from fastapi import FastAPI, BackgroundTasks, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import os
import shortuuid
from io import BytesIO

from utils.database import TalentPipelineDB
from worker import run_sourcing_task
from agents.jd_processor import JDProcessor

app = FastAPI(
    title="Intelligent Sourcing Agent API",
    description="An API to manage and run AI-powered candidate sourcing jobs.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DeleteResponse(BaseModel):
    job_id: str
    acknowledged: bool
    message: str

class DeleteAllResponse(BaseModel):
    deleted_jobs_count: int
    deleted_candidates_count: int
    message: str


class SourcingRequest(BaseModel):
    linkedin_prompt: Optional[str] = Field(None, example="Senior Golang Developer in Bangalore")
    github_prompt: Optional[str] = Field(None, example="Python developer in India with FastAPI contributions")

class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str

db = TalentPipelineDB()
# Lazy initialization of JDProcessor
jd_processor = None

def get_jd_processor():
    global jd_processor
    if jd_processor is None:
        try:
            jd_processor = JDProcessor()
        except Exception as e:
            print(f"Warning: Failed to initialize JDProcessor: {e}")
            print("JD processing will use fallback methods")
    return jd_processor

@app.post("/sourcing-jobs", status_code=202, response_model=JobResponse)
async def create_sourcing_job(request: SourcingRequest, background_tasks: BackgroundTasks):
    if not request.linkedin_prompt and not request.github_prompt:
        raise HTTPException(status_code=400, detail="At least one prompt (linkedin_prompt or github_prompt) must be provided.")

    job_id = shortuuid.uuid()
    db.create_job(job_id, request.linkedin_prompt, request.github_prompt)
    
    background_tasks.add_task(run_sourcing_task, job_id, request.linkedin_prompt, request.github_prompt)
    
    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Sourcing job has been successfully created and is running in the background."
    }

@app.post("/api/saved-candidates/resume")
async def upload_saved_candidate_resume(
    file: UploadFile = File(...),
    job_id: str = Form(...),
    candidate_link: str = Form(...),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    file_id = db.save_resume(content, file.filename, file.content_type or "application/octet-stream", metadata={
        "job_id": job_id,
        "candidate_link": candidate_link,
        "saved": True,
    })
    linked = db.set_resume_for_saved_candidate(job_id, candidate_link, file_id)
    if not linked:
        raise HTTPException(status_code=404, detail="Saved candidate not found to attach resume")
    return {"success": True, "file_id": file_id}

# -------- Saved Candidates API --------
class SaveCandidateRequest(BaseModel):
    job_id: str
    candidate_link: str
    name: Optional[str] = None
    notes: Optional[str] = None
    contacted: bool = False
    review: Optional[int] = Field(None, ge=1, le=5)
    job_title: Optional[str] = None
    email: Optional[str] = None
    linkedin: Optional[str] = None
    # New optional fields for ranking and rationale
    rank: Optional[int] = Field(None, ge=0)
    match_score: Optional[int] = Field(None, ge=0, le=100)
    reasoning: Optional[str] = None
    hired: Optional[bool] = None

def _derive_job_title(job: Optional[dict]) -> Optional[str]:
    if not job:
        return None
    # Prefer structured_jd.job_title if present
    sjd = job.get('structured_jd') if isinstance(job, dict) else None
    if isinstance(sjd, dict) and sjd.get('job_title'):
        return sjd.get('job_title')
    # Try prompts
    text = (job.get('linkedin_prompt') or job.get('github_prompt') or '').strip()
    if not text:
        return None
    lower = text.lower()
    cut_with = lower.find(' with ')
    cut_in = lower.find(' in ')
    cut = -1
    if cut_with != -1 and cut_in != -1:
        cut = min(cut_with, cut_in)
    else:
        cut = cut_with if cut_with != -1 else cut_in
    title = text[:cut].strip() if cut != -1 else text
    return title if title else None

@app.post("/saved-candidates")
async def save_candidate(req: SaveCandidateRequest):
    job = db.get_job(req.job_id)
    title = req.job_title or _derive_job_title(job) or "Untitled Job"
    ok = db.save_candidate_for_job(
        job_id=req.job_id,
        candidate_link=req.candidate_link,
        name=req.name,
        notes=req.notes,
        contacted=req.contacted,
        review=req.review,
        job_title=title,
        email=req.email,
        linkedin=req.linkedin,
        rank=req.rank,
        match_score=req.match_score,
        reasoning=req.reasoning,
        hired=req.hired,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save candidate")
    return {"success": True}

@app.put("/saved-candidates")
async def update_saved_candidate(req: SaveCandidateRequest):
    # Same handler, upsert semantics in DB
    return await save_candidate(req)

@app.get("/saved-candidates")
async def list_saved_candidates(job_id: Optional[str] = None):
    docs = db.get_saved_candidates(job_id)
    return {"items": docs, "total": len(docs)}

@app.get("/saved-candidates/grouped")
async def list_saved_candidates_grouped():
    grouped = db.get_saved_candidates_grouped()
    return {"groups": grouped, "group_count": len(grouped)}

@app.delete("/saved-candidates")
async def delete_saved_candidate(job_id: str, candidate_link: str):
    ok = db.delete_saved_candidate(job_id, candidate_link)
    if not ok:
        raise HTTPException(status_code=404, detail="Saved candidate not found")
    return {"success": True}

# -------- Resume Analyzer --------
from fastapi import UploadFile, File, Form

def _extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(BytesIO(file_bytes))
        text = []
        for page in reader.pages:
            text.append(page.extract_text() or "")
        return "\n".join(text)
    except Exception:
        return ""

def _extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        import docx
        doc = docx.Document(BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        return ""

def _simple_tokenize(s: str) -> set[str]:
    import re
    toks = re.findall(r"[a-zA-Z0-9+#.]+", (s or "").lower())
    stop = {"the","and","in","of","to","a","an","with","for","on","at","by","is","are","as","be"}
    return {t for t in toks if t not in stop}

def _score_resume_against_jd(resume_text: str, jd_obj: dict | None, jd_fallback_text: str | None) -> tuple[int, str]:
    # Build JD text from structured fields if possible
    parts = []
    if jd_obj:
        for k in ("job_title","location","experience_required"):
            v = jd_obj.get(k)
            if v:
                parts.append(str(v))
        skills = jd_obj.get("skills_required") or []
        if isinstance(skills, list):
            parts.extend([str(s) for s in skills])
    jd_text = (" ".join(parts)).strip() or (jd_fallback_text or "")
    R = _simple_tokenize(resume_text)
    J = _simple_tokenize(jd_text)
    if not R or not J:
        return 0, "Insufficient data to compute score"
    overlap = len(R & J)
    denom = len(J)
    score = int(round(100 * overlap / max(denom, 1)))
    reasoning = f"Matched {overlap} of {denom} JD terms."
    return score, reasoning

@app.post("/api/resume/analyze")
async def analyze_resume(file: UploadFile = File(...), job_id: Optional[str] = Form(None)):
    content = await file.read()
    text = ""
    if file.filename.lower().endswith(".pdf"):
        text = _extract_text_from_pdf(content)
    elif file.filename.lower().endswith(".docx"):
        text = _extract_text_from_docx(content)
    if not text:
        # Fallback naive decode
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            text = ""

    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from resume")

    # Select JD: by job_id or last completed
    job = None
    if job_id:
        job = db.get_job(job_id)
    else:
        jobs = db.get_all_jobs()
        for j in jobs:
            if j.get("status") == "completed":
                job = j
                break
    if not job:
        raise HTTPException(status_code=404, detail="No job found to compare against")

    jd_obj = job.get("structured_jd") if isinstance(job, dict) else None
    fallback_text = (job.get("linkedin_prompt") or job.get("github_prompt") or "") if isinstance(job, dict) else ""
    score, reasoning = _score_resume_against_jd(text, jd_obj, fallback_text)

    # Store resume via GridFS
    file_id = db.save_resume(content, file.filename, file.content_type or "application/octet-stream", metadata={
        "job_id": job.get("job_id") if isinstance(job, dict) else None,
        "analyzed": True,
        "score": score,
    })

    return {
        "success": True,
        "job_id": job.get("job_id") if isinstance(job, dict) else None,
        "resume_text_preview": text[:1000],
        "score": score,
        "reasoning": reasoning,
        "file_id": file_id,
    }

@app.get("/sourcing-jobs/{job_id}")
async def get_job_status(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.put("/sourcing-jobs/{job_id}/status")
async def set_job_status(job_id: str, status: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    allowed = {"pending", "running", "completed", "failed", "hired"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status}'")
    db.update_job_status(job_id, status)
    return {"success": True, "job_id": job_id, "status": status}

@app.get("/sourcing-jobs/{job_id}/results")
async def get_job_results(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    results = db.get_candidates_by_job_id(job_id)
    
    # Allow returning results even if job is still running
    if job['status'] == 'failed':
        raise HTTPException(status_code=400, detail=f"Job failed: {job.get('error', 'Unknown error')}")
    elif job['status'] == 'completed':
        return {
            "job_id": job_id,
            "job_details": job,
            "candidate_count": len(results),
            "candidates": results,
            "status": "completed"
        }
    elif job['status'] == 'running' or job['status'] == 'pending':
        # Return whatever results we have so far
        return {
            "job_id": job_id,
            "job_details": job,
            "candidate_count": len(results),
            "candidates": results,
            "status": job['status']
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unknown job status: {job['status']}")

@app.get("/sourcing-jobs")
async def list_all_jobs():
    """
    Get all jobs with their basic info for search history.
    Returns jobs sorted by most recent first.
    """
    jobs = db.get_all_jobs()
    
    # Enhance jobs with candidate counts
    enhanced_jobs = []
    for job in jobs:
        candidate_count = len(db.get_candidates_by_job_id(job['job_id']))
        job['candidate_count'] = candidate_count
        enhanced_jobs.append(job)
    
    return {"jobs": enhanced_jobs}

@app.get("/sourcing-jobs/recent")
async def get_recent_jobs(limit: int = 20):
    """
    Get recent completed jobs for quick access to history.
    """
    all_jobs = db.get_all_jobs()
    completed_jobs = [job for job in all_jobs if job.get('status') == 'completed']
    
    # Return most recent N jobs
    recent_jobs = completed_jobs[:limit]
    
    # Add candidate counts
    for job in recent_jobs:
        candidate_count = len(db.get_candidates_by_job_id(job['job_id']))
        job['candidate_count'] = candidate_count
    
    return {"jobs": recent_jobs, "total": len(completed_jobs)}

@app.get("/sourcing-jobs/recent-with-candidates")
async def get_recent_jobs_with_candidates(limit: int = 20):
    """
    Get recent completed jobs with their candidates for quick access to history.
    """
    all_jobs = db.get_all_jobs()
    completed_jobs = [job for job in all_jobs if job.get('status') == 'completed']
    
    # Return most recent N jobs
    recent_jobs = completed_jobs[:limit]
    
    # Add candidates
    for job in recent_jobs:
        job['candidates'] = db.get_candidates_by_job_id(job['job_id'])
    
    return {"jobs": recent_jobs, "total": len(completed_jobs)}

@app.delete("/sourcing-jobs/{job_id}", response_model=DeleteResponse)
async def delete_sourcing_job(job_id: str):
    """
    Deletes a specific sourcing job and all of its associated candidates.
    """
    # First, verify the job exists to provide a clear 404 error
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    was_deleted = db.delete_job(job_id)
    if not was_deleted:
        # This case is unlikely if the above check passes, but it's good practice
        raise HTTPException(status_code=500, detail="Failed to delete the job.")

    return {
        "job_id": job_id,
        "acknowledged": True,
        "message": f"Job '{job_id}' and all its candidates have been successfully deleted."
    }

@app.delete("/sourcing-jobs", response_model=DeleteAllResponse)
async def delete_all_sourcing_jobs():
    """
    Deletes ALL sourcing jobs and ALL candidates. Use with caution.
    """
    result = db.delete_all_jobs()
    return {
        "deleted_jobs_count": result["deleted_jobs_count"],
        "deleted_candidates_count": result["deleted_candidates_count"],
        "message": "All jobs and candidates have been cleared from the database."
    }

@app.post("/process-jd")
async def process_job_description(
    jd_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Process a job description from text or file (PDF/image) and generate structured data and prompts.
    
    Accepts either:
    - jd_text: Plain text job description
    - file: PDF, image, or text file
    
    Returns structured JD data and generated LinkedIn/GitHub prompts.
    """
    if not jd_text and not file:
        raise HTTPException(status_code=400, detail="Either jd_text or file must be provided.")
    
    try:
        content = None
        content_type = None
        
        if file:
            # Read file content
            file_content = await file.read()
            file_ext = os.path.splitext(file.filename)[1].lower()
            
            # Determine content type based on file extension
            if file_ext in ['.pdf']:
                content_type = 'pdf'
                content = file_content
            elif file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff']:
                content_type = 'image'
                content = file_content
            elif file_ext in ['.txt', '.md']:
                content_type = 'text'
                content = file_content.decode('utf-8')
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")
        else:
            # Use text input
            content_type = 'text'
            content = jd_text
        
        # Process the job description
        processor = get_jd_processor()
        if processor is None:
            # Fallback: return basic structured data without LLM processing
            result = {
                "structured_jd": {
                    "job_title": None,
                    "company": None,
                    "location": None,
                    "experience_required": None,
                    "skills_required": [],
                    "job_type": None,
                    "salary_range": None,
                    "job_description": content if isinstance(content, str) else "Unable to extract text",
                    "requirements": [],
                    "responsibilities": [],
                    "raw_text": content if isinstance(content, str) else "",
                    "content_type": content_type
                },
                "linkedin_prompt": content if isinstance(content, str) else "Software Engineer",
                "github_prompt": content if isinstance(content, str) else "Developer",
                "processing_metadata": {
                    "content_type": content_type,
                    "pipeline_status": "fallback",
                    "jd_parsing_success": False,
                    "prompt_generation_success": False,
                    "error": "GROQ_API_KEY not configured"
                }
            }
        else:
            result = processor.process_job_description(content, content_type)
        
        return {
            "success": True,
            "structured_jd": result.get("structured_jd"),
            "linkedin_prompt": result.get("linkedin_prompt"),
            "github_prompt": result.get("github_prompt"),
            "processing_metadata": result.get("processing_metadata")
        }
        
    except Exception as e:
        import traceback
        print(f"Error processing JD: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process job description: {str(e)}")


@app.post("/generate-prompts")
async def generate_prompts_from_jd(jd_text: str):
    """
    Generate LinkedIn and GitHub prompts from job description text.
    This endpoint accepts raw text and generates optimized prompts.
    """
    if not jd_text:
        raise HTTPException(status_code=400, detail="jd_text is required.")
    
    try:
        # Process the job description
        processor = get_jd_processor()
        if processor is None:
            # Fallback: return basic prompts
            result = {
                "structured_jd": {
                    "job_title": None,
                    "company": None,
                    "location": None,
                    "experience_required": None,
                    "skills_required": [],
                    "job_type": None,
                    "salary_range": None,
                    "job_description": jd_text,
                    "requirements": [],
                    "responsibilities": [],
                    "raw_text": jd_text,
                    "content_type": "text"
                },
                "linkedin_prompt": jd_text,
                "github_prompt": jd_text
            }
        else:
            result = processor.process_job_description(jd_text, 'text')
        
        return {
            "success": True,
            "linkedin_prompt": result.get("linkedin_prompt"),
            "github_prompt": result.get("github_prompt"),
            "structured_jd": result.get("structured_jd")
        }
        
    except Exception as e:
        import traceback
        print(f"Error generating prompts: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate prompts: {str(e)}")

@app.post("/cleanup-old-jobs")
async def cleanup_old_jobs(days_old: int = 30):
    """
    Delete jobs and candidates older than specified days.
    Default: 30 days
    """
    try:
        result = db.cleanup_old_jobs(days_old)
        return {
            "success": True,
            "deleted_jobs": result["deleted_jobs_count"],
            "deleted_candidates": result["deleted_candidates_count"],
            "cutoff_date": result["cutoff_date"],
            "message": f"Cleaned up jobs older than {days_old} days"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup old jobs: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Welcome to the Intelligent Sourcing Agent API"}
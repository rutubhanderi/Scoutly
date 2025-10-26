from fastapi import FastAPI, BackgroundTasks, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import shortuuid
from typing import Optional
import os

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

@app.get("/sourcing-jobs/{job_id}")
async def get_job_status(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

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
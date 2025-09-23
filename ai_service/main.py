from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import shortuuid
from typing import Optional

from utils.database import TalentPipelineDB
from worker import run_sourcing_task

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
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail=f"Job is not yet complete. Current status: {job['status']}")
        
    results = db.get_candidates_by_job_id(job_id)
    return {
        "job_id": job_id,
        "job_details": job,
        "candidate_count": len(results),
        "candidates": results
    }

@app.get("/sourcing-jobs")
async def list_all_jobs():
    jobs = db.get_all_jobs()
    return {"jobs": jobs}


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

@app.get("/")
async def root():
    return {"message": "Welcome to the Intelligent Sourcing Agent API"}
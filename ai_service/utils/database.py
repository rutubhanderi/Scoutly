# utils/database.py
import os
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv
import datetime

load_dotenv()
MONGO_DB_ATLAS_URL = os.getenv("MONGO_DB_ATLAS_URL")

class TalentPipelineDB:
    def __init__(self):
        if not MONGO_DB_ATLAS_URL:
            raise ValueError("MONGO_DB_ATLAS_URL not found in .env file.")
        
        try:
            self.client = MongoClient(MONGO_DB_ATLAS_URL)
            self.db = self.client['talent_pipeline_db']
            
            self.jobs_collection = self.db['jobs']
            self.candidates_collection = self.db['candidates']
            
            self.candidates_collection.create_index([("link", 1), ("job_id", 1)], unique=True)
            
            print("Successfully connected to MongoDB Atlas.")

        except Exception as e:
            print(f"Could not connect to MongoDB Atlas: {e}")
            raise

    def create_job(self, job_id: str, linkedin_prompt: str, github_prompt: str) -> dict:
        job_data = {
            "job_id": job_id,
            "status": "pending",
            "linkedin_prompt": linkedin_prompt,
            "github_prompt": github_prompt,
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }
        self.jobs_collection.insert_one(job_data)
        job_data.pop('_id') 
        return job_data

    def update_job_status(self, job_id: str, status: str):
        self.jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": {"status": status, "updated_at": datetime.datetime.utcnow()}}
        )

    def get_job(self, job_id: str):
        job = self.jobs_collection.find_one({"job_id": job_id}, {'_id': 0})
        return job

    def get_all_jobs(self) -> list:
        jobs = list(self.jobs_collection.find({}, {'_id': 0}).sort("created_at", -1))
        return jobs

    def add_candidate(self, candidate_data: dict, job_id: str):
        candidate_data['job_id'] = job_id
        try:
            self.candidates_collection.insert_one(candidate_data)
            print(f"  -> Added candidate to MongoDB for job {job_id}: {candidate_data.get('name')}")
            return True
        except DuplicateKeyError:
            print(f"  -> Duplicate found for job {job_id}, skipping: {candidate_data.get('name')}")
            return False
        except Exception as e:
            print(f"  -> An error occurred while adding a candidate: {e}")
            return False

    def get_candidates_by_job_id(self, job_id: str) -> list:
        try:
            candidates = list(self.candidates_collection.find({"job_id": job_id}, {'_id': 0}))
            candidates.sort(key=lambda p: p.get('match_score', 0), reverse=True)
            return candidates
        except Exception as e:
            print(f"  -> An error occurred while fetching candidates for job {job_id}: {e}")
            return []

    def delete_job(self, job_id: str) -> bool:
        """Deletes a job and all its associated candidates."""
        # Delete the job document
        job_delete_result = self.jobs_collection.delete_one({"job_id": job_id})
        
        if job_delete_result.deleted_count > 0:
            # If the job was found and deleted, delete its candidates
            self.candidates_collection.delete_many({"job_id": job_id})
            return True
        return False

    def delete_all_jobs(self) -> dict:
        """Deletes all jobs and all candidates from the database."""
        deleted_jobs = self.jobs_collection.delete_many({})
        deleted_candidates = self.candidates_collection.delete_many({})
        return {
            "deleted_jobs_count": deleted_jobs.deleted_count,
            "deleted_candidates_count": deleted_candidates.deleted_count
        }

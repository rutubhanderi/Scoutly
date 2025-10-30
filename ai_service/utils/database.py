# utils/database.py
import os
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv
import datetime
import gridfs

load_dotenv()
MONGO_DB_ATLAS_URL = os.getenv("MONGO_DB_ATLAS_URL")

class TalentPipelineDB:
    def __init__(self):
        if not MONGO_DB_ATLAS_URL:
            raise ValueError("MONGO_DB_ATLAS_URL not found in .env file.")
        
        try:
            self.client = MongoClient(MONGO_DB_ATLAS_URL)
            self.db = self.client['talent_pipeline_db']
            self.fs = gridfs.GridFS(self.db)
            
            self.jobs_collection = self.db['jobs']
            self.candidates_collection = self.db['candidates']
            self.saved_candidates_collection = self.db['saved_candidates']
            
            self.candidates_collection.create_index([("link", 1), ("job_id", 1)], unique=True)
            self.saved_candidates_collection.create_index([("candidate_link", 1), ("job_id", 1)], unique=True)
            
            print("Successfully connected to MongoDB Atlas.")

        except Exception as e:
            print(f"Could not connect to MongoDB Atlas: {e}")
            raise

    def create_job(self, job_id: str, linkedin_prompt: str, github_prompt: str, structured_jd: dict | None = None) -> dict:
        job_data = {
            "job_id": job_id,
            "status": "pending",
            "linkedin_prompt": linkedin_prompt,
            "github_prompt": github_prompt,
            "structured_jd": structured_jd,
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

    # Saved candidates API helpers
    def save_candidate_for_job(self, job_id: str, candidate_link: str, name: str | None, notes: str | None, contacted: bool, review: int | None, job_title: str | None, email: str | None = None, linkedin: str | None = None, resume_file_id: str | None = None, rank: int | None = None, match_score: int | None = None, reasoning: str | None = None, hired: bool | None = None):
        set_doc = {
            "job_id": job_id,
            "candidate_link": candidate_link,
            "name": name,
            "notes": notes,
            "contacted": contacted,
            "review": review,
            "job_title": job_title,
            "email": email,
            "linkedin": linkedin,
            "resume_file_id": resume_file_id,
            "rank": rank,
            "match_score": match_score,
            "reasoning": reasoning,
            "updated_at": datetime.datetime.utcnow(),
        }
        # Only update 'hired' if explicitly provided as boolean
        if isinstance(hired, bool):
            set_doc["hired"] = hired
        try:
            self.saved_candidates_collection.update_one(
                {"job_id": job_id, "candidate_link": candidate_link},
                {"$set": set_doc, "$setOnInsert": {"created_at": datetime.datetime.utcnow()}},
                upsert=True
            )
            # If this candidate is marked hired=True, ensure all other candidates for this job are not hired
            if isinstance(hired, bool) and hired is True:
                self.saved_candidates_collection.update_many(
                    {"job_id": job_id, "candidate_link": {"$ne": candidate_link}},
                    {"$set": {"hired": False, "updated_at": datetime.datetime.utcnow()}}
                )
                # Also reflect this on the job status
                try:
                    self.update_job_status(job_id, "hired")
                except Exception:
                    pass
            return True
        except Exception as e:
            print(f"  -> Failed saving candidate for job {job_id}: {e}")
            return False

    def get_saved_candidates(self, job_id: str | None = None) -> list:
        query = {"job_id": job_id} if job_id else {}
        docs = list(self.saved_candidates_collection.find(query, {'_id': 0}).sort("updated_at", -1))
        return docs

    def get_saved_candidates_grouped(self) -> dict:
        docs = self.get_saved_candidates()
        grouped: dict[str, list] = {}
        for d in docs:
            title = d.get("job_title") or "Untitled Job"
            grouped.setdefault(title, []).append(d)
        # sort each group by rank then updated_at
        for k, arr in grouped.items():
            arr.sort(key=lambda x: (x.get('rank') if isinstance(x.get('rank'), int) else 1_000_000, -x.get('updated_at').timestamp() if x.get('updated_at') else 0))
        return grouped

    def delete_saved_candidate(self, job_id: str, candidate_link: str) -> bool:
        res = self.saved_candidates_collection.delete_one({"job_id": job_id, "candidate_link": candidate_link})
        return res.deleted_count > 0

    # Resume storage with GridFS
    def save_resume(self, file_bytes: bytes, filename: str, content_type: str, metadata: dict | None = None) -> str:
        metadata = metadata or {}
        file_id = self.fs.put(file_bytes, filename=filename, content_type=content_type, metadata=metadata, uploadDate=datetime.datetime.utcnow())
        return str(file_id)

    def set_resume_for_saved_candidate(self, job_id: str, candidate_link: str, file_id: str) -> bool:
        res = self.saved_candidates_collection.update_one(
            {"job_id": job_id, "candidate_link": candidate_link},
            {"$set": {"resume_file_id": file_id, "updated_at": datetime.datetime.utcnow()}}
        )
        return res.matched_count > 0

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

    def cleanup_old_jobs(self, days_old: int = 30) -> dict:
        """
        Deletes jobs and candidates older than specified days.
        Default is 30 days.
        """
        cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=days_old)
        
        # Find old jobs
        old_jobs = list(self.jobs_collection.find({
            "created_at": {"$lt": cutoff_date}
        }))
        
        old_job_ids = [job["job_id"] for job in old_jobs]
        
        # Delete old jobs
        deleted_jobs = self.jobs_collection.delete_many({
            "created_at": {"$lt": cutoff_date}
        })
        
        # Delete associated candidates
        deleted_candidates = 0
        if old_job_ids:
            deleted_candidates = self.candidates_collection.delete_many({
                "job_id": {"$in": old_job_ids}
            }).deleted_count
        
        return {
            "deleted_jobs_count": deleted_jobs.deleted_count,
            "deleted_candidates_count": deleted_candidates,
            "cutoff_date": cutoff_date.isoformat()
        }
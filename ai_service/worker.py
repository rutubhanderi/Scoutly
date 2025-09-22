
from agents.query_architect import QueryArchitect
from agents.data_miner import DataMiner
from agents.profile_ranker import ProfileRanker
from agents.pipeline_manager import PipelineManager
from utils.database import TalentPipelineDB
from config import SERPER_API_KEY

def run_sourcing_task(job_id: str, linkedin_prompt: str, github_prompt: str):
    print(f"Starting background task for job_id: {job_id}")
    db = TalentPipelineDB()
    
    try:
        db.update_job_status(job_id, "running")

        architect = QueryArchitect()
        miner = DataMiner(api_key=SERPER_API_KEY)
        ranker = ProfileRanker()
        manager = PipelineManager(db_instance=db, job_id=job_id)

        campaigns = []
        if linkedin_prompt:
            campaigns.append({"platform": "linkedin", "job_prompt": linkedin_prompt})
        if github_prompt:
            campaigns.append({"platform": "github", "job_prompt": github_prompt})
        
        for campaign in campaigns:
            platform = campaign["platform"]
            job_prompt = campaign["job_prompt"]
            print(f"\n Running campaign for: {platform.upper()} (Job ID: {job_id})")
            
            search_query = architect.create_query(job_prompt, platform=platform)
            
            raw_profiles = miner.search_for_profiles(search_query, platform, job_prompt)
            
            ranked_profiles = ranker.rank_profiles(raw_profiles, job_prompt)
            manager.process_and_store(ranked_profiles)

        db.update_job_status(job_id, "completed")
        print(f"Background task for job_id: {job_id} completed successfully.")

    except Exception as e:
        print(f"Background task for job_id: {job_id} failed: {e}")
        db.update_job_status(job_id, "failed")
from utils.database import TalentPipelineDB

class PipelineManager:
    def __init__(self, db_instance: TalentPipelineDB, job_id: str):
        self.db = db_instance
        self.job_id = job_id
        print(f" Pipeline Manager initialized for job_id: {self.job_id}.")

    def process_and_store(self, ranked_profiles: list):
        print(f"\n[Pipeline Manager] Processing and storing {len(ranked_profiles)} candidates...")
        if not ranked_profiles:
            print("[Pipeline Manager] -> No new profiles to process.")
            return

        for profile in ranked_profiles:
            profile['name'] = profile['name'].title()
            self.db.add_candidate(profile, self.job_id)
            
        print("[Pipeline Manager] -> Finished processing batch.")
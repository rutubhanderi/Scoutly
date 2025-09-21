# agents/pipeline_manager.py
from utils.database import TalentPipelineDB

class PipelineManager:
    """
    Agent 3: The Pipeline Manager 📋
    Processes raw data and stores it in the talent pipeline database.
    This is where contact enrichment would happen in a production system.
    """
    def __init__(self, db_instance: TalentPipelineDB):
        self.db = db_instance
        print("✅ Pipeline Manager initialized.")

    def process_and_store(self, raw_profiles: list):
        """Processes a list of raw profiles and adds them to the database."""
        print("\n[Pipeline Manager] 📇 Processing and storing candidates...")
        if not raw_profiles:
            print("[Pipeline Manager] -> No new profiles to process.")
            return

        for profile in raw_profiles:
            # Simple data cleaning
            profile['name'] = profile['name'].title()
            
            # TODO: Add contact enrichment API call here
            # enriched_contact = enrichment_api.get_contact(profile['name'], profile['link'])
            # profile['email'] = enriched_contact.get('email')
            
            # Storing in the database
            self.db.add_candidate(profile)
            
        print("[Pipeline Manager] -> Finished processing batch.")
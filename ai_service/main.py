# main.py
import json
from agents.query_architect import QueryArchitect
from agents.data_miner import DataMiner
from agents.pipeline_manager import PipelineManager
from utils.database import TalentPipelineDB
from config import SERPER_API_KEY

def run_sourcing_flow():
    """
    Executes the end-to-end intelligent sourcing workflow.
    """
    print("🚀 Starting Intelligent Sourcing Agent System...")
    print("="*50)

    # --- 1. Define the Job ---
    job_prompt = "Find me a Senior Python developer in Pune with experience in FastAPI  and Python."

    # --- 2. Initialize System Components ---
    db = TalentPipelineDB()
    architect = QueryArchitect()
    miner = DataMiner(api_key=SERPER_API_KEY)
    manager = PipelineManager(db_instance=db)
    
    # --- 3. Execute the Agent Workflow ---
    try:
        # Step 1: Query Architect creates a search query from the job prompt.
        search_query = architect.create_query(job_prompt)

        # Step 2: Data Miner fetches raw profiles from the web.
        raw_profiles = miner.search_for_profiles(search_query)
        
        # Step 3: Pipeline Manager processes and stores the results.
        manager.process_and_store(raw_profiles)

        # --- 4. Display Final Results ---
        print("\n✅ Workflow Complete!")
        print("="*50)
        final_pipeline = db.get_all_candidates()
        print(f"✨ Final Talent Pipeline contains {len(final_pipeline)} unique candidates.")
        
        # Pretty-print the final list of candidates using JSON
        print(json.dumps(final_pipeline, indent=2))
        
    except Exception as e:
        print(f"\n🚨 An error occurred during the workflow: {e}")


if __name__ == "__main__":
    run_sourcing_flow()
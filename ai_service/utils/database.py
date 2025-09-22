# utils/database.py
import os
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv

# Load the MongoDB Atlas URL from the environment
load_dotenv()
MONGO_DB_ATLAS_URL = os.getenv("MONGO_DB_ATLAS_URL")

class TalentPipelineDB:
    """
    Connects to a MongoDB Atlas cluster to create a persistent talent pipeline.
    """
    def __init__(self):
        if not MONGO_DB_ATLAS_URL:
            raise ValueError("❌ MONGO_DB_ATLAS_URL not found in .env file.")
        
        try:
            # Establish connection to the MongoDB Atlas cluster
            self.client = MongoClient(MONGO_DB_ATLAS_URL)
            
            # Select the database (will be created if it doesn't exist)
            self.db = self.client['talent_pipeline_db']
            
            # Select the collection (will be created if it doesn't exist)
            self.collection = self.db['candidates']
            
            # IMPORTANT: Create a unique index on the 'link' field.
            # This prevents duplicate profiles at the database level, which is highly efficient.
            self.collection.create_index("link", unique=True)
            
            print("✅ Successfully connected to MongoDB Atlas.")

        except Exception as e:
            print(f"❌ Could not connect to MongoDB Atlas: {e}")
            raise

    def add_candidate(self, candidate_data: dict):
        """
        Adds a candidate to the MongoDB collection.
        Relies on the unique index to prevent duplicates.
        """
        try:
            # Insert the candidate data into the collection
            self.collection.insert_one(candidate_data)
            print(f"  -> Added candidate to MongoDB: {candidate_data.get('name')}")
            return True
        except DuplicateKeyError:
            # This error is expected when a candidate with the same 'link' already exists
            print(f"  -> Duplicate found in MongoDB, skipping: {candidate_data.get('name')}")
            return False
        except Exception as e:
            print(f"  -> An error occurred while adding a candidate: {e}")
            return False

    def get_all_candidates(self) -> list:
        """
        Returns all candidates currently in the pipeline from MongoDB.
        """
        try:
            # The {'_id': 0} projection excludes the MongoDB ObjectId from the result
            candidates = list(self.collection.find({}, {'_id': 0}))
            return candidates
        except Exception as e:
            print(f"  -> An error occurred while fetching candidates: {e}")
            return []
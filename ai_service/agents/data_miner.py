# agents/data_miner.py
import requests
import json
from config import SERPER_API_KEY

class DataMiner:
    """
    Agent 2: The Data Miner ⛏️
    Executes searches using the provided query and retrieves raw profile data.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {'X-API-KEY': self.api_key, 'Content-Type': 'application/json'}
        self.search_url = "https://google.serper.dev/search"
        print("✅ Data Miner initialized.")

    def search_for_profiles(self, query: str) -> list:
        """Performs a search via Serper and returns standardized profile data."""
        print(f"\n[Data Miner] 🔍 Searching with query: {query}")
        payload = json.dumps({"q": query, "num": 10})
        
        try:
            response = requests.post(self.search_url, headers=self.headers, data=payload)
            response.raise_for_status()
            results = response.json().get("organic", [])
            
            profiles = [
                {
                    "name": r.get('title').split('-')[0].strip(), 
                    "title": r.get('title'), 
                    "link": r.get('link'), 
                    "snippet": r.get('snippet'), 
                    "source": "LinkedIn"
                }
                for r in results
            ]
            print(f"[Data Miner] -> Found {len(profiles)} potential profiles.")
            return profiles
        except requests.exceptions.HTTPError as e:
            print(f"❌ HTTP Error while searching: {e}")
            if e.response.status_code == 403:
                print("   This may be due to an invalid API key or insufficient Serper credits.")
        except Exception as e:
            print(f"❌ An unexpected error occurred: {e}")
        return []
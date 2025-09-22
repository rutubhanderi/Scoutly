import requests
import json
from config import GITHUB_ACCESS_TOKEN 

class DataMiner:
    def __init__(self, api_key: str):
        
        self.serper_api_key = api_key
        self.serper_headers = {'X-API-KEY': self.serper_api_key, 'Content-Type': 'application/json'}
        self.search_url = "https://google.serper.dev/search"
      
        self.github_token = GITHUB_ACCESS_TOKEN
        self.github_api_url = "https://api.github.com/search/users"
        self.github_headers = {
            'Authorization': f'token {self.github_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        print("Data Miner initialized.")


    def search_for_profiles(self, query: str, platform: str, job_prompt: str) -> list:
        if platform == 'linkedin':
            return self._search_linkedin(query)
        elif platform == 'github':
            return self._search_github(job_prompt) 
        return []

    def _search_linkedin(self, query: str) -> list:
        """Performs a search via Serper for LinkedIn profiles."""
        print(f"\n[Data Miner] Searching LinkedIn (via Google) with query: {query}")
        payload = json.dumps({"q": query, "num": 10})
        try:
            response = requests.post(self.search_url, headers=self.serper_headers, data=payload)
            response.raise_for_status()
            results = response.json().get("organic", [])
            profiles = [
                {
                    "name": r.get('title').split('-')[0].strip(), "title": r.get('title'), 
                    "link": r.get('link'), "snippet": r.get('snippet'), "source": "LinkedIn"
                } for r in results
            ]
            print(f"[Data Miner] -> Found {len(profiles)} potential profiles from LinkedIn.")
            return profiles
        except Exception as e:
            print(f"An error occurred during LinkedIn search: {e}")
            return []

    def _search_github(self, job_prompt: str) -> list:
        """Performs a search via the official GitHub API."""
        print(f"\n[Data Miner]Searching GitHub (via API) with prompt: {job_prompt}")
        params = { 'q': job_prompt, 'per_page': 10 }
        try:
            response = requests.get(self.github_api_url, headers=self.github_headers, params=params)
            response.raise_for_status()
            results = response.json().get("items", [])
            
            profiles = []
            for item in results:
            
                user_details_resp = requests.get(item['url'], headers=self.github_headers)
                user_details_resp.raise_for_status()
                user_details = user_details_resp.json()
                
                profiles.append({
                    "name": user_details.get('name') or item.get('login'),
                    "title": item.get('login'),
                    "link": item.get('html_url'),
                    "snippet": user_details.get('bio', 'No bio provided.'), 
                    "source": "GitHub API"
                })
            
            print(f"[Data Miner] -> Found {len(profiles)} potential profiles from GitHub API.")
            return profiles
        except Exception as e:
            print(f"An error occurred during GitHub API search: {e}")
            return []
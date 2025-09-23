import requests
import json
import os
from config import GITHUB_ACCESS_TOKEN
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

# Ensure the GROQ_API_KEY is available for the LLM
if not os.getenv("GROQ_API_KEY"):
    print("Warning: GROQ_API_KEY not found in environment. The call in DataMiner might fail.")

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
        
        # Initialize an LLM for parsing the GitHub prompt
        self.model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
        print("Data Miner initialized with Groq LLM for GitHub query generation.")

    def search_for_profiles(self, query: str, platform: str, job_prompt: str) -> list:
        if platform == 'linkedin':
            return self._search_linkedin(query)
        elif platform == 'github':
            # Pass the original, descriptive job_prompt for parsing
            return self._search_github(job_prompt) 
        return []

    def _search_linkedin(self, query: str) -> list:
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
        """
        Performs an intelligent search via the GitHub API by first parsing the
        job prompt into structured keywords and qualifiers.
        """
        print(f"\n[Data Miner] Parsing GitHub prompt with LLM: '{job_prompt}'")
        
        # 1. Use an LLM to extract structured search terms from the prompt
        json_schema = {
            "title": "GitHub User Search Terms",
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "array", 
                    "items": {"type": "string"},
                    "description": "Critical skills, technologies, or roles (e.g., 'FastAPI', 'Golang', 'SRE')."
                },
                "language": {"type": "string", "description": "The primary programming language, if specified."},
                "location": {"type": "string", "description": "The geographical location of the candidate."}
            },
            "required": ["keywords", "location"]
        }
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert GitHub search query builder. Extract key terms from the user's job prompt to find software developers. Default to 'India' if no location is provided."),
            ("human", "{job_prompt}")
        ])
        
        chain = prompt | self.model.with_structured_output(json_schema)
        
        try:
            extracted_data = chain.invoke({"job_prompt": job_prompt})
            print(f"[Data Miner] -> LLM Extracted GitHub Terms: {extracted_data}")
            
            # 2. Construct a targeted search query with qualifiers
            query_parts = extracted_data.get("keywords", [])
            
            if extracted_data.get("language"):
                query_parts.append(f'language:{extracted_data["language"]}')
            
            if extracted_data.get("location"):
                query_parts.append(f'location:{extracted_data["location"]}')

            # ** Add filters to find established, genuine users **
            query_parts.append('followers:>10') # Ensures user has a minimal community presence
            query_parts.append('repos:>5')      # Ensures user has a reasonable amount of work
            
            final_query = " ".join(query_parts)
            print(f"[Data Miner] -> Constructed GitHub API Query: {final_query}")

        except Exception as e:
            print(f"LLM query generation failed: {e}. Falling back to basic prompt.")
            final_query = job_prompt

        # 3. Execute the search with the improved query
        params = {'q': final_query, 'per_page': 10}
        try:
            response = requests.get(self.github_api_url, headers=self.github_headers, params=params)
            response.raise_for_status()
            results = response.json().get("items", [])
            
            profiles = []
            for item in results:
                # The N+1 call is acceptable here to get rich profile data like the bio
                user_details_resp = requests.get(item['url'], headers=self.github_headers)
                user_details_resp.raise_for_status()
                user_details = user_details_resp.json()
                
                profiles.append({
                    "name": user_details.get('name') or item.get('login'),
                    "title": item.get('login'), # Using login as a title fallback
                    "link": item.get('html_url'),
                    "snippet": user_details.get('bio', 'No bio provided.'), 
                    "source": "GitHub"
                })
            
            print(f"[Data Miner] -> Found {len(profiles)} potential profiles from GitHub API.")
            return profiles
        except Exception as e:
            print(f"An error occurred during GitHub API search: {e}")
            return []
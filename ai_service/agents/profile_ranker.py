import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

if not os.getenv("GROQ_API_KEY"):
    print("GROQ_API_KEY not found in environment. The call might fail.")

class ProfileRanker:
    def __init__(self):
        self.model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
        print("Profile Ranker initialized with Groq LLM.")

    def rank_profiles(self, raw_profiles: list, job_prompt: str) -> list:
        if not raw_profiles:
            print("[Profile Ranker] -> No profiles to rank.")
            return []

        print(f"\n[Profile Ranker]  Ranking {len(raw_profiles)} profiles against job prompt...")

        json_schema = {
            "title": "Candidate Score",
            "type": "object",
            "properties": {
                "match_score": {"type": "integer"},
                "reasoning": {"type": "string"}
            },
            "required": ["match_score", "reasoning"]
        }

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert technical recruiter. Your task is to score a candidate's profile based on a job description.
            Analyze the candidate's title and snippet. Provide a match score from 1 (poor match) to 100 (perfect match) and a brief, one-sentence justification.
            Base your score primarily on the skills and experience mentioned in the profile snippet."""),
            ("human", "Job Prompt: {job_prompt}\n\nCandidate Profile:\nTitle: {candidate_title}\nSnippet: {candidate_snippet}")
        ])
        
        chain = prompt | self.model.with_structured_output(json_schema)
        ranked_profiles = []

        for profile in raw_profiles:
            try:
                result = chain.invoke({
                    "job_prompt": job_prompt,
                    "candidate_title": profile.get('title', ''),
                    "candidate_snippet": profile.get('snippet', '')
                })
                profile['match_score'] = result.get('match_score')
                profile['reasoning'] = result.get('reasoning')
                print(f"  -> Scored '{profile['name']}': {profile['match_score']}/100")
            except Exception as e:
                print(f"  -> Could not rank profile for '{profile.get('name', 'Unknown')}': {e}")
                profile['match_score'] = 0
                profile['reasoning'] = "Ranking failed due to an error."
            ranked_profiles.append(profile)
        
        ranked_profiles.sort(key=lambda p: p.get('match_score', 0), reverse=True)
        print("[Profile Ranker] -> Finished ranking all profiles.")
        return ranked_profiles
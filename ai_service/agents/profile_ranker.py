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
            (
                "system",
                """You are an expert technical recruiter. Score how well a candidate matches a job prompt.
                Return:
                - match_score: integer 1-100
                - reasoning: a concise single sentence mentioning the most relevant skills, repos/projects (if provided), and role fit.
                Consider: candidate title, snippet/bio, platform source, and notable GitHub repositories if available.
                Do not exceed one sentence in reasoning. Prefer concrete signals (skills, stack, stars, recency)."""
            ),
            (
                "human",
                "Job Prompt: {job_prompt}\n\nCandidate Profile:\nSource: {candidate_source}\nTitle: {candidate_title}\nSnippet: {candidate_snippet}\nTop Repos: {candidate_repos}"
            ),
        ])
        
        chain = prompt | self.model.with_structured_output(json_schema)
        ranked_profiles = []

        for profile in raw_profiles:
            try:
                repos_list = profile.get('repos') or []
                # Summarize repos as "name(stars)" up to 5
                repos_summary = ", ".join(
                    [
                        f"{r.get('name')}({r.get('stars', 0)})" if isinstance(r, dict) else str(r)
                        for r in repos_list[:5]
                    ]
                ) or "None"

                result = chain.invoke({
                    "job_prompt": job_prompt,
                    "candidate_source": profile.get('source', ''),
                    "candidate_title": profile.get('title', ''),
                    "candidate_snippet": profile.get('snippet', ''),
                    "candidate_repos": repos_summary,
                })
                profile['match_score'] = result.get('match_score')
                profile['reasoning'] = result.get('reasoning')
                print(f"  -> Scored '{profile['name']}': {profile['match_score']}/100")
            except Exception as e:
                print(f"  -> Could not rank profile for '{profile.get('name', 'Unknown')}': {e}")
                profile['match_score'] = profile.get('match_score') or 0
                # Simple fallback reasoning
                fallback_bits = [b for b in [profile.get('title'), profile.get('source')] if b]
                if profile.get('repos'):
                    fallback_bits.append("GitHub repos present")
                profile['reasoning'] = ", ".join(fallback_bits) or "Insufficient data."
            ranked_profiles.append(profile)
        
        ranked_profiles.sort(key=lambda p: p.get('match_score', 0), reverse=True)
        print("[Profile Ranker] -> Finished ranking all profiles.")
        return ranked_profiles
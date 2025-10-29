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
        
        # --- ENHANCED SYSTEM PROMPT ---
        system_prompt = """You are an expert technical recruiter providing a summary for a hiring manager. Your task is to score a candidate's profile against a job prompt and provide a comprehensive, yet concise, reasoning.

        Return a JSON object with two fields:
        - "match_score": An integer from 1 to 100 representing the strength of the match.
        - "reasoning": A brief paragraph (2-3 sentences maximum) explaining your score.

        **Reasoning Guidelines:**
        1.  Start by stating the overall fit and mentioning critical skills from the job prompt that are present in the candidate's title or bio/snippet.
        2.  If GitHub repos are available, highlight 1-2 specific repositories that are highly relevant to the job's technologies. Mention repo names and briefly state why they are relevant (e.g., "the 'Project-X' repo uses FastAPI and Docker").
        3.  Conclude with a brief note on other signals, such as high star counts on a relevant project or a strong alignment in their professional title."""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            (
                "human",
                "Job Prompt: {job_prompt}\n\nCandidate Profile:\nSource: {candidate_source}\nTitle: {candidate_title}\nSnippet: {candidate_snippet}\n\nTop Repos:\n{candidate_repos}"
            ),
        ])
        
        chain = prompt | self.model.with_structured_output(json_schema)
        ranked_profiles = []

        for profile in raw_profiles:
            try:
                # --- Create a more detailed summary of repositories ---
                repos_list = profile.get('repos') or []
                if repos_list:
                    repo_details = [
                        f"- {r.get('name')} ({r.get('stars', 0)} stars): {r.get('description', 'No description.')[:80].strip()}"
                        for r in repos_list[:5] # Limit to top 5 for the prompt
                    ]
                    repos_summary = "\n".join(repo_details)
                else:
                    repos_summary = "None"

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
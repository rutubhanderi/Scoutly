import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

if not os.getenv("GROQ_API_KEY"):
    print("GROQ_API_KEY not found in environment. The call might fail.")

class QueryArchitect:
    def __init__(self):
        self.model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
        print("Query Architect initialized with Groq LLM (llama3-70b-8192).")

    def create_query(self, job_prompt: str, platform: str) -> str:
        print(f"\n[Query Architect]   Processing prompt for {platform.upper()}: '{job_prompt}'")

        if platform == 'linkedin':
            site_directive = 'site:linkedin.com/in/'
            system_prompt = """You are an expert recruitment assistant. Your task is to analyze a job description for a LinkedIn search and extract key information in a clean JSON format.
            Infer seniority from experience requirements. Focus only on the most critical professional skills and the job title. If no location is mentioned, default to Pune, Maharashtra."""
        elif platform == 'github':
            site_directive = 'site:github.com'
            system_prompt = """You are an expert recruitment assistant. Your task is to analyze a job description for a GitHub user search and extract key information in a clean JSON format.
            Focus only on the most critical technical skills, languages, or tools that might appear in repositories. If no location is mentioned, default to Pune, Maharashtra."""
        else:
            raise ValueError("Unsupported platform specified. Use 'linkedin' or 'github'.")

        json_schema = {
            "title": "Extracted Information from Job Description",
            "type": "object",
            "properties": {
                "job_title": {"type": "string"},
                "skills": {"type": "array", "items": {"type": "string"}},
                "location": {"type": "string"}
            },
            "required": ["job_title", "skills", "location"]
        }

        prompt = ChatPromptTemplate.from_messages([("system", system_prompt), ("human", "{job_prompt}")])
        chain = prompt | self.model.with_structured_output(json_schema)

        try:
            extracted_data = chain.invoke({"job_prompt": job_prompt})
            print(f"[Query Architect] -> LLM Extracted Data: {extracted_data}")
            
            job_title = extracted_data.get("job_title", "Software Engineer")
            skills = extracted_data.get("skills", [])
            location = extracted_data.get("location", "Pune")
            
            query_parts = [site_directive, f'"{job_title}"', f'"{location}"']
            query_parts.extend([f'"{skill}"' for skill in skills])
            query = " ".join(query_parts)
            
            print(f"[Query Architect] -> Generated Query: {query}")
            return query
        except Exception as e:
            print(f"Error during LLM processing in QueryArchitect: {e}")
            return f'{site_directive} "{job_prompt}"'
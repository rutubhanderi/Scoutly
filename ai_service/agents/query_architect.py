# agents/query_architect.py
import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_groq import ChatGroq

# Ensure the GROQ_API_KEY is set, though ChatGroq often finds it automatically
if not os.getenv("GROQ_API_KEY"):
    print("⚠️ GROQ_API_KEY not found in environment. The call might fail.")

class QueryArchitect:
    """
    Agent 1: The Upgraded Query Architect 🧠
    Uses a powerful LLM via LangChain and Groq for nuanced understanding of job descriptions.
    """
    def __init__(self):
        # Initialize the Groq LLM, leveraging a powerful and fast model
        self.model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
        print("✅ Query Architect initialized with Groq LLM (llama3-70b-8192).")

    def create_query(self, job_prompt: str) -> str:
        """
        Uses an LLM chain to parse the prompt, extract structured data, and build a search query.
        """
        print(f"\n[Query Architect] 🗣️  Processing prompt with LLM: '{job_prompt}'")

        # Define the desired JSON output structure for the LLM
        json_schema = {
            "title": "Extracted Information from Job Description",
            "description": "Extracts key details for a candidate search query.",
            "type": "object",
            "properties": {
                "job_title": {"type": "string", "description": "The specific, inferred job title. e.g., 'Senior Python Developer'"},
                "skills": {"type": "array", "items": {"type": "string"}, "description": "A list of 3-5 essential technical skills or technologies."},
                "location": {"type": "string", "description": "The primary work location. Default to 'Pimpri-Chinchwad, Maharashtra' if not mentioned."}
            },
            "required": ["job_title", "skills", "location"]
        }

        # Create a LangChain Expression Language (LCEL) chain
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert recruitment assistant. Your task is to analyze a job description and extract key information in a clean JSON format.
            Infer seniority from experience requirements. Focus only on the most critical technical skills. If no location is mentioned, default to Pimpri-Chinchwad, Maharashtra."""),
            ("human", "{job_prompt}")
        ])
        
        # The chain binds the JSON schema to the model, forcing it to return JSON
        chain = prompt | self.model.with_structured_output(json_schema)

        # Invoke the chain to get the structured data
        try:
            extracted_data = chain.invoke({"job_prompt": job_prompt})
            print(f"[Query Architect] -> LLM Extracted Data: {extracted_data}")

            job_title = extracted_data.get("job_title", "Software Engineer")
            skills = extracted_data.get("skills", [])
            location = extracted_data.get("location", "Pimpri-Chinchwad")

            # Construct the final boolean query
            query_parts = ['site:linkedin.com/in/', f'"{job_title}"', f'"{location}"']
            query_parts.extend([f'"{skill}"' for skill in skills])
            query = " ".join(query_parts)
            
            print(f"[Query Architect] -> Generated Query: {query}")
            return query
            
        except Exception as e:
            print(f"❌ Error during LLM processing in QueryArchitect: {e}")
            # Fallback to a simple query if the LLM fails
            return f'site:linkedin.com/in/ "{job_prompt}"'
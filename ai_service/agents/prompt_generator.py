import os
from typing import Dict, Any, Tuple
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

class PromptGenerator:
    """
    Prompt Generator Agent that converts structured job description data
    into optimized prompts for LinkedIn and GitHub searches via Rutu's API
    """
    
    def __init__(self):
        self.model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
        print("Prompt Generator initialized with Groq LLM.")
    
    def generate_linkedin_prompt(self, structured_jd: Dict[str, Any]) -> str:
        """
        Generate optimized LinkedIn search prompt from structured JD data
        """
        print("[Prompt Generator] Generating LinkedIn search prompt")
        
        system_prompt = """You are an expert recruiter specializing in LinkedIn talent sourcing. 
        Your task is to create an optimized LinkedIn search prompt based on the provided job description data.
        
        Guidelines:
        1. Focus on the most important skills and job title
        2. Include location if specified, otherwise default to India
        3. Consider experience level requirements
        4. Make the prompt concise but comprehensive
        5. Use terms that are commonly found on LinkedIn profiles
        6. Prioritize skills that are most critical for the role
        
        Return ONLY the search prompt text, nothing else."""
        
        # Prepare context from structured JD
        context = f"""
        Job Title: {structured_jd.get('job_title', 'Not specified')}
        Company: {structured_jd.get('company', 'Not specified')}
        Location: {structured_jd.get('location', 'Not specified')}
        Experience Required: {structured_jd.get('experience_required', 'Not specified')}
        Skills Required: {', '.join(structured_jd.get('skills_required', []))}
        Job Type: {structured_jd.get('job_type', 'Not specified')}
        Key Requirements: {', '.join(structured_jd.get('requirements', []))}
        Key Responsibilities: {', '.join(structured_jd.get('responsibilities', []))}
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Job Description Data:\n{context}\n\nGenerate an optimized LinkedIn search prompt:")
        ])
        
        chain = prompt | self.model
        
        try:
            response = chain.invoke({"context": context})
            linkedin_prompt = response.content.strip()
            print(f"[Prompt Generator] Generated LinkedIn prompt: {linkedin_prompt}")
            return linkedin_prompt
        except Exception as e:
            print(f"[Prompt Generator] Error generating LinkedIn prompt: {e}")
            # Fallback prompt generation
            return self._generate_fallback_linkedin_prompt(structured_jd)
    
    def generate_github_prompt(self, structured_jd: Dict[str, Any]) -> str:
        """
        Generate optimized GitHub search prompt from structured JD data
        """
        print("[Prompt Generator] Generating GitHub search prompt")
        
        system_prompt = """You are an expert technical recruiter specializing in GitHub talent sourcing.
        Your task is to create an optimized GitHub search prompt based on the provided job description data.
        
        Guidelines:
        1. Focus on technical skills, programming languages, and frameworks
        2. Include location if specified, otherwise default to India
        3. Consider the technical stack and tools mentioned
        4. Make the prompt focused on technologies that would appear in repositories
        5. Prioritize the most critical technical skills
        6. Use terms that developers commonly use in their GitHub profiles and repositories
        
        Return ONLY the search prompt text, nothing else."""
        
        # Prepare context from structured JD, focusing on technical aspects
        technical_skills = [skill for skill in structured_jd.get('skills_required', []) 
                          if any(tech in skill.lower() for tech in 
                               ['python', 'java', 'javascript', 'react', 'node', 'sql', 'aws', 'docker', 
                                'kubernetes', 'git', 'api', 'database', 'framework', 'library', 'tool'])]
        
        context = f"""
        Job Title: {structured_jd.get('job_title', 'Not specified')}
        Location: {structured_jd.get('location', 'Not specified')}
        Experience Required: {structured_jd.get('experience_required', 'Not specified')}
        Technical Skills Required: {', '.join(technical_skills if technical_skills else structured_jd.get('skills_required', []))}
        Key Technical Requirements: {', '.join([req for req in structured_jd.get('requirements', []) if any(tech in req.lower() for tech in ['develop', 'code', 'program', 'build', 'implement', 'technical'])])}
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Job Description Data:\n{context}\n\nGenerate an optimized GitHub search prompt:")
        ])
        
        chain = prompt | self.model
        
        try:
            response = chain.invoke({"context": context})
            github_prompt = response.content.strip()
            print(f"[Prompt Generator] Generated GitHub prompt: {github_prompt}")
            return github_prompt
        except Exception as e:
            print(f"[Prompt Generator] Error generating GitHub prompt: {e}")
            # Fallback prompt generation
            return self._generate_fallback_github_prompt(structured_jd)
    
    def _generate_fallback_linkedin_prompt(self, structured_jd: Dict[str, Any]) -> str:
        """Generate a basic LinkedIn prompt as fallback"""
        job_title = structured_jd.get('job_title') or 'Software Engineer'
        location = structured_jd.get('location') or 'India'
        skills = structured_jd.get('skills_required', [])
        
        prompt_parts = [job_title]
        if location:
            prompt_parts.append(f"in {location}")
        if skills:
            prompt_parts.extend(skills[:3])  # Top 3 skills
        
        return " ".join(prompt_parts)
    
    def _generate_fallback_github_prompt(self, structured_jd: Dict[str, Any]) -> str:
        """Generate a basic GitHub prompt as fallback"""
        job_title = structured_jd.get('job_title') or 'Developer'
        location = structured_jd.get('location') or 'India'
        skills = structured_jd.get('skills_required', [])
        
        # Filter for technical skills
        technical_skills = [skill for skill in skills if any(tech in skill.lower() 
                          for tech in ['python', 'java', 'javascript', 'react', 'node', 'go', 'rust', 'c++'])]
        
        prompt_parts = [job_title.replace('Engineer', 'Developer')]
        if location:
            prompt_parts.append(f"in {location}")
        if technical_skills:
            prompt_parts.extend(technical_skills[:2])  # Top 2 technical skills
        elif skills:
            prompt_parts.extend(skills[:2])  # Top 2 any skills
        
        return " ".join(prompt_parts)
    
    def generate_prompts(self, structured_jd: Dict[str, Any]) -> Tuple[str, str]:
        """
        Generate both LinkedIn and GitHub prompts from structured JD data
        
        Args:
            structured_jd: Structured job description data from JDParser
        
        Returns:
            Tuple of (linkedin_prompt, github_prompt)
        """
        print("[Prompt Generator] Generating prompts for both LinkedIn and GitHub")
        
        try:
            # Check if LLM is available by testing with fallback first
            if structured_jd.get('fallback_used', False):
                print("[Prompt Generator] Using fallback prompt generation (LLM not available)")
                linkedin_prompt = self._generate_fallback_linkedin_prompt(structured_jd)
                github_prompt = self._generate_fallback_github_prompt(structured_jd)
            else:
                # Try LLM-based generation
                try:
                    linkedin_prompt = self.generate_linkedin_prompt(structured_jd)
                    github_prompt = self.generate_github_prompt(structured_jd)
                except Exception as e:
                    print(f"[Prompt Generator] LLM generation failed, using fallback: {e}")
                    linkedin_prompt = self._generate_fallback_linkedin_prompt(structured_jd)
                    github_prompt = self._generate_fallback_github_prompt(structured_jd)
            
            print(f"[Prompt Generator] Successfully generated both prompts")
            return linkedin_prompt, github_prompt
            
        except Exception as e:
            print(f"[Prompt Generator] Error generating prompts: {e}")
            # Return safe fallback prompts
            linkedin_fallback = self._generate_fallback_linkedin_prompt(structured_jd)
            github_fallback = self._generate_fallback_github_prompt(structured_jd)
            return linkedin_fallback, github_fallback

    def validate_and_optimize_prompts(self, linkedin_prompt: str, github_prompt: str, 
                                    structured_jd: Dict[str, Any]) -> Tuple[str, str]:
        """
        Validate and optimize the generated prompts for better search results
        """
        print("[Prompt Generator] Validating and optimizing prompts")
        
        # Basic validation and optimization
        optimized_linkedin = linkedin_prompt
        optimized_github = github_prompt
        
        # Ensure prompts are not too long (limit to ~200 characters for better search)
        if len(optimized_linkedin) > 200:
            words = optimized_linkedin.split()
            optimized_linkedin = " ".join(words[:25])  # Limit to ~25 words
            
        if len(optimized_github) > 200:
            words = optimized_github.split()
            optimized_github = " ".join(words[:25])  # Limit to ~25 words
        
        # Ensure essential information is present
        job_title = structured_jd.get('job_title', '')
        if job_title and job_title.lower() not in optimized_linkedin.lower():
            optimized_linkedin = f"{job_title} {optimized_linkedin}"
            
        if job_title and job_title.lower() not in optimized_github.lower():
            optimized_github = f"{job_title} {optimized_github}"
        
        print(f"[Prompt Generator] Optimized LinkedIn prompt: {optimized_linkedin}")
        print(f"[Prompt Generator] Optimized GitHub prompt: {optimized_github}")
        
        return optimized_linkedin, optimized_github

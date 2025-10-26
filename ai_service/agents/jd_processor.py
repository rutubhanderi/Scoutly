import os
from typing import Union, Dict, Any, Tuple
from .jd_parser import JDParser
from .prompt_generator import PromptGenerator

class JDProcessor:
    """
    Main Job Description Processing Agent that orchestrates the entire pipeline:
    1. Parse JD from various formats (text, PDF, image)
    2. Structure and clean the extracted data
    3. Generate optimized prompts for LinkedIn and GitHub searches
    """
    
    def __init__(self):
        self.jd_parser = JDParser()
        self.prompt_generator = PromptGenerator()
        print("JD Processor initialized with JD Parser and Prompt Generator agents.")
    
    def process_job_description(self, content: Union[str, bytes], content_type: str) -> Dict[str, Any]:
        """
        Complete pipeline to process job description and generate search prompts
        
        Args:
            content: The job description content (text string or bytes for files)
            content_type: 'text', 'pdf', or 'image'
        
        Returns:
            Dictionary containing:
            - structured_jd: Parsed and structured job description data
            - linkedin_prompt: Optimized LinkedIn search prompt
            - github_prompt: Optimized GitHub search prompt
            - processing_metadata: Information about the processing pipeline
        """
        print(f"[JD Processor] Starting complete JD processing pipeline for {content_type}")
        
        try:
            # Step 1: Parse and structure the job description
            print("[JD Processor] Step 1: Parsing job description...")
            structured_jd = self.jd_parser.process_jd(content, content_type)
            
            # Step 2: Generate optimized prompts
            print("[JD Processor] Step 2: Generating search prompts...")
            linkedin_prompt, github_prompt = self.prompt_generator.generate_prompts(structured_jd)
            
            # Step 3: Validate and optimize prompts
            print("[JD Processor] Step 3: Validating and optimizing prompts...")
            optimized_linkedin, optimized_github = self.prompt_generator.validate_and_optimize_prompts(
                linkedin_prompt, github_prompt, structured_jd
            )
            
            # Prepare final result
            result = {
                "structured_jd": structured_jd,
                "linkedin_prompt": optimized_linkedin,
                "github_prompt": optimized_github,
                "processing_metadata": {
                    "content_type": content_type,
                    "pipeline_status": "success",
                    "jd_parsing_success": True,
                    "prompt_generation_success": True,
                    "job_title": structured_jd.get('job_title'),
                    "skills_count": len(structured_jd.get('skills_required', [])),
                    "requirements_count": len(structured_jd.get('requirements', [])),
                    "text_length": len(structured_jd.get('raw_text', ''))
                }
            }
            
            print("[JD Processor] ✅ Complete pipeline executed successfully!")
            print(f"[JD Processor] Generated LinkedIn prompt: {optimized_linkedin}")
            print(f"[JD Processor] Generated GitHub prompt: {optimized_github}")
            
            return result
            
        except Exception as e:
            print(f"[JD Processor] ❌ Error in processing pipeline: {e}")
            
            # Return error result with fallback data
            error_result = {
                "structured_jd": {
                    "job_title": None,
                    "company": None,
                    "location": None,
                    "experience_required": None,
                    "skills_required": [],
                    "job_type": None,
                    "salary_range": None,
                    "job_description": str(content) if content_type == 'text' else "Failed to extract text",
                    "requirements": [],
                    "responsibilities": [],
                    "raw_text": str(content) if content_type == 'text' else "",
                    "content_type": content_type
                },
                "linkedin_prompt": "Software Engineer",
                "github_prompt": "Developer",
                "processing_metadata": {
                    "content_type": content_type,
                    "pipeline_status": "error",
                    "error_message": str(e),
                    "jd_parsing_success": False,
                    "prompt_generation_success": False
                }
            }
            
            return error_result
    
    def process_text_jd(self, text: str) -> Dict[str, Any]:
        """
        Convenience method to process text-based job descriptions
        """
        return self.process_job_description(text, 'text')
    
    def process_pdf_jd(self, pdf_content: bytes) -> Dict[str, Any]:
        """
        Convenience method to process PDF job descriptions
        """
        return self.process_job_description(pdf_content, 'pdf')
    
    def process_image_jd(self, image_content: bytes) -> Dict[str, Any]:
        """
        Convenience method to process image-based job descriptions
        """
        return self.process_job_description(image_content, 'image')
    
    def get_prompts_for_api(self, processing_result: Dict[str, Any]) -> Tuple[str, str]:
        """
        Extract the generated prompts for use with Rutu's API
        
        Args:
            processing_result: Result from process_job_description method
        
        Returns:
            Tuple of (linkedin_prompt, github_prompt)
        """
        linkedin_prompt = processing_result.get('linkedin_prompt', 'Software Engineer')
        github_prompt = processing_result.get('github_prompt', 'Developer')
        
        return linkedin_prompt, github_prompt
    
    def validate_jd_quality(self, structured_jd: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate the quality of the parsed job description
        """
        quality_score = 0
        issues = []
        
        # Check if essential fields are present
        if structured_jd.get('job_title'):
            quality_score += 20
        else:
            issues.append("Missing job title")
        
        if structured_jd.get('skills_required') and len(structured_jd['skills_required']) > 0:
            quality_score += 30
        else:
            issues.append("No skills identified")
        
        if structured_jd.get('requirements') and len(structured_jd['requirements']) > 0:
            quality_score += 20
        else:
            issues.append("No requirements identified")
        
        if structured_jd.get('responsibilities') and len(structured_jd['responsibilities']) > 0:
            quality_score += 15
        else:
            issues.append("No responsibilities identified")
        
        if structured_jd.get('location'):
            quality_score += 10
        
        if structured_jd.get('experience_required'):
            quality_score += 5
        
        # Assess text quality
        raw_text = structured_jd.get('raw_text', '')
        if len(raw_text) > 100:
            quality_score = min(100, quality_score + 10)
        elif len(raw_text) < 50:
            issues.append("Very short job description")
        
        quality_level = "Excellent" if quality_score >= 80 else \
                       "Good" if quality_score >= 60 else \
                       "Fair" if quality_score >= 40 else "Poor"
        
        return {
            "quality_score": quality_score,
            "quality_level": quality_level,
            "issues": issues,
            "recommendations": self._get_quality_recommendations(issues)
        }
    
    def _get_quality_recommendations(self, issues: list) -> list:
        """Generate recommendations based on quality issues"""
        recommendations = []
        
        if "Missing job title" in issues:
            recommendations.append("Ensure the job description includes a clear job title")
        
        if "No skills identified" in issues:
            recommendations.append("Add specific technical and soft skills required for the role")
        
        if "No requirements identified" in issues:
            recommendations.append("Include clear requirements and qualifications")
        
        if "No responsibilities identified" in issues:
            recommendations.append("Add detailed job responsibilities and duties")
        
        if "Very short job description" in issues:
            recommendations.append("Provide a more detailed job description with comprehensive information")
        
        return recommendations

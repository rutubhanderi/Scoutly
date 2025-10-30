import os
import io
import base64
from typing import Union, Dict, Any
import PyPDF2
import pytesseract
from PIL import Image
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

# Configure default paths
POPPLER_PATH = r"C:\Users\parim\Downloads\Release-24.08.0-0\poppler-24.08.0\Library\bin"
TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

class JDParser:
    """
    Job Description Parser Agent that can extract and process text from:
    - Plain text
    - PDF files
    - Images (using OCR)
    """
    
    def __init__(self):
        self.model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
        print("JD Parser initialized with Groq LLM for text processing.")
        
        # Configure Tesseract path
        if os.path.exists(TESSERACT_PATH):
            pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
            print(f"Tesseract configured at: {TESSERACT_PATH}")
        else:
            print(f"Warning: Tesseract not found at {TESSERACT_PATH}")
        
        # Check if Tesseract is available for OCR
        try:
            pytesseract.get_tesseract_version()
            self.ocr_available = True
            print("OCR capability enabled with Tesseract.")
        except Exception as e:
            self.ocr_available = False
            print(f"OCR not available: {e}")
        
        # Configure Poppler path for PDF processing
        if os.path.exists(POPPLER_PATH):
            os.environ["PATH"] += os.pathsep + POPPLER_PATH
            self.poppler_available = True
            print(f"Poppler configured at: {POPPLER_PATH}")
        else:
            self.poppler_available = False
            print(f"Warning: Poppler not found at {POPPLER_PATH}")
    
    def parse_text(self, text: str) -> str:
        """Parse plain text job description"""
        print("[JD Parser] Processing plain text input")
        return text.strip()
    
    def parse_pdf(self, pdf_content: bytes) -> str:
        """Extract text from PDF content"""
        print("[JD Parser] Processing PDF input")
        
        # Try with PyPDF2 first (faster)
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            if text.strip():
                print(f"[JD Parser] Extracted {len(text)} characters from PDF using PyPDF2")
                return text.strip()
            else:
                print("[JD Parser] PyPDF2 extraction yielded no text, trying alternative method...")
                
        except Exception as e:
            print(f"[JD Parser] PyPDF2 extraction failed: {e}")
        
        # Fallback: Try with pdf2image + OCR if Poppler is available
        if self.poppler_available and self.ocr_available:
            try:
                from pdf2image import convert_from_bytes
                
                print("[JD Parser] Converting PDF to images for OCR...")
                images = convert_from_bytes(pdf_content, poppler_path=POPPLER_PATH)
                
                text = ""
                for i, image in enumerate(images):
                    print(f"[JD Parser] Processing page {i+1} with OCR...")
                    page_text = pytesseract.image_to_string(image, lang='eng')
                    if page_text.strip():
                        text += page_text + "\n"
                
                if text.strip():
                    print(f"[JD Parser] Extracted {len(text)} characters from PDF using OCR")
                    return text.strip()
                    
            except ImportError:
                print("[JD Parser] pdf2image not available. Install with: pip install pdf2image")
            except Exception as e:
                print(f"[JD Parser] PDF to image conversion failed: {e}")
        
        # If all methods fail
        raise Exception("Failed to extract text from PDF. The PDF might be image-based or corrupted.")
    
    def parse_image(self, image_content: bytes) -> str:
        """Extract text from image using OCR"""
        print("[JD Parser] Processing image input with OCR")
        
        if not self.ocr_available:
            raise Exception("OCR functionality not available. Please install Tesseract.")
        
        try:
            image = Image.open(io.BytesIO(image_content))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Enhance image for better OCR (optional preprocessing)
            # You can add image enhancement here if needed
            
            # Extract text using OCR
            text = pytesseract.image_to_string(image, lang='eng')
            
            if not text.strip():
                raise Exception("No text found in image")
            
            print(f"[JD Parser] Extracted {len(text)} characters from image")
            return text.strip()
        except Exception as e:
            print(f"[JD Parser] Error parsing image: {e}")
            raise Exception(f"Failed to parse image: {str(e)}")
    
    def clean_and_structure_jd(self, raw_text: str) -> Dict[str, Any]:
        """
        Use LLM to clean and structure the extracted job description text
        """
        print("[JD Parser] Cleaning and structuring job description with LLM")
        
        system_prompt = """You are an expert HR assistant. Your task is to analyze raw job description text and extract structured information.
        
        The input text might be messy, contain OCR errors, or have formatting issues. Clean it up and extract the key information.
        
        Return the information in a clean JSON format with the following structure:
        - job_title: The main job title/position
        - company: Company name (if mentioned)
        - location: Job location (if mentioned)
        - experience_required: Years of experience required
        - skills_required: List of technical and soft skills
        - job_type: Full-time, Part-time, Contract, etc.
        - salary_range: Salary information (if mentioned)
        - job_description: Clean, well-formatted job description
        - requirements: List of key requirements
        - responsibilities: List of key responsibilities
        
        If any field is not found in the text, use null for that field."""
        
        json_schema = {
            "title": "Structured Job Description",
            "type": "object",
            "properties": {
                "job_title": {"type": ["string", "null"]},
                "company": {"type": ["string", "null"]},
                "location": {"type": ["string", "null"]},
                "experience_required": {"type": ["string", "null"]},
                "skills_required": {"type": "array", "items": {"type": "string"}},
                "job_type": {"type": ["string", "null"]},
                "salary_range": {"type": ["string", "null"]},
                "job_description": {"type": "string"},
                "requirements": {"type": "array", "items": {"type": "string"}},
                "responsibilities": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["job_description", "skills_required", "requirements", "responsibilities"]
        }
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Raw job description text:\n\n{raw_text}")
        ])
        
        chain = prompt | self.model.with_structured_output(json_schema)
        
        try:
            structured_data = chain.invoke({"raw_text": raw_text})
            print(f"[JD Parser] Successfully structured job description")
            return structured_data
        except Exception as e:
            print(f"[JD Parser] Error structuring JD with LLM: {e}")
            # Enhanced fallback: use rule-based extraction
            return self._fallback_structure_jd(raw_text)
    
    def _fallback_structure_jd(self, raw_text: str) -> Dict[str, Any]:
        """
        Fallback method to structure JD using rule-based extraction when LLM fails
        """
        print("[JD Parser] Using fallback rule-based structuring")
        
        # Clean and prepare text
        text_lower = raw_text.lower()
        lines = raw_text.split('\n')
        
        # Extract job title (improved logic)
        job_title = None
        title_keywords = [
            'engineer', 'developer', 'manager', 'analyst', 'specialist', 'lead', 
            'senior', 'junior', 'intern', 'associate', 'director', 'coordinator',
            'consultant', 'architect', 'designer', 'administrator', 'officer'
        ]
        
        # Look for job title in first few lines or lines with "title", "position", "role"
        for i, line in enumerate(lines[:10]):
            line_clean = line.strip()
            if not line_clean:
                continue
                
            # Skip common headers
            if any(skip in line_clean.lower() for skip in ['job description', 'overview', 'about', 'requirements']):
                continue
                
            # Check if line contains job title keywords
            if any(keyword in line_clean.lower() for keyword in title_keywords):
                # Clean up the title
                job_title = line_clean
                # Remove common prefixes
                for prefix in ['job title:', 'position:', 'role:', 'title:']:
                    if job_title.lower().startswith(prefix):
                        job_title = job_title[len(prefix):].strip()
                break
            
            # If it's one of the first 3 lines and looks like a title
            if i < 3 and len(line_clean.split()) <= 6 and len(line_clean) > 5:
                job_title = line_clean
                break
        
        # Extract company name (improved logic)
        company = None
        company_indicators = ['company:', 'organization:', 'employer:', 'at ', 'inc.', 'ltd.', 'corp.', 'llc', 'pvt']
        
        for line in lines[:15]:  # Check first 15 lines
            line_clean = line.strip()
            if not line_clean:
                continue
                
            line_lower = line_clean.lower()
            
            # Direct company indicators
            for indicator in ['company:', 'organization:', 'employer:']:
                if indicator in line_lower:
                    company = line_clean.split(':', 1)[1].strip()
                    break
            
            # Look for company suffixes
            if any(suffix in line_lower for suffix in ['inc.', 'ltd.', 'corp.', 'llc', 'pvt', 'technologies', 'solutions']):
                # Avoid lines that are too long (likely descriptions)
                if len(line_clean.split()) <= 8:
                    company = line_clean
                    break
        
        # Extract location (improved logic)
        location = None
        location_keywords = [
            # Indian cities
            'bangalore', 'mumbai', 'delhi', 'pune', 'hyderabad', 'chennai', 'kolkata', 
            'ahmedabad', 'surat', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore',
            'gurgaon', 'gurugram', 'noida', 'faridabad', 'ghaziabad',
            # International
            'new york', 'san francisco', 'london', 'singapore', 'dubai', 'toronto',
            'sydney', 'berlin', 'paris', 'tokyo', 'remote', 'work from home', 'wfh',
            # Countries
            'india', 'usa', 'uk', 'canada', 'australia', 'germany', 'france'
        ]
        
        location_indicators = ['location:', 'based in:', 'office:', 'city:', 'address:']
        
        for line in lines:
            line_clean = line.strip()
            line_lower = line_clean.lower()
            
            # Direct location indicators
            for indicator in location_indicators:
                if indicator in line_lower:
                    location = line_clean.split(':', 1)[1].strip()
                    break
            
            # Look for location keywords
            if not location:
                for loc_keyword in location_keywords:
                    if loc_keyword in line_lower:
                        # Extract the relevant part
                        if len(line_clean.split()) <= 10:  # Avoid long descriptions
                            location = line_clean
                        else:
                            # Try to extract just the location part
                            words = line_clean.split()
                            for i, word in enumerate(words):
                                if loc_keyword in word.lower():
                                    # Take a few words around the location
                                    start = max(0, i-2)
                                    end = min(len(words), i+3)
                                    location = ' '.join(words[start:end])
                                    break
                        break
            
            if location:
                break
        
        # Extract experience (improved patterns)
        experience_required = None
        import re
        
        # More comprehensive experience patterns
        experience_patterns = [
            r'(\d+[\+\-\s]*(?:to|\-|–)\s*\d+|\d+\+?)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)',
            r'(?:experience|exp)[\s:]*(\d+[\+\-\s]*(?:to|\-|–)\s*\d+|\d+\+?)\s*(?:years?|yrs?)',
            r'(\d+[\+\-\s]*(?:to|\-|–)\s*\d+|\d+\+?)\s*(?:years?|yrs?)',
            r'(?:minimum|min|at least)\s*(\d+)\s*(?:years?|yrs?)',
            r'(\d+)\s*(?:years?|yrs?)\s*(?:minimum|min|experience|exp)'
        ]
        
        for pattern in experience_patterns:
            match = re.search(pattern, text_lower)
            if match:
                experience_required = match.group(1) if len(match.groups()) > 0 else match.group(0)
                experience_required = experience_required.strip()
                break
        
        # If no numeric pattern found, look for text patterns
        if not experience_required:
            exp_text_patterns = [
                'entry level', 'fresher', 'fresh graduate', 'no experience',
                'junior level', 'mid level', 'senior level', 'experienced'
            ]
            for pattern in exp_text_patterns:
                if pattern in text_lower:
                    experience_required = pattern.title()
                    break
        
        # Extract skills (enhanced)
        skill_keywords = [
            # Programming languages
            'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin',
            # Web technologies
            'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'fastapi', 'spring', 'laravel',
            # Databases
            'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sqlite',
            # Cloud & DevOps
            'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git', 'github', 'gitlab', 'ci/cd',
            # Data & Analytics
            'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'tableau', 'power bi', 'excel',
            # Other technologies
            'api', 'rest', 'graphql', 'microservices', 'agile', 'scrum', 'jira', 'confluence',
            # Business skills
            'project management', 'business analysis', 'requirements gathering', 'stakeholder management'
        ]
        
        skills_found = []
        for skill in skill_keywords:
            if skill.lower() in text_lower:
                skills_found.append(skill.title())
        
        # Remove duplicates and limit to reasonable number
        skills_found = list(dict.fromkeys(skills_found))[:15]
        
        # Extract requirements and responsibilities (improved)
        requirements = []
        responsibilities = []
        
        current_section = None
        section_keywords = {
            'requirements': ['requirement', 'qualification', 'must have', 'should have', 'skills', 'competenc', 'prerequisite'],
            'responsibilities': ['responsibility', 'duties', 'role', 'will be', 'tasks', 'job duties', 'what you will do']
        }
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue
                
            line_lower = line.lower()
            
            # Detect section headers
            for section, keywords in section_keywords.items():
                if any(keyword in line_lower for keyword in keywords) and len(line.split()) <= 8:
                    current_section = section
                    break
            
            # Extract bullet points
            if line.startswith(('-', '•', '*', '◦')) or (line[0].isdigit() and line[1:3] in ['. ', ') ']):
                cleaned_line = line[1:].strip() if line[0] in '-•*◦' else line[2:].strip()
                
                if len(cleaned_line) > 10:  # Meaningful content
                    if current_section == 'requirements':
                        requirements.append(cleaned_line)
                    elif current_section == 'responsibilities':
                        responsibilities.append(cleaned_line)
        
        # Clean up extracted data
        if company:
            company = company.replace('Company:', '').replace('Organization:', '').strip()
        if location:
            location = location.replace('Location:', '').replace('Based in:', '').strip()
        
        return {
            "job_title": job_title,
            "company": company,
            "location": location,
            "experience_required": experience_required,
            "skills_required": skills_found,
            "job_type": None,
            "salary_range": None,
            "job_description": raw_text,
            "requirements": requirements[:10],  # Limit to 10 items
            "responsibilities": responsibilities[:10],  # Limit to 10 items
            "fallback_used": True  # Flag to indicate fallback was used
        }

    def process_jd(self, content: Union[str, bytes], content_type: str) -> Dict[str, Any]:
        """
        Main method to process job description from various formats
        
        Args:
            content: The job description content (text string or bytes for files)
            content_type: 'text', 'pdf', or 'image'
        
        Returns:
            Structured job description data
        """
        print(f"[JD Parser] Starting to process JD of type: {content_type}")
        
        try:
            # Extract raw text based on content type
            if content_type == 'text':
                raw_text = self.parse_text(content)
            elif content_type == 'pdf':
                raw_text = self.parse_pdf(content)
            elif content_type == 'image':
                raw_text = self.parse_image(content)
            else:
                raise ValueError(f"Unsupported content type: {content_type}")
            
            # Structure the extracted text
            structured_jd = self.clean_and_structure_jd(raw_text)
            structured_jd['raw_text'] = raw_text
            structured_jd['content_type'] = content_type
            
            print(f"[JD Parser] Successfully processed {content_type} JD")
            return structured_jd
            
        except Exception as e:
            print(f"[JD Parser] Error processing JD: {e}")
            raise Exception(f"Failed to process job description: {str(e)}")
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get information about available tools and configurations"""
        return {
            "tesseract_path": TESSERACT_PATH,
            "tesseract_available": self.ocr_available,
            "poppler_path": POPPLER_PATH,
            "poppler_available": self.poppler_available,
            "supported_formats": ["text", "pdf", "image"],
            "pdf_methods": ["PyPDF2", "pdf2image+OCR"] if self.poppler_available else ["PyPDF2"],
            "ocr_languages": ["eng"] if self.ocr_available else []
        }

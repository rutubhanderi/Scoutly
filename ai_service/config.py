import os
from dotenv import load_dotenv
load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")
GITHUB_ACCESS_TOKEN = os.getenv("GITHUB_ACCESS_TOKEN") 

if not SERPER_API_KEY:
    raise ValueError("SERPER_API_KEY not found in .env file. Please add it.")

if not GITHUB_ACCESS_TOKEN:
    raise ValueError("GITHUB_ACCESS_TOKEN not found in .env file. Please add it.")
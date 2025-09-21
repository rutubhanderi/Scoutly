# config.py
import os
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

if not SERPER_API_KEY:
    raise ValueError("❌ SERPER_API_KEY not found in .env file. Please add it.")
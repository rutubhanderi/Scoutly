
import os
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- JWT Configuration ---
SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

# Ensure the JWT_SECRET is set, otherwise the application cannot be secure.
if not SECRET_KEY:
    raise ValueError("JWT_SECRET not found in .env file. Please add it to secure your API.")

# HTTPBearer is a security scheme that looks for a "Bearer" token in the Authorization header.
oauth2_scheme = HTTPBearer()

async def verify_token(request: Request, credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme)):
    """
    A FastAPI dependency that verifies the JWT token from the Authorization header.
    """
    
    # --- TEMPORARY DEBUGGING ---
    print("\n[AUTH DEBUG] Verifying token...")
    print(f"[AUTH DEBUG] Incoming Headers: {request.headers}")
    # --- END DEBUGGING ---

    token = credentials.credentials
    try:
        # Decode the token using the secret key and specified algorithm
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        user_id: str = payload.get("userId")
        if user_id is None:
            print("[AUTH DEBUG] Validation failed: userId missing in payload.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials, user identifier missing in token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print(f"[AUTH DEBUG] Token successfully validated for user: {user_id}")
        return payload
        
    except JWTError as e:
        # This catches errors like invalid signature, expired token, etc.
        print(f"[AUTH DEBUG] JWT Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
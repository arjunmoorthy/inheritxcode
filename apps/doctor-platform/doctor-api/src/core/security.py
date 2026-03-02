from jose import jwt, JWTError
from fastapi import HTTPException, status
from datetime import datetime, timedelta
from core.config import settings

SECRET_KEY = settings.jwt_secret_key
ALGORITHM = "HS256"

def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
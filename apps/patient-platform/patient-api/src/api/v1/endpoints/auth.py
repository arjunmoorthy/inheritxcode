"""
Authentication Endpoints - Patient API
=======================================

Complete authentication endpoints:
- POST /signup: Register new user (AWS Cognito + local DB)
- POST /login: Authenticate with email/password (local User + JWT, same as doctor-api)
- POST /complete-new-password: Complete password setup (Cognito)
- POST /logout: Client-side logout acknowledgment
- DELETE /delete-patient: Delete patient account

Rate Limiting:
- Login: 5 attempts per minute (prevents brute force)
- Signup: 5 attempts per minute
- Password reset: 3 attempts per minute
"""

from datetime import datetime, timezone, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional

from api.deps import get_patient_db, get_doctor_db
from core.config import settings
from core.exceptions import (
    ConflictError,
    NotFoundError,
    AuthenticationError,
    ValidationError,
    ExternalServiceError,
)
from core.logging import get_logger
from core.middleware.rate_limiting import limiter, AUTH_RATE_LIMIT, PASSWORD_RESET_LIMIT
from core.schemas import APIResponse, ErrorResponse
from db.models import User, PatientProfile
from db.doctor_models import DoctorUser, DoctorStaff, DoctorPatient
from services import AuthService

logger = get_logger(__name__)

router = APIRouter()


# =============================================================================
# Password helpers (local auth, same as doctor-api)
# =============================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


# =============================================================================
# Request/Response Schemas
# =============================================================================

class SignupRequest(BaseModel):
    """Request model for user signup."""
    email: EmailStr
    first_name: str
    last_name: str
    physician_email: Optional[str] = None


class SignupResponse(BaseModel):
    """Response model for successful signup."""
    message: str
    email: str
    user_status: str


class LoginRequest(BaseModel):
    """Request model for user login."""
    email: EmailStr
    password: str


class AuthTokens(BaseModel):
    """JWT tokens returned on successful authentication."""
    access_token: str
    refresh_token: str
    id_token: str
    token_type: str = "Bearer"


class UserDetail(BaseModel):
    """User details returned in login response (no password). Same as doctor-api."""
    id: int
    uuid: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    auth_provider: str
    is_active: bool
    is_verified: bool
    is_first_login: bool = False
    last_login_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    staff_id: Optional[int] = None
    patient_id: Optional[int] = None


class LoginData(BaseModel):
    """Login response data: tokens + user details (same shape as doctor-api)."""
    tokens: AuthTokens
    user: UserDetail


class LoginResponse(BaseModel):
    """Response model for login attempt (Cognito flow; kept for complete-new-password)."""
    valid: bool
    message: str
    user_status: Optional[str] = None
    tokens: Optional[AuthTokens] = None
    session: Optional[str] = None


class CompleteNewPasswordRequest(BaseModel):
    """Request model for completing password setup."""
    email: EmailStr
    new_password: str
    session: str


class CompleteNewPasswordResponse(BaseModel):
    """Response model for successful password completion."""
    message: str
    tokens: AuthTokens


class DeletePatientRequest(BaseModel):
    """Request model for patient deletion."""
    email: Optional[str] = None
    uuid: Optional[str] = None
    skip_aws: bool = False


class LogoutResponse(BaseModel):
    """Response model for logout."""
    message: str


# =============================================================================
# JWT helpers (same as doctor-api)
# =============================================================================

def _get_jwt_secret() -> str:
    key = settings.jwt_secret_key
    if not key:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET_KEY not configured. Set it in .env for JWT token creation.",
        )
    return key


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=settings.jwt_algorithm)


def create_id_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "id"})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=settings.jwt_algorithm)


# =============================================================================
# Endpoints
# =============================================================================

@router.post(
    "/signup",
    response_model=SignupResponse,
    summary="Register new user",
    description="Create a new user in AWS Cognito and local database."
)
@limiter.limit(AUTH_RATE_LIMIT)
async def signup_user(
    request: Request,
    body: SignupRequest,
    patient_db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
) -> SignupResponse:
    """
    Create a new user account.
    
    Creates the user in:
    1. AWS Cognito (authentication)
    2. Local database (patient info & config)
    3. Physician association
    
    A temporary password will be sent to the user's email.
    """
    logger.info(f"Signup request: email={body.email}")
    
    auth_service = AuthService(patient_db, doctor_db)
    
    try:
        result = auth_service.signup(
            email=body.email,
            first_name=body.first_name,
            last_name=body.last_name,
            physician_email=body.physician_email,
        )
        
        return SignupResponse(
            message=result["message"],
            email=result["email"],
            user_status=result["user_status"],
        )
        
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ExternalServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/login",
    response_model=APIResponse[LoginData],
    summary="User login",
    description="Authenticate with email/password (local User). Returns JWT tokens and user details, same as doctor-api.",
)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(
    request: Request,
    body: LoginRequest,
    doctor_db: Session = Depends(get_doctor_db),
):
    """
    Same login API as doctor-api: authenticate with email/password.
    User is fetched from the doctor-api users table (same User model).
    Request/response and error format match doctor-api POST /auth/login.
    """
    logger.info(f"Login request: email={body.email}")

    user = doctor_db.query(DoctorUser).filter(DoctorUser.email == body.email).first()

    if not user or not user.password_hash:
        return JSONResponse(
            status_code=401,
            content=ErrorResponse(
                success=False,
                message="Invalid email or password.",
                details=None,
                status_code=401,
            ).model_dump(),
        )

    if not user.is_active:
        return JSONResponse(
            status_code=403,
            content=ErrorResponse(
                success=False,
                message="User account is inactive. Please contact support.",
                details=None,
                status_code=403,
            ).model_dump(),
        )

    if not verify_password(body.password, user.password_hash):
        return JSONResponse(
            status_code=401,
            content=ErrorResponse(
                success=False,
                message="Invalid email or password.",
                details=None,
                status_code=401,
            ).model_dump(),
        )

    # Only users with role "patient" can log in to the patient portal
    if (user.role or "").lower() != "patient":
        return JSONResponse(
            status_code=403,
            content=ErrorResponse(
                success=False,
                message="Only patient users can log in to the patient portal.",
                details=None,
                status_code=403,
            ).model_dump(),
        )

    user.last_login_at = datetime.now(timezone.utc)
    doctor_db.commit()

    token_data = {
        "sub": str(user.uuid),
        "email": user.email,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    id_token = create_id_token(token_data)

    first_name = user.first_name
    last_name = user.last_name
    full_name = " ".join(p for p in [first_name, last_name] if p) or None

    staff = doctor_db.query(DoctorStaff).filter(DoctorStaff.user_id == user.id).first()
    patient = doctor_db.query(DoctorPatient).filter(DoctorPatient.user_id == user.id).first()

    user_detail = UserDetail(
        id=user.id,
        uuid=str(user.uuid),
        email=user.email,
        first_name=first_name,
        last_name=last_name,
        full_name=full_name,
        role=user.role,
        auth_provider=user.auth_provider,
        is_active=user.is_active,
        is_verified=user.is_verified,
        is_first_login=user.is_first_login,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        created_at=user.created_at.isoformat() if user.created_at else None,
        updated_at=user.updated_at.isoformat() if user.updated_at else None,
        staff_id=staff.id if staff else None,
        patient_id=patient.id if patient else None,
    )

    payload = APIResponse(
        success=True,
        message="Login successful.",
        data=LoginData(
            tokens=AuthTokens(
                access_token=access_token,
                refresh_token=refresh_token,
                id_token=id_token,
            ),
            user=user_detail,
        ),
    )
    return JSONResponse(status_code=200, content=payload.model_dump())


class ChangePasswordRequest(BaseModel):
    """Request body for changing password. Same shape as doctor-api; targets doctor DB users table."""
    email: EmailStr
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match.")
        return self


@router.post(
    "/change-password",
    summary="Change password",
    description="Change password for patient users. Targets the doctor-api users table (same as login).",
)
@limiter.limit(PASSWORD_RESET_LIMIT)
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    doctor_db: Session = Depends(get_doctor_db),
):
    """
    Change password for patient users.
    Uses the doctor DB users table (same as login); patient users are stored there.
    Uses temp password sent via email as current_password for first-time setup.
    """
    logger.info(f"Change password request: email={body.email}")

    current_password = (body.current_password or "").strip()
    if not current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is required.",
        )

    user = (
        doctor_db.query(DoctorUser)
        .filter(DoctorUser.email == body.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # 🔐 Validate current password (same bcrypt verification as login)
    if not user.password_hash or not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    user.password_hash = hash_password(body.new_password)
    user.is_first_login = False
    doctor_db.commit()

    return JSONResponse(
        status_code=200,
        content={"status": "success", "message": "Password changed successfully."},
    )


@router.post(
    "/complete-new-password",
    response_model=CompleteNewPasswordResponse,
    summary="Complete password setup",
    description="Complete new password setup for users with temporary passwords."
)
@limiter.limit(PASSWORD_RESET_LIMIT)
async def complete_new_password(
    request: Request,
    body: CompleteNewPasswordRequest,
    patient_db: Session = Depends(get_patient_db),
) -> CompleteNewPasswordResponse:
    """
    Complete the new password setup for a user who was
    created with a temporary password.
    """
    logger.info(f"Complete new password: email={body.email}")
    
    auth_service = AuthService(patient_db)
    
    try:
        result = auth_service.complete_new_password(
            email=body.email,
            new_password=body.new_password,
            session=body.session,
        )
        
        return CompleteNewPasswordResponse(
            message=result["message"],
            tokens=AuthTokens(**result["tokens"]),
        )
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ExternalServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Logout user",
    description="Client-side logout acknowledgment."
)
async def logout() -> LogoutResponse:
    """
    Client-side logout.
    
    The real action is the client deleting the token.
    This endpoint is a formality for logging.
    """
    logger.info("Logout request")
    
    auth_service = AuthService(None)  # No DB needed
    result = auth_service.logout()
    
    return LogoutResponse(message=result["message"])


@router.delete(
    "/delete-patient",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete patient account",
    description="Soft delete patient account and all associated data."
)
async def delete_patient(
    request: DeletePatientRequest,
    patient_db: Session = Depends(get_patient_db),
) -> None:
    """
    Delete all data for the specified user.
    
    Can delete by email or UUID.
    Optionally skips AWS Cognito deletion.
    
    This is an irreversible action.
    """
    logger.warning(f"Delete patient request: email={request.email} uuid={request.uuid}")
    
    auth_service = AuthService(patient_db)
    
    try:
        auth_service.delete_patient(
            email=request.email,
            uuid=request.uuid,
            skip_aws=request.skip_aws,
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ExternalServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/me",
    summary="Get current user",
    description="Get current authenticated user info from token."
)
async def get_me(
    # current_user = Depends(get_current_user)  # Enable when auth is ready
) -> Dict[str, Any]:
    """
    Get current authenticated user info.
    """
    # Placeholder - enable with proper auth dependency
    return {
        "message": "Use Cognito token to get user info",
        "hint": "Pass Authorization: Bearer <token> header"
    }

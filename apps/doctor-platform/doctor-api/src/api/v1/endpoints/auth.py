"""
Authentication Endpoints - Doctor API
=====================================

Complete authentication endpoints:
- POST /signup: Register new staff member (Cognito)
- POST /signup/staff: Manual staff signup with password
- POST /auth/google/signup: Google SSO signup
- POST /login: Authenticate with email/password
- POST /complete-new-password: Complete password setup
- POST /logout: Logout (client-side token removal)
- DELETE /delete-user: Delete staff account

Rate Limiting:
- Login: 5 attempts per minute (prevents brute force)
- Signup: 5 attempts per minute
- Password reset: 3 attempts per minute
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy.orm import Session
from typing import Optional
from uuid import uuid4, UUID
import boto3
from botocore.exceptions import ClientError
import bcrypt
import secrets
from datetime import datetime, timezone, timedelta
from jose import jwt

# Import models from unified models package
from db.models import User, Staff, Clinic, StaffClinic

from api.deps import get_doctor_db_session, get_patient_db_session, get_current_user, TokenData
from services import AuthService
from core.exceptions import (
    AuthenticationError,
    ExternalServiceError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from core.logging import get_logger
from core.middleware.rate_limiting import limiter, AUTH_RATE_LIMIT, PASSWORD_RESET_LIMIT
from google.oauth2 import id_token
from google.auth.transport import requests
from helpers.email import send_reset_password_email
from core.schemas import APIResponse, ErrorResponse
from core.config import settings

logger = get_logger(__name__)
now = datetime.now(timezone.utc)


# =============================================================================
# Password Hashing Utilities
# =============================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class SignupRequest(BaseModel):
    """Signup request for new staff member."""
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "staff"  # staff, physician, admin
    clinic_uuid: int


class SignupResponse(BaseModel):
    """Signup response."""
    message: str
    email: str
    user_status: str


class LoginRequest(BaseModel):
    """Login request with email and password."""
    email: EmailStr
    password: str


class AuthTokens(BaseModel):
    """JWT tokens returned after successful authentication."""
    access_token: str
    refresh_token: str
    id_token: str
    token_type: str = "Bearer"

class ClinicResponse(BaseModel):
    id: int
    uuid: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None

    class Config:
        from_attributes = True

class UserDetail(BaseModel):
    """User details returned in login response (no password)."""
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
    is_first_login: bool
    last_login_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    staff_id: Optional[int] = None
    patient_id: Optional[int] = None
    clinic: Optional[ClinicResponse] = None   # 👈 ADD THIS

class LoginData(BaseModel):
    """Login response data: tokens + user details."""
    tokens: AuthTokens
    user: UserDetail


class LoginResponse(BaseModel):
    """Login response with success status and optional tokens."""
    valid: bool
    message: str
    user_status: Optional[str] = None
    session: Optional[str] = None
    tokens: Optional[AuthTokens] = None


class CompletePasswordRequest(BaseModel):
    """Request to complete new password setup."""
    email: EmailStr
    new_password: str
    session: str


class CompletePasswordResponse(BaseModel):
    """Response after setting new password."""
    message: str
    tokens: AuthTokens


class DeleteUserRequest(BaseModel):
    """Request to delete a user."""
    email: Optional[str] = None
    uuid: Optional[str] = None
    skip_aws: bool = False


class LogoutResponse(BaseModel):
    """Logout response."""
    message: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


# -----------------------------------------------------------------------------
# SSO Provisioning (Google via Cognito)
# -----------------------------------------------------------------------------
# from uuid import UUID

class SSOProvisionRequest(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = "staff"

    # New fields for normal signup (password + confirm password)
    password: Optional[str] = None
    confirm_password: Optional[str] = None
    clinic_uuid: Optional[str] = None   # ✅ Python UUID
    clinic_name: Optional[str] = None
    department: Optional[str] = None
    clinic_address: Optional[str] = None


class SSOProvisionResponse(BaseModel):
    message: str
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    clinic_uuid: Optional[str] = None 
    

    clinic_name: Optional[str] = None
    department: Optional[str] = None
    clinic_address: Optional[str] = None

    staff_uuid: Optional[str] = None
    created: bool = True

class ProfileCompletionRequest(BaseModel):
    staff_id: int  # ✅ staff table primary key (user id)

    role: Optional[str] = None

    clinic_uuid: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None

    department: Optional[str] = None

class ProfileCompletionResponse(BaseModel):
    message: str
    staff_id: int
    staff_uuid: UUID

    role: Optional[str] = None

    clinic_uuid: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    department: Optional[str] = None


class GoogleSignupRequest(BaseModel):
    id_token: str

class GoogleSignupResponse(BaseModel):
    message: str
    email: EmailStr
    staff_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_profile_completed: bool
    created: bool
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

# =============================================================================
# Endpoints
# =============================================================================

@router.post(
    "/signup",
    response_model=SignupResponse,
    summary="Register new staff member",
    description="Create a new staff member in AWS Cognito and local database.",
)
@limiter.limit(AUTH_RATE_LIMIT)
async def signup_user(
    request: SignupRequest,
    http_request: Request,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Create a new staff member account.
    
    Creates the user in:
    1. AWS Cognito (authentication)
    2. Local database (staff profile)
    
    A temporary password will be sent to the user's email.
    """
    logger.info(f"Signup request: email={request.email} role={request.role}")
    
    auth_service = AuthService(db)
    
    try:
        result = auth_service.signup(
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            role=request.role,
            clinic_uuid=request.clinic_uuid,
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
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


# @router.post(
#     "/login",
#     response_model=LoginResponse,
#     summary="Login",
#     description="Authenticate a user with email and password. Rate limited to prevent brute force.",
# )
# @limiter.limit(AUTH_RATE_LIMIT)
# async def login(
#     request: LoginRequest,
#     http_request: Request,
#     db: Session = Depends(get_doctor_db_session),
# ):
#     """
#     Authenticate a user.
    
#     Returns JWT tokens on success, or challenge info if password
#     change is required (for users with temporary passwords).
#     """
#     logger.info(f"Login request: email={request.email}")
    
#     auth_service = AuthService(db)
    
#     try:
#         result = auth_service.login(
#             email=request.email,
#             password=request.password,
#         )
        
#         response = LoginResponse(
#             valid=result["valid"],
#             message=result.get("message", ""),
#             user_status=result.get("user_status"),
#             session=result.get("session"),
#         )
        
#         if result.get("tokens"):
#             response.tokens = AuthTokens(**result["tokens"])
        
#         return response
        
#     except ExternalServiceError as e:
#         logger.error(f"Login failed for {request.email}: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
#             detail=str(e),
#         )


@router.post(
    "/complete-new-password",
    response_model=CompletePasswordResponse,
    summary="Complete Password Setup",
    description="Set a new password for a user with a temporary password.",
)
@limiter.limit(PASSWORD_RESET_LIMIT)
async def complete_new_password(
    request: CompletePasswordRequest,
    http_request: Request,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Complete password setup for users with temporary passwords.
    
    This is called after login returns a FORCE_CHANGE_PASSWORD status.
    The session token from the login response must be provided.
    """
    logger.info(f"Complete new password: email={request.email}")
    
    auth_service = AuthService(db)
    
    try:
        result = auth_service.complete_new_password(
            email=request.email,
            new_password=request.new_password,
            session=request.session,
        )
        
        return CompletePasswordResponse(
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
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Logout",
    description="Logout the current user.",
)
async def logout():
    """
    Logout the current user.
    
    Note: This is primarily a client-side operation. The client
    should delete the stored tokens. This endpoint provides a
    consistent API response.
    """
    logger.info("Logout request")
    return LogoutResponse(message="Logout successful")


@router.delete(
    "/delete-user",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user account",
    description="Delete a staff member account and all associated data.",
)
async def delete_user(
    request: DeleteUserRequest,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Delete a staff member account.
    
    Can delete by email or UUID.
    Optionally skips AWS Cognito deletion.
    
    This is an irreversible action.
    """
    logger.warning(f"Delete user request: email={request.email} uuid={request.uuid}")
    
    auth_service = AuthService(db)
    
    try:
        auth_service.delete_user(
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

@router.post(
    "/signup/staff",
    response_model=SSOProvisionResponse,
    summary="Manual staff signup with password",
)
async def manual_staff_signup(
    request: SSOProvisionRequest,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Manual staff signup endpoint.
    
    Creates:
    1. User record (with hashed password for authentication)
    2. Staff record (profile information)
    3. Clinic record (if clinic_name provided)
    4. StaffClinic association (if clinic created)
    """
    if not request.email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Password validation
    if request.password or request.confirm_password:
        if not request.password or not request.confirm_password:
            raise HTTPException(
                status_code=400,
                detail="Password and confirm password are required",
            )
        if request.password != request.confirm_password:
            raise HTTPException(
                status_code=400,
                detail="Passwords do not match",
            )

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()

    if existing_user:
        # If user registered via Google → block manual signup
        if existing_user.auth_provider == "google":
            raise HTTPException(
                status_code=400,
                detail="This email is registered using Google. Please login with Google."
            )

        # If user registered via local → block duplicate signup
        if existing_user.auth_provider == "local":
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists."
            )
    
    try:
        # 1. Create User record (authentication + name)
        user = User(
            uuid=uuid4(),
            email=request.email,
            password_hash=hash_password(request.password) if request.password else None,
            auth_provider='local',
            first_name=request.first_name,
            last_name=request.last_name,
            is_active=True,
            is_verified=False,
        )
        db.add(user)
        db.flush()  # Get user.id without committing
        
        # 2. Create Staff record (profile - names are in User table)
        staff = Staff(
            uuid=uuid4(),
            user_id=user.id,
            email=request.email,
            role=request.role or "staff",
            is_profile_completed=False,
            is_active=True,
        )
        db.add(staff)
        db.flush()  # Get staff.id without committing
        
        # 3. Create Clinic if clinic_name provided; set user.clinic_id
        clinic = None
        if request.clinic_name:
            # Check if clinic already exists
            clinic = db.query(Clinic).filter(Clinic.name == request.clinic_name).first()
            if not clinic:
                clinic = Clinic(
                    uuid=uuid4(),
                    name=request.clinic_name,
                    address=request.clinic_address,
                    department=request.department,
                    is_active=True,
                )
                db.add(clinic)
                db.flush()
            user.clinic_id = clinic.id
            
            # 4. Create StaffClinic association
            staff_clinic = StaffClinic(
                staff_id=staff.id,
                clinic_id=clinic.id,
                is_primary=True,
                is_active=True,
            )
            db.add(staff_clinic)
        
        # Commit all changes
        db.commit()
        db.refresh(staff)
        
        logger.info(f"Manual signup successful: {request.email}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Signup failed for {request.email}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user: {str(e)}"
        )

    return SSOProvisionResponse(
        message="User provisioned successfully",
        email=request.email,
        first_name=request.first_name,
        last_name=request.last_name,
        role=request.role,
        clinic_uuid=request.clinic_uuid,
        clinic_name=request.clinic_name,
        department=request.department,
        clinic_address=request.clinic_address,
        staff_uuid=str(staff.uuid),
        created=True,
    )

@router.post(
    "/profile/complete",
    response_model=ProfileCompletionResponse,
    summary="Complete profile after social signup",
)
def complete_profile(
    request: ProfileCompletionRequest,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Complete staff profile after signup.
    
    Updates:
    1. Staff role
    2. Creates/associates clinic if provided (department is set on clinic)
    3. Marks profile as completed
    """
    # 1. Fetch staff
    staff = db.query(Staff).filter(Staff.id == request.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    try:
        # 2. Update role if provided
        if request.role:
            staff.role = request.role

        # 3. Create/associate clinic if clinic_name is provided
        clinic = None
        if request.clinic_name:
            # Check if clinic already exists
            clinic = db.query(Clinic).filter(Clinic.name == request.clinic_name).first()
            if not clinic:
                clinic = Clinic(
                    uuid=uuid4(),
                    name=request.clinic_name,
                    address=request.clinic_address,
                    department=request.department,
                    is_active=True,
                )
                db.add(clinic)
                db.flush()
            
            # Check if staff-clinic association already exists
            existing_assoc = db.query(StaffClinic).filter(
                StaffClinic.staff_id == staff.id,
                StaffClinic.clinic_id == clinic.id
            ).first()
            
            if not existing_assoc:
                staff_clinic = StaffClinic(
                    staff_id=staff.id,
                    clinic_id=clinic.id,
                    is_primary=True,
                    is_active=True,
                )
                db.add(staff_clinic)
        elif request.department:
            # Update department on staff's primary clinic if no new clinic created
            primary = staff.primary_clinic
            if primary:
                primary.department = request.department

        # 4. Mark profile as completed
        staff.is_profile_completed = True
        
        db.commit()
        db.refresh(staff)
        if clinic:
            db.refresh(clinic)
        
        logger.info(f"Profile completed for staff_id={staff.id}")

    except Exception as e:
        db.rollback()
        logger.error(f"Profile completion failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete profile: {str(e)}"
        )

    # Resolve department from clinic (created or primary)
    resolved_clinic = clinic if clinic else staff.primary_clinic
    department_value = resolved_clinic.department if resolved_clinic else None

    return ProfileCompletionResponse(
        message="Profile completed successfully",
        staff_id=staff.id,
        staff_uuid=staff.uuid,
        role=staff.role,
        clinic_uuid=str(clinic.uuid) if clinic else (str(resolved_clinic.uuid) if resolved_clinic else request.clinic_uuid),
        clinic_name=clinic.name if clinic else (resolved_clinic.name if resolved_clinic else None),
        clinic_address=clinic.address if clinic else (resolved_clinic.address if resolved_clinic else None),
        department=department_value,
    )

def verify_google_token(token: str):
    client_ids = settings.google_allowed_client_ids_list
    if not client_ids:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_ALLOWED_CLIENT_IDS not configured"
        )
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            client_ids,
        )
        return idinfo
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Google token: {str(e)}"
        )

def _get_jwt_secret() -> str:
    key = settings.jwt_secret_key
    if not key:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET_KEY not configured. Set it in .env for JWT token creation."
        )
    return key


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=settings.access_token_expiry_hours)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=settings.jwt_algorithm)


def create_id_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "id"})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=settings.jwt_algorithm)

@router.post(
    "/google/signup",
    response_model=APIResponse[GoogleSignupResponse],
    summary="Google social signup",
)
def google_signup(
    request: GoogleSignupRequest,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Google SSO signup endpoint.
    
    Creates:
    1. User record (with auth_provider='google' and provider_user_id=Google sub)
    2. Staff record (profile information from Google)
    
    No password is stored for SSO users.
    """
    google_user = verify_google_token(request.id_token)

    email = google_user.get("email")
    first_name = google_user.get("given_name")
    last_name = google_user.get("family_name")
    google_sub = google_user.get("sub")  # Google unique ID

    if not email:
        raise HTTPException(status_code=400, detail="Email not found from Google")

    # 🔍 Step 1: Check if user exists by email
    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:

        # ✅ If user exists but was local → convert to Google
        if existing_user.auth_provider == "local":
            existing_user.auth_provider = "google"
            existing_user.provider_user_id = google_sub
            existing_user.is_verified = True
            db.commit()
    

        # Get associated staff profile
        staff = db.query(Staff).filter(Staff.user_id == existing_user.id).first()
        
        if not staff:
            raise HTTPException(status_code=400, detail="Staff profile not found")
        payload = {
            "user_id": existing_user.id,
            "staff_id": staff.id,
            "staff_uuid": str(staff.uuid),
            "email": staff.email,
            "role": staff.role,
        }

        access_token = create_access_token(payload)
        refresh_token = create_refresh_token(payload)

        is_profile_completed = staff.is_profile_completed

        return APIResponse(
            success=True,
            message="User already exists.",
            data=GoogleSignupResponse(
                message="User already exists.",
                email=staff.email,
                first_name=staff.first_name,
                last_name=staff.last_name,
                staff_id=staff.id,
                is_profile_completed=is_profile_completed,
                access_token=access_token,
                refresh_token=refresh_token,
                created=False,
            ),
        )   
    
    try:
        # 1. Create User record (authentication + name - no password for SSO)
        user = User(
            uuid=uuid4(),
            email=email,
            password_hash=None,  # No password for SSO users
            auth_provider='google',
            provider_user_id=google_sub,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_verified=True,  # Google email is already verified
        )
        db.add(user)
        db.flush()
        
        # 2. Create Staff record (profile - names are in User table)
        staff = Staff(
            uuid=uuid4(),
            user_id=user.id,
            email=email,
            role="staff",
            is_profile_completed=False,
            is_active=True,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)
        
        logger.info(f"Google signup successful: {email}")
        
        # Generate tokens for new user
        payload = {
            "user_id": user.id,
            "staff_id": staff.id,
            "staff_uuid": str(staff.uuid),
            "email": staff.email,
            "role": staff.role,
        }
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token(payload)
        
        return APIResponse(
            success=True,
            message="User created successfully.",
            data=GoogleSignupResponse(
                message="User created successfully.",
                email=staff.email,
                first_name=staff.first_name,
                last_name=staff.last_name,
                staff_id=staff.id,
                is_profile_completed=staff.is_profile_completed,
                access_token=access_token,
                refresh_token=refresh_token,
                created=True,
            ),
            status_code=201
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Google signup failed for {email}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user: {str(e)}"
        )

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_doctor_db_session)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        # Do not reveal whether email exists
        return ErrorResponse(
            success=False,
            message="User with the provided email does not exist.",
            details=None,
            status_code=404
        )

    # Generate secure reset token
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    reset_link = settings.doctor_forget_password_base_url.format(token=token)
    # Send email
    await send_reset_password_email(email=request.email, reset_link=reset_link)

    return APIResponse(
        success=True,
        message="Password reset email sent to the provided email address.",
        data=None,
        status_code=200
    )


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_doctor_db_session)
):
    user = db.query(User).filter(User.reset_token == request.token).first()

    if not user:
        return ErrorResponse(
            success=False,
            message="No user found for the provided reset token.",
            details=None,
            status_code=404
        )

    if (
        not user.reset_token_expires_at
        or user.reset_token_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Reset token has expired.")
    user.password_hash = hash_password(request.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None

    db.commit()

    return APIResponse(
        success=True,
        message="Password has been reset successfully.",
        data=None,
        status_code=200
    )

def resolve_user_clinic(user: User):
    """
    Resolve clinic for a user dynamically.
    Priority:
    1. Direct clinic on user (admin)
    2. Staff linked clinic(s)
    3. Patient linked clinic
    """

    # 1️⃣ Admin user
    if user.clinic:
        return user.clinic

    # 2️⃣ Staff user (doctor / nurse)
    if user.staff and user.staff.clinics:
        # If multiple clinics exist, return first (current behavior)
        return user.staff.clinics[0]

    # 3️⃣ Patient user
    if user.patient_profile and user.patient_profile.clinic:
        return user.patient_profile.clinic

    return None


@router.post("/login", response_model=APIResponse[LoginData])
async def login(
    request: LoginRequest,
    db: Session = Depends(get_doctor_db_session)
):
    user = db.query(User).filter(User.email == request.email).first()

    # Generic error (avoid user enumeration)
    if not user or not user.password_hash:
        return ErrorResponse(
            success=False,
            message="Invalid email or password.",
            details=None,
            status_code=401
        )

    if not user.is_active:
        return ErrorResponse(
            success=False,
            message="User account is inactive. Please contact support.",
            details=None,
            status_code=403
        )

    if not verify_password(request.password, user.password_hash):
        return ErrorResponse(
            success=False,
            message="Invalid email or password.",
            details=None,
            status_code=401
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Token payload
    token_data = {
        "sub": str(user.uuid),
        "email": user.email,
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    id_token = create_id_token(token_data)

    # 👇 Resolve clinic dynamically
    clinic = resolve_user_clinic(user)

    clinic_response = (
        ClinicResponse(
            id=clinic.id,
            uuid=str(clinic.uuid),
            name=clinic.name,
            address=clinic.address,
            phone=clinic.phone,
            department=clinic.department,
        )
        if clinic else None
    )

    # Build user details (exclude password_hash)
    user_detail = UserDetail(
        id=user.id,
        uuid=str(user.uuid),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        role=user.role,
        auth_provider=user.auth_provider,
        is_active=user.is_active,
        is_verified=user.is_verified,
        is_first_login=user.is_first_login,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        created_at=user.created_at.isoformat() if user.created_at else None,
        updated_at=user.updated_at.isoformat() if user.updated_at else None,
        staff_id=user.staff.id if user.staff else None,
        patient_id=user.patient_profile.id if user.patient_profile else None,
        clinic=clinic_response,   # 👈 RETURN CLINIC HERE
    )

    return APIResponse(
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
        status_code=200
    )
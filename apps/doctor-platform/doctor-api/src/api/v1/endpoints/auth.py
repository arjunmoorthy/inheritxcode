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
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional
from uuid import uuid4, UUID
import boto3
from botocore.exceptions import ClientError
import bcrypt

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

logger = get_logger(__name__)


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


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login",
    description="Authenticate a user with email and password. Rate limited to prevent brute force.",
)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(
    request: LoginRequest,
    http_request: Request,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Authenticate a user.
    
    Returns JWT tokens on success, or challenge info if password
    change is required (for users with temporary passwords).
    """
    logger.info(f"Login request: email={request.email}")
    
    auth_service = AuthService(db)
    
    try:
        result = auth_service.login(
            email=request.email,
            password=request.password,
        )
        
        response = LoginResponse(
            valid=result["valid"],
            message=result.get("message", ""),
            user_status=result.get("user_status"),
            session=result.get("session"),
        )
        
        if result.get("tokens"):
            response.tokens = AuthTokens(**result["tokens"])
        
        return response
        
    except ExternalServiceError as e:
        logger.error(f"Login failed for {request.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


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


# @router.post(
#     "/sso/provision",
#     response_model=SSOProvisionResponse,
#     summary="Provision federated SSO user",
# )
# async def provision_sso_user(
#     request: SSOProvisionRequest,
#     current_user: TokenData = Depends(get_current_user),
#     db: Session = Depends(get_doctor_db_session),
# ):
#     from uuid import UUID, uuid4
#     from db.models.staff import Staff

#     if not current_user.email:
#         raise HTTPException(status_code=400, detail="Token missing email")

#     # Parse Cognito sub
#     try:
#         staff_uuid = UUID(current_user.sub)
#     except Exception:
#         staff_uuid = uuid4()

#     # 1️⃣ Check if staff already exists (idempotent)
#     staff = (
#         db.query(Staff)
#         .filter(
#             (Staff.uuid == staff_uuid) |
#             (Staff.email == current_user.email)
#         )
#         .first()
#     )

#     if staff:
#         return SSOProvisionResponse(
#             message="User already provisioned",
#             email=staff.email,
#             staff_uuid=str(staff.uuid),
#             created=False,
#         )

#     # 2️⃣ Create staff entry
#     staff = Staff(
#         uuid=staff_uuid,
#         cognito_sub=current_user.sub,
#         email=current_user.email,
#         first_name=request.first_name,
#         last_name=request.last_name,
#         role=request.role or "staff",
#         clinic_id=request.clinic_id,  # optional
#         is_active=True,
#     )

#     db.add(staff)
#     db.commit()
#     db.refresh(staff)

#     return SSOProvisionResponse(
#         message="User provisioned successfully",
#         email=staff.email,
#         staff_uuid=str(staff.uuid),
#         created=True,
#     )


# Cognito setup
# COGNITO_USER_POOL_ID = "eu-north-1_8leC5jZQf"
# COGNITO_CLIENT_ID = "8is50naib64tgtmtd6kusq8fl"
# AWS_REGION = "us-east-1"

# cognito_client = boto3.client("cognito-idp", region_name=AWS_REGION)


# def create_cognito_user(email: str, first_name: str, last_name: str, password: str = None):
#     """Create user in Cognito. For SSO, password can be None."""
#     try:
#         user_attrs = [
#             {"Name": "email", "Value": email},
#             {"Name": "email_verified", "Value": "True"},
#             {"Name": "given_name", "Value": first_name},
#             {"Name": "family_name", "Value": last_name},
#         ]
#         print("Creating Cognito user with attrs:", user_attrs, 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww')

#         params = {
#             "UserPoolId": COGNITO_USER_POOL_ID,
#             "Username": email,
#             "UserAttributes": user_attrs,
#             "MessageAction": "SUPPRESS",  # Don't send default email
#         }
#         print("Cognito create user params:", params, 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')

#         if password:
#             params["TemporaryPassword"] = password

#         response = cognito_client.admin_create_user(**params)
#         print("Cognito create user response:", response, 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy')
#         return response

#     except ClientError as e:
#         raise HTTPException(status_code=400, detail=f"Cognito error: {e.response['Error']['Message']}")




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
        # Get associated staff profile
        existing_staff = db.query(Staff).filter(Staff.user_id == existing_user.id).first()
        return SSOProvisionResponse(
            message="User already exists",
            email=existing_user.email,
            staff_uuid=str(existing_staff.uuid) if existing_staff else None,
            created=False,
        )
    
    try:
        # 1. Create User record (authentication)
        user = User(
            uuid=uuid4(),
            email=request.email,
            password_hash=hash_password(request.password) if request.password else None,
            auth_provider='local',
            is_active=True,
            is_verified=False,
        )
        db.add(user)
        db.flush()  # Get user.id without committing
        
        # 2. Create Staff record (profile)
        staff = Staff(
            uuid=uuid4(),
            user_id=user.id,
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            role=request.role or "staff",
            department=request.department,
            is_profile_completed=False,
            is_active=True,
        )
        db.add(staff)
        db.flush()  # Get staff.id without committing
        
        # 3. Create Clinic if clinic_name provided
        clinic = None
        if request.clinic_name:
            # Check if clinic already exists
            clinic = db.query(Clinic).filter(Clinic.name == request.clinic_name).first()
            if not clinic:
                clinic = Clinic(
                    uuid=uuid4(),
                    name=request.clinic_name,
                    address=request.clinic_address,
                    is_active=True,
                )
                db.add(clinic)
                db.flush()
            
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
    1. Staff role and department
    2. Creates/associates clinic if provided
    3. Marks profile as completed
    """
    # 1. Fetch staff
    staff = db.query(Staff).filter(Staff.id == request.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    try:
        # 2. Update role and department if provided
        if request.role:
            staff.role = request.role
        if request.department:
            staff.department = request.department

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

    return ProfileCompletionResponse(
        message="Profile completed successfully",
        staff_id=staff.id,
        staff_uuid=staff.uuid,
        role=staff.role,
        clinic_uuid=str(clinic.uuid) if clinic else request.clinic_uuid,
        clinic_name=clinic.name if clinic else None,
        clinic_address=clinic.address if clinic else None,
        department=staff.department,
    )

ALLOWED_CLIENT_IDS = [
    # "407408718192.apps.googleusercontent.com",
    # "165026362997-vj3hj108oho22jodhhlp2ab8fi9tja9c.apps.googleusercontent.com",
    "728521781849-nrcnpe2ac409tsv5d4lghi76tq9btee6.apps.googleusercontent.com"
]

def verify_google_token(token: str):
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            ALLOWED_CLIENT_IDS,   # ✅ audience
        )
        return idinfo
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Google token: {str(e)}"
        )
    
from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = "9d7d08631a2cc5e54d080e522c5c15c41fd99a1e3615ddb226f465241ec1e3a4"
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post(
    "/auth/google/signup",
    response_model=GoogleSignupResponse,
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

    # Check if user already exists (by email or Google sub)
    existing_user = db.query(User).filter(
        (User.email == email) | 
        ((User.auth_provider == 'google') & (User.provider_user_id == google_sub))
    ).first()
    
    if existing_user:
        # Get associated staff profile
        staff = db.query(Staff).filter(Staff.user_id == existing_user.id).first()
        
        if staff:
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

            return GoogleSignupResponse(
                message="User already exists",
                email=staff.email,
                staff_id=staff.id,
                first_name=staff.first_name,
                last_name=staff.last_name,
                is_profile_completed=is_profile_completed,
                access_token=access_token,
                refresh_token=refresh_token,
                created=False,
            )
    
    try:
        # 1. Create User record (authentication - no password for SSO)
        user = User(
            uuid=uuid4(),
            email=email,
            password_hash=None,  # No password for SSO users
            auth_provider='google',
            provider_user_id=google_sub,
            is_active=True,
            is_verified=True,  # Google email is already verified
        )
        db.add(user)
        db.flush()
        
        # 2. Create Staff record (profile)
        staff = Staff(
            uuid=uuid4(),
            user_id=user.id,
            email=email,
            first_name=first_name,
            last_name=last_name,
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
        
        return GoogleSignupResponse(
            message="User signed up successfully via Google",
            email=staff.email,
            first_name=staff.first_name,
            last_name=staff.last_name,
            staff_id=staff.id,
            is_profile_completed=False,
            access_token=access_token,
            refresh_token=refresh_token,
            created=True,
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Google signup failed for {email}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user: {str(e)}"
        )
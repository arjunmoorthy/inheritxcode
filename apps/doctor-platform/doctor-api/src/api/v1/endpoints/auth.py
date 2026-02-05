"""
Authentication Endpoints - Doctor API
=====================================

Complete authentication endpoints using AWS Cognito:
- POST /signup: Register new staff member
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
from sqlalchemy import UUID
from sqlalchemy.orm import Session
from typing import Optional
from uuid import uuid4, UUID
import boto3
from botocore.exceptions import ClientError
from db.doctor_models import Staff, Clinic

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

logger = get_logger(__name__)

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
    clinic_uuid: Optional[UUID] = None   # ✅ Python UUID
    clinic_name: Optional[str] = None
    department: Optional[str] = None
    clinic_address: Optional[str] = None


class SSOProvisionResponse(BaseModel):
    message: str
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    clinic_uuid: Optional[UUID] = None

    clinic_name: Optional[str] = None
    department: Optional[str] = None
    clinic_address: Optional[str] = None

    staff_uuid: Optional[str] = None
    created: bool = True


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
    "/sso/provision",
    response_model=SSOProvisionResponse,
    summary="Provision user (DB only)",
)
async def provision_sso_user(
    request: SSOProvisionRequest,
    db: Session = Depends(get_doctor_db_session),
):
    if not request.email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Password validation (optional)
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

    # Check existing staff
    staff = db.query(Staff).filter(Staff.email == request.email).first()
    if staff:
        return SSOProvisionResponse(
            message="User already provisioned",
            email=staff.email,
            staff_uuid=str(staff.uuid),
            created=False,
        )
    
    clinic = None

    if request.clinic_name:
        clinic = Clinic(
            uuid=uuid4(),
            name=request.clinic_name,
            address=request.clinic_address,
            is_active=True,
        )
        db.add(clinic)
        db.commit()
        db.refresh(clinic)

    # Create staff (only staff fields are persisted)
    staff = Staff(
        uuid=uuid4(),
        email=request.email,
        first_name=request.first_name,
        last_name=request.last_name,
        role=request.role or "staff",
        is_active=True,
    )

    db.add(staff)
    db.commit()
    db.refresh(staff)

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
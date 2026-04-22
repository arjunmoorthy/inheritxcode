"""
Staff Endpoints - Doctor API
============================

Handles staff and physician management operations.

Endpoints:
- GET /staff: List all staff members
- GET /staff/{staff_uuid}: Get a specific staff member
- POST /staff/physician: Create a new physician
- POST /staff/member: Create a new staff member
- GET /staff/physicians: List all physicians
- GET /staff/for-physician/{physician_uuid}: Get staff for a physician
- GET /staff/search: Search staff by name

All endpoints require authentication.
"""

from typing import List, Literal, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_doctor_db_session, TokenData
from services import StaffService
from db.repositories import UserRepository, StaffRepository, ClinicRepository
from core.logging import get_logger
from db.models import Staff, PhysicianNurseAssignment, Clinic, StaffClinic
from core.schemas import APIResponse, ErrorResponse
from utils.security import generate_random_password, hash_password
from helpers.email import send_welcome_email_staff
from api.deps import require_roles
from core.config import settings
import asyncio

logger = get_logger(__name__)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class StaffResponse(BaseModel):
    """Staff member information response."""
    staff_uuid: str
    email_address: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    role: str
    npi_number: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True

class ClinicResponse(BaseModel):
    id: int
    uuid: UUID
    name: str
    address: Optional[str]
    phone: Optional[str]
    fax: Optional[str]
    department: Optional[str]

class AllStaffResponse(BaseModel):
    id: int
    uuid: UUID
    user_id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    full_name: Optional[str]
    role: str
    npi_number: Optional[str]
    phone: Optional[str]
    is_profile_completed: bool
    is_active: bool
    # created_at: Optional[datetime]
    # updated_at: Optional[datetime]
    clinic: Optional[ClinicResponse]  # 👈 added

    class Config:
        orm_mode = True

class UpdateStaffRequest(BaseModel):
    full_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200,
        description="Full name (will be split into first_name and last_name)"
    )
    phone: Optional[str] = Field(
        None,
        min_length=1,
        max_length=20
    )

def split_full_name(full_name: str):
    parts = full_name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""
    return first_name, last_name

class StaffResponseSchema(BaseModel):
    id: int
    role: str
    full_name: str
    email: str
    phone: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class CreatePhysicianRequest(BaseModel):
    """Request to create a new physician."""
    email_address: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    npi_number: str = Field(..., min_length=10, max_length=10, pattern=r"^\d{10}$")
    clinic_uuid: UUID


class CreateStaffRequest(BaseModel):
    """Request to create a new staff member."""
    email_address: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., pattern=r"^(staff|admin)$")
    physician_uuids: List[UUID] = Field(..., min_items=1)
    clinic_uuid: UUID


class StaffListResponse(BaseModel):
    """Paginated list of staff members."""
    staff: List[StaffResponse]
    total: int
    skip: int
    limit: int


class ClinicAssociationResponse(BaseModel):
    """Response with physician's clinic association."""
    physician_uuid: str
    clinic_uuid: str


class MessageResponse(BaseModel):
    """Simple message response."""
    message: str
    staff_uuid: Optional[str] = None

class DoctorListResponse(BaseModel):
    id: int
    full_name: str

class AddStaffRequest(BaseModel):
    """Request to add a new staff member (doctor or nurse)."""
    role: Literal[
        "doctor",
        "nurse",
        "navigator",
        "research_coordinator",
        "medical_assistant",
    ] = Field(
        ...,
        description=(
            "Role: 'doctor', or one of the nurse-like roles: 'nurse', "
            "'navigator', 'research_coordinator', 'medical_assistant'"
        ),
    )
    full_name: str = Field(..., min_length=1, max_length=200, description="Full name (stored as first_name, last_name in user and staff)")
    email: EmailStr = Field(..., description="Email (stored in user and staff)")
    phone: str = Field(..., min_length=1, max_length=20, description="Phone (stored in staff)")
    clinic_id: int = Field(..., ge=1, description="Clinic ID to attach this staff member to")
    doctor_ids: Optional[List[int]] = None

class AddStaffResponse(BaseModel):
    """Response after adding a staff member."""
    message: str
    staff_uuid: str
    email: str
    role: str


class SelfProfileResponse(BaseModel):
    id: int
    uuid: UUID
    user_id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    full_name: Optional[str]
    role: str
    phone: Optional[str]
    is_profile_completed: bool
    is_active: bool
    clinic: Optional[ClinicResponse]


class SelfProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=1, max_length=20)
    clinic_id: Optional[int] = Field(None, ge=1)


def _build_self_profile_response(staff: Staff) -> SelfProfileResponse:
    primary_clinic_assoc = next(
        (
            assoc for assoc in staff.clinic_associations
            if assoc.is_primary and assoc.is_active
        ),
        None,
    )
    clinic = primary_clinic_assoc.clinic if primary_clinic_assoc else None

    return SelfProfileResponse(
        id=staff.id,
        uuid=staff.uuid,
        user_id=staff.user_id,
        email=staff.email,
        first_name=staff.first_name,
        last_name=staff.last_name,
        full_name=staff.full_name,
        role=staff.role,
        phone=staff.phone,
        is_profile_completed=staff.is_profile_completed,
        is_active=staff.is_active,
        clinic=(
            ClinicResponse(
                id=clinic.id,
                uuid=clinic.uuid,
                name=clinic.name,
                address=clinic.address,
                phone=clinic.phone,
                fax=clinic.fax,
                department=clinic.department,
            )
            if clinic else None
        ),
    )


# =============================================================================
# Endpoints
# =============================================================================

@router.get(
    "",
    response_model=StaffListResponse,
    summary="List Staff",
    description="Get a paginated list of all staff members.",
)
async def list_staff(
    role: Optional[str] = Query(None, description="Filter by role"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Get all staff members with optional role filter."""
    staff_service = StaffService(db)
    
    staff_list, total_count = staff_service.list_staff_with_count(
        role=role, skip=skip, limit=limit
    )
    
    return StaffListResponse(
        staff=[StaffResponse(**s.to_dict()) for s in staff_list],
        total=total_count,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/search",
    response_model=List[StaffResponse],
    summary="Search Staff",
    description="Search staff members by name.",
)
async def search_staff(
    q: str = Query(..., min_length=2, description="Search term"),
    role: Optional[str] = Query(None, description="Filter by role"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Search staff by name (case-insensitive partial match)."""
    staff_service = StaffService(db)
    
    staff_list = staff_service.search_staff(
        search_term=q,
        role=role,
        limit=limit,
    )
    
    return [StaffResponse(**s.to_dict()) for s in staff_list]


@router.get(
    "/physicians",
    response_model=List[StaffResponse],
    summary="List Physicians",
    description="Get all physicians.",
)
async def list_physicians(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Get all physician profiles."""
    staff_service = StaffService(db)
    
    physicians = staff_service.list_physicians(skip=skip, limit=limit)
    
    return [StaffResponse(**p.to_dict()) for p in physicians]


@router.get(
    "/for-physician/{physician_uuid}",
    response_model=List[StaffResponse],
    summary="Get Staff for Physician",
    description="Get all staff members associated with a physician.",
)
async def get_staff_for_physician(
    physician_uuid: UUID,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Get staff members working with a specific physician."""
    staff_service = StaffService(db)
    
    staff_list = staff_service.get_staff_for_physician(physician_uuid)
    
    return [StaffResponse(**s.to_dict()) for s in staff_list]


@router.get(
    "/clinic-from-physician/{physician_uuid}",
    response_model=ClinicAssociationResponse,
    summary="Get Clinic for Physician",
    description="Get the clinic associated with a physician.",
)
async def get_clinic_from_physician(
    physician_uuid: UUID,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Get the clinic UUID for a physician."""
    staff_service = StaffService(db)
    
    clinic_uuid = staff_service.get_clinic_for_physician(physician_uuid)
    
    if not clinic_uuid:
        from core.exceptions import NotFoundError
        raise NotFoundError(
            message="No clinic association found for this physician",
            resource_type="ClinicAssociation",
            resource_id=str(physician_uuid),
        )
    
    return ClinicAssociationResponse(
        physician_uuid=str(physician_uuid),
        clinic_uuid=str(clinic_uuid),
    )


# @router.get(
#     "/{staff_uuid}",
#     response_model=StaffResponse,
#     summary="Get Staff Member",
#     description="Get a specific staff member by UUID.",
# )
# async def get_staff(
#     staff_uuid: UUID,
#     current_user: TokenData = Depends(get_current_user),
#     db: Session = Depends(get_doctor_db_session),
# ):
#     """Get a staff member by their UUID."""
#     staff_service = StaffService(db)
    
#     staff = staff_service.get_staff_by_uuid(staff_uuid)
    
#     return StaffResponse(**staff.to_dict())


@router.post(
    "/physician",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Physician",
    description="Create a new physician profile.",
)
async def add_physician(
    request: CreatePhysicianRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """
    Create a new physician.
    
    Creates the profile and sets up self-association with the clinic.
    """
    staff_service = StaffService(db)
    
    physician = staff_service.create_physician(
        email_address=request.email_address,
        first_name=request.first_name,
        last_name=request.last_name,
        npi_number=request.npi_number,
        clinic_uuid=request.clinic_uuid,
    )
    
    return MessageResponse(
        message="Physician added successfully",
        staff_uuid=str(physician.staff_uuid),
    )


@router.post(
    "/member",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Staff Member",
    description="Create a new staff or admin member.",
)
async def add_staff(
    request: CreateStaffRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """
    Create a new staff member.
    
    Creates the profile and sets up associations with physicians.
    """
    staff_service = StaffService(db)
    
    staff = staff_service.create_staff_member(
        email_address=request.email_address,
        first_name=request.first_name,
        last_name=request.last_name,
        role=request.role,
        physician_uuids=request.physician_uuids,
        clinic_uuid=request.clinic_uuid,
    )
    
    return MessageResponse(
        message=f"{request.role.capitalize()} added successfully",
        staff_uuid=str(staff.staff_uuid),
    )


@router.post(
    "/add",
    response_model=AddStaffResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add new staff (doctor or nurse)",
)
def add_staff_simple(
    request: AddStaffRequest,
    current_user: TokenData = Depends(require_roles("admin")),
    db: Session = Depends(get_doctor_db_session),
):
    user_repo = UserRepository(db)
    staff_repo = StaffRepository(db)
    clinic_repo = ClinicRepository(db)

    email_clean = request.email.strip().lower()
    login_link = settings.doctor_set_password_base_url.format(email=email_clean)

    # 🔒 Email uniqueness check
    if user_repo.email_exists(email_clean) or staff_repo.email_exists(email_clean):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user or staff member with this email already exists",
        )

    # 🔤 Split name
    parts = request.full_name.strip().split(None, 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else None

    # 🎭 Role mapping
    # Store the exact provided role in the DB (physician for 'doctor',
    # otherwise store the literal role like 'nurse', 'navigator', etc.).
    db_role = "physician" if request.role == "doctor" else request.role

    # Nurse-like roles that require doctor_ids and physician-nurse assignment
    NURSE_LIKE_ROLES = {
        "nurse",
        "navigator",
        "research_coordinator",
        "medical_assistant",
    }

    # 🏥 Clinic lookup by ID
    clinic = clinic_repo.get_by_id(request.clinic_id)
    if not clinic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinic not found",
        )

    # 🔒 Validation: doctor_ids rules
    # db_role is 'physician' for doctors; other roles may be nurse-like
    if request.role in NURSE_LIKE_ROLES and not request.doctor_ids:
        raise HTTPException(
            status_code=400,
            detail=(
                "doctor_ids are required for nurse-like roles "
                "(nurse, navigator, research_coordinator, medical_assistant)"
            ),
        )

    try:

        # 🆕 Generate temp password
        temp_password = generate_random_password()
        hashed_password = hash_password(temp_password)
        # 👤 Create User
        user = user_repo.create(
            email=email_clean,
            first_name=first_name,
            last_name=last_name,
            role=db_role,
            clinic_id=clinic.id,
            is_first_login=True,
            auth_provider="local",
            password_hash=hashed_password,
            is_active=True,
            is_verified=False,
        )
        db.flush()

        # 👩‍⚕️👨‍⚕️ Create Staff
        staff = staff_repo.create(
            user_id=user.id,
            email=email_clean,
            role=db_role,
            phone=request.phone.strip(),
            is_profile_completed=False,
            is_active=True,
        )
        db.flush()

        # 🔗 Clinic association
        # 🔗 ALWAYS create StaffClinic association
        staff_repo.create_clinic_association(
            staff_id=staff.id,
            clinic_id=clinic.id,
            is_primary=True,
        )      
        if request.role in NURSE_LIKE_ROLES:
            doctors = (
                db.query(Staff)
                .filter(
                    Staff.id.in_(request.doctor_ids),
                    Staff.role == "physician",
                    Staff.is_active == True,
                )
                .all()
            )

            if len(doctors) != len(request.doctor_ids):
                raise HTTPException(
                    status_code=400,
                    detail="One or more doctor_ids are invalid",
                )            
            for doctor in doctors:
                db.add(
                    PhysicianNurseAssignment(
                        physician_id=doctor.id,
                        nurse_id=staff.id,
                    )
                )

        db.commit()
        db.refresh(staff)

        # 📧 Send welcome email (DIRECT call, no background task)
        try:
            print("📧 About to send welcome email to staff...")
            if user.is_first_login:  # Only send if it's the first login (new account)
                asyncio.run(
                    send_welcome_email_staff(
                        email=email_clean,
                        temp_password=temp_password,
                        login_link=login_link
                    )
                )
                print("✅ Welcome email function executed")
        except Exception as email_error:
            logger.error(f"Failed to send welcome email: {email_error}")

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Add staff failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return AddStaffResponse(
        message="Staff added successfully",
        staff_uuid=str(staff.uuid),
        email=staff.email,
        role=staff.role,
    )


@router.get(
    "/profile",
    response_model=APIResponse[SelfProfileResponse],
    summary="Get my profile",
)
def get_my_profile(
    db: Session = Depends(get_doctor_db_session),
    current_user=Depends(
        require_roles(
            "admin",
            "physician",
            "nurse",
            "research_coordinator",
            "navigator",
            "medical_assistant",
        )
    ),
):
    staff = (
        db.query(Staff)
        .filter(
            Staff.user_id == current_user.id,
            Staff.is_active == True,
        )
        .first()
    )

    if not staff:
        raise HTTPException(status_code=404, detail="Staff profile not found")

    return APIResponse(
        success=True,
        message="Profile fetched successfully",
        data=_build_self_profile_response(staff),
    )


@router.patch(
    "/profile",
    response_model=APIResponse[SelfProfileResponse],
    summary="Update my profile",
)
def update_my_profile(
    payload: SelfProfileUpdateRequest,
    db: Session = Depends(get_doctor_db_session),
    current_user=Depends(
        require_roles(
            "admin",
            "physician",
            "nurse",
            "research_coordinator",
            "navigator",
            "medical_assistant",
        )
    ),
):
    staff = (
        db.query(Staff)
        .filter(
            Staff.user_id == current_user.id,
            Staff.is_active == True,
        )
        .first()
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff profile not found")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return APIResponse(
            success=True,
            message="No changes submitted; returning current profile.",
            data=_build_self_profile_response(staff),
        )

    if "email" in updates:
        normalized_email = str(updates["email"]).strip().lower()
        email_conflict = (
            db.query(Staff)
            .filter(
                Staff.email == normalized_email,
                Staff.id != staff.id,
            )
            .first()
        )
        if email_conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use",
            )
        if not staff.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account not linked to staff",
            )
        staff.email = normalized_email
        staff.user.email = normalized_email

    if "first_name" in updates:
        if not staff.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account not linked to staff",
            )
        staff.user.first_name = updates["first_name"].strip()

    if "last_name" in updates:
        if not staff.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account not linked to staff",
            )
        staff.user.last_name = updates["last_name"].strip()

    if "phone" in updates:
        staff.phone = updates["phone"].strip()

    if "clinic_id" in updates:
        if getattr(current_user, "role", None) not in {"admin", "physician"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin and physician can update clinic",
            )

        clinic = db.query(Clinic).filter(Clinic.id == updates["clinic_id"]).first()
        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found",
            )

        if not staff.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account not linked to staff",
            )

        # Keep users.clinic_id and primary staff-clinic association aligned.
        staff.user.clinic_id = clinic.id
        active_associations = [
            assoc for assoc in staff.clinic_associations
            if assoc.is_active
        ]

        existing_assoc = next(
            (assoc for assoc in active_associations if assoc.clinic_id == clinic.id),
            None,
        )

        if existing_assoc:
            for assoc in active_associations:
                assoc.is_primary = assoc.id == existing_assoc.id
        else:
            for assoc in active_associations:
                assoc.is_primary = False
            db.add(
                StaffClinic(
                    staff_id=staff.id,
                    clinic_id=clinic.id,
                    is_primary=True,
                    is_active=True,
                )
            )

    db.commit()
    db.refresh(staff)
    if staff.user:
        db.refresh(staff.user)

    return APIResponse(
        success=True,
        message="Profile updated successfully",
        data=_build_self_profile_response(staff),
    )


@router.get(
    "/list/doctors",
    response_model=APIResponse[list[DoctorListResponse]],
    summary="List all active doctors",
)
def list_doctors(
    db: Session = Depends(get_doctor_db_session),
    current_user: TokenData = Depends(
        require_roles(
            "physician",
            "nurse",
            "research_coordinator",
            "navigator",
            "medical_assistant",
            "admin",
        )
    ),
):
    doctors = (
        db.query(Staff)
        .filter(
            Staff.role == "physician",
            Staff.is_active == True,
        )
        .order_by(Staff.id.asc())
        .all()
    )

    doctor_list = [
        DoctorListResponse(
            id=doctor.id,
            full_name=doctor.full_name,
        )
        for doctor in doctors
    ]

    return APIResponse(
        success=True,
        message="Doctors fetched successfully",
        data=doctor_list,
    )


@router.put(
    "/staff/{staff_id}",
    summary="Update staff phone number and full name",
)
def update_staff(
    staff_id: int,
    payload: UpdateStaffRequest,
    db: Session = Depends(get_doctor_db_session),
):
    staff = (
        db.query(Staff)
        .filter(
            Staff.id == staff_id,
            Staff.is_active == True,
        )
        .first()
    )

    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # ✅ Update phone (Staff table)
    if payload.phone is not None:
        staff.phone = payload.phone

    # ✅ Update full_name (User table)
    if payload.full_name is not None:
        name_parts = payload.full_name.strip().split(" ", 1)

        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else None

        if not staff.user:
            raise HTTPException(
                status_code=400,
                detail="User account not linked to staff"
            )

        staff.user.first_name = first_name
        staff.user.last_name = last_name

    db.commit()
    db.refresh(staff)

    return {
        "success": True,
        "message": "Staff updated successfully",
        "data": {
            "id": staff.id,
            "full_name": staff.full_name,
            "phone": staff.phone,
        },
    }


# @router.get(
#     "/all-staff",
#     response_model=APIResponse[List[AllStaffResponse]],
#     summary="Get all active staff members",
# )
# def get_all_staff(
#     db: Session = Depends(get_doctor_db_session),
#     current_user: TokenData = Depends(require_roles("admin")),
# ):
    
#     all_staff = (
#         db.query(Staff)
#         .filter(
#             Staff.is_active == True,
#             Staff.role != "admin"   # 👈 hide admin records
#         )
#         .order_by(Staff.id.asc())
#         .all()
#     )

#     staff_list = [
#         AllStaffResponse(
#             id=staff.id,
#             uuid=staff.uuid,
#             user_id=staff.user_id,
#             email=staff.email,
#             first_name=staff.first_name,
#             last_name=staff.last_name,
#             full_name=staff.full_name,
#             role=staff.role,
#             npi_number=staff.npi_number,
#             phone=staff.phone,
#             is_profile_completed=staff.is_profile_completed,
#             is_active=staff.is_active,
#         )
#         for staff in all_staff
#     ]

#     return APIResponse(
#         success=True,
#         message="All active staff fetched successfully",
#         data=staff_list
#     )


@router.get(
    "/all-staff",
    response_model=APIResponse[List[AllStaffResponse]],
    summary="Get all active staff members",
)
def get_all_staff(
    db: Session = Depends(get_doctor_db_session),
    current_user: TokenData = Depends(require_roles("admin")),
):
    all_staff = (
        db.query(Staff)
        .filter(
            Staff.is_active == True,
            Staff.role != "admin",
        )
        .order_by(Staff.id.desc())
        .all()
    )

    staff_list = []

    for staff in all_staff:
        # 🔍 Get primary clinic (if exists)
        primary_clinic_assoc = next(
            (
                assoc for assoc in staff.clinic_associations
                if assoc.is_primary and assoc.is_active
            ),
            None
        )

        clinic = primary_clinic_assoc.clinic if primary_clinic_assoc else None

        staff_list.append(
            AllStaffResponse(
                id=staff.id,
                uuid=staff.uuid,
                user_id=staff.user_id,
                email=staff.email,
                first_name=staff.first_name,
                last_name=staff.last_name,
                full_name=staff.full_name,
                role=staff.role,
                npi_number=staff.npi_number,
                phone=staff.phone,
                is_profile_completed=staff.is_profile_completed,
                is_active=staff.is_active,
                clinic=(
                    ClinicResponse(
                        id=clinic.id,
                        uuid=clinic.uuid,
                        name=clinic.name,
                        address=clinic.address,
                        phone=clinic.phone,
                        fax=clinic.fax,
                        department=clinic.department,
                    )
                    if clinic else None
                ),
            )
        )

    return APIResponse(
        success=True,
        message="All active staff fetched successfully",
        data=staff_list,
    )
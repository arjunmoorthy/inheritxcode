"""
Clinic Endpoints - Doctor API
=============================

Handles clinic management operations.

Endpoints:
- GET /clinics: List all clinics
- GET /clinics/{clinic_uuid}: Get a specific clinic
- POST /clinics: Create a new clinic
- PUT /clinics/{clinic_uuid}: Update a clinic
- DELETE /clinics/{clinic_uuid}: Delete a clinic
- GET /clinics/search: Search clinics by name

All endpoints require authentication.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_doctor_db_session, TokenData
from services import ClinicService
from core.logging import get_logger
from core.schemas import APIResponse
from core.exceptions import ConflictError

logger = get_logger(__name__)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class ClinicResponse(BaseModel):
    """Clinic information response."""
    id: int | None = None
    uuid: str
    clinic_name: str
    clinic_address: Optional[str] = None
    fax_number: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True


class CreateClinicRequest(BaseModel):
    """Request to create a new clinic."""
    clinic_name: str = Field(..., min_length=1, max_length=255)
    clinic_address: str = Field(..., min_length=1, max_length=500)
    fax_number: Optional[str] = Field(None, max_length=20)


class UpdateClinicRequest(BaseModel):
    """Request to update a clinic."""
    clinic_name: Optional[str] = Field(None, min_length=1, max_length=255)
    clinic_address: Optional[str] = Field(None, max_length=500)
    fax_number: Optional[str] = Field(None, max_length=20)


class ClinicListResponse(BaseModel):
    """Paginated list of clinics."""
    clinics: List[ClinicResponse]
    total: int
    skip: int
    limit: int


class MessageResponse(BaseModel):
    """Simple message response."""
    message: str


def _to_clinic_response(clinic) -> ClinicResponse:
    """Map Clinic model fields to API response schema."""
    return ClinicResponse(
        id=clinic.id,
        uuid=str(clinic.uuid),
        clinic_name=clinic.name,
        clinic_address=clinic.address,
        fax_number=clinic.fax,
        created_at=clinic.created_at.isoformat() if clinic.created_at else None,
        updated_at=clinic.updated_at.isoformat() if clinic.updated_at else None,
    )


# =============================================================================
# Endpoints
# =============================================================================

@router.get(
    "",
    response_model=APIResponse[ClinicListResponse],
    summary="List Clinics",
    description="Get a paginated list of all clinics.",
)
async def list_clinics(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Get all clinics with pagination."""
    clinic_service = ClinicService(db)
    
    clinics = clinic_service.list_clinics(skip=skip, limit=limit)
    total = clinic_service.count_clinics()
    
    return APIResponse(
        success=True,
        message="Clinics fetched successfully",
        data=ClinicListResponse(
            clinics=[_to_clinic_response(c) for c in clinics],
            total=total,
            skip=skip,
            limit=limit,
        ),
    )


@router.get(
    "/search",
    response_model=APIResponse[List[ClinicResponse]],
    summary="Search Clinics",
    description="Search clinics by name.",
)
async def search_clinics(
    q: str = Query(..., min_length=2, description="Search term"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Search clinics by name (case-insensitive partial match)."""
    clinic_service = ClinicService(db)
    
    clinics = clinic_service.search_clinics(search_term=q, limit=limit)
    
    return APIResponse(
        success=True,
        message="Clinics fetched successfully",
        data=[_to_clinic_response(c) for c in clinics],
    )


@router.get(
    "/{clinic_uuid}",
    response_model=APIResponse[ClinicResponse],
    summary="Get Clinic",
    description="Get a specific clinic by UUID.",
)
async def get_clinic(
    clinic_uuid: UUID,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Get a clinic by its UUID."""
    clinic_service = ClinicService(db)
    
    clinic = clinic_service.get_clinic(clinic_uuid)
    
    return APIResponse(
        success=True,
        message="Clinic fetched successfully",
        data=_to_clinic_response(clinic),
    )


@router.post(
    "",
    response_model=APIResponse[ClinicResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create Clinic",
    description="Create a new clinic.",
)
async def create_clinic(
    request: CreateClinicRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Create a new clinic."""
    clinic_service = ClinicService(db)
    try:
        clinic = clinic_service.create_clinic(
            clinic_name=request.clinic_name,
            clinic_address=request.clinic_address,
            fax_number=request.fax_number,
        )
    except ConflictError as exc:
        # Align with existing API convention where duplicate resources use 400.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc
    
    return APIResponse(
        success=True,
        message="Clinic created successfully",
        data=_to_clinic_response(clinic),
    )


@router.put(
    "/{clinic_uuid}",
    response_model=APIResponse[ClinicResponse],
    summary="Update Clinic",
    description="Update an existing clinic.",
)
async def update_clinic(
    clinic_uuid: UUID,
    request: UpdateClinicRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Update a clinic's information."""
    clinic_service = ClinicService(db)

    # Treat Swagger placeholder values as "not provided" to avoid accidental overwrites.
    clinic_address = request.clinic_address
    fax_number = request.fax_number
    if clinic_address and clinic_address.strip().lower() == "string":
        clinic_address = None
    if fax_number and fax_number.strip().lower() == "string":
        fax_number = None

    clinic = clinic_service.update_clinic(
        clinic_uuid=clinic_uuid,
        clinic_name=request.clinic_name,
        address=clinic_address,
        fax_number=fax_number,
    )
    
    return APIResponse(
        success=True,
        message="Clinic updated successfully",
        data=_to_clinic_response(clinic),
    )


@router.patch(
    "/{clinic_uuid}",
    response_model=APIResponse[ClinicResponse],
    summary="Patch Clinic",
    description="Partially update clinic fields. Only provided fields are updated.",
)
async def patch_clinic(
    clinic_uuid: UUID,
    request: UpdateClinicRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Partially update a clinic's information."""
    clinic_service = ClinicService(db)

    update_data = request.model_dump(exclude_unset=True)

    # Treat Swagger placeholder values as "not provided" to avoid accidental overwrites.
    clinic_address = update_data.get("clinic_address")
    fax_number = update_data.get("fax_number")
    if isinstance(clinic_address, str) and clinic_address.strip().lower() == "string":
        clinic_address = None
        update_data.pop("clinic_address", None)
    if isinstance(fax_number, str) and fax_number.strip().lower() == "string":
        fax_number = None
        update_data.pop("fax_number", None)

    clinic = clinic_service.update_clinic(
        clinic_uuid=clinic_uuid,
        clinic_name=update_data.get("clinic_name"),
        address=update_data.get("clinic_address"),
        fax_number=update_data.get("fax_number"),
    )

    return APIResponse(
        success=True,
        message="Clinic updated successfully",
        data=_to_clinic_response(clinic),
    )


@router.delete(
    "/{clinic_uuid}",
    response_model=APIResponse[MessageResponse],
    summary="Delete Clinic",
    description="Delete a clinic.",
)
async def delete_clinic(
    clinic_uuid: UUID,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_doctor_db_session),
):
    """Delete a clinic by its UUID."""
    clinic_service = ClinicService(db)
    
    clinic_service.delete_clinic(clinic_uuid)
    
    return APIResponse(
        success=True,
        message="Clinic deleted successfully",
        data=MessageResponse(message="Clinic deleted successfully"),
    )






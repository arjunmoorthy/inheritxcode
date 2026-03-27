"""
Profile Endpoints - Patient API
================================

Endpoints for patient profile management:
- GET /: Get complete patient profile with oncology data
- PUT /: Update complete patient profile
- GET /info: Get detailed patient info
- PATCH /config: Update patient configuration
- PATCH /consent: Update consent status
"""

from uuid import UUID
from datetime import date, time, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from api.deps import get_patient_db, get_doctor_db, get_current_patient_uuid
from services import ProfileService
from core.logging import get_logger
from core.exceptions import NotFoundError
from core.schemas import APIResponse
from core import settings

logger = get_logger(__name__)

router = APIRouter()


# =============================================================================
# Request/Response Schemas
# =============================================================================

class PatientProfileResponse(BaseModel):
    """Complete patient profile response with oncology data."""
    first_name: str
    last_name: str
    email_address: str
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    reminder_time: Optional[time] = None
    doctor_name: Optional[str] = None
    clinic_name: Optional[str] = None
    # Treatment info
    diagnosis: Optional[str] = None
    treatment_type: Optional[str] = None
    chemo_plan_name: Optional[str] = None
    chemo_start_date: Optional[date] = None
    chemo_end_date: Optional[date] = None
    current_cycle: Optional[int] = None
    total_cycles: Optional[int] = None
    last_chemo_date: Optional[date] = None
    next_physician_visit: Optional[date] = None
    # Emergency contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    """Request model for updating patient profile."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    reminder_time: Optional[time] = None
    # Treatment info
    diagnosis: Optional[str] = None
    treatment_type: Optional[str] = None
    last_chemo_date: Optional[date] = None
    next_physician_visit: Optional[date] = None
    # Emergency contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PatientInfoResponse(BaseModel):
    """Detailed patient info response."""
    uuid: str
    created_at: Optional[str] = None
    email_address: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    sex: Optional[str] = None
    dob: Optional[date] = None
    mrn: Optional[str] = None
    ethnicity: Optional[str] = None
    phone_number: Optional[str] = None
    disease_type: Optional[str] = None
    treatment_type: Optional[str] = None
    is_deleted: bool


class ConfigurationUpdate(BaseModel):
    """Request model for updating configuration."""
    reminder_method: Optional[str] = None
    reminder_time: Optional[time] = None
    acknowledgement_done: Optional[bool] = None
    agreed_conditions: Optional[bool] = None


class ConsentUpdate(BaseModel):
    """Request model for updating consent."""
    acknowledgement_done: Optional[bool] = None
    agreed_conditions: Optional[bool] = None


class ConfigurationResponse(BaseModel):
    """Configuration response."""
    uuid: str
    reminder_method: Optional[str] = None
    reminder_time: Optional[time] = None
    acknowledgement_done: Optional[bool] = None
    agreed_conditions: Optional[bool] = None


class PatientProfileScreenData(BaseModel):
    """Profile fields required by patient profile screen."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    mrn: Optional[str] = None
    assigned_oncologist: Optional[str] = None
    treatment_start_date: Optional[date] = None
    treatment_end_date: Optional[date] = None
    next_chemotherapy_treatment: Optional[datetime] = None
    day_of_chemo_treatment: Optional[str] = None
    regimen_name: Optional[str] = None


class PatientProfileScreenUpdateRequest(BaseModel):
    """Updatable treatment fields for patient profile screen."""
    treatment_start_date: Optional[date] = None
    treatment_end_date: Optional[date] = None
    next_chemotherapy_treatment: Optional[date] = None
    day_of_chemo_treatment: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================

@router.get(
    "/",
    response_model=PatientProfileResponse,
    summary="Get patient profile",
    description="Get complete patient profile with doctor, clinic, and oncology info."
)
async def get_patient_profile(
    patient_db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
    patient_uuid: str = Query(..., description="Patient UUID"),
):
    """
    Fetch complete patient profile by combining data from
    both patient and doctor databases, including oncology profile.
    """
    logger.info(f"Get profile: patient={patient_uuid}")
    
    profile_service = ProfileService(patient_db, doctor_db)
    
    try:
        profile = profile_service.get_profile(UUID(patient_uuid))
        return PatientProfileResponse(**profile)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/",
    response_model=PatientProfileResponse,
    summary="Update patient profile",
    description="Update patient profile including treatment and emergency contact info."
)
async def update_patient_profile(
    update_data: ProfileUpdateRequest,
    patient_db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
    patient_uuid: str = Query(..., description="Patient UUID"),
):
    """
    Update patient profile including oncology and emergency contact data.
    """
    logger.info(f"Update profile: patient={patient_uuid}")
    
    profile_service = ProfileService(patient_db, doctor_db)
    
    try:
        profile = profile_service.update_profile(
            patient_uuid=UUID(patient_uuid),
            first_name=update_data.first_name,
            last_name=update_data.last_name,
            phone_number=update_data.phone_number,
            date_of_birth=update_data.date_of_birth,
            reminder_time=update_data.reminder_time,
            diagnosis=update_data.diagnosis,
            treatment_type=update_data.treatment_type,
            last_chemo_date=update_data.last_chemo_date,
            next_physician_visit=update_data.next_physician_visit,
            emergency_contact_name=update_data.emergency_contact_name,
            emergency_contact_phone=update_data.emergency_contact_phone,
        )
        return PatientProfileResponse(**profile)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/info",
    response_model=PatientInfoResponse,
    summary="Get patient info",
    description="Get detailed patient information."
)
async def get_patient_info(
    patient_db: Session = Depends(get_patient_db),
    patient_uuid: str = Query(..., description="Patient UUID"),
):
    """
    Get detailed patient info.
    """
    logger.info(f"Get patient info: patient={patient_uuid}")
    
    profile_service = ProfileService(patient_db)
    
    try:
        info = profile_service.get_patient_info(UUID(patient_uuid))
        return PatientInfoResponse(**info)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch(
    "/config",
    response_model=ConfigurationResponse,
    summary="Update configuration",
    description="Update patient configuration settings."
)
async def update_configuration(
    update_data: ConfigurationUpdate,
    patient_db: Session = Depends(get_patient_db),
    patient_uuid: str = Query(..., description="Patient UUID"),
):
    """
    Update patient configuration.
    """
    logger.info(f"Update config: patient={patient_uuid}")
    
    profile_service = ProfileService(patient_db)
    
    try:
        result = profile_service.update_configuration(
            patient_uuid=UUID(patient_uuid),
            reminder_method=update_data.reminder_method,
            reminder_time=update_data.reminder_time,
            acknowledgement_done=update_data.acknowledgement_done,
            agreed_conditions=update_data.agreed_conditions,
        )
        return ConfigurationResponse(**result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch(
    "/consent",
    response_model=ConfigurationResponse,
    summary="Update consent",
    description="Update patient consent status."
)
async def update_consent(
    update_data: ConsentUpdate,
    patient_db: Session = Depends(get_patient_db),
    patient_uuid: str = Query(..., description="Patient UUID"),
):
    """
    Update patient consent status.
    """
    logger.info(f"Update consent: patient={patient_uuid}")
    
    profile_service = ProfileService(patient_db)
    
    try:
        result = profile_service.update_consent(
            patient_uuid=UUID(patient_uuid),
            acknowledgement_done=update_data.acknowledgement_done,
            agreed_conditions=update_data.agreed_conditions,
        )
        return ConfigurationResponse(**result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/screen",
    response_model=APIResponse[PatientProfileScreenData],
    summary="Get patient profile screen data",
    description="Get profile screen fields for the authenticated patient.",
)
async def get_patient_profile_screen(
    doctor_db: Session = Depends(get_doctor_db),
    current_patient_uuid: UUID = Depends(get_current_patient_uuid),
    patient_uuid: Optional[UUID] = Query(
        None,
        description="Dev-only override patient UUID (used only when LOCAL_DEV_MODE=true)",
    ),
):
    """
    Return profile-screen fields:
    - first/last name
    - email
    - assigned oncologist
    - treatment start/end date
    - next chemotherapy treatment
    - day of chemo treatment
    - regimen name
    """
    effective_patient_uuid = patient_uuid if (settings.local_dev_mode and patient_uuid is not None) else current_patient_uuid

    row = doctor_db.execute(
        text(
            """
            SELECT
                fp.first_name,
                fp.last_name,
                u.email,
                fp.mrn,
                COALESCE(
                    NULLIF(
                        string_agg(
                            DISTINCT NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')),
                            ''),
                            ', '
                        ),
                        ''
                    ),
                    fp.oncologist
                ) AS assigned_oncologist,
                fp.start_date AS treatment_start_date,
                fp.end_date AS treatment_end_date,
                fp.next_chemotherapy_at AS next_chemotherapy_treatment,
                fp.chemotherapy_day AS day_of_chemo_treatment,
                fp.regimen_name
            FROM fax_patients fp
            JOIN users u ON u.id = fp.user_id
            LEFT JOIN physician_patients pp
                ON pp.patient_id = fp.id
                AND pp.is_active = true
            LEFT JOIN staff s ON s.id = pp.physician_id
            LEFT JOIN users pu ON pu.id = s.user_id
            WHERE u.uuid = :patient_uuid
            GROUP BY fp.id, u.id
            """
        ),
        {"patient_uuid": str(effective_patient_uuid)},
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    return APIResponse(
        success=True,
        message="Patient profile screen data fetched successfully",
        data=PatientProfileScreenData(
            first_name=row["first_name"],
            last_name=row["last_name"],
            email=row["email"],
            mrn=row["mrn"],
            assigned_oncologist=row["assigned_oncologist"],
            treatment_start_date=row["treatment_start_date"],
            treatment_end_date=row["treatment_end_date"],
            next_chemotherapy_treatment=row["next_chemotherapy_treatment"],
            day_of_chemo_treatment=row["day_of_chemo_treatment"],
            regimen_name=row["regimen_name"],
        ),
    )


@router.patch(
    "/screen",
    response_model=APIResponse[PatientProfileScreenData],
    summary="Update patient profile screen fields",
    description="Update allowed treatment fields for the authenticated patient.",
)
async def update_patient_profile_screen(
    body: PatientProfileScreenUpdateRequest,
    doctor_db: Session = Depends(get_doctor_db),
    current_patient_uuid: UUID = Depends(get_current_patient_uuid),
    patient_uuid: Optional[UUID] = Query(
        None,
        description="Dev-only override patient UUID (used only when LOCAL_DEV_MODE=true)",
    ),
):
    """
    Updatable fields:
    - treatment_start_date
    - treatment_end_date
    - next_chemotherapy_treatment
    - day_of_chemo_treatment
    """
    effective_patient_uuid = patient_uuid if (settings.local_dev_mode and patient_uuid is not None) else current_patient_uuid

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    set_clauses = []
    params = {"patient_uuid": str(effective_patient_uuid)}

    if "treatment_start_date" in updates:
        set_clauses.append("start_date = :start_date")
        params["start_date"] = updates["treatment_start_date"]
    if "treatment_end_date" in updates:
        set_clauses.append("end_date = :end_date")
        params["end_date"] = updates["treatment_end_date"]
    if "next_chemotherapy_treatment" in updates:
        set_clauses.append("next_chemotherapy_at = :next_chemotherapy_at")
        next_chemo_date = updates["next_chemotherapy_treatment"]
        params["next_chemotherapy_at"] = (
            datetime.combine(next_chemo_date, time.min) if next_chemo_date else None
        )
    if "day_of_chemo_treatment" in updates:
        set_clauses.append("chemotherapy_day = :chemotherapy_day")
        params["chemotherapy_day"] = updates["day_of_chemo_treatment"]

    result = doctor_db.execute(
        text(
            f"""
            UPDATE fax_patients fp
            SET {", ".join(set_clauses)}
            FROM users u
            WHERE fp.user_id = u.id
              AND u.uuid = :patient_uuid
            """
        ),
        params,
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    doctor_db.commit()

    # Return latest profile screen payload after update
    row = doctor_db.execute(
        text(
            """
            SELECT
                fp.first_name,
                fp.last_name,
                u.email,
                fp.mrn,
                COALESCE(
                    NULLIF(
                        string_agg(
                            DISTINCT NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')),
                            ''),
                            ', '
                        ),
                        ''
                    ),
                    fp.oncologist
                ) AS assigned_oncologist,
                fp.start_date AS treatment_start_date,
                fp.end_date AS treatment_end_date,
                fp.next_chemotherapy_at AS next_chemotherapy_treatment,
                fp.chemotherapy_day AS day_of_chemo_treatment,
                fp.regimen_name
            FROM fax_patients fp
            JOIN users u ON u.id = fp.user_id
            LEFT JOIN physician_patients pp
                ON pp.patient_id = fp.id
                AND pp.is_active = true
            LEFT JOIN staff s ON s.id = pp.physician_id
            LEFT JOIN users pu ON pu.id = s.user_id
            WHERE u.uuid = :patient_uuid
            GROUP BY fp.id, u.id
            """
        ),
        {"patient_uuid": str(effective_patient_uuid)},
    ).mappings().first()

    return APIResponse(
        success=True,
        message="Patient profile screen updated successfully",
        data=PatientProfileScreenData(
            first_name=row["first_name"],
            last_name=row["last_name"],
            email=row["email"],
            mrn=row["mrn"],
            assigned_oncologist=row["assigned_oncologist"],
            treatment_start_date=row["treatment_start_date"],
            treatment_end_date=row["treatment_end_date"],
            next_chemotherapy_treatment=row["next_chemotherapy_treatment"],
            day_of_chemo_treatment=row["day_of_chemo_treatment"],
            regimen_name=row["regimen_name"],
        ),
    )

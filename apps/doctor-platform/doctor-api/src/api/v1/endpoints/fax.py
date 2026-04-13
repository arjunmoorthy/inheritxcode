from datetime import date, datetime, timedelta
import json
import textwrap
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status, UploadFile
from pydantic import BaseModel, EmailStr, Field, HttpUrl
from sqlalchemy.orm import Session

from api.deps import TokenData, get_doctor_db_session, get_patient_db_session
from db.models.user import User
from db.models.staff import PhysicianPatient, Staff
from db.models.fax_models import FaxRecord, Patient
from services.fax_patient_service import create_or_update_fax_patient, parse_date
from services.structured_extractor import extract_structured_fields, flatten_structured_data
from utils.s3 import upload_file_to_s3, upload_file_to_s3_with_presigned_url
from utils.security import verify_password, hash_password, generate_random_password
from pydantic import model_validator
from helpers.email import send_welcome_email
from api.deps import require_roles
from core.config import settings
from core.logging import get_logger
from api.v1.endpoints.dashboard import assert_staff_can_access_dashboard_patient, get_patient_trends
from services.main import extract_structured_fields_dynamic
from utils.simple_pdf import build_patient_dashboard_pdf_from_url

router = APIRouter()
logger = get_logger(__name__)

def _extract_s3_bucket_and_key(s3_url: str) -> tuple[str, str]:
    """
    Parse S3 URL and return (bucket, key).
    Supports:
    - Virtual-hosted style: https://<bucket>.s3.<region>.amazonaws.com/<key>
    - Path style:           https://s3.<region>.amazonaws.com/<bucket>/<key>
    """
    parsed = urlparse(s3_url)
    if not parsed.netloc:
        raise ValueError(f"Invalid S3 URL (missing host): {s3_url}")

    host = parsed.netloc.strip().lower()
    raw_path = (parsed.path or "").lstrip("/")
    # URLs can contain encoded chars (spaces etc.); boto3 expects decoded key.
    decoded_path = unquote(raw_path)

    if not decoded_path:
        raise ValueError(f"Invalid S3 URL (missing object path): {s3_url}")

    # Path-style host (bucket is first path segment): s3.<region>.amazonaws.com
    if host.startswith("s3.") or host == "s3.amazonaws.com":
        parts = decoded_path.split("/", 1)
        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise ValueError(f"Invalid path-style S3 URL: {s3_url}")
        return parts[0], parts[1]

    # Virtual-hosted style (bucket is host prefix before .s3...)
    marker = ".s3."
    if marker in host:
        bucket = host.split(marker, 1)[0]
    elif host.endswith(".s3.amazonaws.com"):
        bucket = host[: -len(".s3.amazonaws.com")]
    else:
        raise ValueError(f"Unsupported S3 host format: {s3_url}")

    if not bucket:
        raise ValueError(f"Invalid virtual-hosted S3 URL (missing bucket): {s3_url}")

    return bucket, decoded_path


# -----------------------------------------------------------------------------
# Manual Add Patient - same fields as structured_extractor / fax_patients table
# -----------------------------------------------------------------------------

class AddManualPatientRequest(BaseModel):
    """Request body for manually adding a patient to fax_patients. All fields optional."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mrn: Optional[str] = None
    date_of_birth: Optional[str] = None  # e.g. "2/1/1990", "1990-02-01"
    age: Optional[int] = None
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    bmi: Optional[str] = None
    location: Optional[str] = None
    cancer_type: Optional[str] = None
    diagnosis: Optional[str] = None
    oncologist: Optional[str] = None
    oncologist_staff_id: Optional[int] = None
    chemotherapy_day: Optional[str] = None
    next_chemotherapy_date: Optional[str] = None
    physician_ids: Optional[List[int]] = None
    start_date: Optional[str] = None     # e.g. "6/30/2025"
    end_date: Optional[str] = None
    plan_name: Optional[str] = None
    regimen_name: Optional[str] = None
    past_medical_history: Optional[str] = None
    past_surgical_history: Optional[str] = None


@router.post("/patients", status_code=201)
async def add_manual_patient(
    request: AddManualPatientRequest,
    current_user: TokenData = Depends(require_roles("physician", "nurse", "admin")),
    db: Session = Depends(get_doctor_db_session),
):
    """
    Add a patient manually to fax_patients table.
    Uses the same fields as extracted by structured_extractor from OCR.
    """
    if not any([request.first_name, request.last_name, request.phone_number, request.email]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of: first_name, last_name, phone_number, or email",
        )

    first_name = request.first_name
    last_name = request.last_name
    email = str(request.email) if request.email else None

    user = None
    if email:
        existing = db.query(User).filter(User.email == email, User.role == "patient").first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A patient with this email already exists.",
            )
        temp_password = generate_random_password()
        user = User(
            email=email,
            password_hash=hash_password(temp_password),
            role="patient",
            auth_provider="local",
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_verified=False,
            is_first_login=True,
        )
        db.add(user)
        db.flush()

    oncologist_staff_id = request.oncologist_staff_id
    if oncologist_staff_id is not None:
        oncologist_staff = db.query(Staff).filter(Staff.id == oncologist_staff_id).first()
        if not oncologist_staff:
            raise HTTPException(
                status_code=404,
                detail=f"Staff with id {oncologist_staff_id} not found",
            )
        if oncologist_staff.role != "physician":
            raise HTTPException(
                status_code=400,
                detail=f"Staff id {oncologist_staff_id} is not a physician",
            )

    patient = Patient(
        user_id=user.id if user else None,
        mrn=request.mrn,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=parse_date(request.date_of_birth),
        gender=request.gender,
        phone_number=request.phone_number,
        email=email,
        age=request.age,
        bmi=request.bmi,
        location=request.location,
        cancer_type=request.cancer_type,
        diagnosis=request.diagnosis,
        oncologist=request.oncologist,
        oncologist_staff_id=oncologist_staff_id,
        chemotherapy_day=request.chemotherapy_day,
        next_chemotherapy_at=parse_date(request.next_chemotherapy_date),
        start_date=parse_date(request.start_date),
        end_date=parse_date(request.end_date),
        plan_name=request.plan_name,
        regimen_name=request.regimen_name,
        past_medical_history=request.past_medical_history,
        past_surgical_history=request.past_surgical_history,
        password_hash="",
    )
    db.add(patient)
    db.flush()

    if request.physician_ids:
        for physician_id in request.physician_ids:

            physician = db.query(Staff).filter(
                Staff.id == physician_id
            ).first()

            if not physician:
                raise HTTPException(
                    status_code=404,
                    detail=f"Staff with id {physician_id} not found"
                )

            if physician.role != "physician":
                raise HTTPException(
                    status_code=400,
                    detail=f"Staff id {physician_id} is not a physician"
                )

            assignment = PhysicianPatient(
                physician_id=physician_id,
                patient_id=patient.id
            )

            db.add(assignment)

    db.commit()
    db.refresh(patient)

    user = db.query(User).filter(User.id == patient.user_id).first() if patient.user_id else None

    if user and email:
        login_link = settings.patient_set_password_base_url.format(email=email)
        await send_welcome_email(email, temp_password, login_link, user.first_name)

    return {
        "status": "success",
        "patient_id": patient.id,
        "message": "Patient added to fax_patients",
    }


class ChangePasswordRequest(BaseModel):
    email: EmailStr
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match.")
        return self


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_doctor_db_session),
):
    """
    Change password for patient, nurse, or physician.
    Uses temp password sent via email as current_password.
    """

    # 🔍 Find user by email (no role restriction)
    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # 🔐 Validate current password
    if not user.password_hash or not verify_password(
        request.current_password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # 🔑 Update password
    user.password_hash = hash_password(request.new_password)
    user.is_first_login = False

    db.commit()

    return {
        "status": "success",
        "message": "Password changed successfully.",
    }

class Price(BaseModel):
    currency_code: str
    amount: str


class FaxDetails(BaseModel):
    id: str
    direction: str
    from_: str = Field(alias="from")   # ✅ FIXED HERE
    to: str
    numberOfPages: int
    status: str
    headerTimeZone: Optional[str] = None
    retryDelaySeconds: Optional[int] = None
    resolution: Optional[str] = None
    callbackUrl: Optional[HttpUrl] = None
    callbackUrlContentType: Optional[str] = None
    pricePerPage: Optional[str] = None
    projectId: Optional[str] = None
    serviceId: Optional[str] = None
    price: Optional[Price] = None
    maxRetries: Optional[int] = None
    createTime: Optional[datetime] = None
    headerText: Optional[str] = None
    completedTime: Optional[datetime] = None
    headerPageNumbers: Optional[bool] = None
    hasFile: Optional[bool] = None
    currencyCode: Optional[str] = None
    amount: Optional[str] = None

    model_config = {
        "populate_by_name": True
    }


class InboundFaxWebhook(BaseModel):
    event: str
    eventTime: datetime
    fax: FaxDetails


class OutgoingFaxRequest(BaseModel):
    to: str = Field(..., min_length=3, max_length=32, description="Recipient fax number in E.164 format")
    from_number: Optional[str] = Field(
        default=None,
        alias="from",
        min_length=3,
        max_length=32,
        description="Sender fax number in E.164 format. Defaults to SINCH_FAX_FROM_NUMBER",
    )
    contentUrl: HttpUrl = Field(..., description="Publicly accessible PDF URL")
    callbackUrl: Optional[HttpUrl] = Field(default=None, description="Optional status callback URL")

    model_config = {"populate_by_name": True}


class OutgoingPatientSymptomsFaxRequest(BaseModel):
    to: str = Field(..., min_length=3, max_length=32, description="Recipient fax number in E.164 format")
    from_number: Optional[str] = Field(
        default=None,
        alias="from",
        min_length=3,
        max_length=32,
        description="Sender fax number in E.164 format. Defaults to SINCH_FAX_FROM_NUMBER",
    )
    callbackUrl: Optional[HttpUrl] = Field(default=None, description="Optional status callback URL")
    days: int = Field(default=30, ge=1, le=90, description="Number of past days to include in report")

    model_config = {"populate_by_name": True}


async def _submit_sinch_fax(
    to: str,
    content_url: str,
    from_number_override: Optional[str] = None,
    callback_url: Optional[str] = None,
) -> Dict[str, Any]:
    if not settings.sinch_fax_project_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sinch fax project ID is not configured",
        )
    if not settings.sinch_fax_access_key or not settings.sinch_fax_access_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sinch fax credentials are not configured",
        )

    from_number = from_number_override or settings.sinch_fax_from_number
    if not from_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'from' number is required (either in payload or SINCH_FAX_FROM_NUMBER)",
        )

    request_payload: Dict[str, Any] = {
        "to": to,
        "from": from_number,
        "contentUrl": content_url,
    }
    if callback_url:
        request_payload["callbackUrl"] = callback_url

    endpoint = (
        f"{settings.sinch_fax_base_url.rstrip('/')}/projects/"
        f"{settings.sinch_fax_project_id}/faxes"
    )
    logger.info(
        "Submitting Sinch fax request | to=%s from=%s contentUrl=%s callback=%s endpoint=%s",
        to,
        from_number,
        content_url,
        callback_url,
        endpoint,
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                endpoint,
                auth=(settings.sinch_fax_access_key, settings.sinch_fax_access_secret),
                json=request_payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.RequestError as exc:
        logger.error("Sinch fax request failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach Sinch fax API",
        )

    if response.status_code >= 400:
        try:
            sinch_error = response.json()
        except ValueError:
            sinch_error = {"message": response.text}
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Sinch rejected outgoing fax request",
                "sinch_status_code": response.status_code,
                "sinch_error": sinch_error,
            },
        )

    try:
        parsed = response.json()
        logger.info(
            "Sinch fax accepted | status_code=%s fax_id=%s current_status=%s",
            response.status_code,
            parsed.get("id"),
            parsed.get("status"),
        )
        return parsed
    except ValueError:
        logger.warning("Sinch returned non-JSON success response")
        return {"raw_response": response.text}


@router.post("/outgoing", status_code=status.HTTP_201_CREATED)
async def send_outgoing_fax(
    payload: OutgoingFaxRequest,
    current_user: TokenData = Depends(require_roles("physician", "nurse", "admin")),
):
    """
    Send an outgoing fax through Sinch Fax API.
    """
    result = await _submit_sinch_fax(
        to=payload.to,
        content_url=str(payload.contentUrl),
        from_number_override=payload.from_number,
        callback_url=str(payload.callbackUrl) if payload.callbackUrl else None,
    )

    return {
        "status": "success",
        "message": "Outgoing fax request submitted to Sinch",
        "data": result,
    }


@router.post("/outgoing/patient/{patient_uuid}/symptoms", status_code=status.HTTP_201_CREATED)
async def send_patient_symptoms_fax(
    patient_uuid: uuid.UUID,
    payload: OutgoingPatientSymptomsFaxRequest,
    request: Request,
    current_user: User = Depends(require_roles("physician", "nurse", "admin")),
    db: Session = Depends(get_doctor_db_session),
    patient_db: Session = Depends(get_patient_db_session),
):
    """
    Build a patient symptom PDF report and send it as an outgoing fax through Sinch.
    """
    assert_staff_can_access_dashboard_patient(db, current_user, patient_uuid)

    patient = (
        db.query(Patient)
        .join(User, User.id == Patient.user_id)
        .filter(User.uuid == patient_uuid)
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found for this identifier",
        )

    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=payload.days)
    trends = get_patient_trends(
        patient_uuid=patient_uuid,
        start_date=start_date,
        end_date=end_date,
        current_user=current_user,
        patient_db=patient_db,
        doctor_db=db,
    )
    logger.info(
        "Preparing symptom fax report | patient_uuid=%s days=%s severity_series=%s temp_points=%s medication_rows=%s",
        str(patient_uuid),
        payload.days,
        len(getattr(trends, "severity_series", []) or []),
        len(getattr(trends, "temperature_series", []) or []),
        len(getattr(trends, "medications", []) or []),
    )

    authorization_header = request.headers.get("authorization", "")
    access_token = (
        authorization_header.split(" ", 1)[1].strip()
        if authorization_header.lower().startswith("bearer ")
        else ""
    )
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )

    # Build frontend dashboard URL with caller token
    dashboard_url = (
        f"https://oncolife-doctor.inheritxdev.in/public/fax-preview/{patient_uuid}"
        f"?token={access_token}&start_date={start_date.isoformat()}&end_date={end_date.isoformat()}"
    )

    pdf_bytes = await build_patient_dashboard_pdf_from_url(
        url=dashboard_url,
    )
    logger.info(
        "Generated PDF report | patient_uuid=%s bytes=%s first_16_bytes_hex=%s",
        str(patient_uuid),
        len(pdf_bytes),
        pdf_bytes[:16].hex() if pdf_bytes else "",
    )

    report_filename = f"symptoms_report_{patient_uuid}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    object_url, content_url = upload_file_to_s3_with_presigned_url(
        pdf_bytes,
        report_filename,
        expires_in_seconds=86400,
    )
    logger.info(
        "Uploaded PDF to S3 | patient_uuid=%s file=%s objectUrl=%s presignedContentUrl=%s",
        str(patient_uuid),
        report_filename,
        object_url,
        content_url,
    )

    # Validate the uploaded PDF is publicly retrievable for Sinch conversion.
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            head_response = await client.head(content_url)
            if head_response.status_code >= 400 or head_response.status_code == 405:
                get_response = await client.get(content_url)
                logger.info(
                    "S3 PDF GET check | status=%s content_type=%s content_length=%s",
                    get_response.status_code,
                    get_response.headers.get("content-type"),
                    get_response.headers.get("content-length"),
                )
            else:
                logger.info(
                    "S3 PDF HEAD check | status=%s content_type=%s content_length=%s",
                    head_response.status_code,
                    head_response.headers.get("content-type"),
                    head_response.headers.get("content-length"),
                )
    except Exception as e:
        logger.warning("S3 accessibility check failed for contentUrl=%s error=%s", content_url, str(e))

    sinch_result = await _submit_sinch_fax(
        to=payload.to,
        content_url=content_url,
        from_number_override=payload.from_number,
        callback_url=str(payload.callbackUrl) if payload.callbackUrl else None,
    )

    return {
        "status": "success",
        "message": "Patient symptom report generated and fax request submitted to Sinch",
        "data": {
            "patient_uuid": str(patient_uuid),
            "dashboard_url": dashboard_url,
            "contentUrl": content_url,
            "sinch": sinch_result,
        },
    }

@router.post("/inbound-webhook")
async def inbound_fax_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_doctor_db_session)):
    content_type = request.headers.get("content-type", "")
    s3_file_url: Optional[str] = None

    if "application/json" in content_type:
        # JSON payload has no file attachment - we need a file for OCR
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fax webhook with JSON cannot process files. Use multipart/form-data with a file attachment.",
        )

    elif "multipart/form-data" in content_type:
        form = await request.form()
        fax_data = form.get("fax")
        fax = json.loads(fax_data) if fax_data else {}

        fax_id = fax.get("id")
        from_number = fax.get("from")
        to_number = fax.get("to")
        received_at = fax.get("completedTime")

        file: Optional[UploadFile] = form.get("file")
        if file and file.filename:
            contents = await file.read()
            s3_file_url = upload_file_to_s3(contents, file.filename)

        if not s3_file_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File attachment required. Provide a PDF file in the 'file' field.",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported content type. Use multipart/form-data with fax metadata and file.",
        )


    # ============================
    # Convert datetime
    # ============================

    if isinstance(received_at, str):

        received_at = datetime.fromisoformat(
            received_at.replace("Z", "+00:00")
        )

    else:

        received_at = datetime.utcnow()


    # ============================
    # Store in Database
    # ============================

    fax_record = FaxRecord(

        fax_id=fax_id,

        from_number=from_number,

        to_number=to_number,

        file_url=s3_file_url,

        stored_file_path=s3_file_url,

        raw_ocr_text=None,

        ocr_status="pending",

        received_at=received_at

    )


    db.add(fax_record)

    db.commit()

    db.refresh(fax_record)


    print("Fax stored in DB:", fax_record.id)

    # 🔥 TRIGGER OCR AUTOMATICALLY (NON-BLOCKING)
    background_tasks.add_task(run_fax_ocr_task, fax_record.id)


    return {
        "status": "success",
        "fax_db_id": fax_record.id,
        "file_url": s3_file_url
    }

def run_fax_ocr_task(fax_record_id: int):
    from db.models.fax_models import FaxRecord
    from utils.textract import run_textract_from_s3
    from db.session import DoctorSessionLocal

    db = DoctorSessionLocal()
    fax = None  # ✅ IMPORTANT
    background_tasks = BackgroundTasks()

    logger.info("OCR task started | fax_record_id=%s", fax_record_id)

    try:
        fax = db.query(FaxRecord).get(fax_record_id)
        if not fax:
            logger.warning("OCR task aborted: fax record not found | fax_record_id=%s", fax_record_id)
            return

        # Parse stored S3 URL (supports path-style and virtual-hosted style)
        parsed = urlparse(fax.file_url)
        bucket, key = _extract_s3_bucket_and_key(fax.file_url)

        logger.info(
            "OCR input parsed | fax_record_id=%s file_url=%s scheme=%s netloc=%s bucket=%s key=%s",
            fax_record_id,
            fax.file_url,
            parsed.scheme,
            parsed.netloc,
            bucket,
            key,
        )

        fax.ocr_status = "processing"
        db.commit()
        logger.info("OCR status updated to processing | fax_record_id=%s", fax_record_id)

        # 🔹 PASS HERE
        logger.info("Calling Textract start_document_text_detection | fax_record_id=%s", fax_record_id)
        text = run_textract_from_s3(bucket, key)
        logger.info(
            "Textract completed successfully | fax_record_id=%s lines=%s avg_confidence=%s",
            fax_record_id,
            len(text.get("lines", []) or []),
            text.get("avg_confidence"),
        )

        structured_data = extract_structured_fields_dynamic(text["lines"])
        structured_data = flatten_structured_data(structured_data)
        fax.structured_ocr_data = structured_data
        logger.info(
            "Structured OCR extraction completed | fax_record_id=%s structured_keys=%s",
            fax_record_id,
            sorted(list(structured_data.keys())) if isinstance(structured_data, dict) else [],
        )


        try:
            fax.raw_ocr_text = text["text"]
            fax.ocr_confidence = text["avg_confidence"]
            fax.structured_ocr_data = structured_data
            fax.ocr_status = "success"
            db.commit()
            logger.info("OCR persisted successfully | fax_record_id=%s", fax_record_id)

            create_or_update_fax_patient(db, fax, structured_data, background_tasks)
            logger.info("Patient create/update completed from OCR | fax_record_id=%s", fax_record_id)

        except Exception as e:
            db.rollback()
            fax.ocr_status = "failed"
            db.commit()
            logger.exception(
                "Failed while persisting OCR or creating/updating patient | fax_record_id=%s error=%s",
                fax_record_id,
                str(e),
            )
            raise e
            


    except Exception as e:
        logger.exception("OCR task failed | fax_record_id=%s error=%s", fax_record_id, str(e))
        if fax:
            fax.ocr_status = "failed"
            db.commit()
            logger.info("OCR status updated to failed | fax_record_id=%s", fax_record_id)

    finally:
        db.close()
        logger.info("OCR task finished | fax_record_id=%s", fax_record_id)

from datetime import datetime
import json
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status, UploadFile
from pydantic import BaseModel, EmailStr, Field, HttpUrl
from sqlalchemy.orm import Session

from api.deps import TokenData, get_doctor_db_session
from db.models.user import User
from db.models.staff import PhysicianPatient, Staff
from db.models.fax_models import FaxRecord, Patient
from services.fax_patient_service import create_or_update_fax_patient, parse_date
from services.structured_extractor import extract_structured_fields, flatten_structured_data
from utils.s3 import upload_file_to_s3
from utils.security import verify_password, hash_password, generate_random_password
from pydantic import model_validator
from helpers.email import send_welcome_email
from api.deps import require_roles
from core.config import settings
from services.main import extract_structured_fields_dynamic

router = APIRouter()


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
    from urllib.parse import urlparse
    from db.session import DoctorSessionLocal

    db = DoctorSessionLocal()
    fax = None  # ✅ IMPORTANT
    background_tasks = BackgroundTasks()

    print(f"Starting OCR task for fax_record_id={fax_record_id}")

    try:
        fax = db.query(FaxRecord).get(fax_record_id)
        if not fax:
            return

        # 🔹 Parse S3 URL stored in DB
        parsed = urlparse(fax.file_url)

        bucket = parsed.netloc.replace(".s3.us-east-1.amazonaws.com", "")
        key = parsed.path.lstrip("/")

        print("OCR BUCKET:", bucket)
        print("OCR KEY:", key)

        fax.ocr_status = "processing"
        db.commit()

        # 🔹 PASS HERE
        text = run_textract_from_s3(bucket, key)

        structured_data = extract_structured_fields_dynamic(text["lines"])
        structured_data = flatten_structured_data(structured_data)
        fax.structured_ocr_data = structured_data


        try:
            fax.raw_ocr_text = text["text"]
            fax.ocr_confidence = text["avg_confidence"]
            fax.structured_ocr_data = structured_data
            fax.ocr_status = "success"
            db.commit()

            create_or_update_fax_patient(db, fax, structured_data, background_tasks)

            print("Patient created/updated from OCR data successfully")

        except Exception as e:
            db.rollback()
            fax.ocr_status = "failed"
            db.commit()
            print("Failed to create/update patient from OCR data:", str(e))
            raise e
            


    except Exception as e:
        print("OCR failed:", str(e))
        if fax:
            fax.ocr_status = "failed"
            db.commit()

    finally:
        db.close()

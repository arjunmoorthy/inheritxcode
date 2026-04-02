import asyncio
import re
from datetime import datetime

from fastapi import BackgroundTasks
from sqlalchemy import func

from core.config import settings
from db.models.fax_models import Patient
from db.models.staff import PhysicianPatient, Staff
from db.models.user import User
from helpers.email import send_welcome_email
from utils.name_spilt import split_name
from utils.security import generate_random_password, hash_password

# Multiple date formats (order can matter: more specific first)
_DATE_FORMATS = [
    "%m/%d/%y",      # 2/1/26
    "%m/%d/%Y",      # 2/1/2026
    "%d/%m/%y",      # 1/2/26 (day first)
    "%d/%m/%Y",      # 1/2/2026
    "%m-%d-%y",      # 2-1-26
    "%m-%d-%Y",      # 2-1-2026
    "%d-%m-%y",      # 1-2-26
    "%d-%m-%Y",      # 1-2-2026
    "%Y-%m-%d",      # 2026-02-01
    "%B %d, %Y",     # February 1, 2026
    "%b %d, %Y",     # Feb 1, 2026
    "%d %B %Y",      # 1 February 2026
    "%d %b %Y",      # 1 Feb 2026
    "%B %d %Y",      # February 1 2026
    "%b %d %Y",      # Feb 1 2026
]

DEFAULT_FAX_PHYSICIAN_EMAIL = "defaultdoctor@yopmail.com"


def parse_date(value: str):
    """
    Converts various date strings to date.
    Handles: '2/1/26', '6/30/2025 (Planned)', '15-01-1990', 'January 15, 1990', etc.
    """
    if not value:
        return None

    # Remove parenthetical text like "(Planned)" or trailing text
    cleaned = re.sub(r"\s*\(.*?\)\s*", " ", value).strip()
    cleaned = re.sub(r"\s+(planned|actual|estimated).*$", "", cleaned, flags=re.IGNORECASE).strip()

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    # Try extracting first date-like substring (e.g. "Start 2/1/26 something")
    date_match = re.search(
        r"\b(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{2,4}[/\-]\d{1,2}[/\-]\d{1,2})\b",
        cleaned,
    )
    if date_match:
        segment = date_match.group(1)
        for fmt in ("%m/%d/%y", "%m/%d/%Y", "%d/%m/%y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(segment, fmt).date()
            except ValueError:
                continue

    return None


def _find_default_fax_physician(db):
    return (
        db.query(Staff)
        .filter(
            Staff.role == "physician",
            Staff.is_active == True,
            func.lower(func.coalesce(Staff.email, "")) == DEFAULT_FAX_PHYSICIAN_EMAIL,
        )
        .first()
    )


def _assign_default_physician_if_needed(db, patient: Patient):
    if not patient or not patient.id:
        return

    existing_assignment = (
        db.query(PhysicianPatient)
        .filter(
            PhysicianPatient.patient_id == patient.id,
            PhysicianPatient.is_active == True,
        )
        .first()
    )
    if existing_assignment:
        return

    default_physician = _find_default_fax_physician(db)
    if not default_physician:
        return

    db.add(
        PhysicianPatient(
            physician_id=default_physician.id,
            patient_id=patient.id,
        )
    )


def _resolve_oncologist_staff_id(db, oncologist_value: str):
    if not oncologist_value:
        return None

    raw = oncologist_value.strip()
    if not raw:
        return None

    if "@" in raw:
        by_email = (
            db.query(Staff)
            .filter(
                Staff.role == "physician",
                func.lower(Staff.email) == raw.lower(),
            )
            .first()
        )
        return by_email.id if by_email else None

    first_name, last_name = split_name(raw)
    if first_name and last_name:
        by_full_name = (
            db.query(Staff)
            .join(User, User.id == Staff.user_id)
            .filter(
                Staff.role == "physician",
                func.lower(func.coalesce(User.first_name, "")) == first_name.lower(),
                func.lower(func.coalesce(User.last_name, "")) == last_name.lower(),
            )
            .first()
        )
        return by_full_name.id if by_full_name else None

    return None

def create_or_update_fax_patient(db, fax, structured, background_tasks: BackgroundTasks):

    def v(key):
        return structured.get(key)
    login_link = settings.patient_set_password_base_url.format(email=v("email"))
 
    first_name, last_name = split_name(v("name"))
    phone = v("phone_number")
    email = v("email")
    mrn = v("mrn")

    dob = parse_date(v("date_of_birth"))
    start_date = parse_date(v("start_date"))
    end_date = parse_date(v("end_date"))
    oncologist_name = v("oncologist")
    oncologist_staff_id = _resolve_oncologist_staff_id(db, oncologist_name)

    patient = None
    if email:
        patient = db.query(Patient).filter(Patient.email == email).first()

    is_new_patient = patient is None

    if is_new_patient:
        temp_password = generate_random_password()

        # Create User for patient portal auth (single auth table; role=patient)
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

        patient = Patient(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            mrn=mrn,
            gender=v("gender"),
            date_of_birth=dob,
            age=int(v("age")) if v("age") else None,
            phone_number=phone,
            email=email,
            bmi=v("bmi"),
            plan_name=v("plan_name"),
            start_date=start_date,
            end_date=end_date,
            past_medical_history=v("past_medical_history"),
            past_surgical_history=v("past_surgical_history"),
            regimen_name=v("start_on_pathway_regimen") or v("regimen_name"),
            oncologist=oncologist_name,
            oncologist_staff_id=oncologist_staff_id,
            password_hash="",  # auth in users table
        )

        db.add(patient)
        print("New patient created with email:", email)

        if email:
            print("📧 About to send welcome email...")
            asyncio.run(send_welcome_email(email, temp_password, login_link, first_name))
            print("✅ Email send function executed")

    else:
        patient.first_name = first_name
        patient.last_name = last_name
        patient.gender = v("gender")
        patient.date_of_birth = dob
        patient.age = int(v("age")) if v("age") else None
        patient.phone_number = phone
        patient.bmi = v("bmi")
        patient.plan_name = v("plan_name")
        patient.start_date = start_date
        patient.end_date = end_date
        patient.past_medical_history = v("past_medical_history")
        patient.past_surgical_history = v("past_surgical_history")
        patient.regimen_name = v("start_on_pathway_regimen") or v("regimen_name")
        patient.oncologist = oncologist_name
        patient.oncologist_staff_id = oncologist_staff_id

    db.commit()
    db.refresh(patient)

    # OCR-created fax patients currently have no manual doctor selection, so
    # attach them to the dedicated fallback physician when available.
    _assign_default_physician_if_needed(db, patient)

    fax.patient_id = patient.id
    db.commit()

    return patient
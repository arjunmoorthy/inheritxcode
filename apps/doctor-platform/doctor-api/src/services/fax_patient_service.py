import asyncio
import re
from datetime import datetime
from typing import Optional, Tuple

from fastapi import BackgroundTasks
from sqlalchemy import func

from core.config import settings
from db.models.clinic import Clinic
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

# Optional leading honorific — only removed when present; plain "Jane Smith" is unchanged.
_ONCOLOGIST_TITLE_PREFIX = re.compile(
    r"^\s*(dr\.?|doctor)\s+",
    re.IGNORECASE,
)
# Optional trailing credentials — e.g. "Jane Smith, MD" (no leading Dr.)
_ONCOLOGIST_TRAILING_CREDENTIALS = re.compile(
    r"\s*,?\s*(md|m\.d\.|phd|ph\.d\.|d\.o\.|do|mbbs|frcp)\s*$",
    re.IGNORECASE,
)
# OCR noise before the real name (e.g. ". Abhishek Patel" in fax_patients)
_ONCOLOGIST_LEADING_JUNK = re.compile(r"^[\s.,;:\-_•·]+")
_ONCO_PLACEHOLDER_TOKENS = frozenset(
    {
        "string",
        "text",
        "null",
        "none",
        "n/a",
        "na",
        "test",
        "sample",
        "placeholder",
        "unknown",
        "oncologist",
        "name",
    }
)


def _coerce_oncologist_str(value) -> Optional[str]:
    """Structured OCR may still be dict {\"value\": \"...\"} in some paths; fax_patients stores a string."""
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("value")
    if not isinstance(value, str):
        return None
    s = value.strip()
    return s or None


def _coerce_location_str(value) -> Optional[str]:
    """Structured OCR location may be plain string or {'value': '...'}."""
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("value")
    if not isinstance(value, str):
        return None
    s = value.strip()
    return s or None


def _ensure_clinic_exists_by_name(db, clinic_name: Optional[str]) -> None:
    """Create clinic if missing, using case-insensitive name match."""
    if not clinic_name:
        return

    existing = (
        db.query(Clinic)
        .filter(func.lower(func.trim(Clinic.name)) == clinic_name.lower())
        .first()
    )
    if existing:
        return

    db.add(Clinic(name=clinic_name))


def _normalize_name_part(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _is_oncologist_placeholder(text: str) -> bool:
    t = text.lower().strip()
    if not t or len(t) < 2:
        return True
    if t in _ONCO_PLACEHOLDER_TOKENS:
        return True
    # obvious dummy / lorem fragments from bad OCR
    if any(p in t for p in ("lorem", "ipsum", "dolore", "asperna")):
        return True
    return False


def _strip_oncologist_ocr_junk(text: str) -> str:
    """Remove leading punctuation/spaces so '. Abhishek Patel' parses as First Last."""
    t = _normalize_name_part(text)
    while True:
        nxt = _ONCOLOGIST_LEADING_JUNK.sub("", t)
        nxt = _normalize_name_part(nxt)
        if nxt == t:
            break
        t = nxt
    return t


def _parse_oncologist_first_last(raw: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse fax oncologist line into (first_name, last_name) to match users table.
    Does not require \"Dr.\"; strips it only when present. Same for trailing MD/DO/etc.
    Supports \"Last, First [Middle]\" and \"First ... Last\".
    """
    text = _coerce_oncologist_str(raw)
    if not text or _is_oncologist_placeholder(text):
        return None, None
    text = _strip_oncologist_ocr_junk(text)
    if not text or _is_oncologist_placeholder(text):
        return None, None
    text = _normalize_name_part(_ONCOLOGIST_TITLE_PREFIX.sub("", text))
    text = _normalize_name_part(_ONCOLOGIST_TRAILING_CREDENTIALS.sub("", text))
    if not text:
        return None, None
    if "," in text:
        last, _, rest = text.partition(",")
        last = _normalize_name_part(last)
        rest = _normalize_name_part(rest)
        if not last or not rest:
            return None, None
        first_token = rest.split()[0]
        return first_token, last
    parts = text.split()
    if len(parts) < 2:
        return None, None
    return parts[0], " ".join(parts[1:])


def _staff_id_for_single_first_name_if_unique_physician(db, first_name: str) -> Optional[int]:
    """When OCR only has one given name (e.g. 'Brenda'), match if exactly one active physician has that first_name."""
    fn = first_name.lower().strip()
    if not fn or not all(ch.isalpha() or ch in "-'" for ch in fn):
        return None
    q = (
        db.query(Staff.id)
        .join(User, User.id == Staff.user_id)
        .filter(
            Staff.role == "physician",
            Staff.is_active == True,
            func.lower(func.trim(User.first_name)) == fn,
        )
    )
    ids = [r[0] for r in q.limit(3).all()]
    if len(ids) != 1:
        return None
    return ids[0]


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


def _staff_id_for_oncologist_name(db, oncologist_field) -> Optional[int]:
    """
    Match fax_patients.oncologist (messy OCR) to users.first_name + users.last_name,
    then staff.id for role=physician. Leading junk like '. Name' and placeholders are handled.
    """
    raw = _coerce_oncologist_str(oncologist_field)
    if not raw or _is_oncologist_placeholder(raw):
        return None

    first_name, last_name = _parse_oncologist_first_last(raw)
    if first_name and last_name:
        fn = first_name.lower()
        ln = last_name.lower()
        row = (
            db.query(Staff)
            .join(User, User.id == Staff.user_id)
            .filter(
                Staff.role == "physician",
                Staff.is_active == True,
                func.lower(func.trim(User.first_name)) == fn,
                func.lower(func.trim(User.last_name)) == ln,
            )
            .first()
        )
        return row.id if row else None

    # Single token after cleanup, e.g. "Brenda" only from OCR
    cleaned = _strip_oncologist_ocr_junk(raw)
    cleaned = _normalize_name_part(_ONCOLOGIST_TITLE_PREFIX.sub("", cleaned))
    cleaned = _normalize_name_part(_ONCOLOGIST_TRAILING_CREDENTIALS.sub("", cleaned))
    if cleaned and not _is_oncologist_placeholder(cleaned):
        parts = cleaned.split()
        if len(parts) == 1:
            return _staff_id_for_single_first_name_if_unique_physician(db, parts[0])

    return None


def _assign_fax_patient_physician_if_needed(db, patient: Patient):
    """
    Read oncologist from fax_patients, match to user names, use that staff id (physician only)
    for physician_patients; otherwise default fax physician.
    """
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

    matched_staff_id = _staff_id_for_oncologist_name(db, patient.oncologist)
    if matched_staff_id is not None:
        patient.oncologist_staff_id = matched_staff_id
        db.add(patient)

    physician_id = matched_staff_id
    if physician_id is None:
        default_physician = _find_default_fax_physician(db)
        if not default_physician:
            return
        physician_id = default_physician.id

    db.add(
        PhysicianPatient(
            physician_id=physician_id,
            patient_id=patient.id,
        )
    )

def create_or_update_fax_patient(db, fax, structured, background_tasks: BackgroundTasks):

    def v(key):
        return structured.get(key)
    login_link = settings.patient_set_password_base_url.format(email=v("email"))
 
    first_name, last_name = split_name(v("name"))
    phone = v("phone_number")
    email = v("email")
    mrn = v("mrn")
    diagnosis = v("diagnosis")
    library_code = v("library_code")
    drug_description = v("drug_description")
    print(drug_description, 'sssssssssssssssssssssssssssssssssssssssssssssss')

    dob = parse_date(v("date_of_birth"))
    start_date = parse_date(v("start_date"))
    end_date = parse_date(v("end_date"))
    oncologist_name = _coerce_oncologist_str(v("oncologist"))
    location_name = _coerce_location_str(v("location"))
    oncologist_staff_id = _staff_id_for_oncologist_name(db, oncologist_name)
    _ensure_clinic_exists_by_name(db, location_name)

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
            library_code=library_code,
            diagnosis=diagnosis,
            drug_description=drug_description,
            gender=v("gender"),
            date_of_birth=dob,
            age=int(v("age")) if v("age") else None,
            phone_number=phone,
            email=email,
            bmi=v("bmi"),
            location=location_name,
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
        patient.library_code = library_code
        patient.diagnosis = diagnosis
        patient.drug_description = drug_description
        patient.mrn = mrn
        patient.date_of_birth = dob
        patient.age = int(v("age")) if v("age") else None
        patient.phone_number = phone
        patient.bmi = v("bmi")
        patient.location = location_name
        patient.plan_name = v("plan_name")
        patient.start_date = start_date
        patient.end_date = end_date
        patient.past_medical_history = v("past_medical_history")
        patient.past_surgical_history = v("past_surgical_history")
        patient.regimen_name = v("start_on_pathway_regimen") or v("regimen_name")
        patient.oncologist = oncologist_name
        patient.oncologist_staff_id = oncologist_staff_id

        # ================================
        # FIX: UPDATE USER TABLE ALSO
        # ================================
        if patient.user_id:
            user = db.query(User).filter(User.id == patient.user_id).first()
            if user:
                user.first_name = first_name
                user.last_name = last_name
                db.add(user)

    db.commit()
    db.refresh(patient)

    # Match patient.oncologist to users + staff (physician), then physician_patients; else default.
    _assign_fax_patient_physician_if_needed(db, patient)

    fax.patient_id = patient.id
    db.commit()

    return patient
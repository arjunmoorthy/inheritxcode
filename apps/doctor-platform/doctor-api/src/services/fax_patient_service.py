from utils.name_spilt import split_name
from db.models.fax_models import Patient
from datetime import datetime
import re

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

def create_or_update_fax_patient(db, fax, structured):
    print("Structured OCR Data:", structured)

    def v(key):
        return structured.get(key)

    # 🔹 Split name
    first_name, last_name = split_name(v("name"))

    phone = v("phone_number")
    email = v("email")

    dob = parse_date(v("date_of_birth"))
    start_date = parse_date(v("start_date"))
    end_date = parse_date(v("end_date"))

    patient = None

    # 🔍 Try matching existing patient
    if phone and dob:
        patient = db.query(Patient).filter(
            Patient.phone_number == phone,
            Patient.date_of_birth == dob
        ).first()

    if not patient and email:
        patient = db.query(Patient).filter(
            Patient.email == email
        ).first()

    # ➕ Create if not exists
    if not patient:
        patient = Patient()
        db.add(patient)
        db.flush()   # 🔥 assigns ID

    # ✍️ Assign values (SAFE)
    patient.first_name = first_name
    patient.last_name = last_name
    patient.gender = v("gender")
    patient.date_of_birth = dob
    patient.age = int(v("age")) if v("age") else None
    patient.phone_number = phone
    patient.email = email
    patient.bmi = v("bmi")
    patient.plan_name = v("plan_name")
    patient.start_date = start_date
    patient.end_date = end_date
    patient.past_medical_history = v("past_medical_history")
    patient.past_surgical_history = v("past_surgical_history")

    # 💾 Commit patient FIRST
    db.commit()
    db.refresh(patient)

    # 🔗 Link fax → patient
    fax.patient_id = patient.id
    db.commit()

    return patient

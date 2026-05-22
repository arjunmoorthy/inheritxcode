"""
Demo mode helpers — mask patient personal identifiers in API responses.

The frontend passes demo_mode=true as a query param when the demo toggle is on.
Clinical / treatment fields are left unchanged.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional

from fastapi import Query

_DEMO_DOB = date(1970, 6, 15)
_DEMO_AGE = 55


def parse_demo_mode(
    demo_mode: bool = Query(
        default=False,
        description="When true, mask patient personal identifiers in the response.",
    ),
) -> bool:
    return demo_mode


def _stable_suffix(
    patient_uuid: Optional[str] = None,
    patient_id: Optional[int] = None,
) -> str:
    if patient_uuid:
        clean = str(patient_uuid).replace("-", "")
        return clean[-4:].upper() if len(clean) >= 4 else clean.upper() or "0000"
    if patient_id is not None:
        return f"{int(patient_id) % 10000:04d}"
    return "0000"


def _mask_phone(suffix: str) -> str:
    digits = "".join(c for c in suffix if c.isdigit())
    last_four = (digits[-4:] if len(digits) >= 4 else suffix[-4:]).zfill(4)
    return f"(555) 555-{last_four}"


def _mask_mrn(
    patient_uuid: Optional[str] = None,
    patient_id: Optional[int] = None,
) -> str:
    """Stable numeric-only demo MRN (8 digits)."""
    if patient_id is not None:
        return f"{int(patient_id) % 100_000_000:08d}"
    if patient_uuid:
        clean = str(patient_uuid).replace("-", "")
        chunk = clean[-12:] if len(clean) >= 12 else clean
        return f"{int(chunk, 16) % 100_000_000:08d}"
    return "00000000"


def _mask_email(
    patient_uuid: Optional[str] = None,
    patient_id: Optional[int] = None,
) -> str:
    """RFC-valid demo email (numeric local part; passes EmailStr / HTML5 validation)."""
    numeric = _mask_mrn(patient_uuid=patient_uuid, patient_id=patient_id)
    return f"demopatient{numeric}@example.com"


def mask_patient_personal_fields(
    *,
    first_name: Any = None,
    last_name: Any = None,
    email: Any = None,
    phone_number: Any = None,
    mrn: Any = None,
    date_of_birth: Any = None,
    age: Any = None,
    location: Any = None,
    patient_uuid: Optional[str] = None,
    patient_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Return masked values for known patient PII fields."""
    suffix = _stable_suffix(patient_uuid, patient_id)
    masked: Dict[str, Any] = {
        "first_name": "Demo",
        "last_name": f"Patient {suffix}",
        "email": _mask_email(patient_uuid=patient_uuid, patient_id=patient_id),
        "phone_number": _mask_phone(suffix),
        "mrn": _mask_mrn(patient_uuid=patient_uuid, patient_id=patient_id),
        "date_of_birth": _DEMO_DOB.isoformat(),
        "age": _DEMO_AGE,
    }
    if location is not None:
        masked["location"] = "Demo City, CA"
    return masked


def mask_patient_listing_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Mask PII on a patient-listing-dashboard row."""
    out = dict(item)
    masked = mask_patient_personal_fields(
        patient_uuid=out.get("patient_uuid"),
        patient_id=out.get("patient_id"),
        location=out.get("location"),
    )
    out.update(masked)
    return out


def mask_patient_profile_dict(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Mask PII on a patient profile payload (dict or model_dump)."""
    out = dict(profile)
    masked = mask_patient_personal_fields(
        patient_uuid=out.get("patient_uuid"),
        location=out.get("location"),
    )
    out.update(masked)
    return out

"""SMS helpers for patient reminder flows via Sinch."""

import os
import re
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from sinch import SinchClient

from core.config import settings
from core.logging import get_logger

_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_ENV_PATH)

logger = get_logger(__name__)

PATIENT_PORTAL_URL = "https://patient.healthai.global/"


def build_reminder_sms_body(patient_name: str) -> str:
    """Plain-text body matching the daily reminder email content."""
    return (
        f"Dear {patient_name},\n\n"
        "This is your daily reminder to log your symptoms for today. "
        "Your check-in helps your care team understand your recovery "
        "and provide the right guidance when you need it.\n\n"
        f"Log in to the Patient Portal: {PATIENT_PORTAL_URL}\n\n"
        "If you need help, contact your care team."
    )


def normalize_phone_e164(phone: str) -> str:
    """
    Normalize a phone value to E.164 for Sinch.

    Preferred: store with leading + (e.g. +917405976801, +16025129480).

    Without +, country is inferred when possible:
      - 917405976801 (12 digits) -> +917405976801
      - 16025129480 (11 digits, leading 1) -> +16025129480
      - 7405976801 (10 digits, starts with 6–9) -> +917405976801 (India mobile)
      - 4155551234 (10 digits, other) -> +14155551234 (US/Canada)
    """
    if not phone or not str(phone).strip():
        raise ValueError("Phone number is empty")

    raw = str(phone).strip()
    digits = re.sub(r"\D", "", raw)

    if len(digits) < 10:
        raise ValueError(f"Phone number too short: {phone!r}")

    if raw.startswith("+"):
        return f"+{digits}"

    if digits.startswith("91") and len(digits) >= 12:
        e164 = f"+{digits}"
        logger.info("SMS: added + to number with India country code | raw=%s e164=%s", phone, e164)
        return e164

    if digits.startswith("1") and len(digits) == 11:
        e164 = f"+{digits}"
        logger.info("SMS: added + to number with US/Canada country code | raw=%s e164=%s", phone, e164)
        return e164

    if len(digits) == 10:
        if digits[0] in "6789":
            e164 = f"+91{digits}"
            logger.info(
                "SMS: inferred India +91 for 10-digit mobile | raw=%s e164=%s",
                phone,
                e164,
            )
            return e164
        e164 = f"+1{digits}"
        logger.info(
            "SMS: inferred US/Canada +1 for 10-digit number | raw=%s e164=%s",
            phone,
            e164,
        )
        return e164

    e164 = f"+{digits}"
    logger.info("SMS: added + prefix | raw=%s e164=%s", phone, e164)
    return e164


@lru_cache(maxsize=1)
def _get_sinch_client() -> SinchClient:
    project_id = settings.sinch_project_id or os.getenv("SINCH_PROJECT_ID")
    key_id = settings.sinch_key_id or os.getenv("SINCH_KEY_ID")
    key_secret = settings.sinch_key_secret or os.getenv("SINCH_KEY_SECRET")
    sms_region = settings.sinch_sms_region or os.getenv("SINCH_SMS_REGION")

    if not all([project_id, key_id, key_secret, sms_region]):
        raise ValueError(
            "SINCH_PROJECT_ID, SINCH_KEY_ID, SINCH_KEY_SECRET, and SINCH_SMS_REGION "
            "must be set in .env for sending SMS reminders."
        )

    return SinchClient(
        project_id=project_id,
        key_id=key_id,
        key_secret=key_secret,
        sms_region=sms_region,
    )


def _extract_batch_id(response) -> str | None:
    if response is None:
        return None
    if isinstance(response, dict):
        return response.get("id") or response.get("batch_id")
    return getattr(response, "id", None) or getattr(response, "batch_id", None)


def send_reminder_sms(to: str, patient_name: str) -> dict:
    """Send a daily symptom check-in reminder SMS via Sinch."""
    from_number = settings.sinch_from_number or os.getenv("SINCH_FROM_NUMBER")
    if not from_number:
        raise ValueError("SINCH_FROM_NUMBER must be set in .env for sending SMS reminders.")

    to_e164 = normalize_phone_e164(to)
    from_e164 = normalize_phone_e164(from_number)

    if to.strip() != to_e164:
        logger.info(
            "SMS reminder: formatted recipient | raw=%s e164=%s",
            to,
            to_e164,
        )

    logger.info(
        "SMS reminder: sending via Sinch | to=%s from=%s patient_name=%s",
        to_e164,
        from_e164,
        patient_name,
    )

    sinch_client = _get_sinch_client()
    body = build_reminder_sms_body(patient_name)

    try:
        response = sinch_client.sms.batches.send_sms(
            to=[to_e164],
            from_=from_e164,
            body=body,
        )
    except Exception as exc:
        logger.error("SMS reminder: Sinch send failed | to=%s error=%s", to_e164, exc)
        raise

    batch_id = _extract_batch_id(response)
    logger.info(
        "SMS reminder: accepted by Sinch API (check dashboard for delivery) | to=%s batch_id=%s",
        to_e164,
        batch_id,
    )
    return response

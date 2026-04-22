from datetime import date
from uuid import UUID
import asyncio

from celery import shared_task

from core.logging import get_logger
from db.database import SessionFactories
from db.patient_models import ChatPatient
from db.doctor_models import DoctorUser, DoctorPatient
from helpers.email import send_email
logger = get_logger(__name__)


def _get_session(factory_key: str):
    if factory_key not in SessionFactories:
        raise RuntimeError(f"{factory_key} is not configured. Check database environment variables.")
    return SessionFactories[factory_key]()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3})
def send_daily_patient_alerts(self):
    print("Starting daily patient alerts task...")
    """Send reminders only for fax_patients active within start_date/end_date."""
    doctor_db = _get_session("doctor_db")
    try:
        today = date.today()
        patients = (
            doctor_db.query(DoctorPatient)
            .filter(DoctorPatient.start_date.isnot(None))
            .filter(DoctorPatient.end_date.isnot(None))
            .filter(DoctorPatient.start_date <= today)
            .filter(DoctorPatient.end_date >= today)
            .all()
        )

        for patient in patients:
            doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.id == patient.user_id).first()
            if not doctor_user or not doctor_user.email:
                continue
            asyncio.run(
                send_email(
                    to=doctor_user.email,
                    subject="Patient Reminder",
                    patient_name=doctor_user.first_name or "Patient",
                )
            )
            print(f"Running patient alerts for {today}")
            print(f"Total patients: {len(patients)}")
    finally:
        doctor_db.close()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3})
def sync_patient_to_fax_patients(
    self,
    patient_uuid: str | None = None,
    patient_email: str | None = None,
):
    """
    Sync a chat patient to doctor DB fax_patients.

    - Finds patient in chat_patients by UUID (or by email -> doctor user UUID)
    - Uses doctor users row as source for email/name details
    - Ensures fax_patients row exists and points to users.id
    """
    if not patient_uuid and not patient_email:
        raise ValueError("Provide either patient_uuid or patient_email.")

    patient_db = _get_session("patient_db")
    doctor_db = _get_session("doctor_db")

    try:
        doctor_user_by_email = None
        resolved_uuid = None
        if patient_uuid:
            resolved_uuid = UUID(str(patient_uuid))
        else:
            doctor_user_by_email = doctor_db.query(DoctorUser).filter(DoctorUser.email == patient_email).first()
            if doctor_user_by_email:
                resolved_uuid = doctor_user_by_email.uuid

        if not resolved_uuid:
            raise ValueError("Could not resolve patient UUID from provided input.")

        patient = patient_db.query(ChatPatient).filter(ChatPatient.uuid == resolved_uuid).first()
        if not patient:
            raise ValueError("Patient not found in chat_patients.")

        doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.uuid == patient.uuid).first()
        if not doctor_user and doctor_user_by_email:
            doctor_user = doctor_user_by_email

        if not doctor_user:
            raise ValueError(
                "Doctor user not found for this chat patient UUID. "
                "Create users row first, then retry sync."
            )
        else:
            doctor_user.uuid = patient.uuid
            if not doctor_user.role:
                doctor_user.role = "patient"

        fax_patient = doctor_db.query(DoctorPatient).filter(DoctorPatient.user_id == doctor_user.id).first()
        if not fax_patient:
            fax_patient = DoctorPatient(user_id=doctor_user.id)
            doctor_db.add(fax_patient)
            doctor_db.flush()

        doctor_db.commit()

        return {
            "success": True,
            "patient_uuid": str(patient.uuid),
            "email": doctor_user.email,
            "doctor_user_id": doctor_user.id,
            "fax_patient_id": fax_patient.id,
            "message": "Patient synced to doctor_db fax_patients successfully.",
        }
    except Exception:
        doctor_db.rollback()
        raise
    finally:
        patient_db.close()
        doctor_db.close()
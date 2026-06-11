from datetime import date
from uuid import UUID
import asyncio

from celery_worker.app import celery_app
from core.logging import get_logger
from db.database import SessionFactories
from db.patient_models import ChatPatient, PatientInfo
from db.doctor_models import DoctorUser, DoctorPatient
from helpers.email import send_email
from helpers.sms import send_reminder_sms

logger = get_logger(__name__)


def _get_session(factory_key: str):
    if factory_key not in SessionFactories:
        raise RuntimeError(f"{factory_key} is not configured. Check database environment variables.")
    return SessionFactories[factory_key]()


def _resolve_patient_phone(fax_patient: DoctorPatient, patient_info: PatientInfo | None) -> tuple[str | None, str]:
    """Prefer phone_number on fax_patients; fall back to patient_info."""
    fax_phone = (fax_patient.phone_number or "").strip() or None
    if fax_phone:
        return fax_phone, "fax_patients"

    if patient_info and patient_info.phone_number:
        return patient_info.phone_number.strip(), "patient_info"

    return None, "none"


def _resolve_patient_name(
    doctor_user: DoctorUser,
    fax_patient: DoctorPatient,
) -> str:
    return (
        doctor_user.first_name
        or fax_patient.first_name
        or "Patient"
    )


def _try_send_email_reminder(*, patient_uuid, email: str, patient_name: str) -> str:
    """Returns: sent | failed."""
    try:
        asyncio.run(
            send_email(
                to=email,
                subject="Patient Reminder",
                patient_name=patient_name,
            )
        )
        logger.info("Email reminder: sent | uuid=%s email=%s", patient_uuid, email)
        return "sent"
    except Exception as exc:
        logger.error(
            "Email reminder: NOT sent | uuid=%s email=%s error=%s",
            patient_uuid,
            email,
            exc,
        )
        return "failed"


def _try_send_sms_reminder(
    *,
    patient_uuid,
    patient_name: str,
    phone_number: str | None,
) -> str:
    """Returns: skipped_no_phone | sent | failed."""
    if not phone_number:
        logger.warning(
            "SMS reminder: NOT sent (no phone on file) | uuid=%s",
            patient_uuid,
        )
        return "skipped_no_phone"

    try:
        send_reminder_sms(to=phone_number, patient_name=patient_name)
        logger.info(
            "SMS reminder: sent | uuid=%s phone=%s",
            patient_uuid,
            phone_number,
        )
        return "sent"
    except Exception as exc:
        logger.error(
            "SMS reminder: NOT sent | uuid=%s phone=%s error=%s",
            patient_uuid,
            phone_number,
            exc,
        )
        return "failed"


@celery_app.task(
    bind=True,
    name="services.tasks.send_daily_patient_alerts",
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_daily_patient_alerts(self):
    """Send email/SMS reminders for fax_patients active within start_date/end_date."""
    logger.info("Starting daily patient alerts task...")
    doctor_db = _get_session("doctor_db")
    patient_db = _get_session("patient_db")
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

        email_stats = {"sent": 0, "failed": 0, "skipped_no_email": 0}
        sms_stats = {"sent": 0, "failed": 0, "skipped_no_phone": 0}

        for fax_patient in patients:
            doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.id == fax_patient.user_id).first()
            if not doctor_user:
                logger.warning(
                    "Skipping reminders: fax_patient has no linked user | fax_patient_id=%s",
                    fax_patient.id,
                )
                continue

            patient_name = _resolve_patient_name(doctor_user, fax_patient)
            patient_info = (
                patient_db.query(PatientInfo)
                .filter(PatientInfo.uuid == doctor_user.uuid)
                .first()
            )

            if doctor_user.email:
                email_result = _try_send_email_reminder(
                    patient_uuid=doctor_user.uuid,
                    email=doctor_user.email,
                    patient_name=patient_name,
                )
                email_stats[email_result] = email_stats.get(email_result, 0) + 1
            else:
                email_stats["skipped_no_email"] += 1
                logger.warning(
                    "Email reminder: NOT sent (no email on file) | uuid=%s",
                    doctor_user.uuid,
                )

            phone_number, phone_source = _resolve_patient_phone(fax_patient, patient_info)
            logger.info(
                "SMS reminder: phone lookup | uuid=%s fax_patient_id=%s phone=%s source=%s",
                doctor_user.uuid,
                fax_patient.id,
                phone_number,
                phone_source,
            )
            sms_result = _try_send_sms_reminder(
                patient_uuid=doctor_user.uuid,
                patient_name=patient_name,
                phone_number=phone_number,
            )
            sms_stats[sms_result] = sms_stats.get(sms_result, 0) + 1

        logger.info(
            "Daily patient alerts finished | date=%s patients=%d email=%s sms=%s",
            today,
            len(patients),
            email_stats,
            sms_stats,
        )
    finally:
        doctor_db.close()
        patient_db.close()


@celery_app.task(
    bind=True,
    name="services.tasks.sync_patient_to_fax_patients",
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
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

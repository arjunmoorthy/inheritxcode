# import asyncio
# from datetime import datetime, timedelta

# from db.session import DoctorSessionLocal
# from db.models.fax_models import Patient
# from core.config import settings
# from utils.simple_pdf import build_patient_dashboard_pdf_from_url 
# from utils.s3 import upload_file_to_s3_with_presigned_url
# from services.sinch_fax import submit_sinch_fax

# def run_async(coro):
#     return asyncio.run(coro)


# def process_fax_job(patient_uuid, payload_dict, access_token, is_system_call):
#     db = DoctorSessionLocal()

#     try:
#         end_date = datetime.utcnow().date()
#         start_date = end_date - timedelta(days=payload_dict.get("days", 30))

#         # 🔑 Auth handling
#         if is_system_call:
#             auth_param = f"system_key={settings.internal_system_key}"
#         else:
#             auth_param = f"token={access_token}"

#         dashboard_url = (
#             f"{settings.doctor_dashboard_base_url}/public/fax-preview/{patient_uuid}"
#             f"?{auth_param}&start_date={start_date}&end_date={end_date}"
#         )

#         # 🧾 PDF
#         pdf_bytes = run_async(build_patient_dashboard_pdf_from_url(dashboard_url))

#         # ☁️ Upload
#         _, content_url = upload_file_to_s3_with_presigned_url(
#             pdf_bytes,
#             f"report_{patient_uuid}.pdf"
#         )

#         callback_url = payload_dict.get("callbackUrl")

#         run_async(submit_sinch_fax(
#             to=payload_dict["to"],
#             content_url=content_url,
#             from_number_override=payload_dict.get("from_number"),
#             callback_url=str(callback_url) if callback_url else None,  # ✅ ensure string
#         ))

#     except Exception as e:
#         print("FAX FAILED:", str(e))

#     finally:
#         db.close()


import asyncio
from datetime import datetime, timedelta
from db.session import DoctorSessionLocal
from db.models.fax_models import Patient
from db.models.staff import PhysicianPatient, Staff
from db.models.user import User
from core.config import settings
from utils.simple_pdf import build_patient_dashboard_pdf_from_url
from utils.s3 import upload_file_to_s3_with_presigned_url
from api.v1.endpoints.fax import _submit_sinch_fax  # move this out to avoid circular import
from api.v1.endpoints.auth import create_access_token
from sqlalchemy.orm import joinedload


# -----------------------------
# Helper: run async safely
# -----------------------------
def run_async(coro):
    return asyncio.run(coro)


# -----------------------------
# Helper: fetch fax number
# -----------------------------
def get_patient_fax_number(db, patient_id: int):
    patient = (
        db.query(Patient)
        .options(
            joinedload(Patient.physician_assignments)
            .joinedload(PhysicianPatient.physician)
            .joinedload(Staff.clinic_associations)
        )
        .filter(Patient.id == patient_id)
        .first()
    )

    if not patient:
        return None

    for assignment in patient.physician_assignments:
        physician = assignment.physician
        if not physician:
            continue

        for assoc in physician.clinic_associations:
            if assoc.is_active and assoc.clinic and assoc.clinic.fax:
                return assoc.clinic.fax

    return None

def get_assigned_staff_user(db, patient_id: int):
    patient = (
        db.query(Patient)
        .options(
            joinedload(Patient.physician_assignments)
            .joinedload(PhysicianPatient.physician)
        )
        .filter(Patient.id == patient_id)
        .first()
    )

    if not patient:
        return None

    for assignment in patient.physician_assignments:
        staff = assignment.physician
        if staff and staff.user_id:
            return db.query(User).filter(User.id == staff.user_id).first()

    return None


# -----------------------------
# MAIN FUNCTION
# -----------------------------
def send_automated_fax(patient_id: int, user_uuid: str):
    print(f"[AUTO-FAX] Starting fax job for patient_id={patient_id} user_uuid={user_uuid}")
    db = DoctorSessionLocal()

    try:
        fax_number = get_patient_fax_number(db, patient_id)

        if not fax_number:
            print(f"[AUTO-FAX] No fax found for patient {patient_id}")
            return

        user = get_assigned_staff_user(db, patient_id)

        if not user:
            print(f"[AUTO-FAX] No staff user found for patient {patient_id}")
            return
        
        token = create_access_token({
            "sub": str(user.uuid),
            "email": user.email,
        })

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=30)

        dashboard_base_url = settings.doctor_dashboard_base_url.rstrip("/")
        dashboard_url = (
            f"{dashboard_base_url}/public/fax-preview/{user_uuid}"
            f"?token={token}&start_date={start_date.isoformat()}&end_date={end_date.isoformat()}"
        )

        print(f"[AUTO-FAX] Generating PDF for patient={user_uuid} dashboard_url={dashboard_url}")

        pdf_bytes = run_async(build_patient_dashboard_pdf_from_url(dashboard_url))

        _, content_url = upload_file_to_s3_with_presigned_url(
            pdf_bytes,
            f"report_{user_uuid}.pdf"
        )

        run_async(
            _submit_sinch_fax(
                to=fax_number,
                content_url=content_url,
                from_number_override=None,
                callback_url=None,
            )
        )

        print(f"[AUTO-FAX] SUCCESS patient={user_uuid}")
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if patient:
            patient.last_fax_sent_at = datetime.utcnow()
            db.commit()
    except Exception as e:
        print(f"[AUTO-FAX] FAILED patient={user_uuid} error={e}")

    finally:
        db.close()
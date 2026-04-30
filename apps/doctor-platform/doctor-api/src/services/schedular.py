from datetime import date, timedelta
from db.session import DoctorSessionLocal
from db.models.fax_models import Patient
from db.models.staff import PhysicianPatient, Staff
from db.models.user import User
from sqlalchemy.orm import joinedload
# from services.auto_fax_service import send_automated_fax
from services.fax_tasks import send_fax_task


def scheduled_fax_job():
    db = DoctorSessionLocal()

    try:
        tomorrow = date.today() + timedelta(days=1)

        patients = (
            db.query(Patient)
            .options(
                joinedload(Patient.physician_assignments)
                .joinedload(PhysicianPatient.physician)
                .joinedload(Staff.clinic_associations)
            )
            .filter(Patient.next_chemotherapy_at == tomorrow)
            .all()
        )

        print(f"[SCHEDULER] Found {len(patients)} patients")

        for patient in patients:
            try:
                # ✅ Fetch user linked to patient
                user = db.query(User).filter(User.id == patient.user_id).first()
                print(f"[SCHEDULER] Processing patient: {patient.id}")

                if not user or not user.uuid:
                    print(f"[SCHEDULER] Skipping patient={patient.id} (no user uuid)")
                    continue

                # ✅ Pass UUID (NOT id)
                send_fax_task.apply_async(
                    kwargs={"patient_id": patient.id, "user_uuid": str(user.uuid)},
                    queue="doctor_queue"

                )

            except Exception as e:
                print(f"[SCHEDULER] Error patient={patient.id} error={e}")

    finally:
        db.close()
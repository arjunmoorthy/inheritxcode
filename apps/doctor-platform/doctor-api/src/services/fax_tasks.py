from services.celery_base import celery_app
from services.auto_fax_service import send_automated_fax


@celery_app.task(name="send_fax_task")
def send_fax_task(patient_id, user_uuid):
    print(f"Sending fax {patient_id}")
    send_automated_fax(patient_id, user_uuid)
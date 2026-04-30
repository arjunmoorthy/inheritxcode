from celery import Celery
from celery.schedules import crontab
import os


CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)

celery_app = Celery(
    "patient_alerts",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

celery_app.conf.timezone = "America/Los_Angeles"
celery_app.autodiscover_tasks(["services"])

celery_app.conf.task_routes = {
    "services.tasks.send_daily_patient_alerts": {"queue": "patient_queue"},
}

# ✅ ADD IT HERE
celery_app.conf.beat_schedule = {
    "send-patient-alerts-daily": {
        "task": "services.tasks.send_daily_patient_alerts",
        "schedule": crontab(hour=7, minute=58),  # Every 5 minutes for testing, change to crontab(hour=0, minute=0) for daily at midnight
        "options": {"queue": "patient_queue"},
    },
}
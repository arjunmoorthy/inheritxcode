"""Celery application for patient reminders (run locally without loading services/__init__.py)."""

import os

from celery import Celery
from celery.schedules import crontab

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)

celery_app = Celery(
    "patient_alerts",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["celery_worker.tasks"],
)

celery_app.conf.timezone = "America/Los_Angeles"
celery_app.conf.task_routes = {
    "services.tasks.send_daily_patient_alerts": {"queue": "patient_queue"},
    "celery_worker.tasks.send_daily_patient_alerts": {"queue": "patient_queue"},
    "services.tasks.sync_patient_to_fax_patients": {"queue": "patient_queue"},
    "celery_worker.tasks.sync_patient_to_fax_patients": {"queue": "patient_queue"},
}

celery_app.conf.beat_schedule = {
    "send-patient-alerts-daily": {
        "task": "services.tasks.send_daily_patient_alerts",
        "schedule": crontab(hour=7, minute=58),  # TESTING: every 1 min — revert to crontab(hour=7, minute=58) for production
        "options": {"queue": "patient_queue"},
    },
}

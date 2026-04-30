from celery.schedules import crontab
from services.celery_base import celery_app

import services.fax_tasks
import services.tasks

celery_app.conf.task_routes = {
    "send_fax_task": {"queue": "doctor_queue"},
    "run_scheduler_task": {"queue": "doctor_queue"},
}

celery_app.conf.timezone = "America/Los_Angeles"
celery_app.conf.enable_utc = True

celery_app.conf.beat_schedule = {
    "run-fax-job-every-minute": {
        "task": "run_scheduler_task",
        "schedule": crontab(minute="*"),
        "options": {"queue": "doctor_queue"},
    }
}
from services.celery_base import celery_app
from services.schedular import scheduled_fax_job


@celery_app.task(name="run_scheduler_task")
def run_scheduler_task():
    scheduled_fax_job()
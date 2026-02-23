"""
Database Package - Doctor API
=============================

This package provides database infrastructure including:
- Base model classes with common fields
- Session management and dependency injection
- Domain-specific models (clinic, staff)
- Repository pattern for data access

Usage:
    from db import get_doctor_db, get_patient_db
    from db.models import StaffProfile, Clinic
    from db.repositories import StaffRepository, ClinicRepository
"""

from .base import DoctorBase, PatientBase, TimestampMixin

# Session-related names are lazy-imported so that "from db.base import ..."
# (e.g. in Alembic env.py) does not pull in core.config / pydantic_settings.
# This allows running migrations in environments that only have alembic/sqlalchemy.
_SESSION_ATTRS = ("get_doctor_db", "get_patient_db", "doctor_engine", "patient_engine")


def __getattr__(name: str):
    if name in _SESSION_ATTRS:
        from .session import (
            get_doctor_db,
            get_patient_db,
            doctor_engine,
            patient_engine,
        )
        return {
            "get_doctor_db": get_doctor_db,
            "get_patient_db": get_patient_db,
            "doctor_engine": doctor_engine,
            "patient_engine": patient_engine,
        }[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    # Base classes
    "DoctorBase",
    "PatientBase",
    "TimestampMixin",
    # Session management (lazy)
    "get_doctor_db",
    "get_patient_db",
    "doctor_engine",
    "patient_engine",
]






"""
Doctor Models - Backward Compatibility Layer
=============================================

This file provides backward compatibility for code that imports from db.doctor_models.

DEPRECATED: Please import directly from db.models instead.

Old usage (deprecated):
    from db.doctor_models import Staff, Clinic
    
New usage (preferred):
    from db.models import User, Staff, Clinic
"""

# Re-export all models from the unified models package
from db.models import (
    User,
    Staff,
    Clinic,
    StaffClinic,
    PhysicianPatient,
    AuditLog,
    WeeklyReport,
)

# Re-export the base
from db.base import DoctorBase

__all__ = [
    "DoctorBase",
    "User",
    "Staff",
    "Clinic",
    "StaffClinic",
    "PhysicianPatient",
    "AuditLog",
    "WeeklyReport",
]

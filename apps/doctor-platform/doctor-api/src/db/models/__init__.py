"""
Database Models Package - Doctor API
=====================================

This package contains SQLAlchemy ORM models organized by domain:
- user: User authentication model
- staff: Staff profiles, clinic associations, physician-patient assignments
- clinic: Healthcare facility model
- analytics: Audit logs, weekly reports

All models are re-exported here for convenient access.

Usage:
    from db.models import User, Staff, Clinic, StaffClinic, PhysicianPatient
    from db.models import AuditLog, WeeklyReport
"""

# User model (authentication)
from .user import User

# Staff models (profiles and associations)
from .staff import Staff, StaffClinic, PhysicianPatient, PhysicianNurseAssignment

# Clinic model
from .clinic import Clinic

# Analytics models
from .analytics import AuditLog, WeeklyReport


# Backward compatibility aliases for old model names
# These will be deprecated in future versions
StaffProfile = Staff  # Old name for Staff
StaffAssociation = StaffClinic  # Old name for StaffClinic (staff-clinic junction)


__all__ = [
    # User (authentication)
    "User",
    
    # Staff (profiles)
    "Staff",
    "StaffClinic",
    "PhysicianPatient",
    "PhysicianNurseAssignment",
    
    # Clinic
    "Clinic",
    
    # Analytics
    "AuditLog",
    "WeeklyReport",
    
    # Backward compatibility (deprecated)
    "StaffProfile",  # Use Staff instead
    "StaffAssociation",  # Use StaffClinic instead
]

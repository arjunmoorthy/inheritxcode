"""
Repository Package - Doctor API
================================

This package implements the Repository pattern for data access.
Repositories encapsulate all database operations for a specific model,
providing a clean interface for the service layer.

Benefits:
- Separation of concerns (business logic vs data access)
- Easier testing (can mock repositories)
- Consistent query patterns
- Centralized data access logic

Usage:
    from db.repositories import UserRepository, StaffRepository, ClinicRepository
    
    user_repo = UserRepository(db_session)
    staff_repo = StaffRepository(db_session)
    clinic_repo = ClinicRepository(db_session)
"""

from .base import BaseRepository
from .user_repository import UserRepository
from .clinic_repository import ClinicRepository
from .staff_repository import StaffRepository

__all__ = [
    "BaseRepository",
    "UserRepository",
    "ClinicRepository",
    "StaffRepository",
]






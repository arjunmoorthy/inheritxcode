"""
Base Model Classes - Doctor API
===============================

This module defines base classes and mixins for SQLAlchemy models:
- DoctorBase: Declarative base for doctor database models
- PatientBase: Declarative base for patient database models (read-only)
- TimestampMixin: Adds created_at/updated_at fields
- SoftDeleteMixin: Adds soft delete capability

Usage:
    from db.base import DoctorBase, TimestampMixin
    
    class User(DoctorBase, TimestampMixin):
        __tablename__ = 'users'
        id = Column(Integer, primary_key=True)
        ...
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, func
from sqlalchemy.orm import declarative_base, declared_attr


# =============================================================================
# Declarative Bases
# =============================================================================

# Base class for doctor database models
DoctorBase = declarative_base()

# Base class for patient database models (used for read-only access)
PatientBase = declarative_base()


# =============================================================================
# Mixins
# =============================================================================

class TimestampMixin:
    """
    Mixin that adds automatic timestamp fields to models.
    
    Provides:
    - created_at: Set automatically when record is created
    - updated_at: Updated automatically when record is modified
    
    Usage:
        class MyModel(Base, TimestampMixin):
            __tablename__ = 'my_table'
            id = Column(Integer, primary_key=True)
    """
    
    @declared_attr
    def created_at(cls):
        """Timestamp when the record was created."""
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
            comment="Timestamp when record was created"
        )
    
    @declared_attr
    def updated_at(cls):
        """Timestamp when the record was last updated."""
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
            comment="Timestamp when record was last updated"
        )


class SoftDeleteMixin:
    """
    Mixin that adds soft delete capability to models.
    
    Instead of physically deleting records, marks them as deleted.
    This preserves data for auditing and recovery purposes.
    
    Usage:
        class MyModel(Base, SoftDeleteMixin):
            __tablename__ = 'my_table'
            id = Column(Integer, primary_key=True)
    """
    
    @declared_attr
    def deleted_at(cls):
        """Timestamp when record was soft-deleted, NULL if active."""
        return Column(
            DateTime(timezone=True),
            nullable=True,
            default=None,
            comment="Timestamp when record was soft-deleted, NULL if active"
        )
    
    def soft_delete(self) -> None:
        """Mark this record as deleted."""
        self.deleted_at = datetime.utcnow()
    
    def restore(self) -> None:
        """Restore a soft-deleted record."""
        self.deleted_at = None
    
    @property
    def is_deleted(self) -> bool:
        """Check if the record is deleted."""
        return self.deleted_at is not None

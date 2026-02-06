"""
Staff Model - Doctor API
========================

This module defines the Staff SQLAlchemy model for user profiles.

Table: staff
- Stores profile information for all staff members
- Links to Users table (1:1) for authentication
- Links to Clinics via staff_clinics junction table (many-to-many)

Staff Roles:
- 'physician': Treating physician (can have patients assigned)
- 'nurse': Nursing staff
- 'staff': General staff member
- 'admin': Administrative user with elevated permissions

Usage:
    from db.models import Staff, User
    
    # Create user first
    user = User(email="doctor@clinic.com", password_hash="...")
    
    # Then create staff profile
    staff = Staff(
        user=user,
        email="doctor@clinic.com",
        first_name="Jane",
        last_name="Smith",
        role="physician",
        npi_number="1234567890"
    )
"""

import uuid
from typing import Optional, List

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Index, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db.base import DoctorBase, TimestampMixin


class Staff(DoctorBase, TimestampMixin):
    """
    Represents a staff member's profile.
    
    Staff members can be physicians, nurses, general staff, or administrators.
    Each staff member is linked to a User account for authentication.
    
    Attributes:
        id: Auto-increment primary key
        uuid: Unique identifier for external use
        user_id: Foreign key to users table
        email: Email address (denormalized from users)
        first_name: Staff member's first name
        last_name: Staff member's last name
        role: Role type (physician, nurse, staff, admin)
        npi_number: National Provider Identifier (physicians only)
        department: Department within clinic
        phone: Contact phone number
        is_profile_completed: Whether profile setup is complete
        is_active: Whether the profile is active
    """
    
    __tablename__ = 'staff'
    __table_args__ = (
        Index('ix_staff_role', 'role'),
        Index('ix_staff_npi_number', 'npi_number'),
        {'comment': 'Staff member profiles'}
    )
    
    # Primary identifiers
    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-increment primary key"
    )
    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        comment="Unique identifier for external use"
    )
    
    # Link to users table (1:1 relationship)
    user_id = Column(
        Integer,
        ForeignKey('users.id', ondelete='CASCADE'),
        unique=True,
        nullable=False,
        index=True,
        comment="Foreign key to users table"
    )
    
    # Contact info (denormalized for convenience)
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Email address (denormalized from users)"
    )
    
    # Personal information
    first_name = Column(
        String(100),
        nullable=True,
        comment="Staff member's first name"
    )
    last_name = Column(
        String(100),
        nullable=True,
        comment="Staff member's last name"
    )
    
    # Role and credentials
    role = Column(
        String(50),
        nullable=False,
        default='staff',
        comment="Role type: physician, nurse, staff, admin"
    )
    npi_number = Column(
        String(20),
        nullable=True,
        comment="National Provider Identifier (physicians only)"
    )
    department = Column(
        String(100),
        nullable=True,
        comment="Department within clinic"
    )
    phone = Column(
        String(20),
        nullable=True,
        comment="Contact phone number"
    )
    
    # Profile status
    is_profile_completed = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether profile setup is complete"
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether the profile is active"
    )
    
    # Relationships
    user = relationship(
        "User",
        back_populates="staff"
    )
    
    clinic_associations = relationship(
        "StaffClinic",
        back_populates="staff",
        cascade="all, delete-orphan"
    )
    
    physician_patients = relationship(
        "PhysicianPatient",
        back_populates="physician",
        foreign_keys="PhysicianPatient.physician_id",
        cascade="all, delete-orphan"
    )
    
    weekly_reports = relationship(
        "WeeklyReport",
        back_populates="physician",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        """String representation of the staff profile."""
        return (
            f"<Staff(id={self.id}, email='{self.email}', "
            f"role='{self.role}')>"
        )
    
    @property
    def full_name(self) -> str:
        """Get the full name of the staff member."""
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p) or "Unknown"
    
    @property
    def is_physician(self) -> bool:
        """Check if this staff member is a physician."""
        return self.role == 'physician'
    
    @property
    def is_nurse(self) -> bool:
        """Check if this staff member is a nurse."""
        return self.role == 'nurse'
    
    @property
    def is_admin(self) -> bool:
        """Check if this staff member is an admin."""
        return self.role == 'admin'
    
    @property
    def clinics(self) -> List:
        """Get all clinics this staff member is associated with."""
        return [assoc.clinic for assoc in self.clinic_associations if assoc.is_active]
    
    @property
    def primary_clinic(self):
        """Get the primary clinic for this staff member."""
        for assoc in self.clinic_associations:
            if assoc.is_primary and assoc.is_active:
                return assoc.clinic
        # If no primary, return first active
        for assoc in self.clinic_associations:
            if assoc.is_active:
                return assoc.clinic
        return None
    
    def to_dict(self) -> dict:
        """
        Convert the staff profile to a dictionary.
        
        Returns:
            Dictionary representation of the staff profile
        """
        return {
            "id": self.id,
            "uuid": str(self.uuid),
            "user_id": self.user_id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "role": self.role,
            "npi_number": self.npi_number,
            "department": self.department,
            "phone": self.phone,
            "is_profile_completed": self.is_profile_completed,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class StaffClinic(DoctorBase):
    """
    Junction table linking staff members to clinics (many-to-many).
    
    A staff member can work at multiple clinics, and a clinic
    can have multiple staff members.
    
    Attributes:
        id: Auto-increment primary key
        staff_id: Foreign key to staff table
        clinic_id: Foreign key to clinics table
        is_primary: Whether this is the staff member's primary clinic
        assigned_at: When the association was created
        is_active: Whether the association is active
    """
    
    __tablename__ = 'staff_clinics'
    __table_args__ = (
        Index('ix_staff_clinics_staff_id', 'staff_id'),
        Index('ix_staff_clinics_clinic_id', 'clinic_id'),
        {'comment': 'Staff-Clinic associations (many-to-many)'}
    )
    
    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-increment primary key"
    )
    
    staff_id = Column(
        Integer,
        ForeignKey('staff.id', ondelete='CASCADE'),
        nullable=False,
        comment="Foreign key to staff table"
    )
    
    clinic_id = Column(
        Integer,
        ForeignKey('clinics.id', ondelete='CASCADE'),
        nullable=False,
        comment="Foreign key to clinics table"
    )
    
    is_primary = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether this is the staff member's primary clinic"
    )
    
    assigned_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the association was created"
    )
    
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether the association is active"
    )
    
    # Relationships
    staff = relationship(
        "Staff",
        back_populates="clinic_associations"
    )
    
    clinic = relationship(
        "Clinic",
        back_populates="staff_associations"
    )
    
    def __repr__(self) -> str:
        """String representation of the association."""
        return (
            f"<StaffClinic(staff_id={self.staff_id}, "
            f"clinic_id={self.clinic_id}, primary={self.is_primary})>"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "clinic_id": self.clinic_id,
            "is_primary": self.is_primary,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "is_active": self.is_active,
        }


class PhysicianPatient(DoctorBase):
    """
    Links physicians to their assigned patients.
    
    Patients are stored in the patient database and referenced by UUID.
    This table tracks which physician is responsible for which patients.
    
    Attributes:
        id: Auto-increment primary key
        physician_id: Foreign key to staff table (must be a physician)
        patient_uuid: UUID of the patient (from patient database)
        assigned_at: When the assignment was created
        assigned_by: Staff ID who made the assignment
        is_active: Whether the assignment is active
    """
    
    __tablename__ = 'physician_patients'
    __table_args__ = (
        Index('ix_physician_patients_physician_id', 'physician_id'),
        Index('ix_physician_patients_patient_uuid', 'patient_uuid'),
        Index('ix_physician_patients_active', 'is_active'),
        {'comment': 'Physician-Patient assignments'}
    )
    
    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-increment primary key"
    )
    
    physician_id = Column(
        Integer,
        ForeignKey('staff.id', ondelete='CASCADE'),
        nullable=False,
        comment="Foreign key to staff table (physician)"
    )
    
    patient_uuid = Column(
        UUID(as_uuid=True),
        nullable=False,
        comment="UUID of the patient (from patient database)"
    )
    
    assigned_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the assignment was created"
    )
    
    assigned_by = Column(
        Integer,
        ForeignKey('staff.id'),
        nullable=True,
        comment="Staff ID who made the assignment"
    )
    
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether the assignment is active"
    )
    
    # Relationships
    physician = relationship(
        "Staff",
        back_populates="physician_patients",
        foreign_keys=[physician_id]
    )
    
    def __repr__(self) -> str:
        """String representation of the assignment."""
        return (
            f"<PhysicianPatient(physician_id={self.physician_id}, "
            f"patient_uuid={self.patient_uuid})>"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "physician_id": self.physician_id,
            "patient_uuid": str(self.patient_uuid),
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "assigned_by": self.assigned_by,
            "is_active": self.is_active,
        }

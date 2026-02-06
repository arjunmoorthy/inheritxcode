"""
Clinic Model - Doctor API
=========================

This module defines the Clinic SQLAlchemy model for healthcare facilities.

Table: clinics
- Stores clinic/facility information
- Links to Staff via staff_clinics junction table (many-to-many)

Usage:
    from db.models import Clinic
    
    clinic = Clinic(
        name="Main Oncology Center",
        address="123 Medical Way",
        city="Boston",
        state="MA",
        zip_code="02101",
        phone="555-0100"
    )
"""

import uuid
from typing import List

from sqlalchemy import Column, Integer, String, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db.base import DoctorBase, TimestampMixin


class Clinic(DoctorBase, TimestampMixin):
    """
    Represents a healthcare clinic or facility.
    
    This is the central location entity that staff members
    are associated with via the staff_clinics junction table.
    
    Attributes:
        id: Auto-increment primary key
        uuid: Unique identifier for external use
        name: Official name of the clinic
        address: Street address
        city: City
        state: State/Province
        zip_code: Postal code
        phone: Contact phone number
        fax: Fax number for medical documents
        is_active: Whether the clinic is active
    """
    
    __tablename__ = 'clinics'
    __table_args__ = (
        Index('ix_clinics_name', 'name'),
        {'comment': 'Healthcare clinics and facilities'}
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
    
    # Clinic information
    name = Column(
        String(255),
        nullable=False,
        comment="Official name of the clinic"
    )
    address = Column(
        String(500),
        nullable=True,
        comment="Street address"
    )
    city = Column(
        String(100),
        nullable=True,
        comment="City"
    )
    state = Column(
        String(50),
        nullable=True,
        comment="State/Province"
    )
    zip_code = Column(
        String(20),
        nullable=True,
        comment="Postal code"
    )
    phone = Column(
        String(20),
        nullable=True,
        comment="Contact phone number"
    )
    fax = Column(
        String(20),
        nullable=True,
        comment="Fax number for medical documents"
    )
    
    # Status
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether the clinic is active"
    )
    
    # Relationships
    staff_associations = relationship(
        "StaffClinic",
        back_populates="clinic",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        """String representation of the clinic."""
        return f"<Clinic(id={self.id}, name='{self.name}')>"
    
    @property
    def staff_members(self) -> List:
        """Get all active staff members at this clinic."""
        return [assoc.staff for assoc in self.staff_associations if assoc.is_active]
    
    @property
    def full_address(self) -> str:
        """Get the full formatted address."""
        parts = [self.address]
        city_state = ", ".join(filter(None, [self.city, self.state]))
        if city_state:
            parts.append(city_state)
        if self.zip_code:
            parts.append(self.zip_code)
        return ", ".join(filter(None, parts)) or ""
    
    def to_dict(self) -> dict:
        """
        Convert the clinic to a dictionary.
        
        Returns:
            Dictionary representation of the clinic
        """
        return {
            "id": self.id,
            "uuid": str(self.uuid),
            "name": self.name,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "zip_code": self.zip_code,
            "phone": self.phone,
            "fax": self.fax,
            "full_address": self.full_address,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

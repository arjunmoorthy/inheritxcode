"""
Analytics Models - Doctor API
=============================

Models for audit logging and reporting.

Tables:
- audit_logs: HIPAA-compliant access logging
- weekly_reports: Physician weekly report metadata

These models support compliance and reporting features.
"""

import uuid
from datetime import datetime, date
from typing import Optional

from sqlalchemy import Column, String, Text, Boolean, DateTime, Date, Integer, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from db.base import DoctorBase


class AuditLog(DoctorBase):
    """
    HIPAA-compliant audit logging.
    
    Tracks all access to patient data for compliance.
    Every action that accesses or modifies patient data is logged.
    
    Attributes:
        id: Auto-increment primary key
        user_id: Foreign key to users table
        user_uuid: UUID of the user (for convenience)
        user_role: Role of the user at time of action
        action: What action was performed
        entity_type: Type of data accessed
        entity_id: ID of the specific record
        details: Additional context as JSON
        ip_address: IP address of the request
        user_agent: Browser/client user agent
        created_at: When the action was performed
    """
    
    __tablename__ = 'audit_logs'
    __table_args__ = (
        Index('ix_audit_logs_user_id', 'user_id'),
        Index('ix_audit_logs_user_uuid', 'user_uuid'),
        Index('ix_audit_logs_action', 'action'),
        Index('ix_audit_logs_entity', 'entity_type', 'entity_id'),
        Index('ix_audit_logs_created_at', 'created_at'),
        {'comment': 'HIPAA-compliant access audit logs'}
    )
    
    # Primary key
    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-increment primary key"
    )
    
    # User information
    user_id = Column(
        Integer,
        ForeignKey('users.id'),
        nullable=True,
        comment="Foreign key to users table"
    )
    user_uuid = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="UUID of the user"
    )
    user_role = Column(
        String(50),
        nullable=True,
        comment="Role of the user: physician, nurse, staff, admin"
    )
    
    # Action details
    action = Column(
        String(100),
        nullable=False,
        comment="Action performed: login, view_patient, view_dashboard, etc."
    )
    
    entity_type = Column(
        String(100),
        nullable=True,
        comment="Type of entity accessed: patient, conversation, diary, report"
    )
    
    entity_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="ID of the specific entity accessed"
    )
    
    # Additional context
    details = Column(
        JSONB,
        nullable=True,
        comment="Additional context about the action"
    )
    
    # Request metadata
    ip_address = Column(
        String(45),
        nullable=True,
        comment="IP address of the request"
    )
    
    user_agent = Column(
        String(500),
        nullable=True,
        comment="Browser/client user agent"
    )
    
    # Timestamp
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the action was performed"
    )
    
    def __repr__(self) -> str:
        return (
            f"<AuditLog(id={self.id}, user_id={self.user_id}, "
            f"action={self.action})>"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_uuid": str(self.user_uuid) if self.user_uuid else None,
            "user_role": self.user_role,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id) if self.entity_id else None,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class WeeklyReport(DoctorBase):
    """
    Physician weekly report metadata.
    
    Stores metadata about generated weekly reports.
    The actual report content can be stored as JSON or in S3.
    
    Attributes:
        id: Auto-increment primary key
        uuid: Unique identifier for external use
        physician_id: Foreign key to staff table
        report_week_start: Start of the report week
        report_week_end: End of the report week
        report_data: Report content as JSON
        s3_path: Path to PDF in S3 (if generated)
        patient_count: Number of patients in report
        total_alerts: Number of alerts in report
        total_questions: Number of questions in report
        generated_at: When the report was generated
    """
    
    __tablename__ = 'weekly_reports'
    __table_args__ = (
        Index('ix_weekly_reports_uuid', 'uuid'),
        Index('ix_weekly_reports_physician_id', 'physician_id'),
        Index('ix_weekly_reports_week', 'report_week_start', 'report_week_end'),
        {'comment': 'Physician weekly reports'}
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
    
    # Physician reference
    physician_id = Column(
        Integer,
        ForeignKey('staff.id', ondelete='CASCADE'),
        nullable=False,
        comment="Foreign key to staff table (physician)"
    )
    
    # Report period
    report_week_start = Column(
        Date,
        nullable=False,
        comment="Start of the report week"
    )
    
    report_week_end = Column(
        Date,
        nullable=False,
        comment="End of the report week"
    )
    
    # Report content
    report_data = Column(
        JSONB,
        nullable=True,
        comment="Report content as JSON"
    )
    
    s3_path = Column(
        String(500),
        nullable=True,
        comment="Path to PDF in S3"
    )
    
    # Summary metrics
    patient_count = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of patients in report"
    )
    
    total_alerts = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of alerts in report"
    )
    
    total_questions = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of questions in report"
    )
    
    # Timestamp
    generated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the report was generated"
    )
    
    # Relationships
    physician = relationship(
        "Staff",
        back_populates="weekly_reports"
    )
    
    def __repr__(self) -> str:
        return (
            f"<WeeklyReport(id={self.id}, physician_id={self.physician_id}, "
            f"week={self.report_week_start} to {self.report_week_end})>"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "uuid": str(self.uuid),
            "physician_id": self.physician_id,
            "report_week_start": self.report_week_start.isoformat() if self.report_week_start else None,
            "report_week_end": self.report_week_end.isoformat() if self.report_week_end else None,
            "s3_path": self.s3_path,
            "patient_count": self.patient_count,
            "total_alerts": self.total_alerts,
            "total_questions": self.total_questions,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
        }

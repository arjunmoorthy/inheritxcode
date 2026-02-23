"""
User Model - Doctor API
=======================

This module defines the User SQLAlchemy model for authentication.

Table: users
- Stores authentication credentials (email, password hash)
- Supports both manual signup and SSO (Google, Cognito)
- Links to Staff table for profile information

Auth Providers:
- 'local': Manual signup with email/password
- 'google': Google SSO signup
- 'cognito': AWS Cognito SSO

Usage:
    from db.models import User
    
    # Manual signup user
    user = User(
        email="doctor@clinic.com",
        password_hash=hash_password("secret123"),
        auth_provider="local"
    )
    
    # Google SSO user
    user = User(
        email="doctor@gmail.com",
        auth_provider="google",
        provider_user_id="google-sub-id-123"
    )
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db.base import DoctorBase, TimestampMixin


class User(DoctorBase, TimestampMixin):
    """
    Represents a user account for authentication.
    
    This table handles all authentication concerns:
    - Email/password for manual signups
    - SSO provider tracking for Google/Cognito signups
    - Account status (active, verified)
    - Login tracking
    
    The User has a 1:1 relationship with Staff (profile data).
    
    Attributes:
        id: Auto-increment primary key
        uuid: Unique identifier for external use
        email: Unique email address (login identifier)
        password_hash: Bcrypt hash of password (NULL for SSO users)
        auth_provider: Authentication method ('local', 'google', 'cognito')
        provider_user_id: External provider's user ID (sub claim)
        is_active: Whether the account is active
        is_verified: Whether email is verified
        last_login_at: Last successful login timestamp
    """
    
    __tablename__ = 'users'
    __table_args__ = (
        Index('ix_users_auth_provider', 'auth_provider'),
        Index('ix_users_provider_user_id', 'provider_user_id'),
        {'comment': 'User authentication credentials'}
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
    
    # Authentication credentials
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique email address (login identifier)"
    )
    password_hash = Column(
        String(255),
        nullable=True,
        comment="Bcrypt hash of password (NULL for SSO users)"
    )
    
    # Auth provider tracking
    auth_provider = Column(
        String(50),
        nullable=False,
        default='local',
        comment="Authentication method: 'local', 'google', 'cognito'"
    )
    provider_user_id = Column(
        String(255),
        nullable=True,
        comment="External provider's user ID (Google sub, Cognito sub)"
    )
    
    # Personal information
    first_name = Column(
        String(100),
        nullable=True,
        comment="User's first name"
    )
    last_name = Column(
        String(100),
        nullable=True,
        comment="User's last name"
    )
    
    # Account status
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether the account is active"
    )
    is_verified = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether email is verified"
    )
    last_login_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last successful login timestamp"
    )
    reset_token = Column(
        String(255),
        nullable=True,
        index=True,
        comment="Password reset token"
    )
    reset_token_expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Reset token expiry time"
    )
    
    # Relationships
    staff = relationship(
        "Staff",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        """String representation of the user."""
        return (
            f"<User(id={self.id}, email='{self.email}', "
            f"provider='{self.auth_provider}')>"
        )
    
    @property
    def is_sso_user(self) -> bool:
        """Check if this user signed up via SSO."""
        return self.auth_provider != 'local'
    
    @property
    def is_google_user(self) -> bool:
        """Check if this user signed up via Google."""
        return self.auth_provider == 'google'
    
    @property
    def is_cognito_user(self) -> bool:
        """Check if this user signed up via Cognito."""
        return self.auth_provider == 'cognito'
    
    @property
    def has_password(self) -> bool:
        """Check if user has a password set."""
        return self.password_hash is not None
    
    @property
    def full_name(self) -> Optional[str]:
        """Get the user's full name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name
    
    def update_last_login(self) -> None:
        """Update the last login timestamp."""
        self.last_login_at = datetime.utcnow()
    
    def to_dict(self) -> dict:
        """
        Convert the user to a dictionary.
        
        Note: Does NOT include password_hash for security.
        
        Returns:
            Dictionary representation of the user
        """
        return {
            "id": self.id,
            "uuid": str(self.uuid),
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "auth_provider": self.auth_provider,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

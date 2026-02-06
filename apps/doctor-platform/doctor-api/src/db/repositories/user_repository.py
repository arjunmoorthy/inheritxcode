"""
User Repository - Doctor API
============================

Repository for user-related database operations.
Handles User model for authentication.

Usage:
    from db.repositories import UserRepository
    
    user_repo = UserRepository(db)
    user = user_repo.get_by_email("doctor@clinic.com")
"""

from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .base import BaseRepository
from db.models import User
from core.logging import get_logger
from core.exceptions import NotFoundError, ConflictError

logger = get_logger(__name__)


class UserRepository(BaseRepository[User]):
    """
    Repository for User model operations.
    
    Provides CRUD operations and user-specific queries
    for managing authentication data.
    """
    
    def __init__(self, db: Session):
        """Initialize the user repository."""
        super().__init__(User, db)
    
    # =========================================================================
    # User Queries
    # =========================================================================
    
    def get_by_uuid(self, user_uuid: UUID) -> Optional[User]:
        """Get a user by their UUID."""
        return self.db.query(User).filter(User.uuid == user_uuid).first()
    
    def get_by_uuid_or_fail(self, user_uuid: UUID) -> User:
        """Get a user by UUID, raising error if not found."""
        user = self.get_by_uuid(user_uuid)
        if not user:
            raise NotFoundError(
                message="User not found",
                resource_type="User",
                resource_id=str(user_uuid)
            )
        return user
    
    def get_by_email(self, email: str) -> Optional[User]:
        """Get a user by email address."""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_by_email_or_fail(self, email: str) -> User:
        """Get a user by email, raising error if not found."""
        user = self.get_by_email(email)
        if not user:
            raise NotFoundError(
                message="User not found",
                resource_type="User",
                details={"email": email}
            )
        return user
    
    def get_by_provider_user_id(
        self, 
        provider: str, 
        provider_user_id: str
    ) -> Optional[User]:
        """Get a user by SSO provider and provider user ID."""
        return self.db.query(User).filter(
            User.auth_provider == provider,
            User.provider_user_id == provider_user_id
        ).first()
    
    def get_by_email_or_provider(
        self, 
        email: str, 
        provider: str = None, 
        provider_user_id: str = None
    ) -> Optional[User]:
        """Get a user by email OR by provider ID."""
        filters = [User.email == email]
        if provider and provider_user_id:
            filters.append(
                (User.auth_provider == provider) & 
                (User.provider_user_id == provider_user_id)
            )
        return self.db.query(User).filter(or_(*filters)).first()
    
    def email_exists(self, email: str) -> bool:
        """Check if an email address is already in use."""
        return self.exists(email=email)
    
    # =========================================================================
    # User Creation
    # =========================================================================
    
    def create_local_user(
        self,
        email: str,
        password_hash: str,
    ) -> User:
        """
        Create a new local user (email/password signup).
        
        Args:
            email: User's email address
            password_hash: Bcrypt hash of the password
            
        Returns:
            The created User instance
        """
        if self.email_exists(email):
            raise ConflictError(
                message="A user with this email already exists",
                details={"email": email}
            )
        
        user = self.create(
            email=email,
            password_hash=password_hash,
            auth_provider='local',
            is_active=True,
            is_verified=False,
        )
        
        logger.info(f"Created local user: {email}")
        return user
    
    def create_sso_user(
        self,
        email: str,
        auth_provider: str,
        provider_user_id: str,
    ) -> User:
        """
        Create a new SSO user (Google, Cognito, etc.).
        
        Args:
            email: User's email address
            auth_provider: SSO provider name ('google', 'cognito')
            provider_user_id: Provider's user ID (sub claim)
            
        Returns:
            The created User instance
        """
        # Check if user already exists
        existing = self.get_by_email_or_provider(
            email=email,
            provider=auth_provider,
            provider_user_id=provider_user_id
        )
        if existing:
            raise ConflictError(
                message="A user with this email or provider ID already exists",
                details={"email": email, "provider": auth_provider}
            )
        
        user = self.create(
            email=email,
            password_hash=None,  # No password for SSO users
            auth_provider=auth_provider,
            provider_user_id=provider_user_id,
            is_active=True,
            is_verified=True,  # SSO users are pre-verified
        )
        
        logger.info(f"Created SSO user: {email} ({auth_provider})")
        return user
    
    # =========================================================================
    # User Updates
    # =========================================================================
    
    def update_password(self, user: User, new_password_hash: str) -> User:
        """Update a user's password hash."""
        return self.update(user, password_hash=new_password_hash)
    
    def update_last_login(self, user: User) -> User:
        """Update the user's last login timestamp."""
        from datetime import datetime
        return self.update(user, last_login_at=datetime.utcnow())
    
    def verify_user(self, user: User) -> User:
        """Mark a user as verified."""
        return self.update(user, is_verified=True)
    
    def deactivate_user(self, user: User) -> User:
        """Deactivate a user account."""
        return self.update(user, is_active=False)
    
    def activate_user(self, user: User) -> User:
        """Activate a user account."""
        return self.update(user, is_active=True)

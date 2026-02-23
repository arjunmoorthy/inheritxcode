"""
Clinic Repository - Doctor API
==============================

Repository for clinic-related database operations.
Extends BaseRepository with clinic-specific query methods.

Usage:
    from db.repositories import ClinicRepository
    
    clinic_repo = ClinicRepository(db)
    clinic = clinic_repo.get_by_uuid(clinic_uuid)
    clinics = clinic_repo.search_by_name("Oncology")
"""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from .base import BaseRepository
from db.models import Clinic
from core.logging import get_logger
from core.exceptions import NotFoundError, ConflictError

logger = get_logger(__name__)


class ClinicRepository(BaseRepository[Clinic]):
    """
    Repository for Clinic model operations.
    
    Provides CRUD operations and clinic-specific queries
    for managing healthcare facility data.
    """
    
    def __init__(self, db: Session):
        """Initialize the clinic repository."""
        super().__init__(Clinic, db)
    
    # =========================================================================
    # Clinic Queries
    # =========================================================================
    
    def get_by_uuid(self, clinic_uuid: UUID) -> Optional[Clinic]:
        """Get a clinic by its UUID."""
        return self.db.query(Clinic).filter(Clinic.uuid == clinic_uuid).first()
    
    def get_by_uuid_or_fail(self, clinic_uuid: UUID) -> Clinic:
        """Get a clinic by UUID, raising error if not found."""
        clinic = self.get_by_uuid(clinic_uuid)
        if not clinic:
            raise NotFoundError(
                message="Clinic not found",
                resource_type="Clinic",
                resource_id=str(clinic_uuid)
            )
        return clinic
    
    def get_by_name(self, name: str) -> Optional[Clinic]:
        """Get a clinic by its exact name."""
        return self.db.query(Clinic).filter(Clinic.name == name).first()
    
    def search_by_name(
        self,
        search_term: str,
        limit: int = 20
    ) -> List[Clinic]:
        """Search clinics by name (case-insensitive partial match)."""
        return self.db.query(Clinic).filter(
            Clinic.name.ilike(f"%{search_term}%"),
            Clinic.is_active == True
        ).limit(limit).all()
    
    def get_all_active(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> List[Clinic]:
        """Get all active clinics with pagination."""
        return self.db.query(Clinic).filter(
            Clinic.is_active == True
        ).order_by(
            Clinic.name
        ).offset(skip).limit(limit).all()
    
    def count_active(self) -> int:
        """Count total active clinics."""
        return self.db.query(Clinic).filter(Clinic.is_active == True).count()
    
    def name_exists(self, name: str) -> bool:
        """Check if a clinic with the given name already exists."""
        return self.exists(name=name)
    
    # =========================================================================
    # Clinic Creation
    # =========================================================================
    
    def create_clinic(
        self,
        name: str,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None,
        phone: Optional[str] = None,
        fax: Optional[str] = None,
    ) -> Clinic:
        """
        Create a new clinic.
        
        Args:
            name: Name of the clinic
            address: Street address
            city: City
            state: State/Province
            zip_code: Postal code
            phone: Contact phone
            fax: Fax number
            
        Returns:
            The created Clinic instance
        """
        if self.name_exists(name):
            raise ConflictError(
                message="A clinic with this name already exists",
                details={"name": name}
            )
        
        clinic = self.create(
            name=name,
            address=address,
            city=city,
            state=state,
            zip_code=zip_code,
            phone=phone,
            fax=fax,
            is_active=True,
        )
        
        logger.info(f"Created clinic: {name}")
        return clinic
    
    # =========================================================================
    # Clinic Updates
    # =========================================================================
    
    def update_clinic(
        self,
        clinic: Clinic,
        name: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None,
        phone: Optional[str] = None,
        fax: Optional[str] = None,
    ) -> Clinic:
        """Update a clinic's information."""
        update_data = {}
        if name is not None:
            update_data["name"] = name
        if address is not None:
            update_data["address"] = address
        if city is not None:
            update_data["city"] = city
        if state is not None:
            update_data["state"] = state
        if zip_code is not None:
            update_data["zip_code"] = zip_code
        if phone is not None:
            update_data["phone"] = phone
        if fax is not None:
            update_data["fax"] = fax
        
        if update_data:
            return self.update(clinic, **update_data)
        return clinic
    
    def deactivate_clinic(self, clinic: Clinic) -> Clinic:
        """Deactivate a clinic."""
        return self.update(clinic, is_active=False)
    
    def activate_clinic(self, clinic: Clinic) -> Clinic:
        """Activate a clinic."""
        return self.update(clinic, is_active=True)

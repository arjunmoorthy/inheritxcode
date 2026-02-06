"""
Staff Repository - Doctor API
=============================

Repository for staff-related database operations.
Handles Staff, StaffClinic, and PhysicianPatient models.

Usage:
    from db.repositories import StaffRepository
    
    staff_repo = StaffRepository(db)
    physician = staff_repo.get_physician_by_email("doctor@clinic.com")
    staff_list = staff_repo.get_staff_for_clinic(clinic_id)
"""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_

from .base import BaseRepository
from db.models import Staff, StaffClinic, PhysicianPatient, User
from core.logging import get_logger
from core.exceptions import NotFoundError, ConflictError

logger = get_logger(__name__)


class StaffRepository(BaseRepository[Staff]):
    """
    Repository for Staff model operations.
    
    Provides CRUD operations and staff-specific queries
    for managing healthcare personnel data.
    
    Also handles StaffClinic and PhysicianPatient operations.
    """
    
    def __init__(self, db: Session):
        """Initialize the staff repository."""
        super().__init__(Staff, db)
    
    # =========================================================================
    # Staff Profile Queries
    # =========================================================================
    
    def get_by_uuid(self, staff_uuid: UUID) -> Optional[Staff]:
        """Get a staff profile by their UUID."""
        return self.db.query(Staff).filter(Staff.uuid == staff_uuid).first()
    
    def get_by_uuid_or_fail(self, staff_uuid: UUID) -> Staff:
        """Get a staff profile by UUID, raising error if not found."""
        staff = self.get_by_uuid(staff_uuid)
        if not staff:
            raise NotFoundError(
                message="Staff member not found",
                resource_type="Staff",
                resource_id=str(staff_uuid)
            )
        return staff
    
    def get_by_user_id(self, user_id: int) -> Optional[Staff]:
        """Get a staff profile by user ID."""
        return self.db.query(Staff).filter(Staff.user_id == user_id).first()
    
    def get_by_email(self, email: str) -> Optional[Staff]:
        """Get a staff profile by email address."""
        return self.db.query(Staff).filter(Staff.email == email).first()
    
    def get_by_email_or_fail(self, email: str) -> Staff:
        """Get a staff profile by email, raising error if not found."""
        staff = self.get_by_email(email)
        if not staff:
            raise NotFoundError(
                message="Staff member not found",
                resource_type="Staff",
                details={"email": email}
            )
        return staff
    
    def get_physician_by_email(self, email: str) -> Optional[Staff]:
        """Get a physician profile by email address."""
        return self.db.query(Staff).filter(
            and_(
                Staff.email == email,
                Staff.role == 'physician'
            )
        ).first()
    
    def get_all_physicians(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> List[Staff]:
        """Get all physicians with pagination."""
        return self.db.query(Staff).filter(
            Staff.role == 'physician',
            Staff.is_active == True
        ).order_by(
            Staff.last_name, Staff.first_name
        ).offset(skip).limit(limit).all()
    
    def get_staff_by_role(
        self,
        role: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Staff]:
        """Get all staff members with a specific role."""
        return self.db.query(Staff).filter(
            Staff.role == role,
            Staff.is_active == True
        ).order_by(
            Staff.last_name, Staff.first_name
        ).offset(skip).limit(limit).all()
    
    def count_staff(self, role: Optional[str] = None) -> int:
        """Count total staff members with optional role filter."""
        query = self.db.query(Staff).filter(Staff.is_active == True)
        if role:
            query = query.filter(Staff.role == role)
        return query.count()
    
    def search_by_name(
        self,
        search_term: str,
        role: Optional[str] = None,
        limit: int = 20
    ) -> List[Staff]:
        """Search staff by name (first or last name, case-insensitive)."""
        query = self.db.query(Staff).filter(
            Staff.is_active == True,
            (Staff.first_name.ilike(f"%{search_term}%")) |
            (Staff.last_name.ilike(f"%{search_term}%"))
        )
        
        if role:
            query = query.filter(Staff.role == role)
        
        return query.limit(limit).all()
    
    def email_exists(self, email: str) -> bool:
        """Check if an email address is already in use."""
        return self.exists(email=email)
    
    # =========================================================================
    # Staff Creation
    # =========================================================================
    
    def create_staff(
        self,
        user_id: int,
        email: str,
        first_name: str = None,
        last_name: str = None,
        role: str = 'staff',
        npi_number: str = None,
        department: str = None,
    ) -> Staff:
        """
        Create a new staff profile linked to a user.
        
        Args:
            user_id: ID of the associated user
            email: Staff member's email
            first_name: Staff member's first name
            last_name: Staff member's last name
            role: Role (physician, nurse, staff, admin)
            npi_number: National Provider Identifier (physicians only)
            department: Department within clinic
            
        Returns:
            The created Staff instance
        """
        if self.email_exists(email):
            raise ConflictError(
                message="A staff member with this email already exists",
                details={"email": email}
            )
        
        staff = self.create(
            user_id=user_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            npi_number=npi_number,
            department=department,
            is_profile_completed=False,
            is_active=True,
        )
        
        logger.info(f"Created staff: {email} (role={role})")
        return staff
    
    # =========================================================================
    # Staff-Clinic Association Operations
    # =========================================================================
    
    def create_clinic_association(
        self,
        staff_id: int,
        clinic_id: int,
        is_primary: bool = False,
    ) -> StaffClinic:
        """Create a staff-clinic association."""
        association = StaffClinic(
            staff_id=staff_id,
            clinic_id=clinic_id,
            is_primary=is_primary,
            is_active=True,
        )
        self.db.add(association)
        self.db.commit()
        self.db.refresh(association)
        return association
    
    def get_clinic_associations(self, staff_id: int) -> List[StaffClinic]:
        """Get all clinic associations for a staff member."""
        return self.db.query(StaffClinic).filter(
            StaffClinic.staff_id == staff_id,
            StaffClinic.is_active == True
        ).all()
    
    def get_staff_for_clinic(self, clinic_id: int) -> List[Staff]:
        """Get all staff members associated with a clinic."""
        associations = self.db.query(StaffClinic).filter(
            StaffClinic.clinic_id == clinic_id,
            StaffClinic.is_active == True
        ).all()
        
        staff_ids = [a.staff_id for a in associations]
        if not staff_ids:
            return []
        
        return self.db.query(Staff).filter(
            Staff.id.in_(staff_ids),
            Staff.is_active == True
        ).all()
    
    def get_primary_clinic_id(self, staff_id: int) -> Optional[int]:
        """Get the primary clinic ID for a staff member."""
        association = self.db.query(StaffClinic).filter(
            StaffClinic.staff_id == staff_id,
            StaffClinic.is_primary == True,
            StaffClinic.is_active == True
        ).first()
        
        if association:
            return association.clinic_id
        
        # If no primary, return first active
        association = self.db.query(StaffClinic).filter(
            StaffClinic.staff_id == staff_id,
            StaffClinic.is_active == True
        ).first()
        
        return association.clinic_id if association else None
    
    # =========================================================================
    # Physician-Patient Assignment Operations
    # =========================================================================
    
    def assign_patient(
        self,
        physician_id: int,
        patient_uuid: UUID,
        assigned_by: int = None,
    ) -> PhysicianPatient:
        """Assign a patient to a physician."""
        # Check if already assigned
        existing = self.db.query(PhysicianPatient).filter(
            PhysicianPatient.physician_id == physician_id,
            PhysicianPatient.patient_uuid == patient_uuid
        ).first()
        
        if existing:
            if existing.is_active:
                return existing  # Already assigned
            else:
                # Reactivate
                existing.is_active = True
                self.db.commit()
                self.db.refresh(existing)
                return existing
        
        assignment = PhysicianPatient(
            physician_id=physician_id,
            patient_uuid=patient_uuid,
            assigned_by=assigned_by,
            is_active=True,
        )
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        
        logger.info(f"Assigned patient {patient_uuid} to physician {physician_id}")
        return assignment
    
    def unassign_patient(
        self,
        physician_id: int,
        patient_uuid: UUID,
    ) -> bool:
        """Unassign a patient from a physician."""
        assignment = self.db.query(PhysicianPatient).filter(
            PhysicianPatient.physician_id == physician_id,
            PhysicianPatient.patient_uuid == patient_uuid,
            PhysicianPatient.is_active == True
        ).first()
        
        if assignment:
            assignment.is_active = False
            self.db.commit()
            logger.info(f"Unassigned patient {patient_uuid} from physician {physician_id}")
            return True
        
        return False
    
    def get_physician_patients(self, physician_id: int) -> List[UUID]:
        """Get all patient UUIDs assigned to a physician."""
        assignments = self.db.query(PhysicianPatient).filter(
            PhysicianPatient.physician_id == physician_id,
            PhysicianPatient.is_active == True
        ).all()
        
        return [a.patient_uuid for a in assignments]
    
    def get_patient_physicians(self, patient_uuid: UUID) -> List[Staff]:
        """Get all physicians assigned to a patient."""
        assignments = self.db.query(PhysicianPatient).filter(
            PhysicianPatient.patient_uuid == patient_uuid,
            PhysicianPatient.is_active == True
        ).all()
        
        physician_ids = [a.physician_id for a in assignments]
        if not physician_ids:
            return []
        
        return self.db.query(Staff).filter(
            Staff.id.in_(physician_ids),
            Staff.is_active == True
        ).all()
    
    def is_patient_assigned(self, physician_id: int, patient_uuid: UUID) -> bool:
        """Check if a patient is assigned to a physician."""
        return self.db.query(PhysicianPatient).filter(
            PhysicianPatient.physician_id == physician_id,
            PhysicianPatient.patient_uuid == patient_uuid,
            PhysicianPatient.is_active == True
        ).first() is not None

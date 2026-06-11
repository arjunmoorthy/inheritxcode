from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
import uuid

# A separate Base for the doctor database models
DoctorBase = declarative_base()


# -----------------------------------------------------------------------------
# Users table (doctor-api) - for patient-api login
# -----------------------------------------------------------------------------
class DoctorUser(DoctorBase):
    """Maps to doctor-api users table. Used by patient-api login."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, default="staff")
    auth_provider = Column(String(50), nullable=False, default="local")
    provider_user_id = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    is_first_login = Column(Boolean, nullable=False, default=False)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DoctorStaff(DoctorBase):
    """Maps to doctor-api staff table (user_id -> users.id)."""
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False, default="staff")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DoctorPatient(DoctorBase):
    """Maps to doctor-api fax_patients table (user_id -> users.id)."""
    __tablename__ = "fax_patients"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    phone_number = Column(String(50), nullable=True, index=True)
    email = Column(String(255), nullable=True, index=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# -----------------------------------------------------------------------------
# Legacy / other doctor DB tables
# -----------------------------------------------------------------------------
class AllClinics(DoctorBase):
    __tablename__ = 'all_clinics'
    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, server_default=func.now())
    clinic_name = Column(String)
    address = Column(String)
    phone_number = Column(String)
    fax_number = Column(String)

class StaffProfiles(DoctorBase):
    __tablename__ = 'staff_profiles'
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, server_default=func.now())
    staff_uuid = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    email_address = Column(String, unique=True, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    role = Column(String)
    npi_number = Column(String, nullable=True)

class StaffAssociations(DoctorBase):
    __tablename__ = 'staff_associations'
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, server_default=func.now())
    staff_uuid = Column(UUID(as_uuid=True), nullable=False, index=True)
    physician_uuid = Column(UUID(as_uuid=True), nullable=False, index=True)
    clinic_uuid = Column(UUID(as_uuid=True), nullable=False, index=True) 

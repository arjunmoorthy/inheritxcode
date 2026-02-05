from sqlalchemy import (
    Column, 
    Integer, 
    String, 
    DateTime, 
    func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
import uuid
from sqlalchemy import Boolean, ForeignKey

# A separate Base for the doctor database models
DoctorBase = declarative_base()

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

class Staff(DoctorBase):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)

    cognito_sub = Column(String(255), nullable=True)

    email = Column(String(255), unique=True, nullable=False, index=True)
    first_name = Column(String(100))
    last_name = Column(String(100))

    role = Column(String(50), nullable=False)

    # clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=True)
    physician_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

class Clinic(DoctorBase):
    __tablename__ = "clinics"

    id = Column(Integer, primary_key=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)

    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    phone = Column(String(20), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
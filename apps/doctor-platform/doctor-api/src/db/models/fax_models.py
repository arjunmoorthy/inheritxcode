from db.base import DoctorBase, TimestampMixin
from sqlalchemy import Column, String, Text, DateTime, Integer, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB


class FaxRecord(DoctorBase, TimestampMixin):
    __tablename__ = "fax_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="Auto-incrementing primary key")
    fax_id = Column(String, unique=True, index=True)
    from_number = Column(String, nullable=False)
    to_number = Column(String, nullable=False)
    file_url = Column(Text, nullable=False)
    stored_file_path = Column(Text, nullable=True)

    raw_ocr_text = Column(Text, nullable=True)
    ocr_status = Column(String, default="pending")  # pending/success/failed
    ocr_confidence = Column(Float, nullable=True)

    received_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    structured_ocr_data = Column(JSONB, nullable=True)  # ✅ ADD THIS

    # ✅ THIS WAS MISSING
    patient_id = Column(
        Integer,
        ForeignKey("fax_patients.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # ✅ Reverse relation
    patient = relationship("Patient", back_populates="faxes")


class Patient(DoctorBase, TimestampMixin):
    __tablename__ = "fax_patients"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)

    # Link to users table (when patient logs in via patient portal).
    # user.uuid is the identity used in patient-api for chat (chat_patients.uuid / conversations.patient_uuid).
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )
    user = relationship("User", back_populates="patient_profile", uselist=False)

    # Identity
    mrn = Column(String(100), unique=True, index=True, nullable=True)
    first_name = Column(String(255))
    last_name = Column(String(255))
    date_of_birth = Column(Date)
    gender = Column(String(20))

    # Contact
    phone_number = Column(String(50), index=True)
    email = Column(String(255), index=True)

    # Clinical (CURRENT STATE)
    age = Column(Integer)
    bmi = Column(String(20))
    cancer_type = Column(String(255))
    diagnosis = Column(Text, nullable=True)
    oncologist = Column(String(255))

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    plan_name = Column(Text, nullable=True)
    regimen_name = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    chemotherapy_day = Column(String(50), nullable=True)
    next_chemotherapy_at = Column(DateTime(timezone=True), nullable=True)

    # History (latest known)
    past_medical_history = Column(Text)
    past_surgical_history = Column(Text)

    password_hash = Column(String, nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    physician_assignments = relationship(
        "PhysicianPatient",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    # Relationship
    faxes = relationship("FaxRecord", back_populates="patient")
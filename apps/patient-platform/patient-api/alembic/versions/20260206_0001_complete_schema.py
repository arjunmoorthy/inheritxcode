"""Complete schema - Patient API

Revision ID: 20260206_0001
Revises: 
Create Date: 2026-02-06

This migration creates the complete database schema for the Patient API.
It replaces all previous migrations and includes all tables from models:

Core Tables:
- users: Authentication and user accounts
- patient_profiles: Extended patient information
- staff_profiles: Medical staff information
- patients: Core patient records

Conversation & Chat:
- conversations: Chat sessions
- messages: Individual messages
- conversation_summaries: AI-generated summaries

Medical Records:
- chemo_sessions: Chemotherapy sessions
- chemo_symptoms: Symptoms during/after chemo
- diary_entries: Patient diary entries

Referral & Onboarding:
- patient_referrals: Referral data from fax OCR
- referral_documents: Original fax documents
- patient_onboarding_status: Onboarding progress
- onboarding_notification_log: Notification audit

OCR & Providers:
- providers: Healthcare provider information
- oncology_profiles: Cancer diagnosis and treatment
- medications: Patient medications
- fax_ingestion_log: Fax processing audit
- ocr_field_confidence: Per-field OCR confidence
- ocr_confidence_thresholds: Confidence threshold config

Education Module:
- symptoms: Symptom catalog
- symptom_sessions: Chatbot sessions
- rule_evaluations: Rule evaluation audit
- education_documents: Clinician-approved content
- disclaimers: Mandatory disclaimer text
- care_team_handouts: Care team handout documents
- patient_summaries: Immutable patient summaries
- medications_tried: Medications attempted during sessions
- education_delivery_log: Education delivery audit
- education_access_log: Education access analytics

Questions:
- patient_questions: Patient questions for doctor
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260206_0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create complete database schema."""
    
    # ==========================================================================
    # 1. USERS TABLE - Authentication
    # ==========================================================================
    op.create_table(
        'users',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('user_type', sa.String(20), nullable=False, server_default='patient'),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_user_type', 'users', ['user_type'])
    
    # ==========================================================================
    # 2. PATIENT_PROFILES TABLE - Extended Patient Information
    # ==========================================================================
    op.create_table(
        'patient_profiles',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('users.uuid', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('date_of_birth', sa.DateTime(), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('diagnosis', sa.String(255), nullable=True),
        sa.Column('diagnosis_date', sa.DateTime(), nullable=True),
        sa.Column('treatment_status', sa.String(50), nullable=True),
        sa.Column('primary_oncologist', sa.String(255), nullable=True),
        sa.Column('care_team_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('preferences', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_patient_profiles_user_uuid', 'patient_profiles', ['user_uuid'])
    
    # ==========================================================================
    # 3. STAFF_PROFILES TABLE - Medical Staff Information
    # ==========================================================================
    op.create_table(
        'staff_profiles',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('users.uuid', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('role', sa.String(50), nullable=False, server_default='nurse'),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('specialty', sa.String(100), nullable=True),
        sa.Column('license_number', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_staff_profiles_user_uuid', 'staff_profiles', ['user_uuid'])
    
    # ==========================================================================
    # 4. PATIENTS TABLE - Core Patient Records
    # ==========================================================================
    op.create_table(
        'patients',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('mrn', sa.String(50), nullable=True, unique=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('date_of_birth', sa.DateTime(), nullable=True),
        sa.Column('gender', sa.String(20), nullable=True),
        sa.Column('address_line1', sa.String(255), nullable=True),
        sa.Column('address_line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(50), nullable=True),
        sa.Column('zip_code', sa.String(20), nullable=True),
        sa.Column('country', sa.String(50), nullable=True, server_default='USA'),
        sa.Column('emergency_contact_name', sa.String(200), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(20), nullable=True),
        sa.Column('emergency_contact_relationship', sa.String(50), nullable=True),
        sa.Column('diagnosis_info', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('primary_oncologist_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('care_team_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_patients_mrn', 'patients', ['mrn'])
    op.create_index('ix_patients_email', 'patients', ['email'])
    
    # ==========================================================================
    # 5. CONVERSATIONS TABLE - Chat Sessions
    # ==========================================================================
    op.create_table(
        'conversations',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('patients.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('conversation_state', sa.String(50), nullable=True, server_default='greeting'),
        sa.Column('symptom_list', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('severity_list', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('engine_state', postgresql.JSONB(), nullable=True),
        sa.Column('overall_feeling', sa.String(50), nullable=True),
        sa.Column('triage_level', sa.String(50), nullable=True),
        sa.Column('triage_message', sa.Text(), nullable=True),
        sa.Column('bulleted_summary', sa.Text(), nullable=True),
        sa.Column('longer_summary', sa.Text(), nullable=True),
        sa.Column('medication_list', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('is_complete', sa.String(10), nullable=True, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_conversations_patient_uuid', 'conversations', ['patient_uuid'])
    op.create_index('ix_conversations_created_at', 'conversations', ['created_at'])
    
    # ==========================================================================
    # 6. MESSAGES TABLE - Chat Messages
    # ==========================================================================
    op.create_table(
        'messages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('chat_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('conversations.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('sender', sa.String(20), nullable=False),
        sa.Column('message_type', sa.String(50), nullable=False, server_default='text'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('structured_data', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_messages_chat_uuid', 'messages', ['chat_uuid'])
    op.create_index('ix_messages_created_at', 'messages', ['created_at'])
    
    # ==========================================================================
    # 7. CHEMO_SESSIONS TABLE - Chemotherapy Sessions
    # ==========================================================================
    op.create_table(
        'chemo_sessions',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('patients.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('session_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('cycle_number', sa.Integer(), nullable=True),
        sa.Column('day_in_cycle', sa.Integer(), nullable=True),
        sa.Column('treatment_protocol', sa.String(100), nullable=True),
        sa.Column('drugs_administered', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='scheduled'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('pre_treatment_vitals', postgresql.JSONB(), nullable=True),
        sa.Column('post_treatment_vitals', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_chemo_sessions_patient_uuid', 'chemo_sessions', ['patient_uuid'])
    op.create_index('ix_chemo_sessions_session_date', 'chemo_sessions', ['session_date'])
    
    # ==========================================================================
    # 8. CHEMO_SYMPTOMS TABLE - Symptoms During/After Chemo
    # ==========================================================================
    op.create_table(
        'chemo_symptoms',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('chemo_session_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('chemo_sessions.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('patients.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('symptom_code', sa.String(20), nullable=False),
        sa.Column('symptom_name', sa.String(100), nullable=False),
        sa.Column('severity', sa.String(20), nullable=True),
        sa.Column('onset_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('days_after_treatment', sa.Integer(), nullable=True),
        sa.Column('duration_hours', sa.Float(), nullable=True),
        sa.Column('medication_taken', sa.String(200), nullable=True),
        sa.Column('medication_helped', sa.Boolean(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_chemo_symptoms_chemo_session_uuid', 'chemo_symptoms', ['chemo_session_uuid'])
    op.create_index('ix_chemo_symptoms_patient_uuid', 'chemo_symptoms', ['patient_uuid'])
    
    # ==========================================================================
    # 9. DIARY_ENTRIES TABLE - Patient Diary
    # ==========================================================================
    op.create_table(
        'diary_entries',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('patients.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('overall_feeling', sa.String(20), nullable=True),
        sa.Column('energy_level', sa.Integer(), nullable=True),
        sa.Column('pain_level', sa.Integer(), nullable=True),
        sa.Column('sleep_hours', sa.Float(), nullable=True),
        sa.Column('sleep_quality', sa.String(20), nullable=True),
        sa.Column('symptoms_today', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('medications_taken', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('activities', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_diary_entries_patient_uuid', 'diary_entries', ['patient_uuid'])
    op.create_index('ix_diary_entries_entry_date', 'diary_entries', ['entry_date'])
    
    # ==========================================================================
    # 10. CONVERSATION_SUMMARIES TABLE - AI-Generated Summaries
    # ==========================================================================
    op.create_table(
        'conversation_summaries',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('conversations.uuid', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('patients.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('summary_type', sa.String(50), nullable=False, server_default='symptom_check'),
        sa.Column('chief_complaints', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('symptoms_reported', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('triage_level', sa.String(50), nullable=True),
        sa.Column('triage_reasons', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('recommendations', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('follow_up_needed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('follow_up_timeframe', sa.String(50), nullable=True),
        sa.Column('brief_summary', sa.Text(), nullable=True),
        sa.Column('detailed_summary', sa.Text(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_conversation_summaries_conversation_uuid', 'conversation_summaries', ['conversation_uuid'])
    op.create_index('ix_conversation_summaries_patient_uuid', 'conversation_summaries', ['patient_uuid'])
    
    # ==========================================================================
    # 11. PATIENT_REFERRALS TABLE - Referral Data from Fax OCR
    # ==========================================================================
    op.create_table(
        'patient_referrals',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('status', sa.String(50), nullable=False, server_default='received'),
        sa.Column('status_message', sa.Text(), nullable=True),
        sa.Column('fax_number', sa.String(20), nullable=True),
        sa.Column('fax_received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('referring_clinic', sa.String(255), nullable=True),
        sa.Column('referring_ehr', sa.String(100), nullable=True),
        # Patient Demographics
        sa.Column('patient_first_name', sa.String(100), nullable=True),
        sa.Column('patient_last_name', sa.String(100), nullable=True),
        sa.Column('patient_dob', sa.Date(), nullable=True),
        sa.Column('patient_sex', sa.String(20), nullable=True),
        sa.Column('patient_email', sa.String(255), nullable=True),
        sa.Column('patient_phone', sa.String(20), nullable=True),
        sa.Column('patient_mrn', sa.String(50), nullable=True),
        # Physician & Clinic
        sa.Column('attending_physician_name', sa.String(255), nullable=True),
        sa.Column('attending_physician_npi', sa.String(20), nullable=True),
        sa.Column('clinic_name', sa.String(255), nullable=True),
        sa.Column('clinic_address', sa.Text(), nullable=True),
        sa.Column('clinic_phone', sa.String(20), nullable=True),
        sa.Column('clinic_fax', sa.String(20), nullable=True),
        # Cancer & Treatment
        sa.Column('cancer_type', sa.String(255), nullable=True),
        sa.Column('cancer_staging', sa.String(100), nullable=True),
        sa.Column('cancer_diagnosis_date', sa.Date(), nullable=True),
        sa.Column('chemo_plan_name', sa.String(500), nullable=True),
        sa.Column('chemo_regimen', sa.Text(), nullable=True),
        sa.Column('chemo_start_date', sa.Date(), nullable=True),
        sa.Column('chemo_end_date', sa.Date(), nullable=True),
        sa.Column('chemo_current_cycle', sa.Integer(), nullable=True),
        sa.Column('chemo_total_cycles', sa.Integer(), nullable=True),
        sa.Column('treatment_department', sa.String(255), nullable=True),
        sa.Column('treatment_goal', sa.String(100), nullable=True),
        sa.Column('line_of_treatment', sa.String(100), nullable=True),
        # Medical History
        sa.Column('history_of_cancer', sa.Text(), nullable=True),
        sa.Column('past_medical_history', sa.Text(), nullable=True),
        sa.Column('past_surgical_history', sa.Text(), nullable=True),
        sa.Column('current_medications', postgresql.JSONB(), nullable=True),
        sa.Column('allergies', sa.Text(), nullable=True),
        # Vitals
        sa.Column('height_cm', sa.Float(), nullable=True),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('bmi', sa.Float(), nullable=True),
        sa.Column('blood_pressure', sa.String(20), nullable=True),
        sa.Column('pulse', sa.Integer(), nullable=True),
        sa.Column('temperature_f', sa.Float(), nullable=True),
        sa.Column('spo2', sa.Integer(), nullable=True),
        sa.Column('ecog_performance_status', sa.Integer(), nullable=True),
        # Social & Behavioral
        sa.Column('tobacco_use', sa.String(50), nullable=True),
        sa.Column('alcohol_use', sa.String(100), nullable=True),
        sa.Column('drug_use', sa.String(100), nullable=True),
        sa.Column('social_drivers', postgresql.JSONB(), nullable=True),
        # Lab Results & Family History
        sa.Column('lab_results', postgresql.JSONB(), nullable=True),
        sa.Column('family_history', postgresql.JSONB(), nullable=True),
        sa.Column('genetic_testing', sa.Text(), nullable=True),
        # Raw Data
        sa.Column('raw_extracted_data', postgresql.JSONB(), nullable=True),
        sa.Column('extraction_confidence', sa.Float(), nullable=True),
        sa.Column('fields_needing_review', postgresql.JSONB(), nullable=True),
        # Patient Account Linking
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('cognito_user_id', sa.String(100), nullable=True),
        sa.Column('temp_password_hash', sa.String(255), nullable=True),
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_patient_referrals_status', 'patient_referrals', ['status'])
    op.create_index('ix_patient_referrals_patient_uuid', 'patient_referrals', ['patient_uuid'])
    
    # ==========================================================================
    # 12. REFERRAL_DOCUMENTS TABLE - Original Fax Documents
    # ==========================================================================
    op.create_table(
        'referral_documents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('referral_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('patient_referrals.uuid'), nullable=False),
        sa.Column('s3_bucket', sa.String(255), nullable=False),
        sa.Column('s3_key', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_type', sa.String(50), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('textract_job_id', sa.String(255), nullable=True),
        sa.Column('raw_ocr_text', sa.Text(), nullable=True),
        sa.Column('ocr_confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_referral_documents_referral_uuid', 'referral_documents', ['referral_uuid'])
    
    # ==========================================================================
    # 13. PATIENT_ONBOARDING_STATUS TABLE - Onboarding Progress
    # ==========================================================================
    op.create_table(
        'patient_onboarding_status',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('referral_uuid', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('patient_referrals.uuid'), nullable=True, unique=True),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('current_step', sa.String(50), nullable=False, server_default='not_started'),
        # Password Reset
        sa.Column('password_reset_completed', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('password_reset_at', sa.DateTime(timezone=True), nullable=True),
        # Acknowledgement
        sa.Column('acknowledgement_completed', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('acknowledgement_text', sa.Text(), nullable=True),
        sa.Column('acknowledgement_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledgement_ip', sa.String(50), nullable=True),
        # Terms & Privacy
        sa.Column('terms_accepted', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('terms_version', sa.String(20), nullable=True),
        sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('privacy_accepted', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('privacy_version', sa.String(20), nullable=True),
        sa.Column('privacy_accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('hipaa_acknowledged', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('hipaa_version', sa.String(20), nullable=True),
        sa.Column('hipaa_acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        # Reminder Preferences
        sa.Column('reminder_preference_set', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('reminder_channel', sa.String(20), nullable=True),
        sa.Column('reminder_email', sa.String(255), nullable=True),
        sa.Column('reminder_phone', sa.String(20), nullable=True),
        sa.Column('reminder_time', sa.String(10), nullable=True),
        sa.Column('reminder_timezone', sa.String(50), nullable=True),
        sa.Column('reminder_preference_at', sa.DateTime(timezone=True), nullable=True),
        # Completion
        sa.Column('is_fully_onboarded', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('onboarding_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('first_login_at', sa.DateTime(timezone=True), nullable=True),
        # Notifications
        sa.Column('welcome_email_sent', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('welcome_email_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('welcome_sms_sent', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('welcome_sms_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reminder_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_reminder_sent_at', sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_patient_onboarding_status_referral_uuid', 'patient_onboarding_status', ['referral_uuid'])
    op.create_index('ix_patient_onboarding_status_patient_uuid', 'patient_onboarding_status', ['patient_uuid'])
    
    # ==========================================================================
    # 14. ONBOARDING_NOTIFICATION_LOG TABLE - Notification Audit
    # ==========================================================================
    op.create_table(
        'onboarding_notification_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('referral_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notification_type', sa.String(50), nullable=True),
        sa.Column('channel', sa.String(20), nullable=True),
        sa.Column('recipient', sa.String(255), nullable=True),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('status_message', sa.Text(), nullable=True),
        sa.Column('aws_message_id', sa.String(100), nullable=True),
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('body_preview', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_onboarding_notification_log_patient_uuid', 'onboarding_notification_log', ['patient_uuid'])
    op.create_index('ix_onboarding_notification_log_referral_uuid', 'onboarding_notification_log', ['referral_uuid'])
    
    # ==========================================================================
    # 15. PROVIDERS TABLE - Healthcare Provider Information
    # ==========================================================================
    op.create_table(
        'providers',
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('npi', sa.String(20), nullable=True, unique=True),
        sa.Column('specialty', sa.String(100), nullable=True),
        sa.Column('clinic_name', sa.String(255), nullable=True),
        sa.Column('clinic_address', sa.Text(), nullable=True),
        sa.Column('clinic_city', sa.String(100), nullable=True),
        sa.Column('clinic_state', sa.String(50), nullable=True),
        sa.Column('clinic_zip', sa.String(20), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('fax', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('provider_id'),
        sa.UniqueConstraint('full_name', 'clinic_name', name='uq_provider_name_clinic'),
    )
    op.create_index('ix_providers_npi', 'providers', ['npi'])
    op.create_index('ix_providers_full_name', 'providers', ['full_name'])
    op.create_index('ix_providers_clinic_name', 'providers', ['clinic_name'])
    
    # ==========================================================================
    # 16. ONCOLOGY_PROFILES TABLE - Cancer Diagnosis & Treatment
    # ==========================================================================
    op.create_table(
        'oncology_profiles',
        sa.Column('profile_id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('providers.provider_id'), nullable=True),
        sa.Column('referral_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        # Cancer Diagnosis
        sa.Column('cancer_type', sa.String(255), nullable=False),
        sa.Column('cancer_stage', sa.String(50), nullable=True),
        sa.Column('cancer_diagnosis_date', sa.Date(), nullable=True),
        sa.Column('cancer_icd10_code', sa.String(20), nullable=True),
        sa.Column('cancer_snomed_code', sa.String(50), nullable=True),
        # Treatment Information
        sa.Column('line_of_treatment', sa.String(100), nullable=True),
        sa.Column('treatment_goal', sa.String(100), nullable=True),
        sa.Column('chemo_plan_name', sa.Text(), nullable=True),
        sa.Column('chemo_regimen_description', sa.Text(), nullable=True),
        sa.Column('chemo_start_date', sa.Date(), nullable=True),
        sa.Column('chemo_end_date', sa.Date(), nullable=True),
        sa.Column('current_cycle', sa.Integer(), nullable=True),
        sa.Column('total_cycles', sa.Integer(), nullable=True),
        sa.Column('treatment_department', sa.String(255), nullable=True),
        sa.Column('next_clinic_visit', sa.Date(), nullable=True),
        sa.Column('last_chemo_date', sa.Date(), nullable=True),
        # Clinical Context
        sa.Column('bmi', sa.Numeric(4, 1), nullable=True),
        sa.Column('height_cm', sa.Float(), nullable=True),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('history_of_cancer', sa.Text(), nullable=True),
        sa.Column('past_medical_history', sa.Text(), nullable=True),
        sa.Column('past_surgical_history', sa.Text(), nullable=True),
        sa.Column('ecog_status', sa.Integer(), nullable=True),
        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('profile_id'),
        sa.CheckConstraint('ecog_status >= 0 AND ecog_status <= 4', name='check_ecog_range'),
    )
    op.create_index('ix_oncology_profiles_patient_id', 'oncology_profiles', ['patient_id'])
    op.create_index('ix_oncology_profiles_provider_id', 'oncology_profiles', ['provider_id'])
    op.create_index('ix_oncology_profiles_referral_uuid', 'oncology_profiles', ['referral_uuid'])
    
    # ==========================================================================
    # 17. MEDICATIONS TABLE - Patient Medications
    # ==========================================================================
    op.create_table(
        'medications',
        sa.Column('medication_id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('oncology_profile_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('oncology_profiles.profile_id'), nullable=True),
        sa.Column('medication_name', sa.String(255), nullable=False),
        sa.Column('generic_name', sa.String(255), nullable=True),
        sa.Column('brand_name', sa.String(255), nullable=True),
        sa.Column('category', sa.String(50), nullable=False, server_default='chemotherapy'),
        sa.Column('dose', sa.String(100), nullable=True),
        sa.Column('dose_unit', sa.String(50), nullable=True),
        sa.Column('route', sa.String(50), nullable=True),
        sa.Column('frequency', sa.String(100), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('source', sa.String(50), nullable=True),
        sa.Column('ocr_confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('medication_id'),
    )
    op.create_index('ix_medications_patient_id', 'medications', ['patient_id'])
    op.create_index('ix_medications_oncology_profile_id', 'medications', ['oncology_profile_id'])
    op.create_index('ix_medications_category', 'medications', ['category'])
    op.create_index('ix_medications_active', 'medications', ['active'])
    
    # ==========================================================================
    # 18. FAX_INGESTION_LOG TABLE - Fax Processing Audit
    # ==========================================================================
    op.create_table(
        'fax_ingestion_log',
        sa.Column('fax_id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('source_number', sa.String(20), nullable=True),
        sa.Column('destination_number', sa.String(20), nullable=True),
        sa.Column('fax_provider', sa.String(50), nullable=True),
        sa.Column('provider_fax_id', sa.String(255), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('file_type', sa.String(50), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('s3_bucket', sa.String(255), nullable=True),
        sa.Column('s3_key', sa.String(500), nullable=True),
        sa.Column('ocr_status', sa.String(50), nullable=False, server_default='received'),
        sa.Column('ocr_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ocr_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ocr_duration_ms', sa.Integer(), nullable=True),
        sa.Column('textract_job_id', sa.String(255), nullable=True),
        sa.Column('overall_confidence', sa.Float(), nullable=True),
        sa.Column('manual_review_required', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('manual_review_reason', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_by', sa.String(100), nullable=True),
        sa.Column('processed_by', sa.String(50), nullable=True),
        sa.Column('processing_notes', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('referral_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('fax_id'),
    )
    op.create_index('ix_fax_ingestion_log_source_number', 'fax_ingestion_log', ['source_number'])
    op.create_index('ix_fax_ingestion_log_ocr_status', 'fax_ingestion_log', ['ocr_status'])
    op.create_index('ix_fax_ingestion_log_referral_uuid', 'fax_ingestion_log', ['referral_uuid'])
    op.create_index('ix_fax_ingestion_log_patient_uuid', 'fax_ingestion_log', ['patient_uuid'])
    
    # ==========================================================================
    # 19. OCR_FIELD_CONFIDENCE TABLE - Per-Field OCR Confidence
    # ==========================================================================
    op.create_table(
        'ocr_field_confidence',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fax_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('fax_ingestion_log.fax_id'), nullable=False),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('field_category', sa.String(50), nullable=True),
        sa.Column('extracted_value', sa.Text(), nullable=True),
        sa.Column('normalized_value', sa.Text(), nullable=True),
        sa.Column('confidence_score', sa.Numeric(5, 4), nullable=False),
        sa.Column('confidence_threshold', sa.Numeric(5, 4), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='requires_review'),
        sa.Column('accepted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_by', sa.String(100), nullable=True),
        sa.Column('corrected_value', sa.Text(), nullable=True),
        sa.Column('correction_reason', sa.Text(), nullable=True),
        sa.Column('source_page', sa.Integer(), nullable=True),
        sa.Column('source_location', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('fax_id', 'field_name', name='uq_fax_field'),
        sa.CheckConstraint('confidence_score >= 0 AND confidence_score <= 1', name='check_confidence_range'),
    )
    op.create_index('ix_ocr_field_confidence_fax_id', 'ocr_field_confidence', ['fax_id'])
    op.create_index('ix_ocr_field_confidence_field_name', 'ocr_field_confidence', ['field_name'])
    op.create_index('ix_ocr_field_confidence_status', 'ocr_field_confidence', ['status'])
    
    # ==========================================================================
    # 20. SYMPTOMS TABLE - Symptom Catalog
    # ==========================================================================
    op.create_table(
        'symptoms',
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('category', sa.String(100), nullable=False, server_default='common'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('code'),
    )
    
    # ==========================================================================
    # 21. SYMPTOM_SESSIONS TABLE - Chatbot Sessions
    # ==========================================================================
    op.create_table(
        'symptom_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conversation_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='IN_PROGRESS'),
        sa.Column('selected_symptoms', postgresql.JSONB(), nullable=True),
        sa.Column('highest_severity', sa.String(20), nullable=True),
        sa.Column('escalation_triggered', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('summary_generated', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('education_delivered', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_symptom_sessions_patient_id', 'symptom_sessions', ['patient_id'])
    op.create_index('ix_symptom_sessions_conversation_uuid', 'symptom_sessions', ['conversation_uuid'])
    op.create_index('ix_symptom_sessions_status', 'symptom_sessions', ['status'])
    
    # ==========================================================================
    # 22. RULE_EVALUATIONS TABLE - Rule Evaluation Audit
    # ==========================================================================
    op.create_table(
        'rule_evaluations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('symptom_sessions.id'), nullable=False),
        sa.Column('symptom_code', sa.String(20), 
                  sa.ForeignKey('symptoms.code'), nullable=False),
        sa.Column('rule_id', sa.String(50), nullable=False),
        sa.Column('rule_name', sa.String(255), nullable=True),
        sa.Column('condition_met', sa.Boolean(), nullable=False),
        sa.Column('severity', sa.String(20), nullable=True),
        sa.Column('escalation', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('trigger_answers', postgresql.JSONB(), nullable=True),
        sa.Column('triage_message', sa.Text(), nullable=True),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_rule_evaluations_session_id', 'rule_evaluations', ['session_id'])
    op.create_index('ix_rule_evaluations_symptom_code', 'rule_evaluations', ['symptom_code'])
    
    # ==========================================================================
    # 23. EDUCATION_DOCUMENTS TABLE - Clinician-Approved Content
    # ==========================================================================
    op.create_table(
        'education_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('symptom_code', sa.String(20), 
                  sa.ForeignKey('symptoms.code'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=True),
        sa.Column('inline_text', sa.Text(), nullable=False),
        sa.Column('s3_pdf_path', sa.Text(), nullable=False),
        sa.Column('s3_text_path', sa.Text(), nullable=True),
        sa.Column('source_document_id', sa.String(100), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('approved_by', sa.String(255), nullable=False),
        sa.Column('approved_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('priority', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("source_document_id IS NOT NULL", name="check_source_required"),
    )
    op.create_index('ix_education_documents_symptom_code', 'education_documents', ['symptom_code'])
    op.create_index('ix_education_documents_status', 'education_documents', ['status'])
    op.create_index('ix_education_symptom_status', 'education_documents', ['symptom_code', 'status'])
    
    # ==========================================================================
    # 24. DISCLAIMERS TABLE - Mandatory Disclaimer Text
    # ==========================================================================
    op.create_table(
        'disclaimers',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('version', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # ==========================================================================
    # 25. CARE_TEAM_HANDOUTS TABLE - Care Team Handout Documents
    # ==========================================================================
    op.create_table(
        'care_team_handouts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.String(255), nullable=False, server_default='Care Team Handout'),
        sa.Column('inline_summary', sa.Text(), nullable=False),
        sa.Column('s3_pdf_path', sa.Text(), nullable=False),
        sa.Column('s3_text_path', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('source_document_id', sa.String(100), nullable=False),
        sa.Column('approved_by', sa.String(255), nullable=False),
        sa.Column('approved_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # ==========================================================================
    # 26. PATIENT_SUMMARIES TABLE - Immutable Patient Summaries
    # ==========================================================================
    op.create_table(
        'patient_summaries',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('symptom_sessions.id'), nullable=False, unique=True),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('summary_text', sa.Text(), nullable=False),
        sa.Column('patient_note', sa.Text(), nullable=True),
        sa.Column('escalation', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('locked', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('template_id', sa.String(50), nullable=True),
        sa.Column('visible_to_provider', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('provider_viewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_patient_summaries_session_id', 'patient_summaries', ['session_id'])
    op.create_index('ix_patient_summaries_patient_id', 'patient_summaries', ['patient_id'])
    
    # ==========================================================================
    # 27. MEDICATIONS_TRIED TABLE - Medications Attempted During Sessions
    # ==========================================================================
    op.create_table(
        'medications_tried',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('symptom_sessions.id'), nullable=False),
        sa.Column('medication_name', sa.String(255), nullable=False),
        sa.Column('medication_category', sa.String(50), nullable=True),
        sa.Column('effectiveness', sa.String(50), nullable=True, server_default='none'),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_medications_tried_session_id', 'medications_tried', ['session_id'])
    
    # ==========================================================================
    # 28. EDUCATION_DELIVERY_LOG TABLE - Education Delivery Audit
    # ==========================================================================
    op.create_table(
        'education_delivery_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('symptom_sessions.id'), nullable=False),
        sa.Column('education_document_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('education_documents.id'), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('disclaimer_id', sa.String(50), nullable=True),
        sa.Column('care_team_handout_included', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('delivered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('viewed', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_education_delivery_log_session_id', 'education_delivery_log', ['session_id'])
    op.create_index('ix_education_delivery_log_education_document_id', 'education_delivery_log', ['education_document_id'])
    op.create_index('ix_education_delivery_log_patient_id', 'education_delivery_log', ['patient_id'])
    
    # ==========================================================================
    # 29. EDUCATION_ACCESS_LOG TABLE - Education Access Analytics
    # ==========================================================================
    op.create_table(
        'education_access_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('education_document_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('education_documents.id'), nullable=False),
        sa.Column('access_type', sa.String(50), nullable=True),
        sa.Column('source', sa.String(50), nullable=True),
        sa.Column('accessed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_education_access_log_patient_id', 'education_access_log', ['patient_id'])
    op.create_index('ix_education_access_log_education_document_id', 'education_access_log', ['education_document_id'])
    
    # ==========================================================================
    # 30. PATIENT_QUESTIONS TABLE - Patient Questions for Doctor
    # ==========================================================================
    op.create_table(
        'patient_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('share_with_physician', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_answered', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('category', sa.String(50), nullable=True, server_default='other'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_patient_questions_patient_uuid', 'patient_questions', ['patient_uuid'])
    op.create_index('ix_patient_questions_share_with_physician', 'patient_questions', ['share_with_physician'])
    
    # ==========================================================================
    # LEGACY TABLES (for backward compatibility with existing code)
    # ==========================================================================
    
    # 31. PATIENT_INFO TABLE - Legacy patient records (used by auth/profile)
    op.create_table(
        'patient_info',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()'),
                  comment="This is the patient's Cognito sub/uuid."),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('email_address', sa.String(255), nullable=False, unique=True),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('sex', sa.String(20), nullable=True),
        sa.Column('dob', sa.Date(), nullable=True),
        sa.Column('mrn', sa.String(50), nullable=True, unique=True),
        sa.Column('ethnicity', sa.String(50), nullable=True),
        sa.Column('phone_number', sa.String(20), nullable=True),
        sa.Column('disease_type', sa.String(255), nullable=True),
        sa.Column('treatment_type', sa.String(255), nullable=True),
        sa.Column('emergency_contact_name', sa.String(200), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(20), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_patient_info_email_address', 'patient_info', ['email_address'])
    op.create_index('ix_patient_info_mrn', 'patient_info', ['mrn'])
    
    # 32. PATIENT_CONFIGURATIONS TABLE - Legacy patient settings
    op.create_table(
        'patient_configurations',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  comment="This is the patient's Cognito sub/uuid."),
        sa.Column('reminder_method', sa.String(50), nullable=True),
        sa.Column('reminder_time', sa.Time(), nullable=True),
        sa.Column('acknowledgement_done', sa.Boolean(), nullable=True),
        sa.Column('agreed_conditions', sa.Boolean(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('uuid'),
    )
    
    # 33. PATIENT_PHYSICIAN_ASSOCIATIONS TABLE - Legacy physician links
    op.create_table(
        'patient_physician_associations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('physician_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('clinic_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_patient_physician_associations_patient_uuid', 'patient_physician_associations', ['patient_uuid'])
    op.create_index('ix_patient_physician_associations_physician_uuid', 'patient_physician_associations', ['physician_uuid'])
    
    # 34. PATIENT_CHEMO_DATES TABLE - Legacy chemo dates
    op.create_table(
        'patient_chemo_dates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chemo_date', sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_patient_chemo_dates_patient_uuid', 'patient_chemo_dates', ['patient_uuid'])
    
    # 35. PATIENT_DIARY_ENTRIES TABLE - Legacy diary entries
    op.create_table(
        'patient_diary_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('diary_entry', sa.Text(), nullable=False),
        sa.Column('entry_uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()'), unique=True),
        sa.Column('marked_for_doctor', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_patient_diary_entries_patient_uuid', 'patient_diary_entries', ['patient_uuid'])
    
    # ==========================================================================
    # SEED DATA - Default Disclaimer
    # ==========================================================================
    op.execute("""
        INSERT INTO disclaimers (id, text, active, version)
        VALUES (
            'STD-DISCLAIMER-001',
            'This information is for education only and does not replace medical advice. Always follow instructions from your oncology care team.',
            true,
            1
        )
    """)


def downgrade() -> None:
    """Drop all tables in reverse order."""
    # Legacy tables first
    op.drop_table('patient_diary_entries')
    op.drop_table('patient_chemo_dates')
    op.drop_table('patient_physician_associations')
    op.drop_table('patient_configurations')
    op.drop_table('patient_info')
    # New normalized tables
    op.drop_table('patient_questions')
    op.drop_table('education_access_log')
    op.drop_table('education_delivery_log')
    op.drop_table('medications_tried')
    op.drop_table('patient_summaries')
    op.drop_table('care_team_handouts')
    op.drop_table('disclaimers')
    op.drop_table('education_documents')
    op.drop_table('rule_evaluations')
    op.drop_table('symptom_sessions')
    op.drop_table('symptoms')
    op.drop_table('ocr_field_confidence')
    op.drop_table('fax_ingestion_log')
    op.drop_table('medications')
    op.drop_table('oncology_profiles')
    op.drop_table('providers')
    op.drop_table('onboarding_notification_log')
    op.drop_table('patient_onboarding_status')
    op.drop_table('referral_documents')
    op.drop_table('patient_referrals')
    op.drop_table('conversation_summaries')
    op.drop_table('diary_entries')
    op.drop_table('chemo_symptoms')
    op.drop_table('chemo_sessions')
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('patients')
    op.drop_table('staff_profiles')
    op.drop_table('patient_profiles')
    op.drop_table('users')

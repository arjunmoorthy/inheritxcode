"""Complete schema - Doctor API

Revision ID: 20260206_0001
Revises: 
Create Date: 2026-02-06

This migration creates the complete database schema for the Doctor API.
It replaces the previous incomplete migration and includes:
- Users (authentication with password hash support)
- Staff (profiles with roles)
- Clinics (healthcare facilities)
- Staff-Clinic associations (many-to-many)
- Physician-Patient assignments
- Audit logs (HIPAA compliance)
- Weekly reports

Key Design Decisions:
1. Separate Users table for authentication (supports both manual & SSO signup)
2. Staff table for profile data, linked to Users via foreign key
3. Staff can be associated with multiple clinics via staff_clinics junction table
4. Physicians can have multiple patients assigned via physician_patients table
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
    # 1. USERS TABLE - Authentication & Credentials
    # ==========================================================================
    # Stores login credentials for all users (manual signup & SSO)
    # Password is stored as bcrypt hash for manual signups
    # SSO users have auth_provider set and no password_hash
    op.create_table(
        'users',
        # Primary identifiers
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False, 
                  server_default=sa.text('gen_random_uuid()')),
        
        # Authentication credentials
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),  # NULL for SSO users
        
        # Auth provider tracking (for SSO)
        sa.Column('auth_provider', sa.String(50), nullable=False, server_default='local'),
            # Values: 'local', 'google', 'cognito'
        sa.Column('provider_user_id', sa.String(255), nullable=True),  # Google sub, Cognito sub, etc.
        
        # Personal information
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        
        # Account status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), 
                  onupdate=sa.text('now()'), nullable=False),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_users_uuid'),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )
    
    # Indexes for users table
    op.create_index('ix_users_uuid', 'users', ['uuid'])
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_auth_provider', 'users', ['auth_provider'])
    op.create_index('ix_users_provider_user_id', 'users', ['provider_user_id'])
    
    # ==========================================================================
    # 2. CLINICS TABLE - Healthcare Facilities
    # ==========================================================================
    op.create_table(
        'clinics',
        # Primary identifiers
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        
        # Clinic information
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(50), nullable=True),
        sa.Column('zip_code', sa.String(20), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('fax', sa.String(20), nullable=True),
        
        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
                  onupdate=sa.text('now()'), nullable=False),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_clinics_uuid'),
    )
    
    # Indexes for clinics table
    op.create_index('ix_clinics_uuid', 'clinics', ['uuid'])
    op.create_index('ix_clinics_name', 'clinics', ['name'])
    
    # ==========================================================================
    # 3. STAFF TABLE - User Profiles (Physicians, Nurses, Admin)
    # ==========================================================================
    op.create_table(
        'staff',
        # Primary identifiers
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        
        # Link to users table (authentication)
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, unique=True),
        
        # Contact info (denormalized from users for convenience)
        sa.Column('email', sa.String(255), nullable=False),
        
        # Role and credentials
        sa.Column('role', sa.String(50), nullable=False, server_default='staff'),
            # Values: 'physician', 'nurse', 'staff', 'admin'
        sa.Column('npi_number', sa.String(20), nullable=True),  # For physicians
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        
        # Profile completion tracking
        sa.Column('is_profile_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        
        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
                  onupdate=sa.text('now()'), nullable=False),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_staff_uuid'),
        sa.UniqueConstraint('email', name='uq_staff_email'),
        sa.UniqueConstraint('user_id', name='uq_staff_user_id'),
    )
    
    # Indexes for staff table
    op.create_index('ix_staff_uuid', 'staff', ['uuid'])
    op.create_index('ix_staff_user_id', 'staff', ['user_id'])
    op.create_index('ix_staff_email', 'staff', ['email'])
    op.create_index('ix_staff_role', 'staff', ['role'])
    op.create_index('ix_staff_npi_number', 'staff', ['npi_number'])
    
    # ==========================================================================
    # 4. STAFF_CLINICS TABLE - Staff-Clinic Associations (Many-to-Many)
    # ==========================================================================
    # Links staff members to clinics (a staff member can work at multiple clinics)
    op.create_table(
        'staff_clinics',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        
        # Foreign keys
        sa.Column('staff_id', sa.Integer(), 
                  sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('clinic_id', sa.Integer(), 
                  sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False),
        
        # Association metadata
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('staff_id', 'clinic_id', name='uq_staff_clinic'),
    )
    
    # Indexes for staff_clinics table
    op.create_index('ix_staff_clinics_staff_id', 'staff_clinics', ['staff_id'])
    op.create_index('ix_staff_clinics_clinic_id', 'staff_clinics', ['clinic_id'])
    
    # ==========================================================================
    # 5. PHYSICIAN_PATIENTS TABLE - Doctor-Patient Assignments
    # ==========================================================================
    # Links physicians to their patients (patients are in patient_db, referenced by UUID)
    op.create_table(
        'physician_patients',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        
        # Foreign key to staff (must be a physician)
        sa.Column('physician_id', sa.Integer(), 
                  sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        
        # Patient reference (UUID from patient database)
        sa.Column('patient_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Assignment metadata
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('assigned_by', sa.Integer(), sa.ForeignKey('staff.id'), nullable=True),
        
        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('physician_id', 'patient_uuid', name='uq_physician_patient'),
    )
    
    # Indexes for physician_patients table
    op.create_index('ix_physician_patients_physician_id', 'physician_patients', ['physician_id'])
    op.create_index('ix_physician_patients_patient_uuid', 'physician_patients', ['patient_uuid'])
    op.create_index('ix_physician_patients_active', 'physician_patients', ['is_active'])
    
    # ==========================================================================
    # 6. AUDIT_LOGS TABLE - HIPAA Compliance Logging
    # ==========================================================================
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        
        # Who performed the action
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('user_uuid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_role', sa.String(50), nullable=True),
        
        # What action was performed
        sa.Column('action', sa.String(100), nullable=False),
            # Values: 'login', 'logout', 'view_patient', 'view_dashboard', 
            #         'download_report', 'update_profile', etc.
        
        # What entity was affected
        sa.Column('entity_type', sa.String(100), nullable=True),
            # Values: 'patient', 'conversation', 'diary', 'report', 'staff', etc.
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Additional context
        sa.Column('details', postgresql.JSONB(), nullable=True),
        
        # Request metadata
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        
        # Timestamp
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Indexes for audit_logs table
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_user_uuid', 'audit_logs', ['user_uuid'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_entity', 'audit_logs', ['entity_type', 'entity_id'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    
    # ==========================================================================
    # 7. WEEKLY_REPORTS TABLE - Physician Weekly Reports
    # ==========================================================================
    op.create_table(
        'weekly_reports',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        
        # Physician reference
        sa.Column('physician_id', sa.Integer(), 
                  sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        
        # Report period
        sa.Column('report_week_start', sa.Date(), nullable=False),
        sa.Column('report_week_end', sa.Date(), nullable=False),
        
        # Report content
        sa.Column('report_data', postgresql.JSONB(), nullable=True),
        sa.Column('s3_path', sa.String(500), nullable=True),  # Path to PDF in S3
        
        # Summary metrics
        sa.Column('patient_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('total_alerts', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('total_questions', sa.Integer(), nullable=False, server_default=sa.text('0')),
        
        # Timestamps
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_weekly_reports_uuid'),
        sa.UniqueConstraint('physician_id', 'report_week_start', name='uq_physician_week'),
    )
    
    # Indexes for weekly_reports table
    op.create_index('ix_weekly_reports_uuid', 'weekly_reports', ['uuid'])
    op.create_index('ix_weekly_reports_physician_id', 'weekly_reports', ['physician_id'])
    op.create_index('ix_weekly_reports_week', 'weekly_reports', ['report_week_start', 'report_week_end'])


def downgrade() -> None:
    """Drop all tables in reverse order."""
    op.drop_table('weekly_reports')
    op.drop_table('audit_logs')
    op.drop_table('physician_patients')
    op.drop_table('staff_clinics')
    op.drop_table('staff')
    op.drop_table('clinics')
    op.drop_table('users')

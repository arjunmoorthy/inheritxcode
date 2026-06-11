"""
Centralized Configuration - Doctor API
=======================================

This module provides a single source of truth for all application settings.
Uses Pydantic Settings for type validation and environment variable loading.

Configuration is loaded from:
1. Environment variables (highest priority)
2. .env file (if present)
3. Default values (lowest priority)

Usage:
    from core.config import settings
    
    # Access settings
    database_url = settings.doctor_database_url
    debug_mode = settings.debug
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, Field, computed_field

# Resolve .env from project root (doctor-api/), not from current working directory.
# This way the app loads .env correctly whether run as "uvicorn main:app" from
# doctor-api/ or "cd src && uvicorn main:app" from doctor-api/src/.
_CONFIG_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _CONFIG_DIR.parent.parent  # core/ -> src/ -> doctor-api/
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    All settings can be overridden by environment variables.
    Variable names are case-insensitive.
    """
    
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra environment variables
    )
    
    # ==========================================================================
    # Application Settings
    # ==========================================================================
    app_name: str = Field(
        default="OncoLife Doctor API",
        description="Application name for logging and identification"
    )
    app_version: str = Field(
        default="1.0.0",
        description="Application version"
    )
    environment: str = Field(
        default="development",
        description="Deployment environment (development, staging, production)"
    )
    debug: bool = Field(
        default=False,
        description="Enable debug mode with verbose logging"
    )
    local_dev_mode: bool = Field(
        default=False,
        description="Enable local development mode (bypasses Cognito auth)"
    )
    
    # ==========================================================================
    # Server Settings
    # ==========================================================================
    host: str = Field(
        default="0.0.0.0",
        description="Server host address"
    )
    port: int = Field(
        default=8001,
        description="Server port (different from patient API)"
    )
    
    # ==========================================================================
    # Doctor Database Settings
    # ==========================================================================
    doctor_db_user: Optional[str] = Field(
        default=None,
        description="Doctor database username"
    )
    doctor_db_password: Optional[str] = Field(
        default=None,
        description="Doctor database password"
    )
    doctor_db_host: Optional[str] = Field(
        default=None,
        description="Doctor database host"
    )
    doctor_db_port: Optional[str] = Field(
        default="5432",
        description="Doctor database port"
    )
    doctor_db_name: Optional[str] = Field(
        default=None,
        description="Doctor database name"
    )
    
    # ==========================================================================
    # Patient Database Settings (Read-only access for viewing patient data)
    # ==========================================================================
    patient_db_user: Optional[str] = Field(
        default=None,
        description="Patient database username"
    )
    patient_db_password: Optional[str] = Field(
        default=None,
        description="Patient database password"
    )
    patient_db_host: Optional[str] = Field(
        default=None,
        description="Patient database host"
    )
    patient_db_port: Optional[str] = Field(
        default="5432",
        description="Patient database port"
    )
    patient_db_name: Optional[str] = Field(
        default=None,
        description="Patient database name"
    )
    
    # ==========================================================================
    # AWS Cognito Settings (Authentication)
    # ==========================================================================
    aws_region: str = Field(
        default="us-east-1",
        description="AWS region for Cognito"
    )
    aws_access_key_id: Optional[str] = Field(
        default=None,
        description="AWS access key ID"
    )
    aws_secret_access_key: Optional[str] = Field(
        default=None,
        description="AWS secret access key"
    )
    s3_bucket_name: str = Field(
        default="oncolife.ai-fax-storage",
        description="S3 bucket name for fax storage (env: S3_BUCKET_NAME)"
    )
    cognito_user_pool_id: Optional[str] = Field(
        default=None,
        description="Cognito User Pool ID"
    )
    cognito_client_id: Optional[str] = Field(
        default=None,
        description="Cognito App Client ID"
    )
    cognito_client_secret: Optional[str] = Field(
        default=None,
        description="Cognito App Client Secret"
    )
    
    # ==========================================================================
    # JWT (for app-issued tokens: access, refresh, id)
    # ==========================================================================
    jwt_secret_key: Optional[str] = Field(
        default=None,
        description="Secret key for signing JWT tokens (HS256). Required for local auth / password reset tokens."
    )
    jwt_algorithm: str = Field(
        default="HS256",
        description="JWT signing algorithm (HS256 recommended)"
    )
    access_token_expire_minutes: int = Field(
        default=30,
        description="Access token expiry in minutes"
    )
    access_token_expiry_hours: int = Field(
        default=24,
        description="Access token expiry in hours (alternative to minutes)"
    )   
    refresh_token_expire_days: int = Field(
        default=7,
        description="Refresh token expiry in days"
    )
    
    # ==========================================================================
    # Google OAuth (for Google SSO signup)
    # ==========================================================================
    google_allowed_client_ids: str = Field(
        default="",
        description="Comma-separated Google OAuth client IDs allowed for signup (audience validation)"
    )
    
    @computed_field
    @property
    def google_allowed_client_ids_list(self) -> List[str]:
        """Parse comma-separated Google client IDs into a list."""
        if not self.google_allowed_client_ids:
            return []
        return [x.strip() for x in self.google_allowed_client_ids.split(",") if x.strip()]
    
    # ==========================================================================
    # Email (SMTP for password reset, etc.)
    # ==========================================================================
    mail_username: Optional[str] = Field(
        default=None,
        description="SMTP username (e.g. Gmail address)",
        validation_alias="MAIL_USERNAME",
    )
    mail_password: Optional[str] = Field(
        default=None,
        description="SMTP password or app password",
        validation_alias="MAIL_PASSWORD",
    )
    mail_from: Optional[str] = Field(
        default=None,
        description="From address for outgoing emails",
        validation_alias="MAIL_FROM",
    )
    mail_server: str = Field(
        default="smtp.gmail.com",
        description="SMTP server hostname",
        validation_alias="MAIL_SERVER",
    )
    mail_port: int = Field(
        default=587,
        description="SMTP port (587 for STARTTLS, 465 for SSL)",
        validation_alias="MAIL_PORT",
    )
    mail_starttls: bool = Field(
        default=True,
        description="Use STARTTLS"
    )
    mail_ssl_tls: bool = Field(
        default=False,
        description="Use SSL/TLS"
    )
    
    # ==========================================================================
    # CORS Settings
    # ==========================================================================
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5174",
        description="Comma-separated list of allowed CORS origins"
    )
    
    # ==========================================================================
    # Logging Settings
    # ==========================================================================
    log_level: str = Field(
        default="INFO",
        description="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)"
    )
    log_format: str = Field(
        default="json",
        description="Log format (json or text)"
    )
    
    # ==========================================================================
    # Patient Portal (welcome email / set-password link)
    # ==========================================================================
    patient_set_password_base_url: str = Field(
        ...,
        description="Base URL for patient set-password page (login link in welcome email). Env: PATIENT_SET_PASSWORD_BASE_URL",
    )

    doctor_set_password_base_url: str = Field(
        ...,
        description="Base URL for doctor set-password page (login link in welcome email). Env: DOCTOR_SET_PASSWORD_BASE_URL",
    )

    doctor_forget_password_base_url: str = Field(
        ...,
        validation_alias=AliasChoices("FORGET_PASSWORD_BASE_URL", "DOCTOR_FORGET_PASSWORD_BASE_URL"),
        description="Base URL for doctor reset-password page (link in forgot password email). Env: DOCTOR_FORGET_PASSWORD_BASE_URL",
    )
    doctor_dashboard_base_url: str = Field(
        default="https://doctor.healthai.global/",
        description="Base URL for doctor dashboard frontend pages (fax preview, etc). Env: DOCTOR_DASHBOARD_BASE_URL",
    )

    # ==========================================================================
    # Gemini AI (for clinical summary generation)
    # ==========================================================================
    gemini_api_key: Optional[str] = Field(
        default=None,
        description="Gemini API key for AI-generated clinical summaries"
    )
    gemini_model: str = Field(
        default="gemini-3-flash-preview",
        description="Gemini model name for clinical summary generation"
    )
    gemini_timeout_seconds: int = Field(
        default=120,
        description="Timeout (seconds) for Gemini summary generation requests"
    )

    # ==========================================================================
    # Sinch Fax (outgoing fax API)
    # ==========================================================================
    sinch_fax_base_url: str = Field(
        default="https://fax.api.sinch.com/v3",
        description="Sinch Fax API base URL. Env: SINCH_FAX_BASE_URL",
    )
    sinch_project_id: Optional[str] = Field(
        default=None,
        description="Sinch project ID for fax API. Env: SINCH_PROJECT_ID",
    )
    sinch_key_id: Optional[str] = Field(
        default=None,
        description="Sinch fax access key (username for basic auth). Env: SINCH_KEY_ID",
    )
    sinch_key_secret: Optional[str] = Field(
        default=None,
        description="Sinch fax access secret (password for basic auth). Env: SINCH_KEY_SECRET",
    )
    sinch_from_number: Optional[str] = Field(
        default=None,
        description="Default outgoing fax sender number in E.164 format. Env: SINCH_FROM_NUMBER",
    )
    
    # ==========================================================================
    # Computed Properties
    # ==========================================================================
    # Optional explicit ssl mode for DB connections. If set, this value will be
    # appended to the generated database URL as `?sslmode=<value>`. If not set,
    # SSL will only be required automatically when running in production.
    db_ssl_mode: Optional[str] = Field(
        default=None,
        description="Optional sslmode for database connections (e.g. 'require', 'disable')"
    )
    @computed_field
    @property
    def doctor_database_url(self) -> Optional[str]:
        """Construct the doctor database URL from components."""
        if all([
            self.doctor_db_user,
            self.doctor_db_password,
            self.doctor_db_host,
            self.doctor_db_port,
            self.doctor_db_name
        ]):
            # Decide ssl mode: explicit override > production default > no ssl
            if self.db_ssl_mode:
                ssl_query = f"?sslmode={self.db_ssl_mode}"
            elif self.is_production:
                ssl_query = "?sslmode=require"
            else:
                ssl_query = ""

            return (
                f"postgresql://{self.doctor_db_user}:{self.doctor_db_password}@"
                f"{self.doctor_db_host}:{self.doctor_db_port}/{self.doctor_db_name}{ssl_query}"
            )
        return None
    
    @computed_field
    @property
    def patient_database_url(self) -> Optional[str]:
        """Construct the patient database URL from components."""
        if all([
            self.patient_db_user,
            self.patient_db_password,
            self.patient_db_host,
            self.patient_db_port,
            self.patient_db_name
        ]):
            # Decide ssl mode: explicit override > production default > no ssl
            if self.db_ssl_mode:
                ssl_query = f"?sslmode={self.db_ssl_mode}"
            elif self.is_production:
                ssl_query = "?sslmode=require"
            else:
                ssl_query = ""

            return (
                f"postgresql://{self.patient_db_user}:{self.patient_db_password}@"
                f"{self.patient_db_host}:{self.patient_db_port}/{self.patient_db_name}{ssl_query}"
            )
        return None
    
    @computed_field
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    @computed_field
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"
    
    @computed_field
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment.lower() == "development"
    
    @computed_field
    @property
    def cognito_issuer(self) -> Optional[str]:
        """Construct the Cognito issuer URL."""
        if self.aws_region and self.cognito_user_pool_id:
            return f"https://cognito-idp.{self.aws_region}.amazonaws.com/{self.cognito_user_pool_id}"
        return None
    
    @computed_field
    @property
    def cognito_jwks_url(self) -> Optional[str]:
        """Construct the Cognito JWKS URL."""
        if self.cognito_issuer:
            return f"{self.cognito_issuer}/.well-known/jwks.json"
        return None


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Uses lru_cache to ensure settings are only loaded once.
    """
    return Settings()


# Global settings instance for easy import
settings = get_settings()

print("RAW CORS:", settings.cors_origins)
print("PARSED CORS:", settings.cors_origins_list)
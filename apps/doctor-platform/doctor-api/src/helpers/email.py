"""Helper module for email sending (e.g. password reset)."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from core.config import settings

# Ensure .env is loaded (config may load from different path when running from various cwds)
_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"  # helpers/ -> src/ -> doctor-api/
load_dotenv(_ENV_PATH)


def is_mail_configured() -> bool:
    """Return True if MAIL_USERNAME and MAIL_PASSWORD are set (email can be sent)."""
    mail_username = settings.mail_username or os.getenv("MAIL_USERNAME")
    mail_password = settings.mail_password or os.getenv("MAIL_PASSWORD")
    return bool(mail_username and mail_password)


def _get_mail_conf() -> ConnectionConfig:
    """Build FastAPI-Mail config from settings/env. Raises if credentials not configured."""
    mail_username = settings.mail_username or os.getenv("MAIL_USERNAME")
    mail_password = settings.mail_password or os.getenv("MAIL_PASSWORD")
    if not mail_username or not mail_password:
        raise ValueError(
            "MAIL_USERNAME and MAIL_PASSWORD must be set in .env for sending emails."
        )
    return ConnectionConfig(
        MAIL_USERNAME=mail_username,
        MAIL_PASSWORD=mail_password,
        MAIL_FROM=settings.mail_from or mail_username,
        MAIL_PORT=settings.mail_port,
        MAIL_SERVER=settings.mail_server,
        MAIL_STARTTLS=settings.mail_starttls,
        MAIL_SSL_TLS=settings.mail_ssl_tls,
        USE_CREDENTIALS=True,
    )


async def send_reset_password_email(email: str, reset_link: str):
    """
    Sends a password reset email using FastAPI-Mail
    """
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #007bff;">Password Reset Request</h2>
        <p>Hi,</p>
        <p>You requested a password reset. Click the button below to reset your password:</p>

        <!-- Left-aligned button -->
        <table cellspacing="0" cellpadding="0" style="margin: 20px 0;">
            <tr>
                <td align="left" bgcolor="#007bff" style="border-radius: 5px;">
                    <a href="{reset_link}" target="_blank"
                    style="display: inline-block; padding: 12px 25px; font-size: 16px; 
                            color: #ffffff; text-decoration: none; font-weight: bold; 
                            border-radius: 5px;">Reset Password</a>
                </td>
            </tr>
        </table>

        <p>If you did not request this, ignore this email.</p>

        <p>Or copy and paste this link into your browser:</p>
        <p style="background-color:#f5f5f5; padding:10px; border-radius:5px; word-break:break-all;">
            <a href="{reset_link}" style="color:#007bff;">{reset_link}</a>
        </p>
    </div>
    """

    message = MessageSchema(
        subject="Password Reset Request",
        recipients=[email],
        body=html,
        subtype="html"
    )

    fm = FastMail(_get_mail_conf())
    await fm.send_message(message)


async def send_welcome_email(
    email: str,
    temp_password: str,
    login_link: str,
    first_name: str,
):
    """
    Sends a welcome email with temporary login credentials
    and forces password change on first login.
    """

    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto;">

        <h2 style="color: #2c3e50;">Welcome to OncoLife Patient Portal</h2>

        <p>Hi {first_name},</p>

        <p>
            Welcome to <strong>OncoLife</strong>! We’re pleased to have you enrolled in our study and
            look forward to supporting you throughout your care journey.
        </p>

        <p>Your patient portal account has been successfully created.</p>

        <p><strong>Your login details:</strong></p>

        <table cellspacing="0" cellpadding="6" style="margin: 10px 0;">
            <tr>
                <td><strong>Email:</strong></td>
                <td>{email}</td>
            </tr>
            <tr>
                <td><strong>Temporary Password:</strong></td>
                <td>{temp_password}</td>
            </tr>
        </table>

        <p style="color:#d9534f;">
            For your security, you will be prompted to create a new password when you log in for the first time.
        </p>

        <p><strong>Access your portal:</strong></p>

        <p>Click the link below to get started:</p>

        <table cellspacing="0" cellpadding="0" style="margin: 20px 0;">
            <tr>
                <td align="left" bgcolor="#007bff" style="border-radius: 5px;">
                    <a href="{login_link}" target="_blank"
                       style="display: inline-block; padding: 12px 25px; font-size: 16px;
                              color: #ffffff; text-decoration: none; font-weight: bold;
                              border-radius: 5px;">
                        Set Your Password
                    </a>
                </td>
            </tr>
        </table>

        <p>If the button doesn’t work, copy and paste this link into your browser:</p>

        <p style="background-color:#f5f5f5; padding:10px; border-radius:5px; word-break:break-all;">
            <a href="{login_link}" style="color:#007bff;">{login_link}</a>
        </p>

        <p>
            If you did not expect this email, please feel free to disregard it or contact our support team.
        </p>

        <br>

        <p>We’re glad to have you as part of the OncoLife study.</p>

        <p>
            Warm regards,<br>
            <strong>The OncoLife Team</strong>
        </p>

    </div>
    """

    message = MessageSchema(
        subject="Welcome to OncoLife Patient Portal",
        recipients=[email],
        body=html,
        subtype="html",
    )

    fm = FastMail(_get_mail_conf())
    await fm.send_message(message)



async def send_welcome_email_staff(
    email: str,
    temp_password: str,
    login_link: str,
    first_name: str,
):
    """
    Sends a welcome email with temporary login credentials
    and forces password change on first login.
    """

    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #007bff;">Access your Provider Portal account</h2>

        <p>Hello,{first_name}</p>

        <p>Your staff account for the Provider Portal has been created.</p>

        <p><strong>Your login credentials:</strong></p>

        <p><strong>Account email:</strong> {email}</p>

        <p><strong>Temporary password:</strong> {temp_password}</p>

        <p>
            Please use the link below to access your account and set your password.
        </p>

        <p>
            <a href="{login_link}" 
            style="display:inline-block;padding:10px 18px;background:#007bff;color:#ffffff;text-decoration:none;border-radius:4px;">
                Access Account
            </a>
        </p>

        <p>If the button above does not work, copy and paste this link into your browser:</p>

        <p style="word-break:break-all; color:#555;">
            {login_link}
        </p>

        <p>If you were not expecting this email, you can ignore it.</p>

        <br>

        <p>Care Team</p>
    """

    message = MessageSchema(
        subject="Access your Provider Portal account",
        recipients=[email],
        body=html,
        subtype="html",
    )

    fm = FastMail(_get_mail_conf())
    await fm.send_message(message)
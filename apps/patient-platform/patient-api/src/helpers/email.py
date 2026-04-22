"""Email helpers for patient authentication flows."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from core.config import settings

_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_ENV_PATH)


def _get_mail_conf() -> ConnectionConfig:
    """Build FastAPI-Mail config from settings/env."""
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
    """Send password reset email to patient."""
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #007bff;">Password Reset Request</h2>
        <p>Hi,</p>
        <p>You requested a password reset. Click the button below to reset your password:</p>
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
        subtype="html",
    )

    fm = FastMail(_get_mail_conf())
    await fm.send_message(message)


async def send_email(to: str, subject: str, patient_name: str):
    """Generic email sending helper."""

    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Dear {patient_name},</p>

        <p>
        We are committed to supporting you through every step of your treatment.
        Your feedback in these daily check-ins helps your team understand your recovery
        and allows us to provide the right guidance exactly when you need it.
        </p>

        <p>
        Please take a moment to log your symptoms for today. Your entries help us
        ensure your treatment plan remains safe and effective.
        </p>
    </div>
    """

    message = MessageSchema(
        subject=subject,
        recipients=[to],
        body=html,
        subtype="html",
    )

    fm = FastMail(_get_mail_conf())
    await fm.send_message(message)
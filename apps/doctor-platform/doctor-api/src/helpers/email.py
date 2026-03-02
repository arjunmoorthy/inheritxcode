"""Helper module for email sending (e.g. password reset)."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from core.config import settings

# Ensure .env is loaded (config may load from different path when running from various cwds)
_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"  # helpers/ -> src/ -> doctor-api/
load_dotenv(_ENV_PATH)


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
):
    """
    Sends a welcome email with temporary login credentials
    and forces password change on first login.
    """

    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #007bff;">Welcome to the Patient Portal</h2>

        <p>Hi,</p>

        <p>Your patient account has been successfully created.</p>

        <p><strong>Your login credentials:</strong></p>

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
            ⚠️ For security reasons, you will be required to change your password on your first login.
        </p>

        <!-- Left-aligned button -->
        <table cellspacing="0" cellpadding="0" style="margin: 20px 0;">
            <tr>
                <td align="left" bgcolor="#007bff" style="border-radius: 5px;">
                    <a href="{login_link}" target="_blank"
                       style="display: inline-block; padding: 12px 25px; font-size: 16px;
                              color: #ffffff; text-decoration: none; font-weight: bold;
                              border-radius: 5px;">
                        Login to Portal
                    </a>
                </td>
            </tr>
        </table>

        <p>If the button doesn’t work, copy and paste this link into your browser:</p>

        <p style="background-color:#f5f5f5; padding:10px; border-radius:5px; word-break:break-all;">
            <a href="{login_link}" style="color:#007bff;">{login_link}</a>
        </p>

        <p>If you did not expect this email, please ignore it.</p>

        <br>
        <p>Thanks,<br>
        <strong>Care Team</strong></p>
    </div>
    """

    message = MessageSchema(
        subject="Welcome to the Patient Portal",
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
):
    """
    Sends a welcome email with temporary login credentials
    and forces password change on first login.
    """

    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #007bff;">Welcome to the Patient Portal</h2>

        <p>Hi,</p>

        <p>Your staff account has been successfully created.</p>

        <p><strong>Your login credentials:</strong></p>

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
            ⚠️ For security reasons, you will be required to change your password on your first login.
        </p>

        <!-- Left-aligned button -->
        <table cellspacing="0" cellpadding="0" style="margin: 20px 0;">
            <tr>
                <td align="left" bgcolor="#007bff" style="border-radius: 5px;">
                    <a href="{login_link}" target="_blank"
                       style="display: inline-block; padding: 12px 25px; font-size: 16px;
                              color: #ffffff; text-decoration: none; font-weight: bold;
                              border-radius: 5px;">
                        Login to Portal
                    </a>
                </td>
            </tr>
        </table>

        <p>If the button doesn’t work, copy and paste this link into your browser:</p>

        <p style="background-color:#f5f5f5; padding:10px; border-radius:5px; word-break:break-all;">
            <a href="{login_link}" style="color:#007bff;">{login_link}</a>
        </p>

        <p>If you did not expect this email, please ignore it.</p>

        <br>
        <p>Thanks,<br>
        <strong>Care Team</strong></p>
    </div>
    """

    message = MessageSchema(
        subject="Welcome to the Patient Portal",
        recipients=[email],
        body=html,
        subtype="html",
    )

    fm = FastMail(_get_mail_conf())
    await fm.send_message(message)
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

    login_link = "https://patient.healthai.global/"
    html = f"""
    <div style="margin:0; padding:0; background-color:#f3f6fb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fb; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px;">
              <tr>
                <td style="background-color:#0b5ed7; padding:18px 24px; border-radius:12px 12px 0 0;">
                  <div style="font-family: Arial, sans-serif; color:#ffffff; font-size:18px; font-weight:700; letter-spacing:0.2px;">
                    Patient Reminder: Daily Symptom Check-In
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color:#ffffff; padding:24px; border-radius:0 0 12px 12px;">
                  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#1f2937; font-size:15px;">
                    <p style="margin:0 0 14px 0;">Dear {patient_name},</p>

                    <p style="margin:0 0 14px 0;">
                      We are committed to supporting you through every step of your treatment.
                      Your feedback in these daily check-ins helps your team understand your recovery
                      and allows us to provide the right guidance exactly when you need it.
                    </p>

                    <p style="margin:0 0 18px 0;">
                      Please take a moment to log your symptoms for today. Your entries help us
                      ensure your treatment plan remains safe and effective.
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 10px 0 18px 0;">
                      <tr>
                        <td align="left" bgcolor="#0b5ed7" style="border-radius:10px;">
                          <a href="{login_link}" target="_blank"
                             style="display:inline-block; padding:12px 18px; font-size:15px; font-family: Arial, sans-serif;
                                    color:#ffffff; text-decoration:none; font-weight:700; border-radius:10px;">
                            Log in to the Patient Portal
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 10px 0; color:#4b5563; font-size:13px;">
                      If the button doesn’t work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0; background-color:#f3f4f6; padding:10px 12px; border-radius:10px; word-break:break-all;">
                      <a href="{login_link}" style="color:#0b5ed7; text-decoration:none;">{login_link}</a>
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 24px;">
                  <div style="font-family: Arial, sans-serif; color:#6b7280; font-size:12px; line-height:1.5; text-align:center;">
                    Please do not reply to this email. If you need help, contact your care team.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
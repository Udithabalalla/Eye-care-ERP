import asyncio
import smtplib
from email.message import EmailMessage
from datetime import datetime

from app.config.settings import settings


class EmailService:
    """SMTP-backed email delivery service"""

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER

    async def send_password_reset_otp(self, recipient_email: str, recipient_name: str, otp: str, expires_at: datetime) -> None:
        """Send the password reset OTP to the recipient"""
        if not self.smtp_password:
            raise RuntimeError("SMTP password is not configured")

        subject = "Vision Optical Password Reset OTP"
        expiry_text = expires_at.strftime("%Y-%m-%d %H:%M UTC")
        body = (
            f"Hello {recipient_name},\n\n"
            f"Your password reset OTP is: {otp}\n\n"
            f"This code expires at {expiry_text}.\n"
            "If you did not request a password reset, you can ignore this email.\n"
        )

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.from_email
        message["To"] = recipient_email
        message.set_content(body)
        message.add_alternative(
            f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                    <p>Hello {recipient_name},</p>
                    <p>Your password reset OTP is:</p>
                    <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 16px 20px; background: #f3f4f6; display: inline-block; border-radius: 12px;">{otp}</div>
                    <p style="margin-top: 16px;">This code expires at <strong>{expiry_text}</strong>.</p>
                    <p>If you did not request a password reset, you can safely ignore this email.</p>
                </body>
            </html>
            """,
            subtype="html",
        )

        await asyncio.to_thread(self._send_message, message)

    def _send_message(self, message: EmailMessage) -> None:
        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(message)
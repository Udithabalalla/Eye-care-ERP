import asyncio
import os
import smtplib
from email.message import EmailMessage
from datetime import datetime
import httpx

from app.config.settings import settings


class EmailService:
    """SMTP-backed email delivery service"""

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = (
            settings.SMTP_PASSWORD
            or os.getenv("GOOGLE_APP_PASSWORD")
            or os.getenv("EMAIL_PASSWORD")
        )
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        self.smtp_timeout = settings.SMTP_TIMEOUT_SECONDS
        self.smtp_ssl_port = settings.SMTP_SSL_PORT
        self.resend_api_key = settings.RESEND_API_KEY or os.getenv("RESEND_API_KEY")
        self.resend_from_email = settings.RESEND_FROM_EMAIL or self.from_email

    async def send_password_reset_otp(self, recipient_email: str, recipient_name: str, otp: str, expires_at: datetime) -> None:
        """Send the password reset OTP to the recipient"""
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

        if self.smtp_password:
            try:
                await asyncio.wait_for(
                    asyncio.to_thread(self._send_message, message),
                    timeout=self.smtp_timeout + 2,
                )
                return
            except Exception:
                # Fall through to HTTP API fallback when SMTP is blocked/unavailable.
                pass

        if self.resend_api_key:
            await self._send_via_resend(
                recipient_email=recipient_email,
                subject=subject,
                text_body=body,
                html_body=message.get_body(preferencelist=("html",)).get_content(),
            )
            return

        raise RuntimeError("No email delivery method configured. Set SMTP_PASSWORD or RESEND_API_KEY.")

    def _send_message(self, message: EmailMessage) -> None:
        first_error = None

        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=self.smtp_timeout) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
                return
        except Exception as exc:
            first_error = exc

        try:
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_ssl_port, timeout=self.smtp_timeout) as server:
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
                return
        except Exception as second_error:
            if first_error:
                raise second_error from first_error
            raise

    async def _send_via_resend(self, recipient_email: str, subject: str, text_body: str, html_body: str) -> None:
        payload = {
            "from": self.resend_from_email,
            "to": [recipient_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }

        headers = {
            "Authorization": f"Bearer {self.resend_api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
            if response.status_code >= 400:
                raise RuntimeError(f"Resend API error {response.status_code}: {response.text[:300]}")
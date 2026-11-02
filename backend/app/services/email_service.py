import asyncio
import base64
import logging
import os
import smtplib
from email.message import EmailMessage
from datetime import datetime

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)


BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


class EmailService:
    """Email delivery through Gmail SMTP, or Brevo's HTTPS API where SMTP is blocked"""

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER.strip() if settings.SMTP_USER else ""
        # Accept Google App Password whether entered as grouped blocks or compact.
        self.smtp_password = settings.SMTP_PASSWORD.replace(" ", "") if settings.SMTP_PASSWORD else None
        self.from_email = (settings.SMTP_FROM_EMAIL or settings.SMTP_USER).strip() if (settings.SMTP_FROM_EMAIL or settings.SMTP_USER) else ""
        self.smtp_timeout = settings.SMTP_TIMEOUT_SECONDS
        self.smtp_ssl_port = settings.SMTP_SSL_PORT
        self.brevo_api_key = (settings.BREVO_API_KEY or "").strip() or None
        self.from_name = settings.EMAIL_FROM_NAME
        provider = (settings.EMAIL_PROVIDER or "").strip().lower()
        self.provider = provider or ("brevo" if self.brevo_api_key else "smtp")

    def _check_configured(self) -> None:
        if not self.from_email:
            raise RuntimeError("Email sender is not configured. Set SMTP_FROM_EMAIL.")
        if self.provider == "brevo":
            if not self.brevo_api_key:
                raise RuntimeError("EMAIL_PROVIDER is brevo but BREVO_API_KEY is not set.")
            return
        if not self.smtp_user:
            raise RuntimeError(
                "SMTP user configuration is incomplete. "
                "Set SMTP_USER and SMTP_FROM_EMAIL in environment."
            )
        if not self.smtp_password:
            raise RuntimeError(
                "SMTP_PASSWORD is not configured. "
                "Set the SMTP_PASSWORD environment variable to a Gmail App Password."
            )

    async def _deliver(self, message: EmailMessage) -> None:
        """Send with the configured provider, retrying once"""
        if self.provider == "log":
            self._log_instead_of_sending(message)
            return
        self._check_configured()
        for attempt in range(1, 3):
            try:
                if self.provider == "brevo":
                    await self._send_with_brevo(message)
                else:
                    await asyncio.wait_for(
                        asyncio.to_thread(self._send_message, message),
                        timeout=self.smtp_timeout + 5,
                    )
                return
            except Exception:
                if attempt == 2:
                    raise
                logger.warning("Email send attempt %d to %s failed, retrying...", attempt, message["To"])
                await asyncio.sleep(1)

    @staticmethod
    def _log_instead_of_sending(message: EmailMessage) -> None:
        """EMAIL_PROVIDER=log, for local development only: print the email to the log"""
        if os.getenv("ENVIRONMENT", "production").lower() not in {"development", "dev", "local"}:
            raise RuntimeError("EMAIL_PROVIDER=log only works when ENVIRONMENT is development")
        text = next((p.get_content() for p in message.walk() if p.get_content_type() == "text/plain"), "")
        logger.warning("EMAIL NOT SENT (EMAIL_PROVIDER=log) to %s: %s\n%s", message["To"], message["Subject"], text)

    async def _send_with_brevo(self, message: EmailMessage) -> None:
        """Brevo transactional email over HTTPS (port 443)"""
        payload: dict = {
            "sender": {"name": self.from_name, "email": self.from_email},
            "to": [{"email": addr.strip()} for addr in str(message["To"]).split(",") if addr.strip()],
            "subject": str(message["Subject"]),
        }
        if message["Cc"]:
            payload["cc"] = [{"email": addr.strip()} for addr in str(message["Cc"]).split(",") if addr.strip()]
        if message["Reply-To"]:
            payload["replyTo"] = {"email": str(message["Reply-To"])}

        attachments = []
        for part in message.walk():
            if part.is_multipart():
                continue
            if part.get_filename():
                attachments.append({
                    "name": part.get_filename(),
                    "content": base64.b64encode(part.get_payload(decode=True)).decode("ascii"),
                })
            elif part.get_content_type() == "text/html":
                payload["htmlContent"] = part.get_content()
            elif part.get_content_type() == "text/plain":
                payload["textContent"] = part.get_content()
        if attachments:
            payload["attachment"] = attachments
        if "htmlContent" not in payload:
            # Brevo needs HTML content; wrap the plain text
            text = payload.get("textContent", "")
            payload["htmlContent"] = "<pre style=\"font-family: Arial, sans-serif; white-space: pre-wrap\">" + (
                text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            ) + "</pre>"

        async with httpx.AsyncClient(timeout=self.smtp_timeout + 5) as client:
            response = await client.post(
                BREVO_SEND_URL,
                json=payload,
                headers={"api-key": self.brevo_api_key, "accept": "application/json"},
            )
        if response.status_code >= 300:
            raise RuntimeError(f"Brevo refused the email ({response.status_code}): {response.text[:300]}")

    def _otp_message(self, recipient_email: str, recipient_name: str, subject: str, purpose: str,
                     otp: str, expires_at: datetime) -> EmailMessage:
        expiry_text = expires_at.strftime("%Y-%m-%d %H:%M UTC")
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.from_email
        message["To"] = recipient_email
        message.set_content(
            f"Hello {recipient_name},\n\n"
            f"Your {purpose} code is: {otp}\n\n"
            f"This code expires at {expiry_text}.\n"
            "If you didn't ask for this, you can ignore this email.\n"
        )
        message.add_alternative(
            f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                    <p>Hello {recipient_name},</p>
                    <p>Your {purpose} code is:</p>
                    <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 16px 20px; background: #f3f4f6; display: inline-block; border-radius: 12px;">{otp}</div>
                    <p style="margin-top: 16px;">This code expires at <strong>{expiry_text}</strong>.</p>
                    <p>If you didn't ask for this, you can safely ignore this email.</p>
                </body>
            </html>
            """,
            subtype="html",
        )
        return message

    async def _send_otp(self, message: EmailMessage, what: str) -> None:
        try:
            await self._deliver(message)
        except Exception:
            logger.error("%s email to %s failed (%s)", what, message["To"], self.provider, exc_info=True)
            raise
        logger.info("%s code sent to %s via %s", what, message["To"], self.provider)

    async def send_password_reset_otp(
        self, recipient_email: str, recipient_name: str, otp: str, expires_at: datetime
    ) -> None:
        """Send the password reset OTP"""
        message = self._otp_message(recipient_email, recipient_name, "Vision Optical Password Reset OTP",
                                    "password reset", otp, expires_at)
        await self._send_otp(message, "Password reset")

    async def send_signup_otp(
        self, recipient_email: str, recipient_name: str, otp: str, expires_at: datetime
    ) -> None:
        """Send the code that confirms a new account's email address"""
        message = self._otp_message(recipient_email, recipient_name, "Confirm your Vision Optical account",
                                    "account confirmation", otp, expires_at)
        await self._send_otp(message, "Sign-up")

    async def send_purchase_order(
        self,
        recipient_email: str,
        subject: str,
        body: str,
        pdf_bytes: bytes,
        filename: str,
        cc: str | None = None,
        reply_to: str | None = None,
    ) -> None:
        """Email a purchase order to a supplier with its PDF attached."""
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.from_email
        message["To"] = recipient_email
        if cc:
            message["Cc"] = cc
        if reply_to:
            message["Reply-To"] = reply_to
        message.set_content(body)
        message.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)

        try:
            await self._deliver(message)
        except Exception:
            logger.error("Sending purchase order %s failed (%s)", filename, self.provider, exc_info=True)
            raise
        logger.info("Purchase order %s emailed to %s via %s", filename, recipient_email, self.provider)

    def _send_message(self, message: EmailMessage) -> None:
        """Try STARTTLS on port 587 first, then fall back to SSL on port 465."""
        first_error = None

        # Attempt 1: STARTTLS (port 587)
        try:
            logger.debug("Attempting SMTP STARTTLS on %s:%s", self.smtp_host, self.smtp_port)
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=self.smtp_timeout) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
                logger.debug("Email sent via STARTTLS successfully")
                return
        except Exception as exc:
            first_error = exc
            logger.warning("STARTTLS attempt failed: %s", exc)

        # Attempt 2: Direct SSL (port 465)
        try:
            logger.debug("Attempting SMTP SSL on %s:%s", self.smtp_host, self.smtp_ssl_port)
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_ssl_port, timeout=self.smtp_timeout) as server:
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
                logger.debug("Email sent via SSL successfully")
                return
        except Exception as second_error:
            logger.warning("SSL attempt failed: %s", second_error)
            if first_error:
                raise second_error from first_error
            raise
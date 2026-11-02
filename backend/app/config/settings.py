import json
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # Application
    APP_NAME: str = "Vision Optical"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = False
    
    # MongoDB
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "eye_care_institute"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Anyone can create an account from the sign-up page, choosing their role.
    # The account exists only after they enter the code emailed to them.
    ALLOW_SELF_SIGNUP: bool = True
    # Set to false to stop people from signing themselves up as admins
    ALLOW_ADMIN_SELF_SIGNUP: bool = True

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173","https://eye-care-erp.vercel.app","https://eye-care-erp-git-staging-immelon011-9217s-projects.vercel.app"]'
    CORS_ORIGIN_REGEX: Optional[str] = r"^https://.*\.vercel\.app$"

    @field_validator("DEBUG", "RELOAD", mode="before")
    @classmethod
    def normalize_boolean_flags(cls, value):
        if isinstance(value, bool) or value is None:
            return value

        if isinstance(value, (int, float)):
            return bool(value)

        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "y", "on", "debug", "development", "dev", "local"}:
                return True
            if normalized in {"0", "false", "no", "n", "off", "release", "prod", "production", "staging"}:
                return False

        return value

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            # Check if it appears to be a JSON list
            if self.CORS_ORIGINS.startswith("["):
                try:
                    return json.loads(self.CORS_ORIGINS)
                except json.JSONDecodeError:
                    pass
            # Fallback to comma-separated list
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS
    
    # Email (optional)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "vision.opticals.lk@gmail.com"
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "vision.opticals.lk@gmail.com"
    SMTP_TIMEOUT_SECONDS: int = 10
    SMTP_SSL_PORT: int = 465
    # Hosts that block outgoing SMTP (Render's free plan does) can send through
    # Brevo's HTTPS API instead: set BREVO_API_KEY, and verify SMTP_FROM_EMAIL as
    # a sender in Brevo. EMAIL_PROVIDER picks one explicitly ("smtp" or "brevo",
    # or "log" to print emails instead, development only); left empty, Brevo is
    # used whenever BREVO_API_KEY is set.
    EMAIL_PROVIDER: Optional[str] = None
    BREVO_API_KEY: Optional[str] = None
    EMAIL_FROM_NAME: str = "Vision Optical"


    # One-time admin bootstrap for hosts without a shell (Render's free plan).
    # On start, if no account uses BOOTSTRAP_ADMIN_EMAIL, an admin is created with
    # this password and must choose a new one at first sign-in. An existing account
    # is never changed. Remove these variables once you have signed in.
    BOOTSTRAP_ADMIN_EMAIL: Optional[str] = None
    BOOTSTRAP_ADMIN_NAME: Optional[str] = None
    BOOTSTRAP_ADMIN_PASSWORD: Optional[str] = None

    # Password reset
    PASSWORD_RESET_OTP_EXPIRE_MINUTES: int = 10
    PASSWORD_RESET_OTP_MAX_ATTEMPTS: int = 5
    # A new code is sent at most this often per email address
    PASSWORD_RESET_RESEND_SECONDS: int = 60

settings = Settings()

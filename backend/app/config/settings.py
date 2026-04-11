from pydantic_settings import BaseSettings
from typing import Optional, List
import json

class Settings(BaseSettings):
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
    
    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173","https://eye-care-erp.vercel.app","https://eye-care-erp-git-staging-immelon011-9217s-projects.vercel.app"]'
    CORS_ORIGIN_REGEX: Optional[str] = r"^https://.*\.vercel\.app$"
    
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
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: Optional[str] = None

    # Password reset
    PASSWORD_RESET_OTP_EXPIRE_MINUTES: int = 10
    PASSWORD_RESET_OTP_MAX_ATTEMPTS: int = 5
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

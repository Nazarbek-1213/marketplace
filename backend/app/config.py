import os


class Settings:
    app_env = os.getenv("APP_ENV", "development")
    database_url = os.getenv(
        "DATABASE_URL", "sqlite:///./2cbazar.db"
    )
    db_host = os.getenv("DB_HOST", "")
    db_user = os.getenv("DB_USER", "")
    db_password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "")
    jwt_secret = os.getenv("JWT_SECRET", "")
    access_token_days = int(os.getenv("ACCESS_TOKEN_DAYS", "30"))
    refresh_token_days = int(os.getenv("REFRESH_TOKEN_DAYS", "60"))
    otp_secret = os.getenv("OTP_SECRET", "")
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", "")
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    cors_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,"
        "https://2cnzrbk.uz,https://seller.2cnzrbk.uz",
    ).split(",")


settings = Settings()


def validate_settings() -> None:
    if settings.app_env == "production":
        if len(settings.jwt_secret) < 32 or len(settings.otp_secret) < 32:
            raise RuntimeError(
                "JWT_SECRET and OTP_SECRET must each be at least 32 characters in production"
            )
        if not all(
            (
                settings.smtp_host,
                settings.smtp_username,
                settings.smtp_password,
                settings.smtp_from,
            )
        ):
            raise RuntimeError("SMTP settings are required in production")
    else:
        if not settings.jwt_secret:
            settings.jwt_secret = "local-development-only-change-this-secret"
        if not settings.otp_secret:
            settings.otp_secret = "local-development-only-change-this-otp-secret"

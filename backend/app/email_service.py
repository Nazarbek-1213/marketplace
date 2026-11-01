import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def send_login_code(email: str, code: str) -> None:
    if not settings.smtp_host:
        if settings.app_env != "development":
            raise RuntimeError("SMTP is not configured")
        logger.warning("Development email code for %s: %s", email, code)
        return

    message = EmailMessage()
    message["Subject"] = "2cbazar tasdiqlash kodi"
    message["From"] = settings.smtp_from
    message["To"] = email
    message.set_content(
        f"2cbazar hisobingiz uchun tasdiqlash kodi: {code}\n"
        "Kod 10 daqiqa davomida amal qiladi. Uni hech kimga bermang."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)

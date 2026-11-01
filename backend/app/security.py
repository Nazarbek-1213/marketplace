import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time
import uuid

from app.config import settings


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(user_id: int, role: str) -> str:
    return _create_token(user_id, role, "access", settings.access_token_days * 86400)


def create_refresh_token(user_id: int, role: str) -> tuple[str, str, int]:
    jti = str(uuid.uuid4())
    lifetime = settings.refresh_token_days * 86400
    return _create_token(user_id, role, "refresh", lifetime, jti), jti, lifetime


def _create_token(
    user_id: int, role: str, token_type: str, lifetime: int, jti: str | None = None
) -> str:
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload_data = {
        "sub": str(user_id),
        "role": role,
        "type": token_type,
        "iat": int(time.time()),
        "exp": int(time.time()) + lifetime,
    }
    if jti:
        payload_data["jti"] = jti
    payload = _b64encode(json.dumps(payload_data, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}".encode("ascii")
    signature = hmac.new(
        settings.jwt_secret.encode(), signing_input, hashlib.sha256
    ).digest()
    return f"{header}.{payload}.{_b64encode(signature)}"


def decode_token(token: str, expected_type: str) -> dict:
    try:
        header, payload, signature = token.split(".")
        signing_input = f"{header}.{payload}".encode("ascii")
        expected_signature = hmac.new(
            settings.jwt_secret.encode(), signing_input, hashlib.sha256
        ).digest()
        if not hmac.compare_digest(_b64decode(signature), expected_signature):
            raise ValueError("Invalid token signature")
        claims = json.loads(_b64decode(payload))
        if claims.get("type") != expected_type or claims.get("exp", 0) <= time.time():
            raise ValueError("Expired or invalid token")
        if not claims.get("sub") or claims.get("role") not in {"buyer", "seller"}:
            raise ValueError("Invalid token claims")
        return claims
    except (
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        OverflowError,
        binascii.Error,
        UnicodeDecodeError,
        json.JSONDecodeError,
    ) as exc:
        raise ValueError("Invalid or expired token") from exc


def hash_secret(value: str, *, key: str | None = None) -> str:
    if key:
        return hmac.new(key.encode(), value.encode(), hashlib.sha256).hexdigest()
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", value.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${_b64encode(salt)}${_b64encode(derived)}"


def verify_password(value: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algorithm, iterations, salt, expected = encoded.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", value.encode(), _b64decode(salt), int(iterations)
        )
        return hmac.compare_digest(_b64encode(actual), expected)
    except (ValueError, TypeError):
        return False


def make_email_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

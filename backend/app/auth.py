import secrets
import smtplib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.email_service import send_login_code
from app.models import EmailCode, RefreshSession, User, utcnow
from app.schemas import (
    EmailRequest,
    EmailVerify,
    RefreshRequest,
    SellerLogin,
    SellerRegistration,
    TokenPair,
    UserProfileUpdate,
    UserView,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_secret,
    make_email_code,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])
CODE_LIFETIME = timedelta(minutes=10)
CODE_RESEND_DELAY = timedelta(seconds=60)
MAX_CODE_ATTEMPTS = 5


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _send_code(db: Session, email: str, purpose: str) -> None:
    now = utcnow()
    previous = db.scalar(
        select(EmailCode)
        .where(EmailCode.email == email, EmailCode.purpose == purpose)
        .order_by(EmailCode.id.desc())
        .limit(1)
    )
    if previous and now - _utc(previous.sent_at) < CODE_RESEND_DELAY:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Yangi kod so‘rashdan oldin bir daqiqa kuting.",
        )

    code = make_email_code()
    challenge = EmailCode(
        email=email,
        purpose=purpose,
        code_hash=hash_secret(code, key=settings.otp_secret),
        expires_at=now + CODE_LIFETIME,
        sent_at=now,
    )
    db.add(challenge)
    db.commit()
    try:
        send_login_code(email, code)
    except (OSError, RuntimeError, smtplib.SMTPException) as exc:
        db.delete(challenge)
        db.commit()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Email kodini yuborib bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
        ) from exc

def _verify_code(db: Session, email: str, code: str, purpose: str) -> EmailCode:
    challenge = db.scalar(
        select(EmailCode)
        .where(
            EmailCode.email == email,
            EmailCode.purpose == purpose,
            EmailCode.used_at.is_(None),
        )
        .with_for_update()
        .order_by(EmailCode.id.desc())
        .limit(1)
    )
    if not challenge:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kod yaroqsiz yoki muddati tugagan.")
    if challenge.attempts >= MAX_CODE_ATTEMPTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Kod urinishlari limiti tugadi.")
    if _utc(challenge.expires_at) <= utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kod muddati tugagan.")
    challenge.attempts += 1
    if not secrets.compare_digest(
        challenge.code_hash, hash_secret(code, key=settings.otp_secret)
    ):
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email kodi noto‘g‘ri.")
    challenge.used_at = utcnow()
    db.commit()
    return challenge


def _issue_tokens(db: Session, user: User) -> TokenPair:
    refresh, jti, lifetime = create_refresh_token(user.id, user.role)
    db.add(
        RefreshSession(
            jti=jti,
            user_id=user.id,
            expires_at=utcnow() + timedelta(seconds=lifetime),
        )
    )
    db.commit()
    return TokenPair(
        access_token=create_access_token(user.id, user.role),
        refresh_token=refresh,
        access_expires_in=settings.access_token_days * 86400,
    )


@router.post("/marketplace/request-code", status_code=202)
def request_marketplace_code(
    data: EmailRequest, db: Session = Depends(get_db)
) -> dict[str, str]:
    _send_code(db, str(data.email).lower(), "marketplace")
    return {"message": "Tasdiqlash kodi emailingizga yuborildi."}


@router.post("/marketplace/verify", response_model=TokenPair)
def verify_marketplace_code(
    data: EmailVerify, db: Session = Depends(get_db)
) -> TokenPair:
    email = str(data.email).lower()
    _verify_code(db, email, data.code, "marketplace")
    user = db.scalar(select(User).where(User.email == email))
    if user and user.role != "buyer":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Bu email seller hisobiga bog‘langan. Seller kabinetidan kiring.",
        )
    if not user:
        user = User(email=email, role="buyer")
        db.add(user)
        db.commit()
        db.refresh(user)
    return _issue_tokens(db, user)


@router.post("/seller/request-code", status_code=202)
def request_seller_code(data: EmailRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    _send_code(db, str(data.email).lower(), "seller_registration")
    return {"message": "Tasdiqlash kodi emailingizga yuborildi."}


@router.post("/seller/register", response_model=TokenPair, status_code=201)
def register_seller(data: SellerRegistration, db: Session = Depends(get_db)) -> TokenPair:
    email = str(data.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu email allaqachon ro‘yxatdan o‘tgan.")
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu username band.")
    _verify_code(db, email, data.code, "seller_registration")
    user = User(
        email=email,
        username=data.username,
        password_hash=hash_secret(data.password),
        role="seller",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email yoki username band.") from exc
    db.refresh(user)
    return _issue_tokens(db, user)


@router.post("/seller/login", response_model=TokenPair)
def login_seller(data: SellerLogin, db: Session = Depends(get_db)) -> TokenPair:
    user = db.scalar(
        select(User).where(User.username == data.username, User.role == "seller")
    )
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Username yoki parol noto‘g‘ri.")
    return _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenPair)
def refresh_tokens(data: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    try:
        claims = decode_token(data.refresh_token, "refresh")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token yaroqsiz.") from exc
    session = db.scalar(select(RefreshSession).where(RefreshSession.jti == claims.get("jti")))
    if (
        not session
        or session.revoked_at is not None
        or _utc(session.expires_at) <= utcnow()
        or str(session.user_id) != claims["sub"]
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token bekor qilingan.")
    revoked = db.execute(
        update(RefreshSession)
        .where(
            RefreshSession.jti == session.jti,
            RefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )
    if revoked.rowcount != 1:
        db.rollback()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token bekor qilingan.")
    db.commit()
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Foydalanuvchi topilmadi.")
    return _issue_tokens(db, user)


@router.post("/logout", status_code=204)
def logout(data: RefreshRequest, db: Session = Depends(get_db)) -> None:
    try:
        claims = decode_token(data.refresh_token, "refresh")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token yaroqsiz.") from exc
    session = db.scalar(select(RefreshSession).where(RefreshSession.jti == claims.get("jti")))
    if session and session.revoked_at is None:
        session.revoked_at = utcnow()
        db.commit()


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kirish talab qilinadi.")
    try:
        claims = decode_token(authorization[7:], "access")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Access token yaroqsiz.") from exc
    user = db.get(User, int(claims["sub"]))
    if not user or user.role != claims["role"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Foydalanuvchi topilmadi.")
    return user


def require_role(role: str):
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu amal uchun ruxsat yo‘q.")
        return user

    return dependency


@router.get("/me", response_model=UserView)
def get_me(user: User = Depends(current_user)) -> User:
    return user


@router.patch("/me", response_model=UserView)
def update_me(
    data: UserProfileUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

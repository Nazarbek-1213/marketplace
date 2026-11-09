from decimal import Decimal
from datetime import date, datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


def _is_valid_image_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"}:
        return bool(parsed.netloc)
    return (
        value.startswith("/uploads/")
        and parsed.path == value
        and ".." not in parsed.path.split("/")
    )


class EmailRequest(BaseModel):
    email: EmailStr


class EmailVerify(EmailRequest):
    code: str = Field(pattern=r"^\d{6}$")


class SellerRegistration(EmailVerify):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=10, max_length=128)


class SellerPasswordReset(EmailVerify):
    password: str = Field(min_length=10, max_length=128)


class SellerLogin(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class Base64Image(BaseModel):
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    content_base64: str = Field(
        min_length=1,
        max_length=6_990_508,
        json_schema_extra={"format": "byte"},
    )


class Base64ImageUpload(BaseModel):
    images: list[Base64Image] = Field(min_length=1, max_length=3)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_expires_in: int


class UserView(BaseModel):
    id: int
    email: EmailStr
    username: str | None
    role: str
    full_name: str | None
    phone: str | None
    gender: str | None
    birth_date: date | None

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=24)
    gender: Literal["male", "female", "prefer_not_to_say"] | None = None
    birth_date: date | None = None

    @field_validator("full_name", "phone", mode="before")
    @classmethod
    def trim_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str | None) -> str | None:
        if value is not None and len(value) < 2:
            raise ValueError("Ism-familiya kamida 2 ta belgidan iborat bo‘lishi kerak.")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is not None:
            digits = "".join(character for character in value if character.isdigit())
            if not 7 <= len(digits) <= 15 or any(
                not (character.isdigit() or character in "+()- ")
                for character in value
            ):
                raise ValueError("Telefon raqamini xalqaro formatda kiriting.")
        return value

    @model_validator(mode="after")
    def validate_birth_date(self) -> "UserProfileUpdate":
        if self.birth_date and self.birth_date > date.today():
            raise ValueError("Tug‘ilgan sana kelajakda bo‘lishi mumkin emas.")
        return self


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    description: str = Field(default="", max_length=10000)
    category: str = Field(min_length=2, max_length=80)
    image_url: str | None = None
    image_urls: list[str] = Field(default_factory=list, max_length=3)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    stock: int = Field(ge=0, le=1_000_000)

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        if value is not None and not _is_valid_image_url(value):
            raise ValueError("Rasm manzili noto‘g‘ri.")
        return value

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, value: list[str]) -> list[str]:
        if any(not _is_valid_image_url(image_url) for image_url in value):
            raise ValueError("Rasm manzili noto‘g‘ri.")
        return value


class ProductView(ProductCreate):
    id: int
    seller_id: int
    average_rating: float = 0
    review_count: int = 0
    seller_average_rating: float = 0
    seller_review_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ReviewCreate(BaseModel):
    product_id: int = Field(gt=0)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=2000)

    @field_validator("comment")
    @classmethod
    def comment_must_contain_text(cls, value: str) -> str:
        comment = value.strip()
        if len(comment) < 3:
            raise ValueError("Fikr kamida 3 ta mazmunli belgidan iborat bo‘lishi kerak.")
        return comment


class ReviewView(BaseModel):
    id: int
    product_id: int
    product_name: str
    rating: int
    comment: str
    author: str
    seller_name: str | None = None
    seller_reply: str | None = None
    seller_reply_at: datetime | None = None
    created_at: datetime


class SellerReplyCreate(BaseModel):
    reply: str = Field(min_length=3, max_length=2000)

    @field_validator("reply")
    @classmethod
    def reply_must_contain_text(cls, value: str) -> str:
        reply = value.strip()
        if len(reply) < 3:
            raise ValueError("Javob kamida 3 ta mazmunli belgidan iborat bo‘lishi kerak.")
        return reply


class SalesDay(BaseModel):
    date: str
    revenue: Decimal
    orders: int
    units_sold: int


class TopProduct(BaseModel):
    product_id: int
    name: str
    units_sold: int
    revenue: Decimal


class SellerAnalytics(BaseModel):
    period: str
    days: int
    start_date: str
    end_date: str
    revenue: Decimal
    orders: int
    units_sold: int
    previous_revenue: Decimal
    previous_orders: int
    previous_units_sold: int
    daily: list[SalesDay]
    top_products: list[TopProduct]


class OrderLineInput(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)


class OrderCreate(BaseModel):
    delivery_address: str = Field(min_length=8, max_length=500)
    items: list[OrderLineInput] = Field(min_length=1, max_length=50)


class OrderLineView(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal

    model_config = ConfigDict(from_attributes=True)


class OrderView(BaseModel):
    id: int
    status: str
    total: Decimal
    delivery_address: str
    created_at: datetime
    items: list[OrderLineView]

    model_config = ConfigDict(from_attributes=True)

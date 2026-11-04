import base64
import binascii
import uuid
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased, selectinload

from app.auth import require_role
from app.config import settings
from app.database import get_db
from app.models import Order, OrderItem, Product, ProductReview, User
from app.schemas import (
    Base64ImageUpload,
    OrderCreate,
    OrderView,
    ProductCreate,
    ProductView,
    ReviewCreate,
    SellerReplyCreate,
    ReviewView,
    SalesDay,
    SellerAnalytics,
    TopProduct,
)

router = APIRouter(tags=["marketplace"])
MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_JSON_UPLOAD_SIZE = 11 * 1024 * 1024
IMAGE_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "image/webp": (b"RIFF", ".webp"),
}


def _seller_review_summary():
    return (
        select(
            Product.seller_id.label("seller_id"),
            func.coalesce(func.avg(ProductReview.rating), 0).label(
                "seller_average_rating"
            ),
            func.count(ProductReview.id).label("seller_review_count"),
        )
        .outerjoin(ProductReview, ProductReview.product_id == Product.id)
        .group_by(Product.seller_id)
        .subquery()
    )


def _is_supported_image(content: bytes, content_type: str) -> bool:
    signature = IMAGE_SIGNATURES.get(content_type)
    if not signature or not content.startswith(signature[0]):
        return False
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
            return image.format in {"JPEG", "PNG", "WEBP"}
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        return False


def _save_product_images(images: list[tuple[bytes, str]]) -> dict[str, list[str]]:
    upload_directory = Path(settings.upload_dir)
    upload_directory.mkdir(parents=True, exist_ok=True)
    image_urls = []
    for content, extension in images:
        filename = f"{uuid.uuid4().hex}{extension}"
        (upload_directory / filename).write_bytes(content)
        image_urls.append(f"/uploads/{filename}")
    return {"image_urls": image_urls}


@router.post("/api/seller/uploads", status_code=201)
async def upload_product_images(
    files: list[UploadFile] = File(...),
    seller: User = Depends(require_role("seller")),
) -> dict[str, list[str]]:
    del seller
    if not 1 <= len(files) <= 3:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Mahsulot uchun 1 tadan 3 tagacha rasm yuklang.",
        )

    images: list[tuple[bytes, str]] = []
    for file in files:
        content = await file.read(MAX_IMAGE_SIZE + 1)
        if len(content) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "Har bir rasm hajmi 5 MB dan oshmasligi kerak.",
            )
        content_type = file.content_type or ""
        if not _is_supported_image(content, content_type):
            raise HTTPException(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "Faqat JPEG, PNG yoki WebP formatidagi haqiqiy rasmlarni yuklang.",
            )
        images.append((content, IMAGE_SIGNATURES[content_type][1]))

    return _save_product_images(images)


@router.post("/api/seller/uploads/base64", status_code=201)
def upload_product_images_base64(
    data: Base64ImageUpload,
    seller: User = Depends(require_role("seller")),
) -> dict[str, list[str]]:
    del seller
    images: list[tuple[bytes, str]] = []
    total_size = 0
    for image in data.images:
        try:
            content = base64.b64decode(image.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Rasm ma’lumoti yaroqli Base64 formatida emas.",
            ) from exc
        if len(content) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "Har bir rasm hajmi 5 MB dan oshmasligi kerak.",
            )
        total_size += len(content)
        if total_size > MAX_JSON_UPLOAD_SIZE:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "Yuklangan rasmlarning jami hajmi 11 MB dan oshmasligi kerak.",
            )
        if not _is_supported_image(content, image.content_type):
            raise HTTPException(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "Faqat JPEG, PNG yoki WebP formatidagi haqiqiy rasmlarni yuklang.",
            )
        images.append((content, IMAGE_SIGNATURES[image.content_type][1]))

    return _save_product_images(images)


@router.get("/api/products", response_model=list[ProductView])
def list_products(
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ProductView]:
    seller_reviews = _seller_review_summary()
    query = (
        select(
            Product,
            func.coalesce(func.avg(ProductReview.rating), 0).label("average_rating"),
            func.count(ProductReview.id).label("review_count"),
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        )
        .outerjoin(ProductReview, ProductReview.product_id == Product.id)
        .outerjoin(seller_reviews, seller_reviews.c.seller_id == Product.seller_id)
        .where(Product.stock > 0)
        .group_by(
            Product.id,
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        )
        .order_by(Product.created_at.desc())
    )
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    if category:
        query = query.where(Product.category == category)
    return [
        ProductView.model_validate(product).model_copy(
            update={
                "average_rating": float(average_rating),
                "review_count": review_count,
                "seller_average_rating": float(seller_average_rating),
                "seller_review_count": seller_review_count,
            }
        )
        for (
            product,
            average_rating,
            review_count,
            seller_average_rating,
            seller_review_count,
        ) in db.execute(
            query.offset(offset).limit(limit)
        ).all()
    ]


@router.get("/api/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)) -> list[str]:
    return list(
        db.scalars(
            select(Product.category)
            .where(Product.stock > 0)
            .distinct()
            .order_by(Product.category)
        ).all()
    )


@router.get("/api/products/{product_id}", response_model=ProductView)
def get_product(product_id: int, db: Session = Depends(get_db)) -> ProductView:
    seller_reviews = _seller_review_summary()
    row = db.execute(
        select(
            Product,
            func.coalesce(func.avg(ProductReview.rating), 0).label("average_rating"),
            func.count(ProductReview.id).label("review_count"),
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        )
        .outerjoin(ProductReview, ProductReview.product_id == Product.id)
        .outerjoin(seller_reviews, seller_reviews.c.seller_id == Product.seller_id)
        .where(Product.id == product_id, Product.stock > 0)
        .group_by(
            Product.id,
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        )
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mahsulot topilmadi.")
    (
        product,
        average_rating,
        review_count,
        seller_average_rating,
        seller_review_count,
    ) = row
    return ProductView.model_validate(product).model_copy(
        update={
            "average_rating": float(average_rating),
            "review_count": review_count,
            "seller_average_rating": float(seller_average_rating),
            "seller_review_count": seller_review_count,
        }
    )


@router.get(
    "/api/products/{product_id}/reviews",
    response_model=list[ReviewView],
)
def list_product_reviews(
    product_id: int,
    db: Session = Depends(get_db),
) -> list[ReviewView]:
    if not db.get(Product, product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mahsulot topilmadi.")
    seller_user = aliased(User)
    rows = db.execute(
        select(
            ProductReview,
            Product.name,
            User.username,
            User.full_name,
            seller_user.username,
        )
        .join(Product, Product.id == ProductReview.product_id)
        .join(User, User.id == ProductReview.user_id)
        .join(seller_user, seller_user.id == Product.seller_id)
        .where(ProductReview.product_id == product_id)
        .order_by(ProductReview.created_at.desc())
    ).all()
    return [
        ReviewView(
            id=review.id,
            product_id=review.product_id,
            product_name=product_name,
            rating=review.rating,
            comment=review.comment,
            author=full_name or username or "Xaridor",
            created_at=review.created_at,
            seller_reply=review.seller_reply,
            seller_reply_at=review.seller_reply_at,
            seller_name=seller_name,
        )
        for review, product_name, username, full_name, seller_name in rows
    ]


@router.get("/api/reviews/mine", response_model=list[ReviewView])
def list_my_reviews(
    buyer: User = Depends(require_role("buyer")),
    db: Session = Depends(get_db),
) -> list[ReviewView]:
    seller_user = aliased(User)
    rows = db.execute(
        select(
            ProductReview,
            Product.name,
            User.username,
            User.full_name,
            seller_user.username,
        )
        .join(Product, Product.id == ProductReview.product_id)
        .join(User, User.id == ProductReview.user_id)
        .join(seller_user, seller_user.id == Product.seller_id)
        .where(ProductReview.user_id == buyer.id)
        .order_by(ProductReview.created_at.desc())
    ).all()
    return [
        ReviewView(
            id=review.id,
            product_id=review.product_id,
            product_name=product_name,
            rating=review.rating,
            comment=review.comment,
            author=full_name or username or "Xaridor",
            created_at=review.created_at,
            seller_reply=review.seller_reply,
            seller_reply_at=review.seller_reply_at,
            seller_name=seller_name,
        )
        for review, product_name, username, full_name, seller_name in rows
    ]


@router.post("/api/reviews", response_model=ReviewView, status_code=201)
def create_product_review(
    data: ReviewCreate,
    buyer: User = Depends(require_role("buyer")),
    db: Session = Depends(get_db),
) -> ReviewView:
    product = db.get(Product, data.product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mahsulot topilmadi.")
    if not db.scalar(
        select(OrderItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.buyer_id == buyer.id,
            OrderItem.product_id == data.product_id,
        )
        .limit(1)
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Fikr qoldirish uchun avval ushbu mahsulotni xarid qiling.",
        )

    existing_review = db.scalar(
        select(ProductReview.id).where(
            ProductReview.user_id == buyer.id,
            ProductReview.product_id == data.product_id,
        )
    )
    if existing_review:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Bu mahsulotga allaqachon fikr qoldirgansiz.",
        )

    order_id = db.scalar(
        select(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            Order.buyer_id == buyer.id,
            OrderItem.product_id == data.product_id,
        )
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(1)
    )
    review = ProductReview(
        user_id=buyer.id,
        product_id=product.id,
        order_id=order_id,
        rating=data.rating,
        comment=data.comment.strip(),
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Bu mahsulotga allaqachon fikr qoldirgansiz.",
        ) from exc
    db.refresh(review)
    return ReviewView(
        id=review.id,
        product_id=review.product_id,
        product_name=product.name,
        rating=review.rating,
        comment=review.comment,
        author=buyer.full_name or buyer.username or "Xaridor",
        created_at=review.created_at,
        seller_name=db.scalar(
            select(User.username).where(User.id == product.seller_id)
        ),
    )


@router.get("/api/seller/products", response_model=list[ProductView])
def list_seller_products(
    seller: User = Depends(require_role("seller")), db: Session = Depends(get_db)
) -> list[ProductView]:
    seller_reviews = _seller_review_summary()
    rows = db.execute(
        select(
            Product,
            func.coalesce(func.avg(ProductReview.rating), 0).label("average_rating"),
            func.count(ProductReview.id).label("review_count"),
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        )
        .outerjoin(ProductReview, ProductReview.product_id == Product.id)
        .outerjoin(seller_reviews, seller_reviews.c.seller_id == Product.seller_id)
        .where(Product.seller_id == seller.id)
        .group_by(
            Product.id,
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        )
        .order_by(Product.id.desc())
    ).all()
    return [
        ProductView.model_validate(product).model_copy(
            update={
                "average_rating": float(average_rating),
                "review_count": review_count,
                "seller_average_rating": float(seller_average_rating),
                "seller_review_count": seller_review_count,
            }
        )
        for (
            product,
            average_rating,
            review_count,
            seller_average_rating,
            seller_review_count,
        ) in rows
    ]


@router.post("/api/seller/products", response_model=ProductView, status_code=201)
def create_product(
    data: ProductCreate,
    seller: User = Depends(require_role("seller")),
    db: Session = Depends(get_db),
) -> ProductView:
    product = Product(
        seller_id=seller.id,
        name=data.name,
        description=data.description,
        category=data.category,
        image_url=data.image_urls[0] if data.image_urls else (
            str(data.image_url) if data.image_url else None
        ),
        image_urls=data.image_urls or (
            [str(data.image_url)] if data.image_url else []
        ),
        price=data.price,
        stock=data.stock,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    seller_reviews = _seller_review_summary()
    seller_average_rating, seller_review_count = db.execute(
        select(
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        ).where(seller_reviews.c.seller_id == seller.id)
    ).one()
    return ProductView.model_validate(product).model_copy(
        update={
            "seller_average_rating": float(seller_average_rating),
            "seller_review_count": seller_review_count,
        }
    )


@router.patch("/api/seller/products/{product_id}", response_model=ProductView)
def update_seller_product(
    product_id: int,
    data: ProductCreate,
    seller: User = Depends(require_role("seller")),
    db: Session = Depends(get_db),
) -> Product:
    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.seller_id == seller.id,
        )
    )
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mahsulot topilmadi.")
    product.name = data.name
    product.description = data.description
    product.category = data.category
    product.image_url = data.image_urls[0] if data.image_urls else (
        str(data.image_url) if data.image_url else None
    )
    product.image_urls = data.image_urls or (
        [str(data.image_url)] if data.image_url else []
    )
    product.price = data.price
    product.stock = data.stock
    db.commit()
    db.refresh(product)
    seller_reviews = _seller_review_summary()
    average_rating, review_count = db.execute(
        select(
            func.coalesce(func.avg(ProductReview.rating), 0),
            func.count(ProductReview.id),
        ).where(ProductReview.product_id == product.id)
    ).one()
    seller_average_rating, seller_review_count = db.execute(
        select(
            seller_reviews.c.seller_average_rating,
            seller_reviews.c.seller_review_count,
        )
        .where(seller_reviews.c.seller_id == product.seller_id)
    ).one()
    return ProductView.model_validate(product).model_copy(
        update={
            "average_rating": float(average_rating),
            "review_count": review_count,
            "seller_average_rating": float(seller_average_rating),
            "seller_review_count": seller_review_count,
        }
    )


@router.get("/api/seller/reviews", response_model=list[ReviewView])
def list_seller_reviews(
    seller: User = Depends(require_role("seller")),
    db: Session = Depends(get_db),
) -> list[ReviewView]:
    rows = db.execute(
        select(ProductReview, Product.name, User.username, User.full_name)
        .join(Product, Product.id == ProductReview.product_id)
        .join(User, User.id == ProductReview.user_id)
        .where(Product.seller_id == seller.id)
        .order_by(Product.id, ProductReview.created_at.desc())
    ).all()
    return [
        ReviewView(
            id=review.id,
            product_id=review.product_id,
            product_name=product_name,
            rating=review.rating,
            comment=review.comment,
            author=full_name or username or "Xaridor",
            created_at=review.created_at,
            seller_name=seller.username,
            seller_reply=review.seller_reply,
            seller_reply_at=review.seller_reply_at,
        )
        for review, product_name, username, full_name in rows
    ]


@router.put("/api/seller/reviews/{review_id}/reply", response_model=ReviewView)
def reply_to_product_review(
    review_id: int,
    data: SellerReplyCreate,
    seller: User = Depends(require_role("seller")),
    db: Session = Depends(get_db),
) -> ReviewView:
    row = db.execute(
        select(ProductReview, Product.name, User.username, User.full_name)
        .join(Product, Product.id == ProductReview.product_id)
        .join(User, User.id == ProductReview.user_id)
        .where(
            ProductReview.id == review_id,
            Product.seller_id == seller.id,
        )
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sharh topilmadi.")
    review, product_name, username, full_name = row
    review.seller_reply = data.reply.strip()
    review.seller_reply_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)
    return ReviewView(
        id=review.id,
        product_id=review.product_id,
        product_name=product_name,
        rating=review.rating,
        comment=review.comment,
        author=full_name or username or "Xaridor",
        created_at=review.created_at,
        seller_name=seller.username,
        seller_reply=review.seller_reply,
        seller_reply_at=review.seller_reply_at,
    )


@router.get("/api/seller/analytics", response_model=SellerAnalytics)
def get_seller_analytics(
    period: Literal["weekly", "monthly"] = Query(default="weekly"),
    seller: User = Depends(require_role("seller")),
    db: Session = Depends(get_db),
) -> SellerAnalytics:
    local_timezone = timezone(timedelta(hours=5))
    days = 7 if period == "weekly" else 30
    today = datetime.now(local_timezone).date()
    current_start = today - timedelta(days=days - 1)
    previous_start = today - timedelta(days=days * 2 - 1)
    query_start = datetime.combine(previous_start, time.min, tzinfo=local_timezone)
    query_end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=local_timezone)

    rows = db.execute(
        select(
            Order.created_at,
            Order.id,
            OrderItem.product_id,
            OrderItem.product_name,
            OrderItem.quantity,
            OrderItem.unit_price,
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Product.seller_id == seller.id,
            Order.created_at >= query_start,
            Order.created_at < query_end,
        )
    ).all()

    current_revenue = Decimal("0")
    previous_revenue = Decimal("0")
    current_orders: set[int] = set()
    previous_orders: set[int] = set()
    current_units = 0
    previous_units = 0
    daily_totals: dict[str, dict[str, Decimal | int | set[int]]] = {}
    product_totals: dict[int, dict[str, str | Decimal | int]] = {}

    for row in rows:
        created_at = row.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        order_date = created_at.astimezone(local_timezone).date()
        line_revenue = row.unit_price * row.quantity
        is_current = order_date >= current_start
        if is_current:
            date_key = order_date.isoformat()
            current_revenue += line_revenue
            current_orders.add(row.id)
            current_units += row.quantity
            daily_total = daily_totals.setdefault(
                date_key,
                {"revenue": Decimal("0"), "orders": set(), "units_sold": 0},
            )
            daily_total["revenue"] += line_revenue
            daily_total["orders"].add(row.id)
            daily_total["units_sold"] += row.quantity

            product_total = product_totals.setdefault(
                row.product_id,
                {
                    "product_id": row.product_id,
                    "name": row.product_name,
                    "units_sold": 0,
                    "revenue": Decimal("0"),
                },
            )
            product_total["units_sold"] += row.quantity
            product_total["revenue"] += line_revenue
        else:
            previous_revenue += line_revenue
            previous_orders.add(row.id)
            previous_units += row.quantity

    daily = []
    for day_offset in range(days):
        date_key = (current_start + timedelta(days=day_offset)).isoformat()
        totals = daily_totals.get(
            date_key,
            {"revenue": Decimal("0"), "orders": set(), "units_sold": 0},
        )
        daily.append(
            SalesDay(
                date=date_key,
                revenue=totals["revenue"],
                orders=len(totals["orders"]),
                units_sold=totals["units_sold"],
            )
        )

    top_products = sorted(
        (TopProduct(**product) for product in product_totals.values()),
        key=lambda product: (product.revenue, product.units_sold),
        reverse=True,
    )[:5]
    return SellerAnalytics(
        period=period,
        days=days,
        start_date=current_start.isoformat(),
        end_date=today.isoformat(),
        revenue=current_revenue,
        orders=len(current_orders),
        units_sold=current_units,
        previous_revenue=previous_revenue,
        previous_orders=len(previous_orders),
        previous_units_sold=previous_units,
        daily=daily,
        top_products=top_products,
    )


@router.post("/api/orders", response_model=OrderView, status_code=201)
def place_order(
    data: OrderCreate,
    buyer: User = Depends(require_role("buyer")),
    db: Session = Depends(get_db),
) -> Order:
    quantities: dict[int, int] = {}
    for line in data.items:
        quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity

    products = list(
        db.scalars(
            select(Product)
            .where(Product.id.in_(quantities))
            .with_for_update()
        ).all()
    )
    by_id = {product.id: product for product in products}
    if len(by_id) != len(quantities):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mahsulotlardan biri topilmadi.")
    for product_id, quantity in quantities.items():
        if by_id[product_id].stock < quantity:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{by_id[product_id].name} mahsulotidan yetarli zaxira yo‘q.",
            )

    total = sum(
        (by_id[product_id].price * quantity for product_id, quantity in quantities.items()),
        Decimal("0"),
    )
    order = Order(
        buyer_id=buyer.id,
        total=total,
        delivery_address=data.delivery_address,
    )
    for product_id, quantity in quantities.items():
        product = by_id[product_id]
        product.stock -= quantity
        order.items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=product.price,
            )
        )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/api/orders", response_model=list[OrderView])
def list_orders(
    buyer: User = Depends(require_role("buyer")), db: Session = Depends(get_db)
) -> list[Order]:
    return list(
        db.scalars(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.buyer_id == buyer.id)
            .order_by(Order.id.desc())
        ).all()
    )

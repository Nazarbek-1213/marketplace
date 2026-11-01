from collections.abc import Generator

from sqlalchemy import URL, create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


database_url = (
    URL.create(
        "postgresql+psycopg",
        username=settings.db_user,
        password=settings.db_password,
        host=settings.db_host,
        database=settings.db_name,
    )
    if settings.db_host
    else settings.database_url
)
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False}
    if str(database_url).startswith("sqlite")
    else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

_USER_PROFILE_COLUMNS = {
    "full_name": "VARCHAR(120)",
    "phone": "VARCHAR(24)",
    "gender": "VARCHAR(20)",
    "birth_date": "DATE",
}
_PRODUCT_COLUMNS = {"image_urls": "JSON"}


def migrate_user_profile_columns() -> None:
    with engine.begin() as connection:
        existing_columns = {
            column["name"] for column in inspect(connection).get_columns("users")
        }
        for column_name, column_type in _USER_PROFILE_COLUMNS.items():
            if column_name not in existing_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"
                )
        existing_product_columns = {
            column["name"] for column in inspect(connection).get_columns("products")
        }
        for column_name, column_type in _PRODUCT_COLUMNS.items():
            if column_name not in existing_product_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE products ADD COLUMN {column_name} {column_type}"
                )
        connection.exec_driver_sql(
            "UPDATE products SET image_urls = '[]' WHERE image_urls IS NULL"
        )


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session

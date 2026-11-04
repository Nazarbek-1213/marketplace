from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import router as auth_router
from app.catalog import router as catalog_router
from app.config import settings, validate_settings
from app.database import Base, engine, migrate_user_profile_columns
from app import models


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_settings()
    Base.metadata.create_all(bind=engine)
    migrate_user_profile_columns()
    yield


app = FastAPI(
    title="2cbazar API",
    description="2cbazar marketplace and seller API",
    version="1.0.0",
    lifespan=lifespan,
)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(catalog_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

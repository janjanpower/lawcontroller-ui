from fastapi import APIRouter
from app.db import db_health
from app.schemas import HealthResponse

router = APIRouter()

@router.get("/healthz", response_model=HealthResponse)
async def health_check():
    """健康檢查端點"""
    db_status = "up" if db_health() else "down"
    return HealthResponse(ok=db_status == "up", db=db_status)
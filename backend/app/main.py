from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from app.models import Base
from app.settings import settings

from app.routers import health, auth, clients, cases, stages, reminders, files

# 建立資料庫表格
engine = create_engine(settings.database_url)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="法律案件管理系統 API",
    description="法律案件系統的後端 API",
    version="1.0.0"
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["認證"])
app.include_router(clients.router, prefix="/api")
app.include_router(cases.router, prefix="/api")
app.include_router(stages.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")
app.include_router(files.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "法律案件管理系統 API"}
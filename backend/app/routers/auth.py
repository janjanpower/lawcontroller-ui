from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.auth_repository import AuthRepository
from app.schemas import (
    RegisterRequest, LoginRequest, SetupAdminRequest,
    RegisterResponse, LoginResponse, SetupAdminResponse
)
import re

router = APIRouter()

@router.post("/register", response_model=RegisterResponse)
async def register_firm(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    """註冊事務所"""
    repo = AuthRepository(db)
    
    # 驗證帳號格式（英數字、底線、連字號）
    if not re.match(r'^[A-Za-z0-9_-]+$', request.username):
        raise HTTPException(
            status_code=422, 
            detail="帳號僅允許英數字、底線與連字號"
        )
    
    # 驗證密碼強度（至少8碼，包含大小寫英文）
    if not re.match(r'^(?=.*[a-z])(?=.*[A-Z]).{8,}$', request.password):
        raise HTTPException(
            status_code=422,
            detail="密碼需至少8碼，包含至少一個大寫和一個小寫英文字母"
        )
    
    # 檢查帳號是否已存在
    if repo.check_username_exists(request.username):
        raise HTTPException(status_code=409, detail="帳號已存在")
    
    try:
        # 加密密碼
        password_hash = repo.hash_password(request.password)
        
        # 建立事務所
        firm = repo.create_firm({
            "firm_name": request.firm_name,
            "firm_code": request.username,
            "password_hash": password_hash
        })
        
        return RegisterResponse(
            success=True,
            message="事務所註冊成功，請設定管理員",
            firm_id=str(firm.id),
            requires_admin_setup=True
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"註冊失敗: {str(e)}")

@router.post("/login", response_model=LoginResponse)
async def login_firm(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """事務所登入"""
    repo = AuthRepository(db)
    
    # 根據帳號查找事務所
    firm = repo.get_firm_by_username(request.username)
    if not firm:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    # 驗證事務所密碼
    if not repo.verify_firm_password(firm, request.password):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    # 檢查是否已設定管理員
    admin_user = repo.get_firm_admin(firm.id)
    
    if admin_user:
        return LoginResponse(
            success=True,
            message="登入成功",
            firm_id=str(firm.id),
            has_admin=True,
            admin_user_id=str(admin_user.id)
        )
    else:
        return LoginResponse(
            success=True,
            message="請設定管理員",
            firm_id=str(firm.id),
            has_admin=False
        )

@router.post("/setup-admin", response_model=SetupAdminResponse)
async def setup_admin(
    request: SetupAdminRequest,
    db: Session = Depends(get_db)
):
    """設定事務所管理員"""
    repo = AuthRepository(db)
    
    # 檢查事務所是否存在
    firm = repo.db.query(repo.db.query(Firm).filter(Firm.id == request.firm_id).first())
    if not firm:
        raise HTTPException(status_code=404, detail="事務所不存在")
    
    # 檢查是否已有管理員
    existing_admin = repo.get_firm_admin(UUID(request.firm_id))
    if existing_admin:
        raise HTTPException(status_code=409, detail="管理員已存在")
    
    try:
        # 建立管理員用戶
        admin_user = repo.create_admin_user({
            "firm_id": UUID(request.firm_id),
            "full_name": request.admin_name,
            "email": request.admin_email,
            "phone": request.admin_phone,
            "role": "admin",
            "is_active": True
        })
        
        return SetupAdminResponse(
            success=True,
            message="管理員設定成功",
            admin_user_id=str(admin_user.id)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定管理員失敗: {str(e)}")
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.auth_repository import AuthRepository
from app.schemas import RegisterRequest, LoginRequest, AuthResponse
import re

router = APIRouter()

@router.post("/register", response_model=AuthResponse)
async def register_firm(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    """註冊事務所和管理員帳戶"""
    repo = AuthRepository(db)
    
    # 驗證事務所代碼格式（英數字、底線、連字號）
    if not re.match(r'^[A-Za-z0-9_-]+$', request.firm_code):
        raise HTTPException(
            status_code=422, 
            detail="事務所代碼僅允許英數字、底線與連字號"
        )
    
    # 驗證密碼強度（至少8碼，包含大小寫英文）
    if not re.match(r'^(?=.*[a-z])(?=.*[A-Z]).{8,}$', request.admin_password):
        raise HTTPException(
            status_code=422,
            detail="密碼需至少8碼，包含至少一個大寫和一個小寫英文字母"
        )
    
    # 檢查事務所代碼是否已存在
    if repo.check_firm_code_exists(request.firm_code):
        raise HTTPException(status_code=409, detail="事務所代碼已存在")
    
    # 檢查 email 是否已存在
    if repo.check_email_exists(request.admin_email):
        raise HTTPException(status_code=409, detail="Email 已被使用")
    
    try:
        # 建立事務所
        firm = repo.create_firm({
            "firm_name": request.firm_name,
            "firm_code": request.firm_code
        })
        
        # 建立管理員用戶
        user = repo.create_user({
            "firm_id": firm.id,
            "email": request.admin_email,
            "role": "admin",
            "is_active": True
        })
        
        # 建立本地認證
        repo.create_auth_local(user.id, request.admin_password)
        
        return AuthResponse(
            success=True,
            message="註冊成功",
            user_id=str(user.id),
            firm_id=str(firm.id)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"註冊失敗: {str(e)}")

@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """用戶登入"""
    repo = AuthRepository(db)
    
    # 根據 email 查找用戶
    user = repo.get_user_by_email(request.email)
    if not user:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    # 檢查用戶是否啟用
    if not user.is_active:
        raise HTTPException(status_code=401, detail="帳戶已被停用")
    
    # 驗證密碼
    if not repo.verify_password(user.id, request.password):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    return AuthResponse(
        success=True,
        message="登入成功",
        user_id=str(user.id),
        firm_id=str(user.firm_id)
    )
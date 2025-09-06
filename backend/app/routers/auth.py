from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.auth_repository import AuthRepository
from app.schemas import (
    RegisterRequest, LoginRequest,
    RegisterResponse, LoginResponse
)
import re
from uuid import UUID

router = APIRouter()

@router.post("/register", response_model=RegisterResponse)
async def register_firm(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    """註冊事務所"""
    repo = AuthRepository(db)
    
    # 驗證密碼一致性
    if request.password != request.confirm_password:
        raise HTTPException(status_code=422, detail="兩次輸入的密碼不一致")
    
    # 驗證帳號格式（英數字、底線、連字號）
    if not re.match(r'^[A-Za-z0-9_-]+$', request.account):
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
    if repo.check_account_exists(request.account):
        raise HTTPException(status_code=409, detail="帳號已存在")
    
    try:
        # 加密密碼
        password_hash = repo.hash_password(request.password)
        
        # 建立事務所
        firm = repo.create_firm({
            "firm_name": request.firm_name,
            "firm_code": request.account,
            "password_hash": password_hash
        })
        
        return RegisterResponse(
            success=True,
            message="事務所註冊成功，請登入系統"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"註冊失敗: {str(e)}")

@router.post("/login", response_model=LoginResponse)
async def login_firm(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    return LoginResponse(
        success=True,
        message="登入成功",
        firm_id=str(firm.id),
        has_plan=True,  # TODO: 實際檢查事務所是否有付費方案
        users=[]  # TODO: 取得事務所用戶列表
    )
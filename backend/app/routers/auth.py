from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.auth_repository import AuthRepository
from app.schemas import (
    RegisterRequest, LoginRequest,
    RegisterResponse, LoginResponse, UpdatePlanRequest, UpdatePlanResponse
)
import re
from uuid import UUID
from datetime import date, timedelta

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
        
        # 建立事務所（預設沒有方案）
        firm = repo.create_firm({
            "firm_name": request.firm_name,
            "firm_code": request.account,
            "password_hash": password_hash,
            "plan_type": "none",
            "has_paid_plan": False,
            "can_use_free_plan": False,
            "max_users": 1,
            "current_users": 0
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
    """事務所登入"""
    repo = AuthRepository(db)
    
    # 根據帳號查找事務所
    firm = repo.get_firm_by_account(request.account)
    if not firm:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    # 驗證事務所密碼
    if not repo.verify_firm_password(firm, request.password):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    # 檢查是否有可用方案（付費方案或免費方案通行證）
    has_plan = repo.check_firm_has_plan(firm)
    
    # 取得事務所用戶列表
    users = repo.get_firm_users(firm.id)
    
    return LoginResponse(
        success=True,
        message="登入成功",
        firm_id=str(firm.id),
        firm_name=firm.firm_name,
        has_plan=firm.has_paid_plan,  # 付費方案狀態
        plan_type=firm.plan_type,
        can_use_free_plan=firm.can_use_free_plan,  # 免費方案通行證
        max_users=firm.max_users,
        users=[{
            "id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active
        } for user in users]
    )

@router.post("/update-plan", response_model=UpdatePlanResponse)
async def update_firm_plan(
    request: UpdatePlanRequest,
    db: Session = Depends(get_db)
):
    """更新事務所方案"""
    repo = AuthRepository(db)
    
    # 檢查事務所是否存在
    firm = repo.get_firm_by_id(UUID(request.firm_id))
    if not firm:
        raise HTTPException(status_code=404, detail="事務所不存在")
    
    try:
        # 根據方案類型設定相關欄位
        plan_data = {
            "plan_type": request.plan_type,
            "has_paid_plan": request.plan_type != "basic",
            "can_use_free_plan": request.plan_type == "basic",
            "plan_start_date": date.today(),
            "plan_end_date": date.today() + timedelta(days=30)  # 30天試用
        }
        
        # 設定最大用戶數
        max_users_map = {
            "basic": 5,
            "advanced": 10,
            "premium": 20,
            "enterprise": 50
        }
        plan_data["max_users"] = max_users_map.get(request.plan_type, 1)
        
        updated_firm = repo.update_firm_plan(firm.id, plan_data)
        
        if not updated_firm:
            raise HTTPException(status_code=500, detail="更新方案失敗")
        
        return UpdatePlanResponse(
            success=True,
            message="方案更新成功",
            plan_type=updated_firm.plan_type,
            max_users=updated_firm.max_users
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新方案失敗: {str(e)}")

@router.post("/enable-free-plan/{firm_id}")
async def enable_free_plan(
    firm_id: str,
    db: Session = Depends(get_db)
):
    """啟用免費方案（管理員功能）"""
    repo = AuthRepository(db)
    
    # 檢查事務所是否存在
    firm = repo.get_firm_by_id(UUID(firm_id))
    if not firm:
        raise HTTPException(status_code=404, detail="事務所不存在")
    
    try:
        # 啟用免費方案
        plan_data = {
            "plan_type": "basic",
            "has_paid_plan": False,
            "can_use_free_plan": True,
            "max_users": 5,
            "plan_start_date": date.today(),
            "plan_end_date": date.today() + timedelta(days=365)  # 免費方案一年
        }
        
        updated_firm = repo.update_firm_plan(firm.id, plan_data)
        
        return {
            "success": True,
            "message": "免費方案已啟用",
            "plan_type": updated_firm.plan_type
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"啟用免費方案失敗: {str(e)}")
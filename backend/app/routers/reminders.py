from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.reminder_repository import ReminderRepository
from app.repositories.case_repository import CaseRepository
from app.schemas import ReminderCreate, ReminderUpdate, ReminderResponse
from typing import List
from uuid import UUID

router = APIRouter()

@router.get("/cases/{case_id}/reminders", response_model=List[ReminderResponse])
async def get_case_reminders(
    case_id: UUID,
    db: Session = Depends(get_db)
):
    """取得案件提醒列表"""
    # 檢查案件是否存在
    case_repo = CaseRepository(db)
    case = case_repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    reminder_repo = ReminderRepository(db)
    reminders = reminder_repo.get_case_reminders(case_id)
    
    return [ReminderResponse.model_validate(reminder) for reminder in reminders]

@router.post("/cases/{case_id}/reminders", response_model=ReminderResponse)
async def create_case_reminder(
    case_id: UUID,
    reminder_data: ReminderCreate,
    db: Session = Depends(get_db)
):
    """建立案件提醒"""
    # 檢查案件是否存在
    case_repo = CaseRepository(db)
    case = case_repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    reminder_repo = ReminderRepository(db)
    reminder_dict = reminder_data.model_dump()
    reminder_dict["case_id"] = case_id
    
    reminder = reminder_repo.create_reminder(reminder_dict)
    
    return ReminderResponse.model_validate(reminder)

@router.patch("/cases/{case_id}/reminders/{reminder_id}", response_model=ReminderResponse)
async def update_case_reminder(
    case_id: UUID,
    reminder_id: UUID,
    update_data: ReminderUpdate,
    db: Session = Depends(get_db)
):
    """更新案件提醒"""
    # 檢查案件是否存在
    case_repo = CaseRepository(db)
    case = case_repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    reminder_repo = ReminderRepository(db)
    
    # 只更新有提供的欄位
    update_dict = update_data.model_dump(exclude_unset=True)
    
    reminder = reminder_repo.update_reminder(reminder_id, update_dict)
    if not reminder:
        raise HTTPException(status_code=404, detail="提醒不存在")
    
    # 檢查提醒是否屬於該案件
    if reminder.case_id != case_id:
        raise HTTPException(status_code=400, detail="提醒不屬於該案件")
    
    return ReminderResponse.model_validate(reminder)
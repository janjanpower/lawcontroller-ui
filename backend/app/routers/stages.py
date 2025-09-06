from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.stage_repository import StageRepository
from app.repositories.case_repository import CaseRepository
from app.schemas import StageCreate, StageUpdate, StageResponse
from typing import List
from uuid import UUID

router = APIRouter()

@router.get("/cases/{case_id}/stages", response_model=List[StageResponse])
async def get_case_stages(
    case_id: UUID,
    db: Session = Depends(get_db)
):
    """取得案件階段列表"""
    # 檢查案件是否存在
    case_repo = CaseRepository(db)
    case = case_repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    stage_repo = StageRepository(db)
    stages = stage_repo.get_case_stages(case_id)
    
    return [StageResponse.model_validate(stage) for stage in stages]

@router.post("/cases/{case_id}/stages", response_model=StageResponse)
async def create_case_stage(
    case_id: UUID,
    stage_data: StageCreate,
    db: Session = Depends(get_db)
):
    """建立案件階段"""
    # 檢查案件是否存在
    case_repo = CaseRepository(db)
    case = case_repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    stage_repo = StageRepository(db)
    stage_dict = stage_data.model_dump()
    stage_dict["case_id"] = case_id
    
    stage = stage_repo.create_stage(stage_dict)
    
    return StageResponse.model_validate(stage)

@router.patch("/cases/{case_id}/stages/{stage_id}", response_model=StageResponse)
async def update_case_stage(
    case_id: UUID,
    stage_id: UUID,
    update_data: StageUpdate,
    db: Session = Depends(get_db)
):
    """更新案件階段"""
    # 檢查案件是否存在
    case_repo = CaseRepository(db)
    case = case_repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    stage_repo = StageRepository(db)
    
    # 只更新有提供的欄位
    update_dict = update_data.model_dump(exclude_unset=True)
    
    stage = stage_repo.update_stage(stage_id, update_dict)
    if not stage:
        raise HTTPException(status_code=404, detail="階段不存在")
    
    # 檢查階段是否屬於該案件
    if stage.case_id != case_id:
        raise HTTPException(status_code=400, detail="階段不屬於該案件")
    
    return StageResponse.model_validate(stage)
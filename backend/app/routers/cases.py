from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.case_repository import CaseRepository
from app.schemas import CaseCreate, CaseUpdate, CaseResponse, PaginatedResponse, FileResponse
from typing import Optional, List
from uuid import UUID

router = APIRouter()

@router.get("/cases", response_model=PaginatedResponse)
async def get_cases(
    firm_code: str = Query(..., description="事務所代碼"),
    status: str = Query("all", regex="^(open|closed|all)$", description="案件狀態"),
    keyword: Optional[str] = Query(None, description="搜尋關鍵字"),
    page: int = Query(1, ge=1, description="頁碼"),
    page_size: int = Query(20, ge=1, le=100, description="每頁筆數"),
    db: Session = Depends(get_db)
):
    """取得案件列表"""
    repo = CaseRepository(db)
    
    # 取得事務所
    firm = repo.get_firm_by_code(firm_code)
    if not firm:
        raise HTTPException(status_code=404, detail="事務所不存在")
    
    cases, total = repo.get_cases_paginated(firm.id, status, keyword, page, page_size)
    
    return PaginatedResponse(
        items=[CaseResponse.model_validate(case) for case in cases],
        total=total,
        page=page,
        page_size=page_size
    )

@router.post("/cases", response_model=CaseResponse)
async def create_case(
    case_data: CaseCreate,
    db: Session = Depends(get_db)
):
    """建立案件"""
    repo = CaseRepository(db)
    
    # 取得事務所
    firm = repo.get_firm_by_code(case_data.firm_code)
    if not firm:
        raise HTTPException(status_code=404, detail="事務所不存在")
    
    # 建立案件
    case_dict = case_data.model_dump(exclude={"firm_code"})
    case_dict["firm_id"] = firm.id
    
    case = repo.create_case(case_dict)
    
    return CaseResponse.model_validate(case)

@router.get("/cases/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: UUID,
    db: Session = Depends(get_db)
):
    """取得單一案件"""
    repo = CaseRepository(db)
    
    case = repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    return CaseResponse.model_validate(case)

@router.patch("/cases/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: UUID,
    update_data: CaseUpdate,
    db: Session = Depends(get_db)
):
    """更新案件"""
    repo = CaseRepository(db)
    
    # 只更新有提供的欄位
    update_dict = update_data.model_dump(exclude_unset=True)
    
    case = repo.update_case(case_id, update_dict)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    return CaseResponse.model_validate(case)

@router.get("/cases/{case_id}/files", response_model=List[FileResponse])
async def get_case_files(
    case_id: UUID,
    db: Session = Depends(get_db)
):
    """取得案件檔案列表"""
    repo = CaseRepository(db)
    
    # 檢查案件是否存在
    case = repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    files = repo.get_case_files(case_id)
    
    return [FileResponse.model_validate(file) for file in files]
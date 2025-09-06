from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories.client_repository import ClientRepository
from app.schemas import ClientCreate, ClientResponse, PaginatedResponse
from typing import Optional
from uuid import UUID

router = APIRouter()

@router.get("/clients", response_model=PaginatedResponse)
async def get_clients(
    firm_code: str = Query(..., description="事務所代碼"),
    query: Optional[str] = Query(None, description="搜尋關鍵字"),
    page: int = Query(1, ge=1, description="頁碼"),
    page_size: int = Query(20, ge=1, le=100, description="每頁筆數"),
    db: Session = Depends(get_db)
):
    """取得客戶列表"""
    repo = ClientRepository(db)
    
    # 取得事務所
    firm = repo.get_firm_by_code(firm_code)
    if not firm:
        raise HTTPException(status_code=404, detail="事務所不存在")
    
    clients, total = repo.get_clients_paginated(firm.id, query, page, page_size)
    
    return PaginatedResponse(
        items=[ClientResponse.model_validate(client) for client in clients],
        total=total,
        page=page,
        page_size=page_size
    )

@router.post("/clients", response_model=ClientResponse)
async def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db)
):
    """建立客戶"""
    repo = ClientRepository(db)
    
    # 取得事務所
    firm = repo.get_firm_by_code(client_data.firm_code)
    if not firm:
        raise HTTPException(status_code=404, detail="事務所不存在")
    
    # 檢查唯一性
    if not repo.check_client_uniqueness(firm.id, client_data.name, client_data.phone):
        raise HTTPException(status_code=409, detail="客戶已存在（相同姓名和電話）")
    
    # 建立客戶
    client_dict = client_data.model_dump(exclude={"firm_code"})
    client_dict["firm_id"] = firm.id
    
    client = repo.create_client(client_dict)
    
    return ClientResponse.model_validate(client)

@router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    db: Session = Depends(get_db)
):
    """取得單一客戶"""
    repo = ClientRepository(db)
    
    client = repo.get_client_by_id(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="客戶不存在")
    
    return ClientResponse.model_validate(client)
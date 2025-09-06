from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
from app.db import get_db
from app.repositories.case_repository import CaseRepository
from app.schemas import FilePresignRequest, FileConfirmRequest
from app.settings import settings
from uuid import UUID

router = APIRouter()

@router.post("/cases/{case_id}/files/presign")
async def presign_file_upload(
    case_id: UUID,
    request: FilePresignRequest,
    db: Session = Depends(get_db)
):
    """預簽名檔案上傳"""
    # 檢查案件是否存在
    case_repo = CaseRepository(db)
    case = case_repo.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    
    # 準備請求資料
    s3_request = {
        "case_id": str(case_id),
        "filename": request.filename,
        "folder_slug": request.folder_slug,
        "content_type": request.content_type
    }
    
    # 呼叫 S3 API 服務
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.s3_api_base}/api/files/presign",
                json=s3_request,
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"S3 服務錯誤: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"無法連接到檔案服務: {str(e)}")

@router.post("/files/confirm")
async def confirm_file_upload(request: FileConfirmRequest):
    """確認檔案上傳"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.s3_api_base}/api/files/confirm",
                json={"key": request.key},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"S3 服務錯誤: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"無法連接到檔案服務: {str(e)}")

@router.get("/files/{file_id}/download")
async def get_file_download_url(file_id: UUID):
    """取得檔案下載連結"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.s3_api_base}/api/files/{file_id}/download",
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(status_code=404, detail="檔案不存在")
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"S3 服務錯誤: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"無法連接到檔案服務: {str(e)}")
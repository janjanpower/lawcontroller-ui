from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID

# 基礎響應模型
class BaseResponse(BaseModel):
    detail: Optional[str] = None

class HealthResponse(BaseModel):
    ok: bool
    db: str

# 認證相關
class RegisterRequest(BaseModel):
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    account: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

class RegisterResponse(BaseModel):
    success: bool
    message: str
    firm_id: Optional[str] = None
    firm_name: Optional[str] = None
    has_plan: Optional[bool] = None
    plan_type: Optional[str] = None
    can_use_free_plan: Optional[bool] = None
    users: Optional[List[dict]] = None
# 分頁模型
class UpdatePlanRequest(BaseModel):
    firm_id: str
    plan_type: str = Field(..., regex="^(basic|advanced|premium|enterprise)$")
    payment_method: Optional[str] = None

class UpdatePlanResponse(BaseModel):
    success: bool
    message: str
    plan_type: Optional[str] = None
    max_users: Optional[int] = None

class PaginatedResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    page_size: int

# 客戶相關
class ClientCreate(BaseModel):
    firm_code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class ClientResponse(BaseModel):
    id: UUID
    firm_id: UUID
    name: str
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# 案件相關
class CaseCreate(BaseModel):
    firm_code: str
    client_id: Optional[UUID] = None
    case_type: Optional[str] = None
    case_reason: Optional[str] = None
    case_number: Optional[str] = None
    court: Optional[str] = None
    division: Optional[str] = None
    progress: Optional[str] = None

class CaseUpdate(BaseModel):
    progress: Optional[str] = None
    progress_date: Optional[date] = None
    is_closed: Optional[bool] = None
    closed_at: Optional[date] = None

class CaseResponse(BaseModel):
    id: UUID
    firm_id: UUID
    client_id: Optional[UUID]
    case_type: Optional[str]
    case_reason: Optional[str]
    case_number: Optional[str]
    court: Optional[str]
    division: Optional[str]
    progress: Optional[str]
    progress_date: Optional[date]
    lawyer_id: Optional[UUID]
    legal_affairs_id: Optional[UUID]
    is_closed: bool
    closed_at: Optional[date]
    created_at: datetime
    updated_at: datetime
    client: Optional[ClientResponse] = None

    class Config:
        from_attributes = True

# 案件階段相關
class StageCreate(BaseModel):
    name: str
    stage_date: Optional[date] = None
    completed: Optional[bool] = False
    sort_order: Optional[int] = 0

class StageUpdate(BaseModel):
    name: Optional[str] = None
    stage_date: Optional[date] = None
    completed: Optional[bool] = None
    sort_order: Optional[int] = None

class StageResponse(BaseModel):
    id: UUID
    case_id: UUID
    name: str
    stage_date: Optional[date]
    completed: bool
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True

# 提醒相關
class ReminderCreate(BaseModel):
    title: str
    due_date: date

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[date] = None
    is_done: Optional[bool] = None

class ReminderResponse(BaseModel):
    id: UUID
    case_id: UUID
    title: str
    due_date: date
    is_done: bool
    created_at: datetime

    class Config:
        from_attributes = True

# 檔案相關
class FilePresignRequest(BaseModel):
    filename: str
    folder_slug: Optional[str] = None
    content_type: Optional[str] = None

class FileConfirmRequest(BaseModel):
    key: str

class FileResponse(BaseModel):
    id: UUID
    name: str
    size_bytes: Optional[int]
    status: Optional[str]
    s3_key: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
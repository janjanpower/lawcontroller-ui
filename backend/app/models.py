from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, BigInteger, Text, UUID, ForeignKey, DECIMAL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class Firm(Base):
    __tablename__ = "firms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_code = Column(String, unique=True, nullable=False)
    firm_name = Column(String, nullable=False)
    password_hash = Column(Text, nullable=False)  # 事務所登入密碼
    plan_type = Column(String, default='none')  # 'none', 'basic', 'advanced', 'premium', 'enterprise'
    has_paid_plan = Column(Boolean, default=False)  # 是否有付費方案
    can_use_free_plan = Column(Boolean, default=False)  # 是否可使用免費方案
    max_users = Column(Integer, default=1)  # 最大用戶數
    current_users = Column(Integer, default=0)  # 當前用戶數
    plan_start_date = Column(Date, nullable=True)  # 方案開始日期
    plan_end_date = Column(Date, nullable=True)  # 方案結束日期
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    username = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 一對一關聯到 AuthLocal
    auth_local = relationship("AuthLocal", back_populates="user", uselist=False)

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Case(Base):
    __tablename__ = "cases"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    case_type = Column(String, nullable=True)
    case_reason = Column(Text, nullable=True)
    case_number = Column(String, nullable=True)
    court = Column(String, nullable=True)
    division = Column(String, nullable=True)
    progress = Column(String, nullable=True)
    progress_date = Column(Date, nullable=True)
    lawyer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    legal_affairs_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_closed = Column(Boolean, default=False)
    closed_at = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 關聯
    client = relationship("Client")
    lawyer = relationship("User", foreign_keys=[lawyer_id])
    legal_affairs = relationship("User", foreign_keys=[legal_affairs_id])

class CaseStage(Base):
    __tablename__ = "case_stages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    name = Column(String, nullable=False)
    stage_date = Column(Date, nullable=True)
    completed = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class CaseReminder(Base):
    __tablename__ = "case_reminders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    title = Column(String, nullable=False)
    due_date = Column(Date, nullable=False)
    is_done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class CaseFolder(Base):
    __tablename__ = "case_folders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False)
    path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class CaseFile(Base):
    __tablename__ = "case_files"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    folder_id = Column(UUID(as_uuid=True), ForeignKey("case_folders.id"), nullable=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=True)
    bucket = Column(String, nullable=True)
    s3_key = Column(String, nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    content_type = Column(String, nullable=True)
    status = Column(String, nullable=True)
    storage_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String, nullable=False)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuthLocal(Base):
    __tablename__ = "auth_local"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # 一對一關聯到 User
    user = relationship("User", back_populates="auth_local")
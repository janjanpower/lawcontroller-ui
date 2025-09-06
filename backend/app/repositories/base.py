from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import AuditLog
from typing import Optional, Dict, Any
import json

class BaseRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def log_action(self, action: str, details: Optional[Dict[Any, Any]] = None, actor_id: Optional[str] = None):
        """記錄操作日誌"""
        audit_log = AuditLog(
            actor_id=actor_id,
            action=action,
            details=details
        )
        self.db.add(audit_log)
        self.db.commit()
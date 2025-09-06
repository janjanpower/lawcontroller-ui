from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import CaseReminder
from app.repositories.base import BaseRepository
from typing import List, Optional
from uuid import UUID

class ReminderRepository(BaseRepository):
    def get_case_reminders(self, case_id: UUID) -> List[CaseReminder]:
        """取得案件提醒列表"""
        return self.db.query(CaseReminder).filter(
            CaseReminder.case_id == case_id
        ).order_by(CaseReminder.due_date, desc(CaseReminder.created_at)).all()
    
    def create_reminder(self, reminder_data: dict) -> CaseReminder:
        """建立案件提醒"""
        reminder = CaseReminder(**reminder_data)
        self.db.add(reminder)
        self.db.commit()
        self.db.refresh(reminder)
        
        # 記錄操作日誌
        self.log_action("CREATE_REMINDER", {"reminder_id": str(reminder.id), "case_id": str(reminder.case_id), "title": reminder.title})
        
        return reminder
    
    def get_reminder_by_id(self, reminder_id: UUID) -> Optional[CaseReminder]:
        """根據ID取得提醒"""
        return self.db.query(CaseReminder).filter(CaseReminder.id == reminder_id).first()
    
    def update_reminder(self, reminder_id: UUID, update_data: dict) -> Optional[CaseReminder]:
        """更新提醒"""
        reminder = self.get_reminder_by_id(reminder_id)
        if not reminder:
            return None
        
        for key, value in update_data.items():
            if hasattr(reminder, key) and value is not None:
                setattr(reminder, key, value)
        
        self.db.commit()
        self.db.refresh(reminder)
        
        # 記錄操作日誌
        self.log_action("UPDATE_REMINDER", {"reminder_id": str(reminder.id), "updates": update_data})
        
        return reminder
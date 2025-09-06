from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import CaseStage
from app.repositories.base import BaseRepository
from typing import List, Optional
from uuid import UUID

class StageRepository(BaseRepository):
    def get_case_stages(self, case_id: UUID) -> List[CaseStage]:
        """取得案件階段列表"""
        return self.db.query(CaseStage).filter(
            CaseStage.case_id == case_id
        ).order_by(CaseStage.sort_order, CaseStage.created_at).all()
    
    def create_stage(self, stage_data: dict) -> CaseStage:
        """建立案件階段"""
        stage = CaseStage(**stage_data)
        self.db.add(stage)
        self.db.commit()
        self.db.refresh(stage)
        
        # 記錄操作日誌
        self.log_action("CREATE_STAGE", {"stage_id": str(stage.id), "case_id": str(stage.case_id), "name": stage.name})
        
        return stage
    
    def get_stage_by_id(self, stage_id: UUID) -> Optional[CaseStage]:
        """根據ID取得階段"""
        return self.db.query(CaseStage).filter(CaseStage.id == stage_id).first()
    
    def update_stage(self, stage_id: UUID, update_data: dict) -> Optional[CaseStage]:
        """更新階段"""
        stage = self.get_stage_by_id(stage_id)
        if not stage:
            return None
        
        for key, value in update_data.items():
            if hasattr(stage, key) and value is not None:
                setattr(stage, key, value)
        
        self.db.commit()
        self.db.refresh(stage)
        
        # 記錄操作日誌
        self.log_action("UPDATE_STAGE", {"stage_id": str(stage.id), "updates": update_data})
        
        return stage
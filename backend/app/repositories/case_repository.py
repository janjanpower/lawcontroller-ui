from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc
from app.models import Case, Client, CaseStage, CaseReminder, CaseFile, Firm
from app.repositories.base import BaseRepository
from typing import Optional, List, Tuple
from uuid import UUID

class CaseRepository(BaseRepository):
    def get_cases_paginated(
        self,
        firm_id: UUID,
        status: str = "all",
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Case], int]:
        """分頁取得案件列表"""
        base_query = self.db.query(Case).options(joinedload(Case.client)).filter(Case.firm_id == firm_id)
        
        # 狀態篩選
        if status == "open":
            base_query = base_query.filter(Case.is_closed == False)
        elif status == "closed":
            base_query = base_query.filter(Case.is_closed == True)
        
        # 關鍵字搜尋
        if keyword:
            search_filter = or_(
                Case.case_number.ilike(f"%{keyword}%"),
                Case.case_reason.ilike(f"%{keyword}%"),
                Client.name.ilike(f"%{keyword}%")
            )
            base_query = base_query.join(Client, Case.client_id == Client.id, isouter=True).filter(search_filter)
        
        total = base_query.count()
        cases = base_query.order_by(desc(Case.created_at)).offset((page - 1) * page_size).limit(page_size).all()
        
        return cases, total
    
    def create_case(self, case_data: dict) -> Case:
        """建立案件"""
        case = Case(**case_data)
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        
        # 記錄操作日誌
        self.log_action("CREATE_CASE", {"case_id": str(case.id), "case_number": case.case_number})
        
        return case
    
    def get_case_by_id(self, case_id: UUID) -> Optional[Case]:
        """根據ID取得案件"""
        return self.db.query(Case).options(joinedload(Case.client)).filter(Case.id == case_id).first()
    
    def update_case(self, case_id: UUID, update_data: dict) -> Optional[Case]:
        """更新案件"""
        case = self.get_case_by_id(case_id)
        if not case:
            return None
        
        for key, value in update_data.items():
            if hasattr(case, key) and value is not None:
                setattr(case, key, value)
        
        self.db.commit()
        self.db.refresh(case)
        
        # 記錄操作日誌
        self.log_action("UPDATE_CASE", {"case_id": str(case.id), "updates": update_data})
        
        return case
    
    def get_case_files(self, case_id: UUID) -> List[CaseFile]:
        """取得案件檔案列表"""
        return self.db.query(CaseFile).filter(CaseFile.case_id == case_id).order_by(desc(CaseFile.created_at)).all()
    
    def get_firm_by_code(self, firm_code: str) -> Optional[Firm]:
        """根據事務所代碼取得事務所"""
        return self.db.query(Firm).filter(Firm.firm_code == firm_code).first()
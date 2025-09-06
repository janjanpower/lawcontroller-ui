from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from app.models import Client, Firm
from app.repositories.base import BaseRepository
from typing import Optional, List, Tuple
from uuid import UUID

class ClientRepository(BaseRepository):
    def get_firm_by_code(self, firm_code: str) -> Optional[Firm]:
        """根據事務所代碼取得事務所"""
        return self.db.query(Firm).filter(Firm.firm_code == firm_code).first()
    
    def get_clients_paginated(
        self, 
        firm_id: UUID, 
        query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Client], int]:
        """分頁取得客戶列表"""
        base_query = self.db.query(Client).filter(Client.firm_id == firm_id)
        
        if query:
            search_filter = or_(
                Client.name.ilike(f"%{query}%"),
                Client.phone.ilike(f"%{query}%")
            )
            base_query = base_query.filter(search_filter)
        
        total = base_query.count()
        
        clients = base_query.offset((page - 1) * page_size).limit(page_size).all()
        
        return clients, total
    
    def create_client(self, client_data: dict) -> Client:
        """建立客戶"""
        client = Client(**client_data)
        self.db.add(client)
        self.db.commit()
        self.db.refresh(client)
        
        # 記錄操作日誌
        self.log_action("CREATE_CLIENT", {"client_id": str(client.id), "name": client.name})
        
        return client
    
    def get_client_by_id(self, client_id: UUID) -> Optional[Client]:
        """根據ID取得客戶"""
        return self.db.query(Client).filter(Client.id == client_id).first()
    
    def check_client_uniqueness(self, firm_id: UUID, name: str, phone: Optional[str]) -> bool:
        """檢查客戶唯一性 (firm_id, name, COALESCE(phone,''))"""
        phone_value = phone or ''
        existing = self.db.query(Client).filter(
            and_(
                Client.firm_id == firm_id,
                Client.name == name,
                func.coalesce(Client.phone, '') == phone_value
            )
        ).first()
        return existing is None
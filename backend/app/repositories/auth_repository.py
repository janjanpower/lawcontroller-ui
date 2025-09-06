from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models import Firm, User, AuthLocal
from app.repositories.base import BaseRepository
from typing import Optional
from uuid import UUID
import bcrypt

class AuthRepository(BaseRepository):
    def get_firm_by_username(self, username: str) -> Optional[Firm]:
        """根據帳號取得事務所"""
        return self.db.query(Firm).filter(Firm.firm_code == username).first()
    
    def create_firm(self, firm_data: dict) -> Firm:
        """建立事務所（包含密碼）"""
        firm = Firm(**firm_data)
        self.db.add(firm)
        self.db.commit()
        self.db.refresh(firm)
        
        # 記錄操作日誌
        self.log_action("CREATE_FIRM", {"firm_id": str(firm.id), "firm_name": firm.firm_name})
        
        return firm
    
    def verify_firm_password(self, firm: Firm, password: str) -> bool:
        """驗證事務所密碼"""
        return bcrypt.checkpw(password.encode('utf-8'), firm.password_hash.encode('utf-8'))
    
    def get_firm_admin(self, firm_id: UUID) -> Optional[User]:
        """取得事務所管理員"""
        return self.db.query(User).filter(
            User.firm_id == firm_id,
            User.role == 'admin',
            User.is_active == True
        ).first()
    
    def create_admin_user(self, user_data: dict) -> User:
        """建立管理員用戶"""
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        # 記錄操作日誌
        self.log_action("CREATE_ADMIN", {"user_id": str(user.id), "firm_id": str(user.firm_id)})
        
        return user
    
    def check_username_exists(self, username: str) -> bool:
        """檢查帳號是否已存在"""
        return self.db.query(Firm).filter(Firm.firm_code == username).first() is not None
    
    def hash_password(self, password: str) -> str:
        """加密密碼"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
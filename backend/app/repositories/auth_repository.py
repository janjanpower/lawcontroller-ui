from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models import Firm, User, AuthLocal
from app.repositories.base import BaseRepository
from typing import Optional
from uuid import UUID
import bcrypt

class AuthRepository(BaseRepository):
    def get_firm_by_code(self, firm_code: str) -> Optional[Firm]:
        """根據事務所代碼取得事務所"""
        return self.db.query(Firm).filter(Firm.firm_code == firm_code).first()
    
    def create_firm(self, firm_data: dict) -> Firm:
        """建立事務所"""
        firm = Firm(**firm_data)
        self.db.add(firm)
        self.db.commit()
        self.db.refresh(firm)
        
        # 記錄操作日誌
        self.log_action("CREATE_FIRM", {"firm_id": str(firm.id), "firm_name": firm.firm_name})
        
        return firm
    
    def create_user(self, user_data: dict) -> User:
        """建立用戶"""
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        # 記錄操作日誌
        self.log_action("CREATE_USER", {"user_id": str(user.id), "email": user.email})
        
        return user
    
    def create_auth_local(self, user_id: UUID, password: str) -> AuthLocal:
        """建立本地認證記錄"""
        # 加密密碼
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        auth_local = AuthLocal(
            user_id=user_id,
            password_hash=password_hash
        )
        self.db.add(auth_local)
        self.db.commit()
        self.db.refresh(auth_local)
        
        return auth_local
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """根據 email 取得用戶"""
        return self.db.query(User).filter(User.email == email).first()
    
    def verify_password(self, user_id: UUID, password: str) -> bool:
        """驗證密碼"""
        auth_local = self.db.query(AuthLocal).filter(AuthLocal.user_id == user_id).first()
        if not auth_local:
            return False
        
        return bcrypt.checkpw(password.encode('utf-8'), auth_local.password_hash.encode('utf-8'))
    
    def check_firm_code_exists(self, firm_code: str) -> bool:
        """檢查事務所代碼是否已存在"""
        return self.db.query(Firm).filter(Firm.firm_code == firm_code).first() is not None
    
    def check_email_exists(self, email: str) -> bool:
        """檢查 email 是否已存在"""
        return self.db.query(User).filter(User.email == email).first() is not None
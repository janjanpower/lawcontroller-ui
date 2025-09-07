from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models import Firm, User, AuthLocal
from app.repositories.base import BaseRepository
from typing import Optional
from uuid import UUID
import bcrypt

class AuthRepository(BaseRepository):
    def get_firm_by_account(self, account: str) -> Optional[Firm]:
        """根據帳號取得事務所"""
        return self.db.query(Firm).filter(Firm.firm_code == account).first()
    
    def update_firm_plan(self, firm_id: UUID, plan_data: dict) -> Optional[Firm]:
        """更新事務所方案"""
        firm = self.db.query(Firm).filter(Firm.id == firm_id).first()
        if not firm:
            return None
        
        for key, value in plan_data.items():
            if hasattr(firm, key):
                setattr(firm, key, value)
        
        self.db.commit()
        self.db.refresh(firm)
        
        # 記錄操作日誌
        self.log_action("UPDATE_FIRM_PLAN", {"firm_id": str(firm.id), "plan_data": plan_data})
        
        return firm
    
    def check_firm_has_plan(self, firm: Firm) -> bool:
        """檢查事務所是否有可用方案（付費方案或免費方案通行證）"""
        return firm.has_paid_plan or firm.can_use_free_plan
    
    def get_firm_users(self, firm_id: UUID) -> List[User]:
        """取得事務所用戶列表"""
        return self.db.query(User).filter(
            User.firm_id == firm_id,
            User.is_active == True
        ).all()
    
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
    
    def get_firm_by_id(self, firm_id: UUID) -> Optional[Firm]:
        """根據ID取得事務所"""
        return self.db.query(Firm).filter(Firm.id == firm_id).first()
    
    def create_admin_user(self, user_data: dict) -> User:
        """建立管理員用戶（包含密碼存儲到 auth_local）"""
        # 提取密碼，其餘資料建立 User
        password = user_data.pop('password', None)
        
        user = User(**user_data)
        self.db.add(user)
        self.db.flush()  # 取得 user.id
        
        # 如果有密碼，建立 AuthLocal 記錄
        if password:
            password_hash = self.hash_password(password)
            auth_local = AuthLocal(
                user_id=user.id,
                password_hash=password_hash
            )
            self.db.add(auth_local)
        
        self.db.commit()
        self.db.refresh(user)
        
        # 記錄操作日誌
        self.log_action("CREATE_ADMIN", {"user_id": str(user.id), "firm_id": str(user.firm_id)})
        
        return user
    
    def verify_user_password(self, user: User, password: str) -> bool:
        """驗證用戶密碼（從 auth_local 表）"""
        if not user.auth_local:
            return False
        return bcrypt.checkpw(password.encode('utf-8'), user.auth_local.password_hash.encode('utf-8'))
    
    def get_user_with_auth(self, firm_id: UUID, username: str) -> Optional[User]:
        """取得用戶及其認證資訊"""
        return (
            self.db.query(User)
            .join(AuthLocal)
            .filter(
                User.firm_id == firm_id,
                User.username == username,
                User.is_active == True
            )
            .first()
        )
    
    def check_account_exists(self, account: str) -> bool:
        """檢查帳號是否已存在"""
        return self.db.query(Firm).filter(Firm.firm_code == account).first() is not None
    
    def hash_password(self, password: str) -> str:
        """加密密碼"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def update_user_password(self, user_id: UUID, new_password: str) -> bool:
        """更新用戶密碼（更新 auth_local 表）"""
        try:
            password_hash = self.hash_password(new_password)
            
            # 查找或建立 AuthLocal 記錄
            auth_local = self.db.query(AuthLocal).filter(AuthLocal.user_id == user_id).first()
            
            if auth_local:
                auth_local.password_hash = password_hash
            else:
                auth_local = AuthLocal(
                    user_id=user_id,
                    password_hash=password_hash
                )
                self.db.add(auth_local)
            
            self.db.commit()
            
            # 記錄操作日誌
            self.log_action("UPDATE_PASSWORD", {"user_id": str(user_id)})
            
            return True
        except Exception as e:
            self.db.rollback()
            return False
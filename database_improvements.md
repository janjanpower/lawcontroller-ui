# 資料庫改進方案

## 需要新增的欄位

### 1. clients 表新增欄位
```sql
-- 客戶身份證號或統編（用於唯一識別）
ALTER TABLE clients ADD COLUMN id_number VARCHAR(20);

-- 客戶生日（輔助識別）
ALTER TABLE clients ADD COLUMN birth_date DATE;

-- 客戶類型（個人/公司）
ALTER TABLE clients ADD COLUMN client_type VARCHAR(20) DEFAULT 'individual';

-- 建立複合唯一索引（事務所內客戶唯一性）
CREATE UNIQUE INDEX idx_clients_unique_identity 
ON clients (firm_id, name, COALESCE(id_number, ''), COALESCE(phone, ''));
```

### 2. cases 表新增欄位
```sql
-- 案件狀態更詳細的追蹤
ALTER TABLE cases ADD COLUMN case_status VARCHAR(50) DEFAULT 'active';

-- 案件建立者
ALTER TABLE cases ADD COLUMN created_by_user_id UUID REFERENCES users(id);

-- 案件最後修改者
ALTER TABLE cases ADD COLUMN updated_by_user_id UUID REFERENCES users(id);
```

### 3. 新增 case_folders 表（如果不存在）
```sql
CREATE TABLE IF NOT EXISTS case_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    folder_name VARCHAR(255) NOT NULL,
    folder_path VARCHAR(500) NOT NULL,
    folder_type VARCHAR(50) DEFAULT 'custom', -- 'default', 'stage', 'custom'
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_user_id UUID REFERENCES users(id)
);

-- 建立索引
CREATE INDEX idx_case_folders_case_id ON case_folders(case_id);
```

## 改進的業務邏輯

### 1. 客戶唯一性檢查
- 在同一事務所內，客戶的唯一性由 `(firm_id, name, id_number, phone)` 組合決定
- 如果沒有身份證號，則用 `(firm_id, name, phone, birth_date)` 組合

### 2. 案件權限控制
- 用戶只能查看自己事務所的案件
- 客戶只能查看與自己相關的案件（通過 client_id 關聯）

### 3. 預設資料夾自動建立
- 新建案件時自動建立：狀紙、案件資訊、案件進度
- 新增階段時自動在「案件進度」下建立對應資料夾

## 前端改進

### 1. 客戶選擇改進
- 新增客戶時要求填寫身份證號或統編
- 顯示客戶列表時顯示更多識別資訊

### 2. 案件列表改進
- 只顯示當前事務所的案件
- 加強客戶身份顯示

### 3. 權限控制
- 前端路由加入事務所驗證
- API 請求都要帶上 firm_code 參數
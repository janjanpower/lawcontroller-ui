-- 法律案件管理系統資料庫模型
-- 版本: 1.0
-- 建立日期: 2024-01-01

-- ================================
-- 1. 事務所管理
-- ================================

-- 法律事務所表
CREATE TABLE law_firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_name VARCHAR(255) NOT NULL,
    firm_code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    tax_id VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- 事務所用戶表（律師、法務等）
CREATE TABLE firm_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'lawyer', 'legal_affairs', 'assistant')),
    email VARCHAR(255),
    phone VARCHAR(20),
    employee_id VARCHAR(50),
    department VARCHAR(100),
    position VARCHAR(100),
    hire_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(firm_id, username),
    UNIQUE(firm_id, employee_id)
);

-- ================================
-- 2. 客戶管理
-- ================================

-- 客戶表
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
    customer_code VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    id_number VARCHAR(20),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    occupation VARCHAR(100),
    company VARCHAR(255),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    line_user_id VARCHAR(100),
    line_display_name VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    
    UNIQUE(firm_id, customer_code),
    UNIQUE(firm_id, id_number),
    UNIQUE(line_user_id)
);

-- 客戶驗證表（LINE Bot 註冊用）
CREATE TABLE customer_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
    line_user_id VARCHAR(100) NOT NULL,
    verification_code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES firm_users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
    
    UNIQUE(verification_code)
);

-- ================================
-- 3. 案件管理
-- ================================

-- 案件表
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    case_id VARCHAR(50) NOT NULL,
    case_number VARCHAR(100),
    case_type VARCHAR(20) NOT NULL CHECK (case_type IN ('民事', '刑事', '行政', '家事', '商事', '其他')),
    case_reason TEXT,
    case_description TEXT,
    opposing_party TEXT,
    court VARCHAR(255),
    division VARCHAR(100),
    judge_name VARCHAR(100),
    lawyer_id UUID REFERENCES firm_users(id),
    legal_affairs_id UUID REFERENCES firm_users(id),
    assistant_id UUID REFERENCES firm_users(id),
    current_stage VARCHAR(100) DEFAULT '委任',
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'completed', 'closed', 'suspended')),
    start_date DATE,
    expected_end_date DATE,
    actual_end_date DATE,
    fee_amount DECIMAL(12,2),
    fee_currency VARCHAR(3) DEFAULT 'TWD',
    fee_status VARCHAR(20) DEFAULT 'pending' CHECK (fee_status IN ('pending', 'partial', 'paid', 'overdue')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES firm_users(id),
    notes TEXT,
    
    UNIQUE(firm_id, case_id)
);

-- 案件階段表
CREATE TABLE case_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    stage_description TEXT,
    stage_date DATE NOT NULL,
    stage_time TIME,
    expected_date DATE,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES firm_users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES firm_users(id),
    
    UNIQUE(case_id, stage_name, stage_date)
);

-- 案件標籤表
CREATE TABLE case_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    tag_color VARCHAR(7) DEFAULT '#3498db',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(firm_id, tag_name)
);

-- 案件標籤關聯表
CREATE TABLE case_tag_relations (
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES case_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (case_id, tag_id)
);

-- ================================
-- 4. 檔案管理
-- ================================

-- 案件資料夾表
CREATE TABLE case_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES case_folders(id) ON DELETE CASCADE,
    folder_name VARCHAR(255) NOT NULL,
    folder_path TEXT NOT NULL,
    folder_type VARCHAR(20) DEFAULT 'custom' CHECK (folder_type IN ('default', 'custom', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES firm_users(id),
    
    UNIQUE(case_id, folder_path)
);

-- 案件檔案表
CREATE TABLE case_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES case_folders(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100),
    mime_type VARCHAR(100),
    file_hash VARCHAR(64),
    storage_type VARCHAR(20) DEFAULT 's3' CHECK (storage_type IN ('local', 's3', 'azure', 'gcp')),
    storage_url TEXT,
    is_public BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_by UUID REFERENCES firm_users(id),
    description TEXT,
    tags TEXT[],
    
    UNIQUE(case_id, file_path)
);

-- 檔案版本表
CREATE TABLE file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64),
    storage_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES firm_users(id),
    change_notes TEXT,
    
    UNIQUE(file_id, version_number)
);

-- ================================
-- 5. LINE Bot 整合
-- ================================

-- LINE 訊息記錄表
CREATE TABLE line_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    line_user_id VARCHAR(100) NOT NULL,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file', 'location', 'sticker')),
    message_content TEXT,
    message_data JSONB,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    line_message_id VARCHAR(100),
    reply_token VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES firm_users(id),
    status VARCHAR(20) DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed')),
    
    INDEX idx_line_messages_user_time (line_user_id, created_at),
    INDEX idx_line_messages_customer_time (customer_id, created_at)
);

-- LINE Bot 設定表
CREATE TABLE line_bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
    channel_access_token TEXT NOT NULL,
    channel_secret VARCHAR(100) NOT NULL,
    webhook_url TEXT,
    auto_reply_enabled BOOLEAN DEFAULT true,
    welcome_message TEXT,
    business_hours_start TIME DEFAULT '09:00',
    business_hours_end TIME DEFAULT '18:00',
    business_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 1=Monday, 7=Sunday
    out_of_hours_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(firm_id)
);

-- ================================
-- 6. 系統設定與日誌
-- ================================

-- 系統設定表
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID REFERENCES law_firms(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES firm_users(id),
    
    UNIQUE(firm_id, setting_key)
);

-- 操作日誌表
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID REFERENCES law_firms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES firm_users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_audit_logs_firm_time (firm_id, created_at),
    INDEX idx_audit_logs_user_time (user_id, created_at),
    INDEX idx_audit_logs_resource (resource_type, resource_id)
);

-- ================================
-- 7. 索引優化
-- ================================

-- 案件相關索引
CREATE INDEX idx_cases_firm_status ON cases(firm_id, status);
CREATE INDEX idx_cases_customer ON cases(customer_id);
CREATE INDEX idx_cases_lawyer ON cases(lawyer_id);
CREATE INDEX idx_cases_created_at ON cases(created_at);
CREATE INDEX idx_cases_current_stage ON cases(current_stage);

-- 客戶相關索引
CREATE INDEX idx_customers_firm_status ON customers(firm_id, status);
CREATE INDEX idx_customers_line_user ON customers(line_user_id);
CREATE INDEX idx_customers_name ON customers(name);

-- 檔案相關索引
CREATE INDEX idx_case_files_case ON case_files(case_id);
CREATE INDEX idx_case_files_folder ON case_files(folder_id);
CREATE INDEX idx_case_files_uploaded_at ON case_files(uploaded_at);

-- 階段相關索引
CREATE INDEX idx_case_stages_case ON case_stages(case_id);
CREATE INDEX idx_case_stages_date ON case_stages(stage_date);

-- ================================
-- 8. 觸發器和函數
-- ================================

-- 更新 updated_at 欄位的函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 為需要的表格建立觸發器
CREATE TRIGGER update_law_firms_updated_at BEFORE UPDATE ON law_firms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_firm_users_updated_at BEFORE UPDATE ON firm_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_line_bot_settings_updated_at BEFORE UPDATE ON line_bot_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- 9. 初始資料
-- ================================

-- 建立測試事務所
INSERT INTO law_firms (firm_name, firm_code, address, phone, email) VALUES 
('測試法律事務所', 'TEST_LAW_FIRM', '台北市中正區重慶南路一段122號', '02-2388-1234', 'info@testlaw.com.tw');

-- 建立管理員帳戶
INSERT INTO firm_users (firm_id, username, password_hash, full_name, role, email) VALUES 
((SELECT id FROM law_firms WHERE firm_code = 'TEST_LAW_FIRM'), 
 'admin', 
 '$2b$10$rQZ8kHWKQVnqVQZ8kHWKQVnqVQZ8kHWKQVnqVQZ8kHWKQVnqVQZ8k', -- 密碼: admin123
 '系統管理員', 
 'admin', 
 'admin@testlaw.com.tw');

-- 建立預設案件標籤
INSERT INTO case_tags (firm_id, tag_name, tag_color) VALUES 
((SELECT id FROM law_firms WHERE firm_code = 'TEST_LAW_FIRM'), '緊急', '#e74c3c'),
((SELECT id FROM law_firms WHERE firm_code = 'TEST_LAW_FIRM'), '重要', '#f39c12'),
((SELECT id FROM law_firms WHERE firm_code = 'TEST_LAW_FIRM'), '一般', '#3498db'),
((SELECT id FROM law_firms WHERE firm_code = 'TEST_LAW_FIRM'), '低優先', '#95a5a6');

-- ================================
-- 10. 權限設定
-- ================================

-- 建立角色
CREATE ROLE law_app_user;
CREATE ROLE law_app_admin;

-- 授予基本權限
GRANT CONNECT ON DATABASE law_management_system TO law_app_user;
GRANT USAGE ON SCHEMA public TO law_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO law_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO law_app_user;

-- 授予管理員權限
GRANT law_app_user TO law_app_admin;
GRANT CREATE ON SCHEMA public TO law_app_admin;

-- 註解
COMMENT ON DATABASE law_management_system IS '法律案件管理系統資料庫';
COMMENT ON TABLE law_firms IS '法律事務所基本資料表';
COMMENT ON TABLE firm_users IS '事務所用戶表，包含律師、法務等角色';
COMMENT ON TABLE customers IS '客戶基本資料表';
COMMENT ON TABLE cases IS '案件主表';
COMMENT ON TABLE case_stages IS '案件進度階段表';
COMMENT ON TABLE case_files IS '案件相關檔案表';
COMMENT ON TABLE line_messages IS 'LINE Bot 訊息記錄表';
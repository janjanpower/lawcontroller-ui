/*
# 客戶身份識別改進

1. 新增欄位
   - `id_number` (系統生成的客戶編號)

2. 建立唯一性約束
   - 確保同事務所內客戶身份唯一 (firm_id, name, id_number)

3. 案件追蹤改進
   - 新增建立者和修改者追蹤
*/

-- 新增客戶編號欄位（系統自動生成）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_number VARCHAR(20);

-- 新增案件追蹤欄位
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by_user_id UUID;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS updated_by_user_id UUID;

-- 新增外鍵約束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_cases_created_by_user'
    ) THEN
        ALTER TABLE cases ADD CONSTRAINT fk_cases_created_by_user 
        FOREIGN KEY (created_by_user_id) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_cases_updated_by_user'
    ) THEN
        ALTER TABLE cases ADD CONSTRAINT fk_cases_updated_by_user 
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id);
    END IF;
END $$;

-- 建立客戶唯一性索引
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_clients_unique_identity'
    ) THEN
        CREATE UNIQUE INDEX idx_clients_unique_identity 
        ON clients (firm_id, name, id_number);
    END IF;
END $$;

-- 建立案例資料夾表
CREATE TABLE IF NOT EXISTS case_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    folder_path VARCHAR(500) NOT NULL,
    folder_type VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_user_id UUID,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- 建立案例資料夾索引
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_case_folders_case_id'
    ) THEN
        CREATE INDEX idx_case_folders_case_id ON case_folders(case_id);
    END IF;
END $$;

-- 為現有客戶生成 id_number（如果為空）
DO $$
DECLARE
    firm_record RECORD;
    client_record RECORD;
    counter INTEGER;
BEGIN
    -- 為每個事務所的客戶生成編號
    FOR firm_record IN SELECT id, firm_code FROM firms LOOP
        counter := 1;
        
        FOR client_record IN 
            SELECT id FROM clients 
            WHERE firm_id = firm_record.id AND (id_number IS NULL OR id_number = '')
            ORDER BY created_at
        LOOP
            UPDATE clients 
            SET id_number = firm_record.firm_code || '_' || LPAD(counter::text, 3, '0')
            WHERE id = client_record.id;
            
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- 設定 id_number 為 NOT NULL（在生成完現有資料後）
ALTER TABLE clients ALTER COLUMN id_number SET NOT NULL;
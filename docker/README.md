# 法律案件管理系統 Docker 部署

這是一個完整的法律案件管理系統，包含 Web 前端、API 後端、PostgreSQL 資料庫和 LINE Bot 服務。

## 系統架構

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   LINE Bot      │    │   Nginx Proxy   │
│   (React)       │    │   (Node.js)     │    │   (Optional)    │
│   Port: 5173    │    │   Port: 3001    │    │   Port: 80/443  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Server    │
                    │   (Node.js)     │
                    │   Port: 3000    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐    ┌─────────────────┐
                    │   PostgreSQL    │    │   AWS S3        │
                    │   Port: 5432    │    │   (File Storage)│
                    └─────────────────┘    └─────────────────┘
```

## 快速開始

### 1. 準備環境

確保您的系統已安裝：
- Docker (>= 20.0)
- Docker Compose (>= 2.0)

### 2. 設定環境變數

```bash
# 複製環境變數範本
cp .env.example .env

# 編輯環境變數
nano .env
```

必須設定的環境變數：
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE Bot Channel Access Token
- `LINE_CHANNEL_SECRET`: LINE Bot Channel Secret
- `AWS_ACCESS_KEY_ID`: AWS 存取金鑰 ID
- `AWS_SECRET_ACCESS_KEY`: AWS 秘密存取金鑰
- `S3_BUCKET_NAME`: S3 儲存桶名稱

### 3. 啟動服務

```bash
# 建置並啟動所有服務
docker-compose up -d

# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f
```

### 4. 驗證部署

- API 健康檢查: http://localhost:3000/health
- LINE Bot 健康檢查: http://localhost:3001/health
- 資料庫連接測試: `docker-compose exec postgres psql -U law_admin -d law_management_system -c "SELECT version();"`

## 服務說明

### PostgreSQL 資料庫
- **容器名稱**: law_postgres
- **端口**: 5432
- **資料庫**: law_management_system
- **用戶**: law_admin
- **資料持久化**: postgres_data volume

### API 服務
- **容器名稱**: law_api
- **端口**: 3000
- **功能**: 
  - 用戶認證與授權
  - 案件管理 CRUD
  - 客戶管理
  - 檔案上傳至 S3
  - RESTful API

### LINE Bot 服務
- **容器名稱**: law_linebot
- **端口**: 3001
- **功能**:
  - 客戶註冊與驗證
  - 案件進度查詢
  - 文件上傳
  - 即時通訊

## 資料庫結構

### 主要資料表
- `law_firms`: 法律事務所
- `firm_users`: 事務所用戶（律師、法務）
- `customers`: 客戶資料
- `cases`: 案件資料
- `case_stages`: 案件階段
- `case_files`: 檔案記錄
- `line_messages`: LINE 訊息記錄

### 初始資料
系統會自動建立：
- 測試事務所 (firm_code: TEST_LAW_FIRM)
- 管理員帳戶 (username: admin, password: admin123)

## API 端點

### 認證
- `POST /api/auth/login` - 用戶登入
- `POST /api/auth/register` - 事務所註冊
- `GET /api/auth/verify` - 驗證 token

### 案件管理
- `GET /api/cases` - 取得案件列表
- `POST /api/cases` - 新增案件
- `GET /api/cases/:id` - 取得單一案件
- `PUT /api/cases/:id` - 更新案件
- `DELETE /api/cases/:id` - 刪除案件

### 客戶管理
- `GET /api/customers` - 取得客戶列表
- `POST /api/customers` - 新增客戶
- `PUT /api/customers/:id` - 更新客戶

### 檔案管理
- `POST /api/files/upload` - 上傳檔案
- `GET /api/files/:id` - 下載檔案
- `DELETE /api/files/:id` - 刪除檔案

## LINE Bot 功能

### 客戶註冊流程
1. 客戶加入官方 LINE
2. 輸入註冊資料：`註冊 姓名 電話 身分證字號`
3. 系統產生驗證碼
4. 事務所人員確認身份
5. 啟用客戶帳戶

### 支援指令
- `案件` / `進度` - 查詢案件進度
- `幫助` - 顯示使用說明
- 直接上傳檔案 - 自動歸檔到案件

## 維護指令

### 備份資料庫
```bash
# 建立備份
docker-compose exec postgres pg_dump -U law_admin law_management_system > backup.sql

# 恢復備份
docker-compose exec -T postgres psql -U law_admin law_management_system < backup.sql
```

### 查看日誌
```bash
# 查看所有服務日誌
docker-compose logs

# 查看特定服務日誌
docker-compose logs api
docker-compose logs linebot
docker-compose logs postgres
```

### 重啟服務
```bash
# 重啟所有服務
docker-compose restart

# 重啟特定服務
docker-compose restart api
```

### 更新服務
```bash
# 重新建置並啟動
docker-compose up -d --build

# 清理未使用的映像
docker system prune -f
```

## 安全注意事項

1. **更改預設密碼**: 修改 `.env` 中的所有預設密碼
2. **JWT 金鑰**: 使用強密碼作為 JWT_SECRET
3. **HTTPS**: 生產環境建議使用 SSL 憑證
4. **防火牆**: 限制資料庫端口的外部存取
5. **定期備份**: 設定自動備份機制

## 故障排除

### 常見問題

1. **資料庫連接失敗**
   ```bash
   # 檢查資料庫狀態
   docker-compose logs postgres
   
   # 重啟資料庫
   docker-compose restart postgres
   ```

2. **API 服務無法啟動**
   ```bash
   # 檢查環境變數
   docker-compose config
   
   # 查看 API 日誌
   docker-compose logs api
   ```

3. **LINE Bot 無法接收訊息**
   - 確認 Webhook URL 設定正確
   - 檢查 LINE Channel 設定
   - 驗證 SSL 憑證（生產環境）

### 效能調優

1. **資料庫調優**
   - 調整 PostgreSQL 記憶體設定
   - 建立適當的索引
   - 定期執行 VACUUM

2. **API 調優**
   - 啟用 Redis 快取
   - 使用連接池
   - 實作 API 限流

## 開發環境

如需開發環境設定，請參考各服務目錄下的 README 檔案。

## 授權

此專案採用 MIT 授權條款。
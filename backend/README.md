# 法律案件管理系統 API

基於 FastAPI 的法律案件管理系統後端 API，提供案件、客戶、階段、提醒和檔案管理功能。

## 功能特色

- 🏢 多事務所支援
- 👥 客戶管理（唯一性約束）
- 📋 案件 CRUD 操作
- 📊 案件階段追蹤
- ⏰ 提醒管理
- 📁 檔案上傳（整合 S3 服務）
- 📝 操作日誌記錄
- 🔍 分頁搜尋功能

## 快速開始

### 環境需求

- Python 3.11+
- PostgreSQL 16
- Docker & Docker Compose

### 安裝與啟動

1. **複製環境變數檔案**
```bash
cp .env.example .env
```

2. **編輯環境變數**
```bash
# 編輯 .env 檔案，設定資料庫連線和 S3 服務位址
DATABASE_URL=postgresql://username:password@law_pg:5432/database
S3_API_BASE=http://law_s3_api:8000
```

3. **啟動服務**
```bash
docker-compose up -d --build
```

4. **檢查服務狀態**
```bash
curl -sS http://127.0.0.1:8080/healthz
```

## API 測試範例

### 健康檢查
```bash
curl -sS http://127.0.0.1:8080/healthz
```

### 認證功能

**註冊事務所**
```bash
curl -X POST http://127.0.0.1:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firm_name": "測試法律事務所",
    "account": "testlaw001",
    "password": "Admin123!",
    "confirm_password": "Admin123!"
  }'
```

**用戶登入**
```bash
curl -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "account": "testlaw001",
    "password": "Admin123!"
  }'
```

### 客戶管理

**建立客戶**
```bash
curl -X POST http://127.0.0.1:8080/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "firm_code": "YOUR_FIRM_CODE",
    "name": "客戶姓名",
    "phone": "電話號碼",
    "email": "email@example.com",
    "address": "地址",
    "notes": "備註"
  }'
```

**查詢客戶列表**
```bash
curl "http://127.0.0.1:8080/api/clients?firm_code=YOUR_FIRM_CODE&query=關鍵字&page=1&page_size=20"
```

**取得單一客戶**
```bash
curl http://127.0.0.1:8080/api/clients/{client_id}
```

### 案件管理

**建立案件**
```bash
curl -X POST http://127.0.0.1:8080/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "firm_code": "YOUR_FIRM_CODE",
    "client_id": "client-uuid-here",
    "case_type": "案件類型",
    "case_reason": "案件原因",
    "case_number": "案件編號",
    "court": "法院名稱",
    "division": "庭別",
    "progress": "進度"
  }'
```

**查詢案件列表**
```bash
curl "http://127.0.0.1:8080/api/cases?firm_code=YOUR_FIRM_CODE&status=open&keyword=關鍵字&page=1&page_size=20"
```

**更新案件**
```bash
curl -X PATCH http://127.0.0.1:8080/api/cases/{case_id} \
  -H "Content-Type: application/json" \
  -d '{
    "progress": "新進度",
    "progress_date": "YYYY-MM-DD",
    "is_closed": false
  }'
```

### 案件階段管理

**取得案件階段**
```bash
curl http://127.0.0.1:8080/api/cases/{case_id}/stages
```

**新增階段**
```bash
curl -X POST http://127.0.0.1:8080/api/cases/{case_id}/stages \
  -H "Content-Type: application/json" \
  -d '{
    "name": "階段名稱",
    "stage_date": "YYYY-MM-DD",
    "completed": false,
    "sort_order": 1
  }'
```

**更新階段**
```bash
curl -X PATCH http://127.0.0.1:8080/api/cases/{case_id}/stages/{stage_id} \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true
  }'
```

### 提醒管理

**取得案件提醒**
```bash
curl http://127.0.0.1:8080/api/cases/{case_id}/reminders
```

**新增提醒**
```bash
curl -X POST http://127.0.0.1:8080/api/cases/{case_id}/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "提醒標題",
    "due_date": "YYYY-MM-DD"
  }'
```

### 檔案管理

**檔案上傳三步驟**

1. **取得預簽名 URL**
```bash
curl -X POST http://127.0.0.1:8080/api/cases/{case_id}/files/presign \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "檔案名稱.pdf",
    "folder_slug": "資料夾名稱",
    "content_type": "application/pdf"
  }'
```

2. **上傳檔案到 S3**
```bash
curl -X PUT -T 本地檔案 \
  -H "Content-Type: application/pdf" \
  "<upload_url_from_step1>"
```

3. **確認上傳**
```bash
curl -X POST http://127.0.0.1:8080/api/files/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "key": "s3-key-from-step1"
  }'
```

**取得檔案下載連結**
```bash
curl http://127.0.0.1:8080/api/files/{file_id}/download
```

**查看案件檔案列表**
```bash
curl http://127.0.0.1:8080/api/cases/{case_id}/files
```

## API 文件

啟動服務後，可透過以下網址查看完整的 API 文件：

- Swagger UI: http://127.0.0.1:8080/docs
- ReDoc: http://127.0.0.1:8080/redoc

## 錯誤處理

API 統一回傳 JSON 格式的錯誤訊息：

```json
{
  "detail": "錯誤描述"
}
```

常見的 HTTP 狀態碼：
- `400`: 請求參數錯誤
- `404`: 資源不存在
- `409`: 資源衝突（如唯一性約束）
- `422`: 資料驗證失敗
- `503`: 外部服務不可用

## 專案結構

```
backend/
├── app/
│   ├── main.py              # FastAPI 應用程式入口
│   ├── settings.py          # 設定檔
│   ├── db.py               # 資料庫連線
│   ├── models.py           # SQLAlchemy 模型
│   ├── schemas.py          # Pydantic 模型
│   ├── repositories/       # 資料存取層
│   │   ├── base.py
│   │   ├── client_repository.py
│   │   ├── case_repository.py
│   │   ├── stage_repository.py
│   │   └── reminder_repository.py
│   └── routers/            # API 路由
│       ├── health.py
│       ├── clients.py
│       ├── cases.py
│       ├── stages.py
│       ├── reminders.py
│       └── files.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## 開發說明

### 本地開發

```bash
# 安裝依賴
pip install -r requirements.txt

# 啟動開發伺服器
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 資料庫遷移

本專案使用現有的資料庫 schema，不包含遷移工具。請確保資料庫已正確建立所需的表格。

## 授權

MIT License
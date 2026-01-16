# 多租戶聊天機器人平台

可客製化的嵌入式聊天機器人平台,支援多租戶管理、動態服務配置、提示詞編輯等功能。

## 功能特色

- ✅ **多租戶架構**: 每個客戶獨立的 API Key、設定、提示詞
- ✅ **動態服務配置**: 可啟用/停用服務,調整參數 (temperature, grounding 等)
- ✅ **提示詞管理**: Markdown 格式,支援線上編輯
- ✅ **固定問題客製化**: 每個租戶自訂 Quick Actions
- ✅ **管理後台**: Web UI 管理租戶、服務、提示詞
- ✅ **嵌入式部署**: 一行代碼嵌入任何網站

## 技術架構

### 後端
- **框架**: Flask
- **AI**: Google Gemini 2.5 Flash
- **快取**: Redis
- **語言**: Python 3.x

### 前端
- **框架**: Next.js 16 (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS
- **UI**: Framer Motion

## 快速開始

### 1. 環境準備

```bash
# 安裝 Python 依賴
cd backend
pip install -r requirements.txt

# 安裝 Node.js 依賴
cd ..
npm install
```

### 2. 設定環境變數

**backend/.env**:
```env
GEMINI_API_KEY=your_gemini_api_key
REDIS_HOST=localhost
REDIS_PORT=6379
ADMIN_API_KEY=admin_secret_key
```

**.env.local** (根目錄):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:5001
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### 3. 啟動服務

**啟動 Redis**:
```bash
redis-server
```

**啟動後端 API** (port 5000):
```bash
cd backend
python app.py
```

**啟動管理後台 API** (port 5001):
```bash
cd backend
python admin_app.py
```

**啟動前端** (port 3000):
```bash
npm run dev
```

### 4. 訪問管理後台

- URL: http://localhost:3000/admin/login
- API Key: `admin_secret_key`

## 使用指南

### 管理租戶

1. 登入管理後台
2. 點擊「新增租戶」
3. 填寫租戶資訊:
   - 租戶名稱
   - Gemini API Key
   - 啟用狀態
4. 儲存

### 設定服務

1. 在租戶列表點擊「服務」
2. 查看已啟用的服務
3. 調整服務參數:
   - Temperature (0-1)
   - Use Grounding (是/否)
   - Search Keyword

### 編輯提示詞

1. 在租戶列表點擊「提示詞」
2. 選擇要編輯的服務
3. 在編輯器中修改提示詞 (Markdown 格式)
4. 點擊「儲存」

### 嵌入聊天機器人

在您的網站中加入以下代碼:

```html
<script src="http://localhost:3000/api/chat-widget?tenant_id=YOUR_TENANT_ID"></script>
```

## API 文件

### 聊天 API

**端點**: `POST /api/chat`

**Headers**:
```
Content-Type: application/json
X-Tenant-ID: your_tenant_id
```

**請求**:
```json
{
  "message": "你好",
  "mode": "general",
  "history": []
}
```

**回應**:
```json
{
  "type": "general",
  "response": "您好！我是聊天助手...",
  "references": [],
  "detected_language": {
    "language_code": "zh-TW",
    "language_name": "Traditional Chinese"
  }
}
```

### 租戶設定 API

**端點**: `GET /api/tenant/config`

**Headers**:
```
X-Tenant-ID: your_tenant_id
```

**回應**:
```json
{
  "tenant_id": "demo",
  "name": "示範客戶",
  "quick_actions": [
    {
      "icon": "🗺️",
      "text": "路線導航",
      "query": "從停車場到 Apple Store 怎麼去？"
    }
  ]
}
```

## 管理後台 API

### 租戶管理

**列出所有租戶**: `GET /admin/tenants`  
**取得租戶**: `GET /admin/tenants/{id}`  
**建立租戶**: `POST /admin/tenants`  
**更新租戶**: `PUT /admin/tenants/{id}`  
**刪除租戶**: `DELETE /admin/tenants/{id}`

### 提示詞管理

**列出提示詞**: `GET /admin/tenants/{id}/prompts`  
**取得提示詞**: `GET /admin/tenants/{id}/prompts/{service}`  
**更新提示詞**: `PUT /admin/tenants/{id}/prompts/{service}`  
**建立提示詞**: `POST /admin/tenants/{id}/prompts`

### 服務管理

**列出服務**: `GET /admin/tenants/{id}/services`  
**更新服務**: `PUT /admin/tenants/{id}/services/{service}`  
**新增服務**: `POST /admin/tenants/{id}/services`  
**刪除服務**: `DELETE /admin/tenants/{id}/services/{service}`

### Quick Actions 管理

**取得**: `GET /admin/tenants/{id}/quick-actions`  
**更新**: `PUT /admin/tenants/{id}/quick-actions`

所有管理 API 需要在 Header 中帶上 `X-Admin-Key`。

## 專案結構

```
chatbot-platform/
├── app/                        # Next.js App Router
│   ├── admin/                  # 管理後台頁面
│   │   ├── login/
│   │   └── tenants/
│   ├── api/
│   │   └── chat-widget/        # 嵌入腳本 API
│   └── page.tsx                # 聊天主頁
├── src/
│   ├── components/chat/        # 聊天 UI 元件
│   ├── lib/
│   │   ├── admin/              # 管理後台工具
│   │   └── api-client.ts       # API Client
│   └── types/
├── backend/
│   ├── app.py                  # 主 API
│   ├── admin_app.py            # 管理後台 API
│   ├── config/
│   │   ├── tenant_manager.py  # 租戶管理器
│   │   ├── service_factory.py # 服務工廠
│   │   └── tenants.json        # 租戶設定
│   ├── prompts/                # 提示詞檔案
│   │   └── {tenant_id}/
│   ├── middleware/
│   │   └── tenant_auth.py      # 租戶驗證
│   └── services/               # AI 服務
└── public/
```

## 測試

執行後端測試:
```bash
cd backend
python test_tenant_manager.py
python test_service_factory.py
python test_tenant_auth.py
python test_admin_api.py
python test_admin_prompts.py
python test_admin_services.py
```

## 部署

### Docker 部署 (推薦)

```bash
# 建立 Docker 映像
docker-compose build

# 啟動服務
docker-compose up -d
```

### 手動部署

1. 設定 Nginx 反向代理
2. 使用 PM2 管理 Node.js 進程
3. 使用 Gunicorn 運行 Flask
4. 設定 Redis 持久化

## 常見問題

**Q: 如何新增自訂服務?**  
A: 繼承 `BaseGeminiService`,實作自己的服務類別,然後在租戶設定中引用。

**Q: 提示詞支援哪些格式?**  
A: 支援 Markdown 格式,可以使用標題、列表、粗體等。

**Q: 如何切換語言?**  
A: 系統自動偵測使用者語言並翻譯回應。

**Q: Redis 連線失敗怎麼辦?**  
A: 檢查 Redis 是否啟動,確認 `.env` 中的連線設定正確。

## 授權

MIT License

## 聯絡方式

如有問題請聯繫開發團隊。

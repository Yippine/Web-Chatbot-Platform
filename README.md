# AI Genie — 多租戶聊天機器人平台

可客製化的嵌入式 AI 聊天機器人平台，支援多租戶管理、動態服務配置、提示詞編輯、外觀自訂、多語系翻譯等功能。

## 功能特色

- **多租戶架構**：每個品牌獨立的 API Key、服務設定、提示詞
- **動態服務配置**：可啟用/停用服務，調整 temperature、grounding、搜尋關鍵字等參數
- **AI 意圖路由**：自動判斷使用者意圖，分派至對應服務
- **提示詞管理**：Markdown 格式，支援線上編輯，按租戶/服務分目錄
- **Quick Actions**：每個租戶自訂快捷按鈕，可綁定服務與參數
- **外觀自訂**：標題、色彩、漸層、聊天圖示皆可自訂
- **多語系翻譯**：支援自動翻譯介面文字（en、ja、ko、vi、id、th），含過期偵測
- **語言偵測**：自動偵測使用者語言並以對應語言回覆
- **管理後台**：Web UI 管理租戶、服務、提示詞、外觀、翻譯
- **嵌入式部署**：一行 `<script>` 嵌入任何網站

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| 樣式 | Tailwind CSS 4 + Framer Motion |
| 後端框架 | Flask 3.0 (Python 3.11+) |
| AI 服務 | Google Gemini 2.5 Flash (google-genai SDK) |
| Session 管理 | Redis 5.0 |
| 圖片處理 | Pillow |
| 容器化 | Docker + Docker Compose + Nginx 反向代理 |
| 生產部署 | Gunicorn (WSGI) |

## 專案結構

```
chatbot-platform/
├── app/                              # Next.js App Router
│   ├── page.tsx                      # 首頁（重導至聊天頁）
│   ├── layout.tsx                    # 根佈局
│   ├── globals.css                   # 全域樣式 (Tailwind)
│   ├── chat/page.tsx                 # 聊天主頁面
│   ├── admin/                        # 管理後台頁面
│   │   ├── layout.tsx                #   管理後台佈局
│   │   ├── page.tsx                  #   管理後台首頁
│   │   ├── login/page.tsx            #   登入頁
│   │   └── tenants/                  #   品牌管理
│   │       ├── page.tsx              #     品牌列表
│   │       └── [id]/
│   │           ├── page.tsx          #     品牌編輯
│   │           ├── services/         #     服務管理
│   │           └── appearance/       #     外觀設定
│   └── api/
│       ├── chat/route.ts             # 聊天 API 代理
│       └── chat-widget/route.ts      # 嵌入式腳本產生器
├── src/
│   ├── components/
│   │   ├── chat/                     # ChatContainer, MessageList, InputBar,
│   │   │                             # Message, ChatHeader, QuickActions, LoadingMessage
│   │   └── ui/                       # Button, Card, Carousel
│   ├── lib/
│   │   ├── api-client.ts             # 前端 → 後端 API 通訊
│   │   ├── admin/api-client.ts       # 管理後台 API Client
│   │   ├── appearance.ts             # 外觀工具函式
│   │   ├── i18n.ts                   # 多語系
│   │   └── utils.ts                  # 工具函式
│   ├── types/index.ts                # TypeScript 型別定義
│   ├── contexts/LanguageContext.tsx   # React Context (語言)
│   └── locales/translations.json     # 前端翻譯檔
├── backend/
│   ├── app.py                        # 主 API 伺服器 (port 5000)
│   ├── admin_app.py                  # 管理後台 API (port 5001)
│   ├── config/
│   │   ├── tenant_manager.py         # 租戶設定管理器
│   │   ├── service_factory.py        # 服務工廠（動態建立 AI 服務）
│   │   └── tenants.json              # 租戶設定資料
│   ├── services/
│   │   ├── base_gemini_service.py    # Gemini AI 基礎類別 + Redis session
│   │   ├── chat_service.py           # 對話問答服務
│   │   ├── query_service.py          # 資料查詢服務（含 grounding + 快取）
│   │   └── smart_route_service.py    # 路線導航服務（含 Google Maps 工具）
│   ├── middleware/
│   │   └── tenant_auth.py            # 租戶驗證中介層
│   ├── prompts/{tenant_id}/          # 各租戶的提示詞 (Markdown)
│   ├── translations/{tenant_id}/     # 各租戶的多語系翻譯檔 (JSON)
│   ├── public/images/tenants/        # 租戶上傳的圖片
│   ├── test/                         # 測試檔案
│   ├── Dockerfile                    # 主 API 容器 (Gunicorn, 4 workers)
│   ├── Dockerfile.admin              # 管理 API 容器 (Gunicorn, 2 workers)
│   └── requirements.txt              # Python 依賴
├── public/                           # 靜態資源（圖示、測試頁面）
├── docs/                             # 文件
│   └── APPEARANCE_GUIDE.md           # 外觀設定指南
├── docker-compose.yml                # 容器編排（5 服務）
├── nginx.conf                        # Nginx 反向代理設定
├── Dockerfile                        # 前端容器（多階段建置）
├── .env.example                      # 根目錄環境變數範本
└── LICENSE                           # AGPL-3.0
```

## 本地端開發部署

### 前置需求

- Node.js 20+
- Python 3.11+
- Redis

### 步驟 1：安裝依賴

```bash
# 前端
npm install

# 後端
cd backend
python -m venv venv
# Linux / macOS
source venv/bin/activate
# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 步驟 2：設定環境變數

**根目錄 `.env`**（複製 `.env.example`）：

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:5001
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

**`backend/.env`**（複製 `backend/.env.example`）：

```env
GEMINI_API_KEY=your_gemini_api_key
ADMIN_API_KEY=your_admin_secret_key

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# 各租戶的 Gemini API Key（由管理後台自動寫入）
# TENANT_DEMO_GEMINI_API_KEY=xxx
```

### 步驟 3：啟動 Redis

```bash
redis-server
```

如果是 Windows 且沒有原生 Redis，可用 Docker：

```bash
docker run -d --name redis -p 6379:6379 redis:latest
```

### 步驟 4：啟動後端

開兩個終端機：

```bash
# 終端機 1 — 主 API (port 5000)
cd backend
source venv/bin/activate   # Windows: venv\Scripts\activate
python app.py

# 終端機 2 — 管理後台 API (port 5001)
cd backend
source venv/bin/activate   # Windows: venv\Scripts\activate
python admin_app.py
```

### 步驟 5：啟動前端

```bash
# 終端機 3 — Next.js (port 3000)
npm run dev
```

### 步驟 6：開始使用

| 頁面 | URL |
|------|-----|
| 聊天頁面 | http://localhost:3000/chat?tenant_id=demo |
| 管理後台 | http://localhost:3000/admin |
| 管理後台登入 | http://localhost:3000/admin/login |
| 後端健康檢查 | http://localhost:5000/api/health |
| 管理 API 健康檢查 | http://localhost:5001/api/admin/health |

管理後台登入密碼為 `backend/.env` 中的 `ADMIN_API_KEY`。

## Docker 部署

### 步驟 1：設定環境變數

編輯根目錄 `.env`：

```env
NGINX_PORT=80
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_ADMIN_API_URL=https://your-domain.com
NEXT_PUBLIC_FRONTEND_URL=https://your-domain.com
```

編輯 `backend/.env`（同上方後端環境變數）。

### 步驟 2：準備資料目錄

Docker 環境下 `tenants.json` 透過 volume 掛載在 `backend/data/`：

```bash
mkdir -p backend/data backend/data/images/tenants
cp backend/config/tenants.json backend/data/tenants.json
```

### 步驟 3：啟動

```bash
docker-compose up -d --build
```

### 服務架構

```
Client → Nginx (:80)
           ├── /images/tenants/*  → 靜態檔案 (Nginx 直接 serve)
           ├── /api/admin/*       → admin-backend (:5001, Gunicorn 2w)
           ├── /api/*             → backend (:5000, Gunicorn 4w)
           └── /*                 → frontend (:3000)
                                         └── Redis (內部網路)
```

### Docker Compose 服務

| 服務 | 容器名稱 | 說明 |
|------|----------|------|
| redis | ai-genie-redis | Redis 資料庫，啟用 AOF 持久化 |
| backend | ai-genie-backend | 主 API，掛載 prompts + translations |
| admin-backend | ai-genie-admin-backend | 管理 API，掛載 prompts + translations + images |
| frontend | ai-genie-frontend | Next.js 前端 |
| nginx | ai-genie-nginx | 反向代理 + 靜態檔案 |

### 常用指令

```bash
docker-compose up -d          # 啟動
docker-compose down           # 停止
docker-compose logs -f        # 查看即時日誌
docker-compose up -d --build  # 重新建置並啟動
```

## API 文件

### 聊天 API（app.py — port 5000）

所有聊天 API 需要 `X-Tenant-ID` header。

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/health` | 健康檢查 |
| POST | `/api/detect-language` | 語言偵測 |
| POST | `/api/chat/intent` | AI 意圖判斷 |
| POST | `/api/chat` | 聊天（支援 mode 指定服務） |
| GET | `/api/tenant/config` | 取得租戶前端設定（支援 `?lang=` 多語系） |
| GET | `/api/query/data` | 查詢資料（支援 `?service=` 指定服務） |

**聊天請求範例**：

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: demo" \
  -d '{"message": "你好", "mode": "general", "user_id": "user123", "lang": "en"}'
```

**意圖判斷範例**：

```bash
curl -X POST http://localhost:5000/api/chat/intent \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: demo" \
  -d '{"message": "怎麼去停車場"}'
```

### 管理後台 API（admin_app.py — port 5001）

所有管理 API 需要 `X-Admin-Key` header。

**租戶管理**：

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/admin/health` | 健康檢查 |
| GET | `/api/admin/tenants` | 列出所有租戶 |
| GET | `/api/admin/tenants/{id}` | 取得租戶詳情 |
| POST | `/api/admin/tenants` | 建立租戶 |
| PUT | `/api/admin/tenants/{id}` | 更新租戶 |
| DELETE | `/api/admin/tenants/{id}` | 刪除租戶 |

**服務管理**：

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/admin/service-classes` | 取得可用服務類別 |
| GET | `/api/admin/tenants/{id}/services` | 列出服務 |
| GET | `/api/admin/tenants/{id}/services/{service}` | 取得服務（含提示詞） |
| POST | `/api/admin/tenants/{id}/services` | 新增服務 |
| PUT | `/api/admin/tenants/{id}/services/{service}` | 更新服務 |
| DELETE | `/api/admin/tenants/{id}/services/{service}` | 刪除服務 |

**Quick Actions**：

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/admin/tenants/{id}/quick-actions` | 取得 Quick Actions |
| PUT | `/api/admin/tenants/{id}/quick-actions` | 更新 Quick Actions |

**外觀設定**：

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/admin/tenants/{id}/appearance` | 取得外觀設定 |
| PUT | `/api/admin/tenants/{id}/appearance` | 更新外觀設定 |
| POST | `/api/admin/tenants/{id}/appearance/upload-icon` | 上傳聊天圖示 |

**翻譯管理**：

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/admin/tenants/{id}/translations` | 查詢翻譯狀態（含過期偵測） |
| POST | `/api/admin/tenants/{id}/translations` | 生成指定語言翻譯 |

## 嵌入聊天機器人

在任意網站加入一行：

```html
<script src="https://your-domain.com/api/chat-widget?tenant_id=YOUR_TENANT_ID"></script>
```

本地開發時：

```html
<script src="http://localhost:3000/api/chat-widget?tenant_id=demo"></script>
```

也可以用 `public/test.html` 測試嵌入效果。

## 新增自訂服務

1. 在 `backend/services/` 建立新的服務類別，繼承 `BaseGeminiService`
2. 在 `backend/config/service_factory.py` 的 `SERVICE_CLASSES` 中註冊
3. 透過管理後台新增服務時選擇對應的服務類別

目前內建的服務類別：

| 類別 | 說明 |
|------|------|
| `ChatService` | 通用對話問答 |
| `QueryService` | 資料查詢（支援 grounding 搜尋 + 快取） |
| `SmartRouteService` | 路線導航規劃（支援 Google Maps 工具） |

### BaseGeminiService 提供的功能

- Redis 基礎的使用者 session 管理（TTL 1 小時）
- 並行 URL 處理以取得 grounding 參考資料
- 可設定的 temperature、grounding、search_keyword
- 每個服務可自訂 system prompt（從 Markdown 檔案載入）
- 多語言回覆支援

## 測試

```bash
cd backend
python -m pytest test/ -v
```

或個別執行：

```bash
python test/test_tenant_manager.py
python test/test_service_factory.py
python test/test_tenant_auth.py
python test/test_admin_api.py
python test/test_admin_prompts.py
python test/test_admin_services.py
python test/test_integration.py
```

## 常用開發指令

```bash
# 前端
npm run dev              # 啟動 Next.js 開發伺服器 (port 3000)
npm run build            # 正式環境建置
npm start                # 啟動正式環境伺服器
npm run lint             # 執行 ESLint

# Docker
docker-compose up -d     # 啟動所有服務
docker-compose down      # 停止所有服務
docker-compose logs -f   # 查看日誌
```

## 授權

本專案採用 [GNU Affero General Public License v3.0](LICENSE) 授權，附帶額外條款（依據 AGPL-3.0 第 7 條）。

© 2026 Wendy YU (YwY170) — https://github.com/YwY170/Web-Chatbot-Platform

# Project Context

> AI Genie — 多租戶嵌入式 AI 聊天機器人平台

## Purpose

AI Genie 是一個可客製化的嵌入式 AI 聊天機器人平台，讓多個品牌（租戶）能以單行 `<script>` 在自家網站嵌入專屬聊天機器人。每個租戶擁有獨立的 API Key、服務配置、提示詞、外觀與多語系設定，並透過 Web 管理後台維護。核心對話能力由 Google Gemini 提供，搭配 AI 意圖路由將使用者訊息分派至對應服務。

## Tech Stack

| 層級 | 技術 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| 樣式 | Tailwind CSS 4 + Framer Motion |
| 後端框架 | Flask 3.0 (Python 3.11+) |
| AI 服務 | Google Gemini 2.5 Flash (google-genai SDK) |
| Session 管理 | Redis 5.0（TTL 1 小時） |
| 資料庫 | PostgreSQL 16（數據統計） |
| 圖片處理 | Pillow |
| 容器化 | Docker + Docker Compose + Nginx 反向代理 |
| 生產部署 | Gunicorn（主 API 4 workers / 管理 API 2 workers） |

## Architecture

三個應用層 + 反向代理：

- **前端（Next.js, :3000）**：聊天 UI（`/chat`）、管理後台 UI（`/admin`）、API 代理路由（`/api/chat`、`/api/chat-widget`）。
- **主 API（Flask `app.py`, :5000）**：對話、意圖路由、語言偵測、租戶前端設定、資料查詢。所有端點需 `X-Tenant-ID` header。
- **管理 API（Flask `admin_app.py`, :5001）**：租戶 / 服務 / Quick Actions / 外觀 / 翻譯的 CRUD。所有端點需 `X-Admin-Key` header。
- **Nginx（:80）**：`/images/tenants/*` 靜態檔、`/api/admin/*` → 管理 API、`/api/*` → 主 API、`/*` → 前端。

服務以工廠模式（`service_factory.py`）動態建立，皆繼承 `BaseGeminiService`。內建服務類別：`ChatService`（通用對話）、`QueryService`（資料查詢 + grounding + 快取）、`SmartRouteService`（路線導航 + Google Maps）、`FrappeQueryService`（ERP 查詢 + Frappe REST）。

## Data & Storage

- **租戶設定**：`backend/config/tenants.json`（Docker 下掛載於 `backend/data/tenants.json`）。
- **提示詞**：`backend/prompts/{tenant_id}/{service}.md`（Markdown，含 `general.md` 與各服務檔）。
- **翻譯**：`backend/translations/{tenant_id}/*.json`。
- **租戶圖片**：`backend/public/images/tenants/`，由 Nginx 直接 serve。
- **統計**：PostgreSQL（`backend/db.py`）。
- 各租戶 Gemini API Key 以環境變數 `TENANT_{ID}_GEMINI_API_KEY` 形式由管理後台寫入，缺漏時 fallback 至 `GEMINI_API_KEY`。

## Conventions

- 使用者面向文字一律繁體中文；介面文字支援自動翻譯（en、ja、ko、vi、id、th）並含過期偵測。
- 服務啟用 / 停用為動態配置；參數含 `temperature`、`grounding`、`search_keyword` 等。
- 新增服務類別：建立繼承 `BaseGeminiService` 的類別 → 在 `service_factory.py` 的 `SERVICE_CLASSES` 註冊 → 管理後台選用。
- 測試位於 `backend/test/`，以 `pytest` 執行。

## Capabilities (baseline specs)

本 baseline 規格逆向自現有實作，記錄「系統目前實際行為」，作為日後變更（OpenSpec change）的基準線。涵蓋能力：租戶管理、服務配置、AI 意圖路由、對話、提示詞管理、Quick Actions、外觀自訂、多語系翻譯、語言偵測、嵌入式部署、管理後台、數據統計。

## License

GNU AGPL-3.0（附 AGPL-3.0 第 7 條額外條款）。© 2026 Wendy YU (YwY170).

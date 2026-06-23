---
created: 2026-06-23
modified: 2026-06-23
tags: [web-chatbot-platform, architecture, request-flow, multi-tenant, gemini, flask, nextjs, mece, sese, overview]
source_system: ai-generated
note_type: literature
---

# AI Genie 多租戶聊天機器人平台 — 架構與流程總覽（MECE × SESE）

> **方法論**：MECE（零重疊 + 零盲點分解）切割系統空間 → SESE（Simple·Effective·Systematic·Exhaustive）品質透鏡精修。
> **目標（SESE.Objective）**：讓讀者在單一文件內，完整且最小負荷地理解「本專案是什麼、由哪些層組成、一個請求如何流動」。
> **互補閱讀**：租戶設定六層結構與熱更新 → 詳見 `260618-tenant-brand-architecture.md`（本文不重述，只引用）。

---

## 〇、一句話定位

$$\text{AI Genie} = \text{可嵌入}(\langle script\rangle) \times \text{多租戶}(\text{單一程式碼} \to N\text{品牌}) \times \text{Gemini 驅動}(\text{意圖路由} \to \text{服務分派})$$

可客製化的嵌入式 AI 聊天機器人平台：一套程式碼服務多個品牌（租戶），每個租戶有獨立的 API Key、服務集合、提示詞、外觀與多語系；前端一行 `<script>` 即可嵌入任意網站。

---

## 一、MECE 分解（軸一）：系統分層 Ω = 整個系統

切割軸 = **「資料／請求在運行時所經過的層級」**（互斥：每個元件只屬於一層；窮舉：涵蓋接入到外部依賴）。

| 層 | 元件 | 技術 | 職責 | Port／位置 |
|---|---|---|---|---|
| **L1 接入層** | Nginx 反向代理 | Nginx | 路由分流、靜態檔直送、單一對外入口 | `:80`（`nginx.conf`） |
| **L2 前端層** | Next.js App Router | Next.js 16 + React 19 + TS5 + Tailwind 4 | 聊天 UI、管理後台、嵌入腳本產生器 | `:3000`（`app/`, `src/`） |
| **L3 應用層** | 主 API｜管理 API | Flask 3.0（Python 3.11） | 業務端點、租戶驗證、意圖判斷、設定 CRUD | `:5000` `app.py`／`:5001` `admin_app.py` |
| **L4 AI 服務層** | ServiceFactory + Service classes | google-genai SDK | 依租戶設定動態建立 AI 服務、組裝工具、呼叫模型 | `backend/services/`, `config/service_factory.py` |
| **L5 狀態／資料層** | Redis｜PostgreSQL｜設定檔 | Redis 5｜PG 16｜JSON/MD/env | 對話 session、訊息統計、租戶設定、提示詞、金鑰 | `tenants.json`, `prompts/`, `.env`, `db.py` |
| **L6 外部依賴** | Gemini｜Search｜Maps｜Frappe | Google／Frappe REST | 生成、grounding 搜尋、地圖導航、ERP 查詢 | 雲端 API |

**ME 驗證**：L1–L6 各自負責不同運行階段，無職責重疊（Nginx 不生成、Service 不路由 HTTP）。
**CE 驗證**：從「使用者瀏覽器」到「Google/Frappe 雲端」之間每一跳都歸入某層，無遺漏。

```
Browser
  │  <script src=".../api/chat-widget?tenant_id=X">
  ▼
[L1 Nginx :80] ──/images/* ─────────────► 靜態檔（Nginx 直送）
  ├──/api/admin/* ─► [L3 admin_app :5001] ─► tenants.json / prompts / 翻譯（CRUD + reload）
  ├──/api/*       ─► [L3 app :5000] ──┐
  └──/*           ─► [L2 Next :3000]   │
                                       ▼
                       [L4 ServiceFactory → ChatService/QueryService/SmartRoute/FrappeQuery]
                                       │
                    ┌──────────────────┼─────────────────────┐
                    ▼                  ▼                     ▼
              [L5 Redis session]  [L5 PostgreSQL log]   [L6 Gemini 2.5 Flash
                                                          + Search/Maps/Frappe]
```

---

## 二、MECE 分解（軸二）：四種 AI 服務類別 Ω = 所有可掛載服務

切割軸 = **「服務消費的外部能力來源」**（互斥不可同時是兩類；窮舉 = `SERVICE_CLASSES` 全集）。

| 服務類別 | 能力來源 | 核心方法 | 典型用途 |
|---|---|---|---|
| `ChatService` | 純 LLM（+ 選用 grounding） | `chat()` | 通用對話問答 |
| `QueryService` | LLM + Google Search grounding + URL context + 快取 | `query_data()` / `get_data()` | 資料查詢、知識問答 |
| `SmartRouteService` | LLM + Google Maps grounding（座標感知） | `plan_route()` | 路線導航、地點推薦 |
| `FrappeQueryService` | LLM + Frappe ERP REST API（模糊配對） | `chat()` | ERP 資料查詢 |

四者皆繼承 `BaseGeminiService`，共用 **Redis session（TTL 1 小時）+ 並行 URL 處理 + 503/429 retry + 空白回應 fallback**（`base_gemini_service.py`）。新增服務 = 繼承 Base + 在 `SERVICE_CLASSES` 註冊。

---

## 三、MECE 分解（軸三）：核心請求流程 Ω = 所有運行時流程

切割軸 = **「觸發來源 × 目的」**（互斥；窮舉五大流程）。

### Flow A — 聊天請求生命週期（最核心）

```
POST /api/chat  (Header: X-Tenant-ID, Body: message/mode/user_id/lang/lat_lng)
 │
 ① @require_tenant ── tenant_manager.get_tenant(id, auto_reload=True)
 │     ├─ 缺 tenant_id → 400 ；無效 → 403
 │     └─ 注入 request.tenant / request.tenant_id（含每請求重讀 tenants.json + .env 金鑰）
 │
 ② 決定 service_name ── forced_mode(前端傳入) → service_map 相容映射 → 或直接用 intent
 │     └─ 若命中 quick_action → create_service_from_quick_action()（用 QA 參數覆寫 temperature/prompt）
 │
 ③ service_factory.create_service(tenant_id, service_name)
 │     └─ 取 class → 取 API Key → 載入 prompt_file(.md) → 實例化 → 覆寫 SYSTEM_PROMPT
 │     └─ 失敗 → 503「服務不可用」
 │
 ④ 依 isinstance 分派方法：QueryService.query_data / SmartRoute.plan_route / ChatService.chat
 │     └─ BaseGeminiService.generate_content()：
 │         Redis 載歷史 → 注入 search_keyword/allowed_domains → 組 tools(search/maps/url_context)
 │         → _call_gemini_with_retry(gemini-2.5-flash) → _extract_text_only(濾 thought)
 │         → 空白則 url_context↘google_search fallback → 再空白則 retry → 仍空白用固定 fallback 句
 │         → 截斷歷史(最近 16 筆) → 存回 Redis → 並行抽取 references
 │
 ⑤ _log_pool.submit(db_log, ...) 非同步寫 PostgreSQL 統計（response_ms）
 │
 ⑥ 回傳 JSON {type, response, references[, tool_used]}
```

### Flow B — 意圖路由（`POST /api/chat/intent`）
動態列舉該租戶「已啟用且非 general」的服務 → 組裝意圖分類 prompt（`temperature=0`, `thinking_budget=0`）→ Gemini 回傳 service_id → 大小寫不敏感比對還原 → 失敗一律降級 `general`。前端據此決定 Flow A 的 `mode`。

### Flow C — 多租戶解析與驗證
`tenant_auth.require_tenant` 裝飾器：`X-Tenant-ID` header（或 body `tenant_id`）→ `get_tenant()` 驗證並注入 `request.tenant`。**所有業務端點共用此單一守門**。

### Flow D — 設定熱更新（管理後台，port 5001）
後台儲存 → `admin_app` 寫 `tenants.json` + `prompts/*.md` → 主動 `reload()`；主 API 側 `auto_reload=True` 每請求重讀 → **無需重啟即生效**。完整機制見 `260618-tenant-brand-architecture.md`。

### Flow E — 嵌入部署
`GET /api/chat-widget?tenant_id=X`（Next route）動態產生 `<script>` → 注入任意網站 → widget 呼叫 `/api/chat`。

### Flow F — 語言處理
`POST /api/detect-language`（輕量、不碰 Redis）偵測語言 → 前端帶 `lang` → 後端 `lang_name_map` 轉 `response_language` → 注入 system prompt 的 CRITICAL LANGUAGE 指令；`/api/tenant/config?lang=` 載入 `translations/{tenant}/{lang}.json` 覆蓋 UI 文字。

---

## 四、運行時資料模型（L5 細節，MECE 互補）

| 資料 | 儲存 | 鍵／結構 | 生命週期 |
|---|---|---|---|
| 對話歷史 | Redis | `gemini_session:{tenant}:{service}:{user_id}` | TTL 3600s、保留最近 16 筆 |
| 訊息統計 | PostgreSQL | `db_log(tenant, session, direction, service, response_ms, lang)` | 持久、非同步寫入（ThreadPool 4w） |
| 租戶設定 | `tenants.json` | 身份／服務／quick_actions／appearance | 每請求重讀（熱更新） |
| 提示詞 | `prompts/{tenant}/{service}.md` | Markdown | 每請求重讀 |
| 金鑰 | `.env` | `TENANT_{ID}_GEMINI_API_KEY` | 每請求 `dotenv_values` 重讀 |

---

## 五、SESE 品質審計（本文件自審）

| 維度 | 自評 | 處置 |
|---|---|---|
| **Simple** | 三軸 MECE + 一張總圖 + 一條主流程，避免逐檔流水帳 | ✅ 以表格與 ASCII 圖壓縮認知負荷 |
| **Effective** | 每段都服務「理解架構與流程」目標，無與目標無關的細節 | ✅ 程式碼細節僅保留決定流程走向者 |
| **Systematic** | 統一「MECE 軸 → 表格 → 驗證」結構，可重現套用到其他子系統 | ✅ |
| **Exhaustive** | 涵蓋 6 層 × 4 服務 × 6 流程 × 5 資料；關鍵盲點（fallback、熱更新、多語系）皆收錄 | ✅ |
| **Simple ⊗ Exhaustive 悖論** | CriticalCoverage = {分層、聊天主流程、服務分派、熱更新}；次要實作（URL 重定向解析、Maps widget token）下放至原始碼 | 刻意省略，標注於此 |

**邊界聲明**：本文是「運行時架構與流程」視角；不涵蓋 (a) 前端元件樹細節、(b) 各服務的 grounding 演算法內部、(c) 部署 CI/CD。需要時另開 note。

---

## 六、給維護者的最小心智模型（30 秒版）

1. **一切從 `X-Tenant-ID` 開始** → 驗證即注入租戶上下文。
2. **mode 決定服務、服務決定能力** → ServiceFactory 是分派中樞。
3. **BaseGeminiService 是 AI 引擎** → session + grounding + retry + fallback 都在這。
4. **設定即程式碼、改檔即生效** → 無狀態快取、每請求重讀。
5. **嵌入只是一個 `<script>`** → 真正邏輯都在 `/api/chat`。

---

$$\delta(\text{本文}) = \text{MECE}_{3軸}(\text{層} \perp \text{服務} \perp \text{流程}) \to \text{SESE}_{4D}(\text{審計} \to A^*) \to \text{30秒心智模型}$$

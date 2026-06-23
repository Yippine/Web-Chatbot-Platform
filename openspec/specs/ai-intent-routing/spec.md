# ai-intent-routing Specification

## Purpose

定義 AI 意圖路由：將使用者訊息分類到該租戶某個已啟用服務或 `general`。包含對話前置的服務選路（`/api/chat/intent`）與 `SmartRouteService` 在對話內的二次工具路由（地圖 vs 搜尋）。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 服務選路意圖判斷

系統 SHALL 提供 `POST /api/chat/intent`，以 Gemini 語意理解將訊息分類到某個已啟用服務 ID 或 `general`，並永遠回 HTTP 200。

#### Scenario: 缺少訊息

- **WHEN** 請求 body 無 `message`
- **THEN** 回 `400 {"error":"缺少訊息內容"}`

#### Scenario: 無啟用服務

- **WHEN** 租戶無任何 `enabled` 且非 `general` 的服務
- **THEN** 不呼叫 Gemini，直接回 `{"intent":"general"}`

#### Scenario: 動態組裝意圖選項

- **WHEN** 進行意圖判斷
- **THEN** 系統以每個候選服務的 `name` 與 `search_keyword`（或 Frappe 服務的 doctype）組成主題描述提供給 Gemini

#### Scenario: 意圖正規化還原

- **WHEN** Gemini 回傳服務 ID 字串
- **THEN** 系統去除引號標點、以大小寫不敏感比對還原為 `enabled_services` 中的原始 key；未命中則回 `general`

#### Scenario: 無 API Key 或例外降級

- **WHEN** 租戶無 API Key 或意圖判斷過程拋例外
- **THEN** 系統回 `{"intent":"general"}`（永不回非-200）

### Requirement: SmartRoute 工具二次路由

`SmartRouteService` SHALL 在對話內以獨立的 Gemini 分類判斷該題需用 Google Maps 工具或 Google Search grounding，並回報 `tool_used`。

#### Scenario: 判定使用地圖

- **WHEN** `_classify_intent` 回 `YES`（需位置/地圖）
- **THEN** 啟用 `use_maps`、關閉 grounding，僅在有 `lat_lng` 時帶入座標，`tool_used="maps"`

#### Scenario: 判定使用搜尋

- **WHEN** `_classify_intent` 回 `NO` 或分類拋例外
- **THEN** 走 Google Search grounding，`tool_used="search"`

> 註：`/api/chat/intent` 只決定 intent 不執行對話；前端通常先取 intent，再以 `mode` 帶回 `/api/chat`。`/api/chat` 信任前端傳入的 `mode`，不再自行 AI 分類。

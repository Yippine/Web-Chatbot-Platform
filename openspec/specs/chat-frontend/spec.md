# chat-frontend Specification

## Purpose

定義聊天前端 UI（`/chat?tenant_id=…`）的行為：協調語言偵測→意圖判斷→聊天請求三段流程、訊息渲染、session 維持、loading 狀態與錯誤處理。前端為租戶化的聊天 UI 殼層，實際 AI 邏輯在外部後端。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 聊天頁租戶解析與渲染

前端 SHALL 從 query `tenant_id`（預設 `demo`）解析租戶，載入其 config 後渲染 ChatHeader/MessageList/QuickActions/InputBar，並在 config 載入前顯示 spinner。

#### Scenario: 預設租戶

- **WHEN** URL 未帶 `tenant_id`
- **THEN** 前端以 `demo` 作為租戶

### Requirement: 訊息送出三段流程

前端 SHALL 在使用者送出訊息時依序執行：語言偵測 → （general 模式下）意圖判斷 → 聊天請求，並以三段式 loading 文案反映進度。

#### Scenario: general 模式先判斷意圖

- **WHEN** `currentMode === 'general'` 且已載入 services
- **THEN** 先呼叫 `/api/chat/intent`，意圖須在 services 白名單內且非 `general` 才採用，否則退回 `general`

#### Scenario: loading 文案隨流程切換

- **WHEN** 訊息處理進行中
- **THEN** loading 文案依序為 偵測語言 →（翻譯 UI）→ 分析意圖 → 服務 loading_message / 預設文案

### Requirement: 訊息渲染

前端 SHALL 對 bot 文字訊息做輕量 Markdown→HTML 處理（粗體、連結、換行；移除標題與列表符號），並依當前語言顯示時間戳。references 另以一則 bot 訊息格式化顯示（maps→📍、其他→🔗）。

#### Scenario: 文字訊息格式化

- **WHEN** 渲染 bot 文字訊息
- **THEN** `**粗體**`→`<strong>`、`http(s)` 連結→新分頁連結、`\n`→`<br/>`，並移除 `#` 標題與列表符號

#### Scenario: references 獨立訊息

- **WHEN** 回應含 `references[]`
- **THEN** 另開一則 bot 訊息以圖示與 uri 格式化呈現

### Requirement: Session 與對話歷史

前端 SHALL 以 `crypto.randomUUID()` 產生 `user_id` 存於 `sessionStorage`（key `chatbot_user_id`），每次 chat 請求帶入；對話歷史僅保留使用者訊息，送出時取最後 5 則。

#### Scenario: user_id 持久於分頁

- **WHEN** 同一分頁多次送訊息
- **THEN** 沿用 `sessionStorage` 中的同一 `user_id`（分頁關閉即失效，不跨分頁）

### Requirement: 錯誤處理

前端 SHALL 在回應含 `error` 或 `response` 為空/全空白時拋錯並顯示 `error.general` 文案。

#### Scenario: 空回應視為錯誤

- **WHEN** `result.error` 存在或 `result.response` 為空白
- **THEN** 前端拋錯，catch 後顯示 `t('error.general')`

> 註（現狀偏差）：(1) `app/api/chat/route.ts` 為 stub（回 `收到訊息：…`），真實聊天由 api-client 直連 `NEXT_PUBLIC_API_URL`；(2) `types/index.ts` 定義的 `card/carousel/floor-map` 等型別目前未被渲染（Message 僅處理 string）。

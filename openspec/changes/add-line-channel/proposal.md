## Why

客戶要求把現有的 web 聊天機器人也上架到 LINE。平台的 AI 核心（Gemini 對話、意圖路由、多服務分流、session、grounding）本身與通路無關，但目前所有入口都假設「我們自有的網頁前端」在當指揮者（前端依序打 detect-language / intent / chat 三支 API）。LINE 沒有我們的前端——它以 webhook 主動把訊息推來，因此需要在後端新增一條 LINE 通路，並讓對話流程在伺服器端一次跑完。

本次範圍**只做 LINE**，明確排除 Telegram、RAGflow、長照(LTC)報告與文件生成。

## What Changes

- 新增 **LINE 通路**：每租戶一個 webhook 入口 `POST /webhook/line/<tenant_id>`，含 `X-Line-Signature` 簽章驗證、事件解析、回覆/推播。
- 新增 **後端對話協調器**：把現有 `/api/chat` 內「建服務 → 分派 → 組裝回覆」的核心邏輯抽成可重用函式 `process_message()`，供 HTTP route 與 LINE webhook 共用（不複製邏輯）。LINE 沿用既有 **AI 意圖路由**，使租戶的多個服務（如 `tpe_policy` 的 5 個服務）在 LINE 上也能自動分流。
- **LINE 分流行為與 web 一致**：LINE 永遠進行 AI 意圖分流，候選服務 = 各服務的「啟用服務」（與 web 同一套），不提供 LINE 專屬的分流開關或逐服務 LINE 過濾；服務的 class / temperature / grounding / search_keyword / prompt 等單一共用，設定一次兩平台通用。
- 新增 **Markdown→純文字轉換**：LINE 不渲染 HTML/Markdown，回覆前將 Gemini 輸出降級為純文字（references 併入文字尾）。
- 新增 **非同步回覆模型**：webhook 立即回 200 並顯示 LINE loading 動畫，背景執行緒跑完 AI 後以 reply（逾時則 push）送回，規避 LINE reply_token 30 秒、單次有效的限制。
- 擴充 **租戶資料模型**：tenant 增加 `line` 設定區塊（`enabled` 與 channel access token / secret 的環境變數名稱），沿用現有 `.env` 金鑰機制。
- 新增 **管理後台 LINE 設定（兩步驟）**：
  - 步驟一：新增品牌頁維持**只填品牌 ID**（不在此填 token/secret）；儲存後品牌即建立。
  - 步驟二：品牌建立後，於品牌編輯區提供獨立的「LINE 設定」入口——**顯示該品牌的 Webhook URL（唯讀、可複製，由品牌 ID 推導）**，並提供 channel access token / secret 輸入欄與啟用開關；儲存時 token/secret 寫入 `.env`、`line` 區塊寫入 `tenants.json`。
- 新增依賴 `line-bot-sdk`（v3）。
- **不做**（明確排除，列入非目標）：Telegram、RAGflow、LTC、Word 文件生成、LINE Quick Reply / Rich Menu（快捷鈕 UI 第二期再評估）、外觀自訂 / 嵌入式 widget 套用至 LINE（通路上無意義）。

## Capabilities

### New Capabilities
- `line-channel`: LINE 通路的 webhook 入口、簽章驗證、事件解析、loading 動畫、reply/push 回覆、Markdown→純文字降級、LINE userId 對應 session，以及背景非同步處理與 reply_token 對策。

### Modified Capabilities
- `chat-conversation`: 新增「後端對話協調器」需求——對話分派核心邏輯抽成可重用、與通路無關的 `process_message()`，使非 HTTP 入口（LINE webhook）能在伺服器端完成完整對話流程。既有 `/api/chat` 對外行為不變。
- `tenant-management`: 租戶資料模型新增可選的 `line` 設定區塊（`enabled` + 憑證環境變數名稱），並於管理面沿用既有金鑰寫入機制。

## Impact

- **後端程式碼**：`backend/app.py`（抽出 `process_message`、掛載 LINE webhook blueprint）、新增 LINE 通路模組（webhook route / LINE 收發 / markdown 轉換）、`backend/config/tenant_manager.py`（讀取 `line` 憑證）、`backend/admin_app.py`（新增 LINE 設定的取得/儲存端點，token/secret 寫入 `.env`）、`backend/requirements.txt`（加 `line-bot-sdk`）。
- **前端（管理後台）**：品牌編輯區新增「LINE 設定」入口/區塊——顯示 Webhook URL、輸入 token/secret 與啟用開關（沿用既有 `/admin/tenants/[id]` 編輯結構）。
- **設定與資料**：`tenants.json` 每租戶新增 `line` 區塊；`.env` 新增各租戶 LINE token/secret（由後台寫入）。
- **部署 / Nginx**：`/webhook/line/*` 需路由至主後端（:5000）；LINE 官方後台 webhook URL 指向各租戶入口。
- **外部相依**：LINE Messaging API（reply/push/loading 動畫的額度與限制）。
- **不影響**：前端聊天頁、現有 `/api/chat` 等 web 端點行為；外觀、嵌入 widget、Quick Actions（web）維持原狀。
- **參考來源**：`wendyyu170/linebot`（branch `feature/gemini-linebot`）的 `base_linebot.py`、webhook 簽章驗證、`markdown_converter.py` 為實作參考；授權相容性（對方 repo 授權未明、本專案 AGPL-3.0）須於實作前確認，必要時自行重寫。

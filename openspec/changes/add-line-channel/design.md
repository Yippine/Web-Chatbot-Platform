## Context

平台目前僅有 web 通路。對話流程由**前端**當指揮者，依序呼叫三支後端 API：`/api/detect-language` → `/api/chat/intent` → `/api/chat`。AI 核心（`service_factory` 建立服務、`BaseGeminiService.generate_content`、Redis session `{tenant}:{service}:{user}`、grounding、多階降級）本身與通路無關。

LINE 的互動方向相反：LINE 伺服器以 webhook 主動把使用者訊息推來，要求我們在**短時間內回 200**，並透過 reply_token（30 秒、單次有效）或 push 回覆。因此 LINE 通路必須在**伺服器端**自行完成「偵測 → 路由 → 生成 → 回覆」整個流程。

參考專案 `wendyyu170/linebot`（`feature/gemini-linebot`）已有可借鏡的 LINE 收發模組（`base_linebot.py`）、webhook 簽章驗證與 `markdown_converter.py`；但其多平台 / RAGflow / 工廠抽象不在本次範圍。

## Goals / Non-Goals

**Goals:**
- 讓現有租戶（如 `tpe_policy`）能以最小改動上架 LINE，且 LINE 使用者能透過既有 **AI 意圖路由**使用該租戶的**多個服務**。
- 核心 AI 邏輯**零重寫**：抽出通路無關的 `process_message()`，web 與 LINE 共用。
- 對既有 web 行為**零破壞**：`/api/chat` 等端點對外行為不變。

**Non-Goals:**
- 不支援 Telegram、RAGflow、LTC 報告、Word 文件生成。
- 不在 LINE 上實作 Quick Reply / Rich Menu（快捷鈕）與「模式切換 / 退出模式」UI（第二期再評估）。
- 不把外觀自訂、嵌入式 widget 套用至 LINE（通路上無意義）。
- 不改聊天前端；管理後台僅新增「LINE 設定」區塊，不重構既有頁面。

## Decisions

### D1. 抽出通路無關的 `process_message()`，web 與 LINE 共用
將 `/api/chat` 內「決定 mode → 建立服務 → 依類別分派 → 組裝回覆 → 記錄統計」的核心抽成 `process_message(tenant, text, user_id, mode=None, lang=None, lat_lng=None) -> dict`。HTTP route 變成薄包裝；LINE webhook 也呼叫同一函式。

- **替代方案**：LINE 端複製一份對話邏輯 → 否決，會造成兩套邏輯漂移。
- **理由**：單一真實邏輯，未來再加通路（若有）也只接這個函式。

### D2. LINE 沿用 AI 意圖路由（方式 A），不做快捷鈕
LINE 收到文字後，在 `process_message()` 內先跑既有意圖路由選服務，再生成回覆。使租戶的多服務（如 `tpe_policy` 5 個服務）在 LINE 自動分流。

- **替代方案 1**：LINE 固定走單一服務（如 `general`）→ 較快但失去多服務價值；列為可選的 per-tenant 設定（`line.intent_routing: false`）。
- **替代方案 2**：把 web 的 Quick Action 按鈕移植成 LINE Quick Reply → 工程量大、語意（mode 黏著）難對應 → 延後到第二期。
- **理由**：意圖路由純文字進出、平台無關，是 LINE 上最自然且改動最小的做法。

### D3. 非同步回覆 + 立即 200 + loading 動畫，reply 失敗 fallback push
webhook 立即回 `200 OK`，同步顯示 LINE loading 動畫，並把 `process_message()` 丟到背景執行緒（沿用既有 `_log_pool` 之外的獨立 ThreadPool）。生成完成後優先用 `reply_token` 回覆；若 token 已逾時/失效則改用 `push`。

- **替代方案**：webhook 內同步等 Gemini 回完再回覆 → 否決，意圖+生成兩次 Gemini 呼叫常超過 reply_token 30 秒，且拖住 webhook 造成 LINE 重送。
- **理由**：穩定性優先；loading 動畫填補等待感；push 作為保險。

### D4. 多租戶以「每租戶一個 webhook URL」分流
LINE webhook 入口為 `POST /webhook/line/<tenant_id>`，以 path 的 `tenant_id` 取得該租戶設定與憑證；用該租戶 `channel_secret` 驗 `X-Line-Signature`。

- **替代方案**：單一共用 URL + 以 LINE `destination`（bot 的 userId）反查租戶 → 需維護 destination→tenant 映射表，較複雜。
- **理由**：每租戶獨立 URL 最直觀，與既有「以 path/header 帶 tenant」的慣例一致。

### D5. session user_id 直接採用 LINE userId
`BaseGeminiService` 的 session key 已是 `{tenant}:{service}:{user}`，LINE webhook 直接把事件中的 LINE `userId` 當 `user_id` 傳入即可，天然支援、無需改 session 機制。

### D6. 憑證沿用既有 `.env` + `api_key_env` 機制
tenant 設定新增 `line.channel_access_token_env` / `line.channel_secret_env`（存環境變數名稱），值存 `.env`，由 `tenant_manager` 於取用時注入暫態欄位，與現有 Gemini 金鑰一致。

### D7. 回覆前 Markdown→純文字
LINE 不渲染 HTML/Markdown。回覆前以 markdown 轉純文字（移除粗體/標題/列表符號、保留連結為純 URL、references 併入文字尾）。

### D8. 管理後台「LINE 設定」採兩步驟 UX，憑證後台寫入、URL 後台顯示
LINE 的設定拆成兩步,對應憑證與 URL 的反方向流動:

- **步驟一(建立)**:新增品牌頁維持只填**品牌 ID**(+ 名稱/Gemini 設定)。儲存後品牌即存在,Webhook URL 隨即確定。
- **步驟二(設定 LINE)**:於品牌編輯區的「LINE 設定」區塊——
  - **顯示 Webhook URL**:由 `公開網域 + /webhook/line/ + 品牌ID` 推導,唯讀、可複製(不另存,避免與真實 route 漂移)。
  - **輸入 token/secret + 啟用開關**:儲存時呼叫管理端點,把 token/secret 寫入 `.env`(沿用既有 `update_env_file` 機制),`line` 區塊(`enabled`、`*_env`、`intent_routing`)寫入 `tenants.json`。
- **設定順序提示**:UI 標明「先在此填好 token/secret 並儲存,再到 LINE 後台貼上 Webhook URL 按 Verify」(因 Verify 會送帶簽章請求,我方需先有 secret 才能驗章)。

**憑證/URL 流向**:Channel secret + token 由 LINE → 我方(填表寫入 `.env`);Webhook URL 由我方 → LINE(顯示供複製)。

### D9. 加好友歡迎訊息刻意交給 LINE 原生功能,不接 `follow` 事件
LINE 使用者加好友的歡迎訊息,**刻意**由 LINE 官方帳號管理後台的原生歡迎功能負責,本平台**不**處理 `follow` 事件、也不把外觀頁的 `welcomeMessage` 推送到 LINE。

- **理由**:(1) 解耦——原生歡迎不依賴本平台後端,server 當機也照發,可靠性較高;(2) 零程式碼/零維護;(3) 原生支援圖片/貼圖/多則訊息/`{nickname}`,比純文字路徑豐富;(4) 加好友歡迎本屬 LINE 帳號層級的事,不應混入 AI 對話流程。
- **替代方案(選項 B)**:接 `follow` 事件、沿用租戶 `welcomeMessage` 自動發歡迎,達成「設定一次、web/LINE 兩邊同步」→ 暫不採用;僅在「租戶數量多到逐一登入 LINE 後台設定變成實質負擔」時再評估(屬小幅增量,可隨時補上)。
- **定位釐清**:外觀頁的 `welcomeMessage`、顏色/漸層等為 **web 專用**,不套用至 LINE。

### D10. 服務設定共用 + 稀疏覆寫(單一「LINE 啟用」開關),不做整套分平台設定
服務的核心設定(class / temperature / grounding / search_keyword / `prompt_file`)維持**單一共用**——設定一次,web 與 LINE 皆用。僅新增**一個** per-service 的「LINE 啟用」布林欄位(預設視為啟用),控制該服務是否納入 LINE 的意圖路由與可用範圍。

- **理由**:服務設定欄位中,平台無關者佔絕大多數,共用最省維護;純 web 欄位(loading/mode/顏色/快捷鈕)在 LINE 自動失效、無需使用者管理,也不構成衝突;真正需要分平台的只有「某服務要不要出現在 LINE」一件事(典型:`SmartRouteService` 在 LINE 降級、僅靠快捷鈕的 `QueryService` 在 LINE 體驗不佳,想只留在 web)。
- **資料模型**:服務 config 新增可選欄位(例如 `line_enabled`,預設 `true`);LINE 意圖路由的候選池 SHALL 排除 `line_enabled === false` 的服務。
- **替代方案(完整分平台設定)**:每服務的 prompt/參數可 web 與 LINE 各設一套 → 否決,使用者需維護兩套設定,違反「設定一次」的期待,複雜度與認知負擔過高。
- **替代方案(純維持現狀)**:完全共用、不加任何開關 → 可作為更省的起點,但無法將降級服務(如 SmartRoute)排除於 LINE,故採「共用 + 單一開關」為平衡點。
- **分平台 prompt 暫不做**:共用 prompt + markdown 轉純文字已足夠;若未來確有「LINE 需更精簡」需求,再以進階選用欄位增量加入。

- **替代方案**:在「新增品牌」頁就一次填 token/secret → 否決,建立當下通常還沒在 LINE 開好 channel(雞生蛋),且把建立與通路設定耦合;拆兩步更貼合既有 services/appearance 分頁結構。
- **替代方案**:Webhook URL 存進 DB/設定檔 → 否決,URL 是純推導值,顯示即可,落檔反而會與實際 route 不一致。

## Risks / Trade-offs

- **reply_token 30 秒逾時** → D3 以「立即 200 + loading + 背景處理 + push fallback」規避。
- **push 訊息有月額度** → 優先 reply、僅在 token 失效時 push；必要時記錄 push 使用量供觀察。
- **意圖路由增加一次 Gemini 呼叫、延長回應** → 由 D2 的 per-tenant `intent_routing` 開關提供「固定單一服務」的快速模式。
- **webhook 安全（簽章/重放）** → 強制 `X-Line-Signature` 驗證；驗章失敗回 400 且不處理。
- **LINE 不支援 carousel/卡片/地圖 widget** → 該類回覆在 LINE 降級為純文字（地圖回連結/地址）；於 spec 標注。
  - 技術註記：`SmartRouteService` 的 Google 來源是 **Gemini 內建 `google_maps` grounding 工具**（非獨立 Google Maps Platform SDK），伺服器端在 LINE 仍可正常呼叫、取得地點資料。LINE 上的降級**非 API 限制**，而是通路端兩項缺失：(1) GPS 座標（`lat_lng`）來自瀏覽器定位，LINE 一般文字訊息不帶座標 → 無法做「以使用者位置為起點」的導航；(2) 互動地圖 widget（`maps_widget_token`）需網頁渲染，LINE 僅能純文字 → 無法顯示互動地圖。若未來要在 LINE 取得座標，須另接 LINE 「位置訊息」事件（使用者手動分享、屬另一事件類型，不在本次範圍），且互動地圖 widget 仍無法於 LINE 渲染。
- **背景執行緒例外吞掉使用者回覆** → 背景任務需 try/except + 失敗時 push 一則 fallback 文案，避免使用者「已讀不回」。
- **授權相容性**：參考 repo 授權未明、本專案 AGPL-3.0 → 借用前確認，必要時依其作法自行重寫。

## Migration Plan

1. 加入 `line-bot-sdk` 依賴並更新後端映像。
2. 新增 LINE 通路模組與 `process_message()`，掛載 `/webhook/line/<tenant_id>`（不影響既有端點）。
3. 為試辦租戶在 `.env` 設定 LINE token/secret，於 `tenants.json` 加 `line` 區塊（`enabled:true`）。
4. Nginx 將 `/webhook/line/*` 導向主後端（:5000）。
5. 於 LINE 官方後台設定該租戶 webhook URL 並驗證；以單一租戶灰度上線。
6. **回滾**：將該租戶 `line.enabled` 設為 `false`（或移除 LINE 後台 webhook），web 通路與其他租戶不受影響。

## Open Questions

- 預設要不要對所有租戶開意圖路由，或預設固定 `general`？（影響回應速度與成本）
- ~~是否需要在管理後台新增 LINE 設定 UI~~ → **已定案(D8)**：採方案乙，管理後台兩步驟設定，token/secret 由後台寫入 `.env`。
- 「LINE 設定」放在品牌主編輯頁的一個區塊，或獨立子頁 `/admin/tenants/[id]/line`？（兩者皆可，傾向比照 services/appearance 用子頁）
- 是否需要記錄 LINE 通路的訊息統計（沿用 `message_logs`，新增 channel 欄位）？

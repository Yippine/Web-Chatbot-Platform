## ADDED Requirements

### Requirement: LINE Webhook 入口與簽章驗證

系統 SHALL 提供每租戶獨立的 LINE webhook 入口 `POST /webhook/line/<tenant_id>`，以該租戶的 channel secret 驗證 `X-Line-Signature`，驗證失敗則拒絕處理。

#### Scenario: 簽章有效

- **WHEN** webhook 請求帶有正確的 `X-Line-Signature`（以該租戶 channel secret 計算相符）
- **THEN** 系統解析事件並進入後續處理流程

#### Scenario: 簽章無效

- **WHEN** `X-Line-Signature` 缺失或與計算結果不符
- **THEN** 系統回 `400` 且不處理該請求

#### Scenario: 租戶未啟用 LINE

- **WHEN** path 的 `tenant_id` 對應租戶不存在，或其 `line.enabled` 非真
- **THEN** 系統拒絕該 webhook（不處理）

### Requirement: 非同步處理與即時回應

系統 SHALL 在收到 LINE webhook 後立即回 `200 OK` 並顯示 LINE loading 動畫，將 AI 對話處理交由背景執行緒完成，以符合 LINE 對 webhook 的時限要求並規避 reply_token 逾時。

#### Scenario: 立即回應並顯示 loading

- **WHEN** 通過簽章驗證的訊息事件進入
- **THEN** 系統立即回 `200 OK`、對該使用者顯示 loading 動畫，並於背景開始處理對話

#### Scenario: 背景處理例外不致已讀不回

- **WHEN** 背景對話處理拋出例外
- **THEN** 系統捕捉例外並以 push 送出一則 fallback 文案，使用者不會收不到任何回覆

### Requirement: 事件解析與多服務路由

系統 SHALL 將 LINE 文字訊息事件解析為使用者文字、LINE userId 與 reply token，並透過通路無關的對話協調器在該租戶的多個服務間自動分流。LINE 的分流行為 SHALL 與 web 一致：永遠進行 AI 意圖判斷，候選服務 = 所有 `enabled` 且非 `general` 的服務（不提供 LINE 專屬的分流開關或逐服務 LINE 過濾）。

#### Scenario: 文字訊息一律走意圖路由

- **WHEN** 收到使用者文字訊息
- **THEN** 系統以該文字進行意圖判斷選定服務（候選為該租戶所有已啟用服務），再以該服務設定生成回覆

#### Scenario: 候選與 web 相同

- **WHEN** 在 LINE 進行意圖路由
- **THEN** 候選服務集合與 web 相同（依各服務的「啟用服務」決定），無 LINE 專屬過濾

#### Scenario: 非文字訊息

- **WHEN** 事件非文字訊息（如貼圖、圖片）
- **THEN** 系統略過 AI 處理（本期不支援非文字輸入）

### Requirement: 服務類別在 LINE 的相容性與降級

意圖路由 SHALL 對該租戶的所有已啟用服務生效（純文字判斷，與通路無關）；被選中服務的執行結果在 LINE 上 SHALL 依其能力降級。`ChatService`、`QueryService`、`FrappeQueryService` SHALL 於 LINE 正常運作（純文字 + 純 URL references）。`SmartRouteService` 因 LINE 一般文字訊息不帶 GPS 座標且無法渲染互動地圖 widget，SHALL 降級為純文字答案（不做以使用者座標為起點的導航、不顯示地圖 widget）。

#### Scenario: 文字類服務正常運作

- **WHEN** 意圖路由在 LINE 選中 `ChatService`/`QueryService`/`FrappeQueryService`
- **THEN** 系統正常生成純文字回覆，references 以純 URL 併入文字

#### Scenario: SmartRouteService 降級

- **WHEN** 意圖路由在 LINE 選中 `SmartRouteService`
- **THEN** 系統在無 `lat_lng` 下執行，回純文字答案（地址/連結），不顯示地圖 widget、不做以使用者座標為起點的導航

#### Scenario: 路由品質依賴服務描述

- **WHEN** 某服務的名稱與 `search_keyword` 不足以表達其用途
- **THEN** 該服務在 LINE 較難被意圖路由選中（LINE 本期無快捷鈕作為備援入口），需以清楚的名稱/關鍵字補強

### Requirement: Session 對應 LINE 使用者

系統 SHALL 以 LINE userId 作為對話 session 的 `user_id`，沿用既有 `{tenant}:{service}:{user}` 的 Redis session 隔離。

#### Scenario: 同一 LINE 使用者維持對話脈絡

- **WHEN** 同一 LINE userId 在同一租戶連續對話
- **THEN** 系統以該 userId 維持 session 歷史，與 web 使用者及其他 LINE 使用者互不混淆

### Requirement: Webhook URL 推導與顯示

系統 SHALL 將每租戶的 LINE Webhook URL 定義為 `<公開網域>/webhook/line/<tenant_id>` 的推導值（不另行儲存），並於管理後台品牌建立後顯示供複製。

#### Scenario: 建立品牌後即可取得 URL

- **WHEN** 品牌以某 `tenant_id` 建立後
- **THEN** 管理後台顯示該品牌的 Webhook URL `<公開網域>/webhook/line/<tenant_id>`（唯讀、可複製）

#### Scenario: URL 與實際 route 一致

- **WHEN** 顯示 Webhook URL
- **THEN** 其 path 與實際處理該品牌的 webhook route 相同，URL 不另存於設定檔以避免漂移

### Requirement: 回覆策略與 Markdown 降級

系統 SHALL 在生成回覆後將 Markdown 內容降級為 LINE 可顯示的純文字（references 併入文字尾），並優先以 reply token 回覆，token 失效時改用 push。

#### Scenario: reply token 仍有效

- **WHEN** 背景處理完成且 reply token 尚未逾時
- **THEN** 系統以 reply 送出純文字回覆

#### Scenario: reply token 已失效

- **WHEN** 背景處理完成但 reply token 已逾時/失效
- **THEN** 系統改以 push 送出回覆

#### Scenario: 富媒體回覆降級

- **WHEN** 回覆內容含 Markdown、卡片、carousel 或地圖 widget 等富媒體
- **THEN** 系統降級為純文字（連結保留為純 URL、地圖回連結/地址）後送出

### Requirement: 語言行為兩層分離

系統 SHALL 區分兩層語言行為:LINE 通路 SHALL 沿用「AI 回覆語言」層(依使用者訊息偵測語言並令 Gemini 以該語言回覆,平台無關);LINE 通路 SHALL NOT 套用「UI 多語系翻譯」層(標題、歡迎語、服務名稱、loading/mode 文案等網頁介面翻譯),因 LINE 無對應的網頁 UI。

#### Scenario: 回覆語言跟隨使用者

- **WHEN** LINE 使用者以某語言(如日文)發訊
- **THEN** 系統以該語言回覆(沿用與 web 相同的回覆語言機制),無需任何 per-service 語言設定

#### Scenario: UI 多語系翻譯不影響 LINE

- **WHEN** 管理後台修改或生成品牌的 UI 多語系翻譯
- **THEN** LINE 通路的行為不受影響(LINE 不渲染標題/歡迎卡/按鈕/loading 文字等網頁 UI)

#### Scenario: 服務頁無語言欄位

- **WHEN** 編輯某服務的設定
- **THEN** 不存在「語言設定」欄位可改;LINE 回覆語言由執行期使用者偵測決定,而非服務層設定

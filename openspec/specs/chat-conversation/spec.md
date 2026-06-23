# chat-conversation Specification

## Purpose

定義平台核心對話能力：統一對話端點 `/api/chat` 的服務分派、Gemini 對話生成引擎（`BaseGeminiService`）的 session 管理、grounding/url_context/Maps 工具組裝、多階降級（fallback）、參考連結抽取，以及各服務類別（ChatService/QueryService/SmartRouteService/FrappeQueryService）的對話行為與資料查詢端點 `/api/query/data`。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 統一對話分派

系統 SHALL 提供 `POST /api/chat`，依前端傳入的 `mode` 建立對應服務，依服務類別決定呼叫方法並組裝回應，回應依服務類別帶不同 `type`。

- 輸入：`message`(必填)、`user_id`(預設 `default`)、`mode`、`lang`、`lat_lng`
- 回應 `type`：`QueryService→query`、`SmartRouteService→route`、`ChatService(含 FrappeQueryService 子類)→chat`、其他→`general`

#### Scenario: 缺少訊息

- **WHEN** 請求 body 無 `message`
- **THEN** 回 `400`

#### Scenario: 服務不可用

- **WHEN** `mode` 對應的服務無法建立
- **THEN** 回 `503 {"error":"服務 '<name>' 不可用"}`

#### Scenario: 未捕捉例外

- **WHEN** 對話處理過程拋出未預期例外
- **THEN** 回 `500 {"error": <str(e)>}`

#### Scenario: 依服務類別回不同 type

- **WHEN** 服務成功回應
- **THEN** `QueryService` 回 `{type:"query",...}`、`SmartRouteService` 回 `{type:"route",...,tool_used}`、`ChatService` 回 `{type:"chat",...}`

#### Scenario: Quick Action 動態建服務

- **WHEN** `mode` 對應到某 `quick_actions[].service`
- **THEN** 系統以該 quick_action 的 `temperature`/`use_grounding`/`search_keyword`/`prompt_file` 覆寫參數動態建立服務（class 由 `tenant.services[svc].class` 決定，預設 ChatService）

### Requirement: Session 隔離與歷史管理

`BaseGeminiService` SHALL 以 Redis 維持對話 session，key 格式 `gemini_session:{tenant_id}:{service_name}:{user_id}`（三維隔離），TTL 3600 秒，歷史上限 16 條（8 輪），超過保留最近 16 條。

#### Scenario: Session 三維隔離

- **WHEN** 同一 user 對不同租戶或不同服務發話
- **THEN** 各自使用獨立的 session key，歷史互不混淆

#### Scenario: 歷史截尾

- **WHEN** 對話歷史超過 16 條
- **THEN** 系統截尾保留最近 16 條

#### Scenario: Redis 故障容錯

- **WHEN** Redis load/save 過程拋例外
- **THEN** 系統印錯誤，load 回空歷史、save 略過，不中斷對話

#### Scenario: Redis 初始化失敗硬擋

- **WHEN** 服務建構期 `_init_redis` ping 失敗
- **THEN** 拋例外導致服務建立失敗，上游回 `503`

### Requirement: 工具組裝與語言/搜尋增強

`BaseGeminiService` SHALL 依設定組裝 Gemini 工具（Maps 與 Search 互斥、url_context 可疊加），並在需要時注入搜尋關鍵字前綴與強制回覆語言指令。

#### Scenario: 搜尋關鍵字前綴

- **WHEN** 服務設了 `search_keyword` 且 `use_grounding` 開啟
- **THEN** 查詢前綴拼為 `"{keyword} {query}"`

#### Scenario: 限定網域 url_context

- **WHEN** `config.allowed_domains` 非空
- **THEN** 啟用 url_context 工具並把 `https://<domain>` 附加至查詢文字

#### Scenario: 強制回覆語言

- **WHEN** `response_language` 存在且不等於 `Traditional Chinese`
- **THEN** 在 system prompt 追加「MUST respond in <lang>」指令

#### Scenario: 工具互斥優先序

- **WHEN** 同時可能啟用 maps 與 grounding
- **THEN** `use_maps` 優先採 google_maps 工具，否則採 google_search；url_context 可與其一併存

### Requirement: 多階降級保證可回應

`BaseGeminiService` SHALL 在工具或生成失敗時逐階降級，並對 `503/429/UNAVAILABLE/RESOURCE_EXHAUSTED` 退避重試（最多 2 次），最終仍以固定文案回應而非錯誤。

#### Scenario: url_context 失敗改純搜尋

- **WHEN** url_context 啟用但偵測到 URL 取得失敗或回應為空
- **THEN** 移除該 user content，改用純 google_search（若 use_grounding）重打

#### Scenario: 最終空白回應 fallback

- **WHEN** 重試後回應仍為空
- **THEN** 回固定文案「抱歉，AI 模型暫時無法回應，請稍後再試一次~~~」，HTTP 仍 200

### Requirement: 參考連結抽取

`BaseGeminiService` SHALL 從 grounding metadata 抽取參考連結，grounding 來源僅保留命中 `allowed_domains` 的 URL，最多 3 筆。

#### Scenario: grounding 參考過濾

- **WHEN** 抽取 grounding 參考且服務設有 `allowed_domains`
- **THEN** 僅保留命中網域的 URL（最多 3 筆）；未設 `allowed_domains` 時回空

#### Scenario: 地圖參考抽取

- **WHEN** 使用 Maps 工具
- **THEN** 從 grounding_chunks 抽取 maps(title/uri/place_id) 與 web 參考，並嘗試取 maps widget token

### Requirement: 資料查詢端點

系統 SHALL 提供 `GET /api/query/data`，由 `QueryService.get_data` 以 `search_keyword` 組查回傳資料；非 `QueryService` 的服務不支援此操作。

#### Scenario: 非 QueryService 服務

- **WHEN** `/api/query/data` 指向的服務非 `QueryService`
- **THEN** 回 `400`（不支援 get_data）

#### Scenario: 服務不可用

- **WHEN** `/api/query/data` 指向的服務無法建立
- **THEN** 回 `503`

### Requirement: Frappe ERP 即時查詢

`FrappeQueryService` SHALL 以 AI 模糊配對解析意圖、即時呼叫 Frappe REST API（timeout 8s）取資料、再以 Gemini 生成自然語言回答，REST 失敗時優雅降級。

#### Scenario: REST 逾時降級

- **WHEN** Frappe REST 請求逾時或出錯
- **THEN** 回空集合（`[]`/`{}`）而不丟出例外

#### Scenario: 查無資料

- **WHEN** 查詢結果為空
- **THEN** 回「找不到相關資料」類訊息，`references:[]`

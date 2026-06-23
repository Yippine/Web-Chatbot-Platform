# service-configuration Specification

## Purpose

定義租戶下「服務（service）」的配置模型、以工廠模式動態實例化 Gemini 服務的生命週期，以及管理後台對服務的 CRUD。每個服務綁定一個服務類別（`ChatService`/`QueryService`/`SmartRouteService`/`FrappeQueryService`），並可調 temperature、grounding、搜尋關鍵字等參數。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 服務配置模型

系統 SHALL 以租戶設定內的 `services` 字典定義各服務，每個服務配置包含 `name`、`icon`、`enabled`、`class`、`prompt_file`、`temperature`、`use_grounding`、`search_keyword`、`allowed_domains`、`loading_message`、`query_loading_message`、`mode_message`、`show_mode_message`，以及 `FrappeQueryService` 專用的 `frappe`。

#### Scenario: 服務參數預設值

- **WHEN** 服務配置未指定 `temperature` 或 `use_grounding` 或 `class`
- **THEN** 系統採用預設值：`temperature=0.7`、`use_grounding=True`、`class=ChatService`

### Requirement: 服務工廠建立

系統 SHALL 透過 `ServiceFactory.create_service(tenant_id, service_name)` 依序驗證租戶、服務存在性、啟用狀態與 API Key，再依 `class` 映射實例化對應服務類別並注入參數。每次請求皆新建服務實例（無實例快取）。

#### Scenario: 正常建立服務

- **WHEN** 租戶存在、服務存在且啟用、租戶具備 `gemini_api_key`
- **THEN** 系統依 `class` 建立服務實例，注入 `temperature`/`use_grounding`/`search_keyword`/`config`，並在 `prompt_file` 載入成功時覆寫 `SYSTEM_PROMPT`

#### Scenario: 服務不可用回 503

- **WHEN** 服務不存在、`enabled=false`、或租戶缺 `gemini_api_key`
- **THEN** 工廠回 `None`，上游 `/api/chat` 回 `503 {"error":"服務 '<name>' 不可用"}`

#### Scenario: 未知服務類別降級

- **WHEN** 服務 `class` 字串無對應的已註冊類別
- **THEN** 系統靜默 fallback 為 `ChatService`，不報錯

#### Scenario: 實例化例外

- **WHEN** 服務建構過程拋出例外
- **THEN** 工廠捕捉例外並回 `None`（轉為上游 503）

### Requirement: 服務類別清單（管理後台）

管理後台 SHALL 提供 `GET /api/admin/service-classes`，回傳可用服務類別及其說明，供前端選用。

#### Scenario: 取得服務類別

- **WHEN** 請求 `GET /api/admin/service-classes`
- **THEN** 回 `{classes:[{value,label,description}]}`，涵蓋 `ChatService`、`QueryService`、`SmartRouteService`、`FrappeQueryService`

### Requirement: 服務 CRUD（管理後台）

管理後台 SHALL 提供租戶下服務的列出、取得（含提示詞）、新增、更新、刪除端點。新增/刪除服務時 SHALL 同步維護 `quick_actions`。

- 列出：`GET /api/admin/tenants/<id>/services`
- 取得：`GET /api/admin/tenants/<id>/services/<service>`（含 `prompt_content`）
- 新增：`POST /api/admin/tenants/<id>/services`
- 更新：`PUT /api/admin/tenants/<id>/services/<service>`
- 刪除：`DELETE /api/admin/tenants/<id>/services/<service>`

#### Scenario: 新增服務成功

- **WHEN** `POST .../services` 帶唯一 `service_id`
- **THEN** 系統以預設 `class=ChatService`、`temperature=0.7`、`use_grounding=True`、`prompt_file=prompts/<tenant>/<service_id>.md` 建立服務、（非 `general`）自動加入 `quick_actions`、若帶 `prompt_content` 則寫提示詞檔，回 `201`

#### Scenario: 新增缺少 service_id

- **WHEN** `POST .../services` 未提供 `service_id`
- **THEN** 回 `400 {"error":"缺少服務 ID"}`

#### Scenario: 新增重複服務

- **WHEN** `service_id` 已存在於該租戶
- **THEN** 回 `409 {"error":"服務已存在"}`

#### Scenario: 租戶或服務不存在

- **WHEN** GET/PUT/DELETE 的目標租戶或服務不存在
- **THEN** 分別回 `404 {"error":"租戶不存在"}` 或 `404 {"error":"服務不存在"}`

#### Scenario: 刪除服務同步清理

- **WHEN** `DELETE .../services/<service>` 成功
- **THEN** 系統刪除服務並從 `quick_actions` 移除對應項，重新載入並清除快取

### Requirement: FrappeQueryService 建構約束

當服務類別為 `FrappeQueryService` 時，系統 SHALL 要求 `config.frappe` 提供 `url` 與 `queries`，缺失則建構失敗。

#### Scenario: Frappe 設定缺失

- **WHEN** `FrappeQueryService` 建構時缺 `frappe.url` 或 `frappe.queries`
- **THEN** 建構子拋 `ValueError`，被工廠捕捉為 `None`，上游回 `503`

# prompt-management Specification

## Purpose

定義系統提示詞（system prompt）的目錄組織、路徑解析與載入覆寫機制，以及管理後台對提示詞內容的線上編輯與 Frappe 模組模板。提示詞以 Markdown 檔案儲存，按租戶/服務分目錄。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 提示詞目錄組織

系統 SHALL 以 `prompts/<tenant_id>/<service_name>.md` 的結構組織提示詞，每檔對應一個服務，每租戶目錄通常含 `general.md` 作為通用服務提示詞。

#### Scenario: 提示詞檔案定位

- **WHEN** 服務配置的 `prompt_file` 指向 `prompts/<tenant>/<service>.md`
- **THEN** 系統以該明示路徑（相對 backend 根）讀取檔案，而非由 tenant_id+service_name 隱式推導

### Requirement: 提示詞載入與覆寫

系統 SHALL 在服務建立時以 `load_prompt(prompt_file)` 讀取 UTF-8 純文字，內容非空時覆寫服務實例的 `SYSTEM_PROMPT`。

#### Scenario: 提示詞成功載入

- **WHEN** `prompt_file` 對應檔案存在且內容非空
- **THEN** 系統以檔案內容覆寫服務的 `SYSTEM_PROMPT`

#### Scenario: 提示詞檔案缺失降級

- **WHEN** `prompt_file` 對應檔案不存在或讀取例外
- **THEN** `load_prompt` 印警告並回空字串，工廠因內容為空而不覆寫，服務沿用類別預設 `SYSTEM_PROMPT`

#### Scenario: 服務未設定 prompt_file

- **WHEN** 服務配置無 `prompt_file`
- **THEN** 系統跳過載入，使用類別預設提示詞

### Requirement: 提示詞線上編輯（管理後台）

管理後台 SHALL 在取得服務時一併回傳 `prompt_content`，並在新增/更新服務帶 `prompt_content` 時寫入對應 `.md` 檔（自動建立目錄）。

#### Scenario: 取得服務含提示詞

- **WHEN** `GET /api/admin/tenants/<id>/services/<service>`
- **THEN** 回 `{service:{...}, prompt_content:<檔案文字>}`

#### Scenario: 編輯提示詞內容

- **WHEN** 新增或更新服務時帶 `prompt_content`
- **THEN** 系統將內容寫入 `prompts/<tenant>/<service>.md`（必要時建立目錄）

### Requirement: Frappe 模組模板（管理後台）

管理後台 SHALL 提供 `GET /api/admin/frappe/templates`，回傳預建的 Frappe 模組模板（含 `label`/`icon`/`description`/`default_prompt`/`queries`），供 `FrappeQueryService` 一鍵帶入查詢定義與預設提示詞。

#### Scenario: 取得 Frappe 模板

- **WHEN** 請求 `GET /api/admin/frappe/templates`
- **THEN** 回 `{templates:[{key,label,icon,description,default_prompt,queries}]}`

> 註：Frappe 模板是供管理介面選用的範本，非執行期提示詞。

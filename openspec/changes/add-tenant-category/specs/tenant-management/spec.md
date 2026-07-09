## MODIFIED Requirements

### Requirement: 租戶資料模型

系統 SHALL 以 `tenants.json` 作為租戶設定的單一真實來源（SSOT），其結構為 `{tenant_id: tenant_config}` 字典，每個租戶包含 `id`、`name`、`api_key_env`、`enabled`、`category_id`、`services`、`quick_actions`、`appearance` 等欄位。

- `api_key_env` 存放環境變數名稱字串（如 `TENANT_LEOSYS_GEMINI_API_KEY`），而非金鑰明文。
- `gemini_api_key` 不存於 JSON，為執行期由 `.env` 動態注入的暫態欄位。
- `category_id` 參照 `categories.json` 中的分類識別碼，標示該租戶所屬的分類（見 `tenant-category` 規格）。

#### Scenario: 租戶設定鍵與 id 對應

- **WHEN** 讀取 `tenants.json` 中某個 key 對應的租戶
- **THEN** 該租戶物件的 `id` 欄位與字典 key 相同，且包含 `name`、`api_key_env`、`enabled`、`category_id`、`services`、`quick_actions`、`appearance` 欄位

#### Scenario: 金鑰以環境變數名稱保存

- **WHEN** 租戶設定了 API Key
- **THEN** `tenants.json` 僅儲存 `api_key_env`（環境變數名稱），金鑰明文存於 `.env`，不出現在 JSON 內

#### Scenario: 既有租戶皆歸屬既有分類

- **WHEN** 讀取既有 93 筆租戶設定
- **THEN** 每筆租戶的 `category_id` 皆對應 `categories.json` 中「智慧行銷處」「教案」「汽車」三者之一，不存在未分類的租戶

### Requirement: 租戶 CRUD（管理後台）

管理後台 SHALL 提供租戶的列出、查詢、建立、更新、刪除端點，所有寫操作完成後 SHALL 重新載入設定，更新/刪除另需清除服務工廠快取。

- 列出：`GET /api/admin/tenants` → `{tenants:[{id,name,enabled,category_id,services_count}]}`
- 查詢：`GET /api/admin/tenants/<id>`（先查啟用者，fallback 查全部含未啟用）
- 建立：`POST /api/admin/tenants`（`category_id` 為必填）
- 更新：`PUT /api/admin/tenants/<id>`
- 刪除：`DELETE /api/admin/tenants/<id>`

#### Scenario: 建立租戶成功

- **WHEN** `POST /api/admin/tenants` 帶唯一的 `id` 與有效的 `category_id`
- **THEN** 系統建立租戶、預設帶入一個 `general`（ChatService）服務與空 `appearance`、若帶 `gemini_api_key` 則寫入 `.env` 的 `TENANT_<ID大寫>_GEMINI_API_KEY` 並於租戶存 `api_key_env`、建立 `prompts/<id>/general.md`，回 `201`

#### Scenario: 建立缺少 id

- **WHEN** `POST /api/admin/tenants` 未提供 `id`
- **THEN** 回 `400 {"error":"缺少租戶 ID"}`

#### Scenario: 建立缺少或無效的 category_id

- **WHEN** `POST /api/admin/tenants` 未提供 `category_id`，或提供的 `category_id` 不存在於 `categories.json`
- **THEN** 回 `400 {"error":"缺少或無效的分類"}`，不建立租戶

#### Scenario: 建立重複 id

- **WHEN** `POST /api/admin/tenants` 的 `id` 已存在
- **THEN** 回 `409 {"error":"租戶 ID 已存在"}`

#### Scenario: 更新不存在的租戶

- **WHEN** `PUT` 或 `DELETE` 目標租戶不存在
- **THEN** 回 `404 {"error":"租戶不存在"}`

#### Scenario: 更新時金鑰空字串不覆寫

- **WHEN** `PUT /api/admin/tenants/<id>` 帶空字串 `gemini_api_key`
- **THEN** 系統不更新金鑰，保留原有設定

#### Scenario: 更新租戶所屬分類

- **WHEN** `PUT /api/admin/tenants/<id>` 帶新的 `category_id`，且該分類存在於 `categories.json`
- **THEN** 系統更新該租戶的 `category_id`

#### Scenario: 刪除租戶清理金鑰

- **WHEN** `DELETE /api/admin/tenants/<id>` 成功
- **THEN** 系統從 `.env` 移除對應金鑰、從 `tenants.json` 刪除租戶、重新載入並清除快取，回成功訊息

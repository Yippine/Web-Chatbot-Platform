# tenant-management Specification

## Purpose

定義多租戶設定的資料模型、載入與熱更新機制、各租戶 Gemini API Key 的環境變數注入，以及管理後台對租戶（品牌）的 CRUD。租戶設定為平台所有功能的根基：每個租戶擁有獨立的服務、提示詞、外觀與 Quick Actions。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 租戶資料模型

系統 SHALL 以 `tenants.json` 作為租戶設定的單一真實來源（SSOT），其結構為 `{tenant_id: tenant_config}` 字典，每個租戶包含 `id`、`name`、`api_key_env`、`enabled`、`services`、`quick_actions`、`appearance` 等欄位。

- `api_key_env` 存放環境變數名稱字串（如 `TENANT_LEOSYS_GEMINI_API_KEY`），而非金鑰明文。
- `gemini_api_key` 不存於 JSON，為執行期由 `.env` 動態注入的暫態欄位。

#### Scenario: 租戶設定鍵與 id 對應

- **WHEN** 讀取 `tenants.json` 中某個 key 對應的租戶
- **THEN** 該租戶物件的 `id` 欄位與字典 key 相同，且包含 `name`、`api_key_env`、`enabled`、`services`、`quick_actions`、`appearance` 欄位

#### Scenario: 金鑰以環境變數名稱保存

- **WHEN** 租戶設定了 API Key
- **THEN** `tenants.json` 僅儲存 `api_key_env`（環境變數名稱），金鑰明文存於 `.env`，不出現在 JSON 內

### Requirement: 租戶設定載入與容錯

系統 SHALL 於啟動時從設定檔載入租戶，設定檔路徑優先取環境變數 `TENANTS_CONFIG_PATH`，否則 fallback 至模組同目錄的 `tenants.json`。載入失敗時 SHALL 優雅降級而不中斷服務。

#### Scenario: 設定檔不存在

- **WHEN** 設定檔路徑不存在
- **THEN** 系統將租戶集合設為空字典、印出警告，且不拋出例外

#### Scenario: JSON 解析失敗

- **WHEN** 設定檔內容非合法 JSON
- **THEN** 系統捕捉例外、將租戶集合設為空字典，服務仍可啟動

### Requirement: 租戶設定熱更新

系統 SHALL 在每次取用租戶設定時重新讀取 `tenants.json`（`auto_reload=True`），使設定變更免重啟即時生效。

#### Scenario: 設定變更即時生效

- **WHEN** 外部修改了 `tenants.json` 後有新請求進來
- **THEN** 系統以最新檔案內容回應，無需重啟容器

### Requirement: API Key 即時注入

當租戶具有 `api_key_env` 時，系統 SHALL 於取用租戶時即時從 `.env` 讀取對應變數值，寫入該租戶的暫態 `gemini_api_key` 欄位。

#### Scenario: 環境變數存在

- **WHEN** `api_key_env` 指向的變數存在於 `.env`
- **THEN** 系統將其值注入 `tenant['gemini_api_key']`

#### Scenario: 環境變數缺失

- **WHEN** `api_key_env` 指向的變數在 `.env` 不存在
- **THEN** 系統印出警告但仍回傳租戶物件（`gemini_api_key` 留空），錯誤延後至服務建立階段才浮現

### Requirement: 租戶啟用狀態判定

系統 SHALL 將 `enabled=false` 的租戶視同不存在；`enabled` 欄位缺失時預設為 `true`。

#### Scenario: 停用租戶不可取用

- **WHEN** 透過 `get_tenant` 取用一個 `enabled=false` 的租戶
- **THEN** 回傳 `None`，使下游驗證視其為無效租戶

### Requirement: 租戶 CRUD（管理後台）

管理後台 SHALL 提供租戶的列出、查詢、建立、更新、刪除端點，所有寫操作完成後 SHALL 重新載入設定，更新/刪除另需清除服務工廠快取。

- 列出：`GET /api/admin/tenants` → `{tenants:[{id,name,enabled,services_count}]}`
- 查詢：`GET /api/admin/tenants/<id>`（先查啟用者，fallback 查全部含未啟用）
- 建立：`POST /api/admin/tenants`
- 更新：`PUT /api/admin/tenants/<id>`
- 刪除：`DELETE /api/admin/tenants/<id>`

#### Scenario: 建立租戶成功

- **WHEN** `POST /api/admin/tenants` 帶唯一的 `id`
- **THEN** 系統建立租戶、預設帶入一個 `general`（ChatService）服務與空 `appearance`、若帶 `gemini_api_key` 則寫入 `.env` 的 `TENANT_<ID大寫>_GEMINI_API_KEY` 並於租戶存 `api_key_env`、建立 `prompts/<id>/general.md`，回 `201`

#### Scenario: 建立缺少 id

- **WHEN** `POST /api/admin/tenants` 未提供 `id`
- **THEN** 回 `400 {"error":"缺少租戶 ID"}`

#### Scenario: 建立重複 id

- **WHEN** `POST /api/admin/tenants` 的 `id` 已存在
- **THEN** 回 `409 {"error":"租戶 ID 已存在"}`

#### Scenario: 更新不存在的租戶

- **WHEN** `PUT` 或 `DELETE` 目標租戶不存在
- **THEN** 回 `404 {"error":"租戶不存在"}`

#### Scenario: 更新時金鑰空字串不覆寫

- **WHEN** `PUT /api/admin/tenants/<id>` 帶空字串 `gemini_api_key`
- **THEN** 系統不更新金鑰，保留原有設定

#### Scenario: 刪除租戶清理金鑰

- **WHEN** `DELETE /api/admin/tenants/<id>` 成功
- **THEN** 系統從 `.env` 移除對應金鑰、從 `tenants.json` 刪除租戶、重新載入並清除快取，回成功訊息

### Requirement: 讀-改-寫並發緩解

管理後台寫入租戶前 SHALL 先重新載入設定再合併寫回整檔，以降低多 worker 覆蓋風險。

#### Scenario: 寫前重載

- **WHEN** 任一租戶寫操作執行
- **THEN** 系統先 `reload()` 取得最新狀態，合併變更後寫回整個 `tenants.json`

> 註（現狀偏差）：寫入為「讀-改-寫整檔」非原子操作，無樂觀鎖/版本號，並發下仍可能發生 lost update（最後寫入者勝出）。

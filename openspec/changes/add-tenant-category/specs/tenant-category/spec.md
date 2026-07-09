## ADDED Requirements

### Requirement: 分類資料模型

系統 SHALL 以 `backend/data/categories.json` 作為分類設定的單一真實來源（SSOT），結構為 `{category_id: {"id": category_id, "name": "顯示名稱"}}`。`category_id` 為不可變識別碼，`name` 為可編輯的顯示名稱。

#### Scenario: 分類鍵與 id 對應

- **WHEN** 讀取 `categories.json` 中某個 key 對應的分類
- **THEN** 該分類物件的 `id` 欄位與字典 key 相同，且包含 `name` 欄位

### Requirement: 分類列出與建立（管理後台）

管理後台 SHALL 提供分類的列出與建立端點：

- 列出：`GET /api/admin/categories` → `{categories:[{id,name}]}`
- 建立：`POST /api/admin/categories`（帶 `id`、`name`）

#### Scenario: 建立分類成功

- **WHEN** `POST /api/admin/categories` 帶唯一的 `id` 與 `name`
- **THEN** 系統於 `categories.json` 新增該分類，回 `201`

#### Scenario: 建立缺少必要欄位

- **WHEN** `POST /api/admin/categories` 未提供 `id` 或 `name`
- **THEN** 回 `400 {"error":"缺少分類 id 或名稱"}`

#### Scenario: 建立重複 id

- **WHEN** `POST /api/admin/categories` 的 `id` 已存在於 `categories.json`
- **THEN** 回 `409 {"error":"分類 ID 已存在"}`

### Requirement: 分類重新命名（管理後台）

管理後台 SHALL 提供分類重新命名端點：`PUT /api/admin/categories/<id>`（帶新的 `name`），僅能修改 `name`，不影響 `id` 或既有租戶的 `category_id` 歸屬。

#### Scenario: 重新命名成功

- **WHEN** `PUT /api/admin/categories/<id>` 帶新的 `name`，且該分類存在
- **THEN** 系統更新 `categories.json` 中對應分類的 `name`，回成功訊息，所有已歸屬該分類的租戶不受影響

#### Scenario: 重新命名不存在的分類

- **WHEN** `PUT /api/admin/categories/<id>` 目標分類不存在
- **THEN** 回 `404 {"error":"分類不存在"}`

### Requirement: 分類刪除（管理後台）

管理後台 SHALL 提供分類刪除端點：`DELETE /api/admin/categories/<id>`。若該分類底下仍有任何租戶歸屬（`category_id` 等於該分類 id），系統 SHALL 拒絕刪除，避免產生歸屬不存在分類的孤兒租戶。

#### Scenario: 刪除空分類成功

- **WHEN** `DELETE /api/admin/categories/<id>` 的目標分類存在，且沒有任何租戶的 `category_id` 等於該分類 id
- **THEN** 系統從 `categories.json` 移除該分類，回成功訊息

#### Scenario: 分類底下仍有租戶時拒絕刪除

- **WHEN** `DELETE /api/admin/categories/<id>` 的目標分類底下仍有租戶歸屬
- **THEN** 回 `409 {"error":"分類底下仍有品牌，請先將品牌移至其他分類"}`，不刪除該分類

#### Scenario: 刪除不存在的分類

- **WHEN** `DELETE /api/admin/categories/<id>` 目標分類不存在
- **THEN** 回 `404 {"error":"分類不存在"}`

### Requirement: 分類無存取邊界

分類 SHALL 僅作為租戶的組織性分組，不 SHALL 影響 Admin API Key 的存取範圍；持有有效 Admin API Key 者可列出、查看、篩選任一分類。

#### Scenario: 網址帶分類參數不限制存取範圍

- **WHEN** 使用者以 `?category=<id>` 開啟品牌管理頁
- **THEN** 頁面預設篩選顯示該分類的品牌，但使用者仍可切換 tab 檢視或篩選其他任一分類，系統不因網址參數限制其可見範圍

### Requirement: 品牌列表頁依分類分組

品牌管理頁（`/admin/tenants`）SHALL 以分類 tab 呈現租戶列表（含「全部」tab），並將目前選取的分類反映在網址查詢參數 `category` 上；頁面 SHALL 提供新增分類的入口。

#### Scenario: 切換分類 tab

- **WHEN** 使用者點擊某個分類 tab
- **THEN** 列表僅顯示 `category_id` 對應該分類的租戶，且網址更新為帶有 `?category=<id>`

#### Scenario: 帶分類參數開啟頁面

- **WHEN** 使用者開啟帶有 `?category=<id>` 的品牌管理頁網址
- **THEN** 頁面載入後預設停在該分類對應的 tab

#### Scenario: 頁內新增分類

- **WHEN** 使用者透過分類 tab 列的新增入口建立新分類
- **THEN** 系統呼叫分類建立端點，成功後 tab 列即時顯示新分類，無需重新整理頁面

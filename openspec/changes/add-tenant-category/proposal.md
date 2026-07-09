## Why

目前 93 個租戶（品牌）在 `tenants.json` 中是攤平的一份清單，管理後台的「品牌管理」頁也是單一張表，沒有任何分組概念。內部團隊實際上早已依業務線把品牌分成「智慧行銷處」（Vivian，11 個）、「教案」（alina，3 個）、「汽車」（angela，79 個）三群在管理，但這個分類目前只存在於 Excel/口頭認知裡，管理後台完全看不出來。品牌數量還會持續成長（汽車類已知還有客戶尚未建立品牌），沒有分類會讓列表越來越難維護，新增品牌時也無法明確歸屬。

## What Changes

- 新增「分類」（Category）資料模型，可手動建立分類（如智慧行銷處、教案、汽車），僅需名稱，不含使用者權限或存取邊界（後台仍共用同一組 Admin API Key，分類純粹是組織性的分組，不做資料隔離）。
- 品牌管理頁（`/admin/tenants`）改為依分類提供 tab 篩選（全部 / 智慧行銷處 / 教案 / 汽車 / ...），並可在頁面上直接新增分類。
- 篩選狀態反映在網址上（`?category=<id>`），可將指向特定分類的網址複製分享；分享出去的網址僅決定開啟頁面時預設停在哪個 tab，任何持有 Admin API Key 的人仍可切換查看其他分類（沒有存取限制）。
- 新增品牌時可（且需要）指定所屬分類；在某分類 tab 下點擊「新增品牌」時，自動帶入該分類。
- 既有 93 個租戶一次性回填分類：智慧行銷處 11 個、教案 3 個、汽車 79 個（含 2 個未使用 `_car` 命名慣例但屬汽車業務的品牌：`hl_motor`、`changyi_tyre`），資料對應已與使用者逐筆核對確認，不留未分類項目。

## Capabilities

### New Capabilities
- `tenant-category`: 分類的資料模型與 CRUD（建立、列出、重新命名），以及租戶與分類的歸屬關係管理。

### Modified Capabilities
- `tenant-management`: 租戶資料模型新增 `category_id` 欄位；建立租戶端點（`POST /api/admin/tenants`）的請求/回應納入分類欄位；列出租戶端點（`GET /api/admin/tenants`）回傳分類資訊供前端分組。

## Impact

- **資料**：`backend/data/tenants.json` 每筆租戶新增 `category_id`；新增一份分類清單來源（如 `backend/data/categories.json`）。
- **後端**：`backend/config/tenant_manager.py`（載入/校驗分類）、`backend/admin_app.py`（新增分類 CRUD 端點、既有租戶 CRUD 端點納入 `category_id`）。
- **前端**：`app/admin/tenants/page.tsx`（分組 tab、`?category=` query 參數、頁內新增分類入口）、`app/admin/tenants/[id]/page.tsx`（新增品牌表單納入分類選擇/自動帶入）、`src/lib` 下的 Admin API client。
- **一次性資料遷移**：既有 93 筆租戶回填 `category_id`，不影響其餘欄位與既有功能（服務、外觀、LINE、Prompt 等維持不變）。
- **不影響**：`admin-authentication`（沿用單一 Admin API Key，不做使用者/角色分級）、對外聊天端點與租戶驗證中介層（`tenant_auth.py`）。

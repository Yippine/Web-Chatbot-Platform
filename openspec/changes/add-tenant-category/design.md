## Context

`tenants.json` 目前是攤平的 `{tenant_id: tenant_config}` 字典（93 筆），`backend/admin_app.py` 提供品牌 CRUD，`app/admin/tenants/page.tsx` 是單一張未分組的表格。後台認證維持單一共用 `ADMIN_API_KEY`（見 `admin-authentication` spec），沒有使用者帳號或角色分級——這次的分類功能明確不碰這一塊，純粹是組織性分組。

使用者已與內部團隊逐筆核對，93 個租戶的分類歸屬已確認：智慧行銷處 11、教案 3、汽車 79（含 `hl_motor`、`changyi_tyre` 兩個命名不含 `_car` 但業務上屬汽車的品牌）。汽車類實際客戶數（PDF 記載 100 家）與現有 79 筆有落差，屬於既有資料落後於業務現況，非本次變更需處理的問題。

## Goals / Non-Goals

**Goals:**
- 讓 93 個既有品牌歸屬到三個既有分類，且往後可手動新增分類。
- 品牌管理頁依分類分組顯示，網址可攜帶 `?category=<id>` 讓分享出去的連結預設停在某個分類 tab。
- 新增品牌時綁定所屬分類（由當前 tab 帶入，或於「全部」tab 下手動選擇）。

**Non-Goals:**
- 不做使用者帳號、角色或存取範圍限制——所有人仍共用同一組 Admin API Key，任何分類皆可互相切換查看，`?category=` 純粹是 UI 篩選狀態，不是安全邊界。
- 分類刪除僅在「分類底下無任何品牌」時才允許（見 Decisions #7），不處理「刪除時連帶轉移品牌」這類批次搬移功能。
- 不處理汽車類品牌實際家數落後於業務現況的資料落差（79 vs 100），僅將現有 79 筆正確歸類。
- 不建立「AI老師傅」分類或大協生化科技的品牌（該租戶尚未建立，屬另一件工作）。

## Decisions

### 1. 分類獨立存於 `backend/data/categories.json`，租戶以 `category_id` 外鍵參照

沿用專案既有的「每個實體一份 JSON SSOT」慣例（`tenants.json` 之於租戶）。`categories.json` 結構：`{category_id: {"id": category_id, "name": "顯示名稱"}}`。租戶物件新增 `category_id` 欄位（字串，參照 `categories.json` 的 key）。

備選方案：把分類清單內嵌在 `tenants.json` 頂層（例如 `_categories` 特殊 key）。放棄原因：混雜資料型態（一份檔案裝兩種實體），且既有讀寫邏輯（`TenantManager.list_tenants()` 回傳整個 dict 當作租戶列表）會被污染，需要額外過濾邏輯，風險大於拆成獨立檔案。

### 2. 用 `category_id`（穩定識別碼）而非中文顯示名稱做外鍵與網址參數

`?category=car` 而非 `?category=汽車`。原因與 `tenant_id`/`name` 的既有分工一致：`id` 不可變、`name` 可改，分類改名（例如「智慧行銷處」未來若改稱呼）不會讓租戶的歸屬或已分享出去的網址失效。

### 3. 品牌列表頁採 tab 篩選，不做獨立「分類管理」頁面

`/admin/tenants` 頁面新增 tab 列（全部 / 各分類 / 新增分類），分類清單透過 `GET /api/admin/categories` 取得。新增分類為 tab 列末端的輕量輸入（例如點「+」跳出單一名稱輸入框），不另建管理頁面。理由：目前分類只需要名稱這一個屬性，獨立管理頁面的維護成本大於其帶來的價值；若未來分類需要負責人、說明等更多屬性，屆時再抽成獨立頁面，資料模型不需大改（`categories.json` 已是獨立實體）。

### 4. `GET /api/admin/tenants` 回應內含 `category_id`，前端做客戶端分組/篩選

不新增「依分類查詢租戶」的後端端點，列表本來就一次性抓回全部（93 筆量體小），分類篩選在前端做即可，减少一個 API 表面。

### 5. 建立品牌時 `category_id` 為必填，後端驗證其存在於 `categories.json`

呼應「先建分類、再建品牌」的需求動機。若當前 tab 是「全部」，前端表單需另外提供分類下拉選單強制選擇；若當前 tab 是特定分類，自動帶入且預設唯讀（可切換）。

### 6. 既有 93 筆租戶回填為一次性資料遷移，非執行期程式邏輯

直接編輯 `backend/data/tenants.json`，依已核對的對照表（智慧行銷處 11 / 教案 3 / 汽車 79）逐筆補上 `category_id`，並建立對應的 `backend/data/categories.json`（3 筆分類）。不寫成一次性 migration script（規模小、一次性、人工核對過的清單直接落地即可，寫腳本反而增加不會再被使用的程式碼）。

### 7. 分類刪除採「有品牌就擋」策略，不做連帶轉移

`DELETE /api/admin/categories/<id>` 在刪除前檢查 `tenants.json` 是否有任何租戶的 `category_id` 等於該分類 id，只要有一筆就拒絕（`409`）並提示「請先將品牌移至其他分類」。放棄「刪除時把底下品牌自動轉移到其他分類」的方案：自動轉移需要額外決定「轉去哪個分類」，隱含的資料異動比使用者手動逐一改分類更容易造成誤解，且與使用者確認過偏好「有品牌就擋住」而非自動處理。

## Risks / Trade-offs

- **[風險] 分享出去的 `?category=car` 網址不是存取邊界** → 這是刻意的設計（Non-Goal 已聲明），需在交付時向使用者/Vivian/alina/angela 說清楚：拿到連結的人仍可切換看到其他分類的品牌。
- **[風險] 一次性人工回填 93 筆分類可能手誤** → 已於探索階段逐筆核對命名規則與 PDF 名單（77 個 `_car` 命名 + 2 個例外，且 11+3+79=93 剛好對上總數，無漏無多），實作時仍需再過一次全量清單複核。
- **[取捨] 品牌建立表單在「全部」tab 下多一個必填欄位** → 略增操作步驟，換取「品牌一定有分類」的資料完整性，避免日後又出現未分類的品牌。

## Migration Plan

1. 新增 `backend/data/categories.json`，包含三筆既有分類（智慧行銷處/教案/汽車）。
2. 回填 `backend/data/tenants.json` 93 筆租戶的 `category_id`（依核對後的對照表）。
3. 後端 `admin_app.py` 新增分類 CRUD 端點、既有租戶 CRUD 端點納入 `category_id` 驗證與回傳。
4. 前端品牌列表頁改版（tab 篩選 + `?category=` + 新增分類入口）、新增品牌表單納入分類欄位。
5. 部署後人工核對品牌管理頁分組結果與 PDF 名單一致（尤其 `hl_motor`、`changyi_tyre` 兩筆）。

無需資料庫層級遷移（JSON 檔案直接編輯），回滾方式為還原 `tenants.json`/`categories.json` 兩份檔案並回退程式碼版本。

## Open Questions

- 分類的顯示順序（tab 排序）依建立時間、還是允許手動排序？本次先以建立時間排序，若後續有需求再補。

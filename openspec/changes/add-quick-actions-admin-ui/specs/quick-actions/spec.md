## MODIFIED Requirements

### Requirement: Quick Actions 管理端點

管理後台 SHALL 提供 Quick Actions 的取得與整體覆寫端點，並由管理後台的「快速按鈕管理」頁面直接呼叫以進行檢視、新增、刪除、排序、編輯。

- 取得：`GET /api/admin/tenants/<id>/quick-actions`
- 覆寫：`PUT /api/admin/tenants/<id>/quick-actions`

#### Scenario: 覆寫缺少欄位

- **WHEN** `PUT .../quick-actions` 的 body `quick_actions` 為 None
- **THEN** 回 `400 {"error":"缺少 quick_actions"}`（空陣列 `[]` 合法，會清空）

#### Scenario: 隨服務自動維護

- **WHEN** 新增或刪除服務（不論 `service_id` 為何值，含 `general`）
- **THEN** 系統自動將該服務加入或自 `quick_actions` 移除

## ADDED Requirements

### Requirement: Quick Actions 管理頁面

管理後台 SHALL 提供一個頁面，讓使用者檢視、新增、刪除、排序、編輯租戶的 Quick Actions；新增時僅能從該租戶目前已存在的服務中選擇 `service_id`，避免產生指向不存在服務、因而靜默不渲染的按鈕。

#### Scenario: 檢視清單

- **WHEN** 使用者進入品牌的「快速按鈕管理」頁面
- **THEN** 頁面依陣列順序顯示目前 `quick_actions` 清單，每筆顯示對應服務的名稱／圖示與 `query` 文字

#### Scenario: 新增時限制服務來源

- **WHEN** 使用者於新增表單開啟服務下拉選單
- **THEN** 選單僅列出該租戶目前存在的服務，不提供自由輸入 `service_id` 的欄位

#### Scenario: 排序

- **WHEN** 使用者點擊某筆的「上移」或「下移」並儲存
- **THEN** 該筆與相鄰筆在 `quick_actions` 陣列中的順序互換，前台按鈕依新順序渲染

#### Scenario: 刪除

- **WHEN** 使用者點擊某筆的「刪除」並確認、儲存
- **THEN** 該筆從 `quick_actions` 移除，前台不再渲染對應按鈕

#### Scenario: 編輯 query

- **WHEN** 使用者修改某筆的 `query` 文字並儲存
- **THEN** 該筆的 `query` 更新為新值，前台點擊該按鈕時改以新文字自動送出

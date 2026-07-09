## Why

管理後台目前沒有任何頁面可以直接檢視或編輯租戶的 Quick Actions（前台聊天視窗的快捷按鈕）。使用者只能透過「新增服務」間接讓系統自動掛一顆按鈕（且服務 ID 為 `general` 時還會被排除，完全不會產生按鈕），無法設定按鈕要不要帶預設提問（`query`）、無法調整順序、也無法補建/移除既有按鈕。結果是：非工程背景的使用者（如實習生）在前台勾選服務的「顯示模式招呼訊息」後，經常發現完全沒有按鈕可以觸發它，只能請工程師手動改 `tenants.json` 或呼叫 API 才能生效。後端 API（`GET/PUT /api/admin/tenants/<id>/quick-actions`）已存在且未被前端使用，補一個管理頁面即可補上這個缺口。

## What Changes

- 在管理後台新增「快速按鈕管理」頁面（`/admin/tenants/[id]/quick-actions`），可檢視租戶目前的 Quick Actions 清單。
- 支援新增一筆 Quick Action：選擇一個「已啟用」的服務、可選填預設提問文字（`query`）。
- 支援刪除既有 Quick Action。
- 支援調整 Quick Actions 順序（決定按鈕在前台的排列順序）。
- 支援編輯既有 Quick Action 的 `query` 文字。
- 服務列表頁加入進入此頁的連結（品牌列表操作欄已有 7 個連結、偏擠，且點進服務頁就能到，故不重複加在品牌列表）。
- **BREAKING（行為變更，非 API 變更）**：移除後端「新增服務時，`service_id === "general"` 排除自動加入 Quick Actions」的特例——改為與其他服務一致，一律自動加入（`query` 預設空字串），使用者若不需要可在新頁面刪除。此變更僅影響「新增服務」當下的自動掛載行為，既有租戶資料不受影響、不需回填遷移。

## Capabilities

### New Capabilities

（無——沿用既有 `quick-actions` capability，不新增獨立能力）

### Modified Capabilities

- `quick-actions`：
  - 新增「管理後台 SHALL 提供 Quick Actions 的檢視、新增、刪除、排序、編輯 query 端點的直接操作介面」需求（取代目前「僅能透過服務新增/刪除間接維護」的行為）。
  - 修改「隨服務自動維護」需求：新增服務時不再排除 `service_id === "general"`，一律自動加入 Quick Actions。

## Impact

- **前端新增**：`app/admin/tenants/[id]/quick-actions/page.tsx`（新頁面）；`src/lib/admin/api-client.ts` 的 `getQuickActions`/`updateQuickActions` 由未使用轉為實際呼叫；`app/admin/tenants/page.tsx`、`app/admin/tenants/[id]/services/page.tsx` 加入導覽連結。
- **後端修改**：`backend/admin_app.py` 的 `add_service`（移除 `service_id != "general"` 條件判斷），`get_quick_actions`/`update_quick_actions` 端點行為不變（僅新增消費方）。
- **資料**：不變更 `tenants.json` 既有結構（`quick_actions: [{service_id, query}]`），不需資料遷移。
- **文件**：`docs/INTERN_ADD_BOT_TRAINING.md` 可補充「快速按鈕管理」章節（後續視需要更新，不在本次 tasks 範圍內強制要求）。

## 1. 後端：移除 general 特例

- [x] 1.1 `backend/admin_app.py` `add_service`：移除 `if service_id != "general":` 條件判斷，改為一律將新服務加入 `quick_actions`（`query` 預設空字串）
- [x] 1.2 手動驗證：對既有租戶新增一個 `service_id="general"` 的服務，確認 `tenants.json` 的 `quick_actions` 有自動加入該筆
- [x] 1.3 手動驗證：既有租戶（已存在的 `quick_actions` 資料）重新載入後不受影響、無資料流失

## 2. 前端 API 串接

- [x] 2.1 確認 `src/lib/admin/api-client.ts` 的 `getQuickActions(tenantId)` / `updateQuickActions(tenantId, quickActions)` 簽章符合頁面需求（沿用既有方法，無需新增）
- [x] 2.2 確認 `listServices(tenantId)` 可用於取得新增表單的服務下拉選單資料（沿用既有方法）

## 3. 新頁面：快速按鈕管理

- [x] 3.1 建立 `app/admin/tenants/[id]/quick-actions/page.tsx`，載入時呼叫 `getQuickActions` 與 `listServices`
- [x] 3.2 清單區：依陣列順序顯示每筆 quick action，顯示對應服務的 icon＋name（服務不存在時標示「服務已刪除」，不阻擋刪除該筆）
- [x] 3.3 新增表單：`service_id` 用 `<select>` 僅列出該租戶現有服務（比照 `services/[service]/page.tsx` 下拉選單樣式），`query` 為可留空的文字輸入
- [x] 3.4 每筆提供「上移」「下移」按鈕，操作本地陣列順序（首筆無上移、末筆無下移）
- [x] 3.5 每筆提供「刪除」按鈕（確認對話框比照既有頁面 `confirm(...)` 模式）
- [x] 3.6 每筆提供 `query` 文字編輯（inline 或展開編輯皆可，比照既有表單風格）
- [x] 3.7 儲存按鈕：呼叫 `updateQuickActions(tenantId, quickActions)` 整組覆寫，成功／失敗訊息比照既有頁面（`success`/`error` 狀態列）
- [x] 3.8 頁面載入中／儲存中狀態比照既有頁面的 spinner／disabled 按鈕樣式

## 4. 導覽連結

- [x] 4.1 ~~`app/admin/tenants/page.tsx` 品牌列表操作欄加入「快速按鈕」連結~~ → 使用者反饋操作欄已夠擠、且與 4.2 重複，改為不加，僅保留 4.2 這個入口
- [x] 4.2 `app/admin/tenants/[id]/services/page.tsx` 頂部加入回到／前往「快速按鈕管理」的連結

## 5. 驗證

- [x] 5.1 針對一個測試租戶，透過新頁面新增一筆 quick action，重新整理該租戶的 `/chat` 頁面確認按鈕出現且可點擊
- [x] 5.2 驗證刪除、排序、編輯 query 後，`/chat` 頁面的按鈕清單與行為（含 mode_message 顯示、query 自動送出）皆與變更一致
- [x] 5.3 驗證新增表單選到「已停用」服務時的行為（沿用 spec 既有規則：服務需存在即可渲染，是否要求「已啟用」由目前程式碼實際行為決定，若現況不限制啟用狀態則表單亦不額外限制，僅在 UI 說明文字註記）
- [x] 5.4 執行 `backend/test/` 既有測試（如有涵蓋 quick_actions 相關端點）確認未破壞既有行為

## Context

`quick_actions`（租戶 JSON 的 `quick_actions: [{service_id, query}]`）驅動前台聊天視窗（`QuickActions.tsx`）的快捷按鈕。後端已有完整 CRUD：

- `GET /api/admin/tenants/<id>/quick-actions` → `{ quick_actions: [...] }`
- `PUT /api/admin/tenants/<id>/quick-actions`（body `{ quick_actions: [...] }`，整組覆寫）

前端 `src/lib/admin/api-client.ts` 已有 `getQuickActions()` / `updateQuickActions()` 方法，但目前沒有任何頁面呼叫它們。使用者唯一能「間接」改到 `quick_actions` 的方式是新增/刪除服務（`backend/admin_app.py` 的 `add_service`／`delete_service` 會自動同步），且新增服務時有 `service_id != "general"` 的特例排除。這導致：

1. 已存在的服務無法補建按鈕（例如把 ChatService 命名為 `general` 的品牌，永遠拿不到按鈕）。
2. 無法設定/修改 `query`（預設提問文字）。
3. 無法調整按鈕顯示順序或單純移除某顆按鈕而不刪掉服務本身。

管理後台既有頁面模式（`services/[service]/page.tsx`、`line/page.tsx`）都是「載入 → 表單編輯 → 呼叫對應 API 儲存」的單頁模式，本設計沿用相同模式，不引入新的狀態管理或 UI 套件。

## Goals / Non-Goals

**Goals:**
- 提供一個頁面，讓使用者不必碰設定檔就能檢視、新增、刪除、排序、編輯租戶的 Quick Actions。
- 新增 Quick Action 時，只能選擇該租戶「目前已存在的服務」（下拉選單），避免打錯 `service_id` 造成按鈕不渲染（spec 既有行為：找不到服務的按鈕直接不渲染，屬靜默失敗，UI 應該事先擋掉）。
- 移除「新增服務時排除 `general`」的特例，讓自動維護行為對所有服務一致。

**Non-Goals:**
- 不做拖曳排序（drag-and-drop）；用「上移/下移」按鈕即可，避免引入新依賴，符合現有頁面複雜度水準。
- 不改變前台 `QuickActions.tsx` / `ChatContainer.tsx` 的渲染或點擊行為（spec 中「Quick Action 點擊綁定行為」需求不變）。
- 不做 `query` 文字的 AI 輔助生成或範本庫，單純文字輸入框。
- 不新增 quick action 等級的圖示/自訂名稱——顯示用的 icon/name 仍取自對應服務設定（維持現有 spec 行為，避免兩處來源不一致）。

## Decisions

**1. 整組覆寫（PUT 全量）而非單筆新增/刪除 API**
沿用既有 `PUT /api/admin/tenants/<id>/quick-actions` 的整組覆寫語意（前端在本地陣列操作增/刪/排序，儲存時一次送出整組）。
- 替代方案：新增 `POST .../quick-actions`、`DELETE .../quick-actions/<index>` 等細粒度端點。
- 選擇整組覆寫的理由：後端端點已存在且穩定，改動面最小；清單通常只有個位數筆數，整組送出的成本可忽略；避免多一組端點的維護與測試成本。

**2. 頁面路由與導覽**
新增 `app/admin/tenants/[id]/quick-actions/page.tsx`，比照 `services`／`appearance`／`line` 頁面的路由層級與返回連結樣式。在 `app/admin/tenants/page.tsx` 品牌列表的操作欄、以及 `services/page.tsx` 頂部加入「快速按鈕」連結。
- 替代方案：把 Quick Actions 編輯區塊直接嵌入「服務列表」頁面（因為概念上跟服務綁定）。
- 選擇獨立頁面的理由：Quick Actions 是跨服務、需要排序的清單型資料，跟「服務列表」（單純每個服務一張卡片）的資訊架構不同；獨立頁面也讓 URL 可直接分享/收藏，符合現有其他設定頁的慣例（各自獨立路由）。

**3. 新增表單以「已啟用服務」下拉選單限制輸入**
新增 Quick Action 時，`service_id` 用 `<select>` 從 `GET /api/admin/tenants/<id>/services` 取得的服務清單中選（比照 `services/[service]/page.tsx` 用 `getServiceClasses()` 下拉選單的既有模式），而非自由輸入文字框。已被加入 Quick Actions 的服務仍可再次選取（允許同一服務對應多顆不同 `query` 的按鈕，這是既有資料結構本身就支援的彈性，不額外限制）。

**4. 移除 `add_service` 的 `general` 特例**
`backend/admin_app.py` 的 `add_service`：
```python
# 自動新增到 Quick Actions（general 除外）
if service_id != "general":
    ...
```
改為一律執行（拿掉條件判斷）。
- 替代方案 A：保留特例，只在新頁面讓使用者手動補建。→ 会保留「同一件事兩種行為」的不一致，教學/踩坑成本不會消失，故不採用。
- 替代方案 B：把「排除清單」做成可設定項。→ 過度設計，`general` 只是慣例命名而非系統保留字，沒有必要保留這個特例的存在意義。
- 影響評估：現有已建立的租戶不受影響（此邏輯只在「新增服務」當下觸發一次，不回填既有資料）；新建服務若剛好叫 `general` 也會拿到按鈕，使用者不需要可在新頁面刪除，成本低於維持特例的認知負擔。

**5. 排序表示法**
`quick_actions` 陣列順序即顯示順序（沿用既有前台渲染邏輯：依陣列順序渲染），新頁面的「上移/下移」直接操作陣列索引，不新增額外的 `order` 欄位。

## Risks / Trade-offs

- **[風險] 整組覆寫可能與其他來源的併發寫入衝突**（例如頁面開著的同時，另一個人透過「新增服務」觸發自動維護）→ **緩解**：沿用既有後端 `tenant_manager.reload()` 後再寫入的模式（`update_quick_actions` 已如此實作），是既有已接受的風險等級，不在本次變更中加鎖；教學情境（單一使用者操作）風險極低。
- **[風險] 移除 `general` 特例屬行為變更，可能有既有自動化流程依賴「`general` 不會自動加入按鈕」的假設** → **緩解**：搜尋現有程式碼與 `openspec/specs` 未發現任何顯式依賴此特例的下游邏輯；proposal 中標記為 BREaking 並在 tasks 中列出驗證項（用現有租戶測試新增/不受影響）。
- **[取捨] 不做拖曳排序**，上移/下移在筆數多時較不直覺 → 可接受：Quick Actions 筆數通常對應服務數量（個位數），教學情境更是 1-3 顆。

## Migration Plan

1. 後端：移除 `add_service` 的 `general` 特例（單行條件判斷變更），不涉及資料遷移。
2. 前端：新增頁面與導覽連結，屬純新增，不影響既有頁面。
3. 部署順序：後端與前端可分開部署（新頁面呼叫的既有 GET/PUT 端點本來就存在），但建議同批次上線以便一次驗收。
4. 回滾：兩邊改動皆可獨立 revert（新頁面刪除、`add_service` 條件判斷復原），無資料庫/設定檔結構變更，回滾無資料風險。

## Open Questions

- 是否要在「服務列表」頁面的每張服務卡片上，直接顯示「是否已有對應的 Quick Action」狀態（例如一個小標籤），降低使用者需要切換頁面才能確認的成本？本次先不做，留待後續反饋決定。

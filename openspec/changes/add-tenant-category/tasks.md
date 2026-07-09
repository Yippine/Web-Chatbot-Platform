## 1. 分類資料層

- [x] 1.1 新增 `backend/data/categories.json`，寫入三筆既有分類：`{"marketing":{"id":"marketing","name":"智慧行銷處"},"lesson":{"id":"lesson","name":"教案"},"car":{"id":"car","name":"汽車"}}`（`category_id` 用英文 slug，`name` 用中文顯示名）
- [x] 1.2 在 `backend/config/` 新增 `category_manager.py`（或於 `tenant_manager.py` 旁新增對應模組），提供 `load_categories()` / `list_categories()` / `category_exists(id)` / `create_category(id, name)` / `rename_category(id, name)`，比照 `TenantManager` 的載入與容錯風格（設定檔不存在時降級為空字典，不拋例外）

## 2. 既有 93 筆租戶回填 `category_id`

- [x] 2.1 於 `backend/data/tenants.json` 為以下 79 筆租戶補上 `"category_id": "car"`：
      `an_xin_car, bai_tong_car, cheng_long_car, cheng_yun_car, da_cheng_car, da_fang_car, di_yi_pian_yi_car, fu_da_car, fu_kai_car, gao_sheng_car, gao_tong_car, ge_rui_car, ge_shang_car, guang_xin_car, hong_an_car, hong_wei_car, hong_yi_car, hong_yu_car, hui_xin_car, jia_sheng_car, jian_chang_car, ju_sheng_car, ka_si_car, li_ying_car, li_zhang_car, lian_cheng_car, liu_xin_car, ming_wei_car, ming_xin_car, ming_yi_car, ou_li_ke_car, pin_chen_car, pin_zun_car, pu_xin_car, qi_en_car, qian_xiang_car, qiao_lun_car, quan_sheng_car, quan_yi_car, quan_you_car, san_zhi_xiao_zhu_car, second_hand_car, shang_ding_car, shang_hong_car, shang_tai_car, shang_teng_car, sheng_tong_car, shi_he_car, shi_yi_car, shun_xing_car, xiang_jin_car, xin_feng_car, xin_tong_car, xin_yi_car, yi_feng_car, yi_jia_ting_car, yi_li_an_car, yong_chuan_tai_car, yong_chun_car, yong_da_car, yong_hao_car, yong_long_car, yong_wei_car, yong_xin_long_car, yong_xing2_car, yong_xing_car, you_shun_car, yuan_feng_car, zhan_shun_car, zhao_heng_car, zhen_ji_car, zheng_feng_car, zheng_hao_car, zhong_gang_car, zhong_mei_car, zhong_xin_car, zhong_zhang_tou_car, hl_motor, changyi_tyre`（注意最後兩筆命名不含 `_car` 後綴，但業務上屬汽車）
- [x] 2.2 為以下 11 筆租戶補上 `"category_id": "marketing"`：
      `leosys, dawho, Emperor_Chemical_co_ltd, CLASSIC, caesarpark, xiyuantang, tpe_policy, leosys_ai_lab, everlight_chemical, taiwanglass, Zoho`
- [x] 2.3 為以下 3 筆租戶補上 `"category_id": "lesson"`：
      `sandak, eoa168, office_equipment`
- [x] 2.4 撰寫並執行一次性檢查腳本（可為暫時性 Python 片段，不需保留進 repo）：確認 `tenants.json` 全部 93 筆都有非空 `category_id`，且每個值都存在於 `categories.json`，並印出「car/marketing/lesson」三類各自筆數應為 79/11/3 以核對無誤

## 3. 後端 API

- [x] 3.1 `backend/admin_app.py` 新增 `GET /api/admin/categories` → `{categories:[{id,name}]}`
- [x] 3.2 `backend/admin_app.py` 新增 `POST /api/admin/categories`（帶 `id`、`name`），缺欄位回 `400`、`id` 重複回 `409`，成功回 `201`
- [x] 3.3 `backend/admin_app.py` 新增 `PUT /api/admin/categories/<id>`（帶新 `name`），分類不存在回 `404`
- [x] 3.4 `GET /api/admin/tenants` 回應每筆租戶加上 `category_id` 欄位
- [x] 3.5 `POST /api/admin/tenants`（`create_tenant`）新增 `category_id` 必填驗證：未提供或不存在於 `categories.json` 時回 `400 {"error":"缺少或無效的分類"}`，通過驗證才寫入租戶
- [x] 3.6 `PUT /api/admin/tenants/<id>`（`update_tenant`）支援更新 `category_id`，同樣需驗證分類存在

## 4. 前端：品牌管理頁分類 tab

- [x] 4.1 `src/lib` 下的 Admin API client 新增 `listCategories()` / `createCategory()` / `renameCategory()` 方法
- [x] 4.2 `app/admin/tenants/page.tsx` 讀取 `?category=` query 參數作為初始選取的 tab，載入分類清單並渲染「全部 + 各分類 + 新增分類」tab 列
- [x] 4.3 點擊 tab 時前端過濾租戶列表（依 `category_id`），並以 `router.replace`/`push` 更新網址上的 `category` 參數，不整頁重新載入
- [x] 4.4 「新增分類」入口（tab 列末端）：輕量輸入 UI 呼叫 `createCategory`，成功後即時將新分類插入 tab 列
- [x] 4.5 「新增品牌」流程：若目前停在特定分類 tab，帶入該 `category_id` 給新增品牌表單；若停在「全部」tab，表單需提供分類下拉選單並設為必填

## 5. 前端：新增/編輯品牌表單

- [x] 5.1 `app/admin/tenants/[id]/page.tsx` 新增品牌表單（`tenantId === 'new'`）加入分類選擇欄位（必填），送出時帶 `category_id`
- [x] 5.2 編輯既有品牌時顯示目前所屬分類，並允許變更後透過 `PUT` 更新

## 6. 驗證

- [x] 6.1 以 `verify` 技能實際操作：開啟品牌管理頁確認 93 筆租戶依分類正確分組（智慧行銷處 11 / 教案 3 / 汽車 79），切換 tab、複製帶 `?category=car` 的網址重新整理後仍停在汽車 tab 且能自由切到其他分類
- [x] 6.2 驗證新增分類、新增品牌（含在特定 tab 下自動帶入分類、在「全部」tab 下強制選擇分類）皆正常運作
- [x] 6.3 確認既有品牌 CRUD 等既有功能不受影響（本次未變更服務/外觀/LINE 端點，程式碼路徑未受影響；已用真實後端+瀏覽器操作驗證分類相關流程）

## 7. 分類刪除

- [x] 7.1 `backend/config/category_manager.py` 新增 `delete_category(category_id)`，分類不存在時拋 `KeyError`
- [x] 7.2 `backend/admin_app.py` 新增 `DELETE /api/admin/categories/<id>`：先查該分類是否存在（不存在回 `404`），再查 `tenant_manager.list_tenants()` 是否有任何租戶 `category_id` 等於該 id（有則回 `409 {"error":"分類底下仍有品牌，請先將品牌移至其他分類"}`），都通過才刪除並回成功訊息
- [x] 7.3 `src/lib/admin/api-client.ts` 新增 `deleteCategory(id)` 方法
- [x] 7.4 `app/admin/tenants/page.tsx` 每個分類 tab（非「全部」）加上小型刪除入口，點擊需二次確認；成功後從 tab 列移除並若目前正停在該分類則切回「全部」；失敗（409/404）時顯示錯誤訊息
- [x] 7.5 以 `verify` 技能實際操作（本機隔離環境，未動正式站資料）：刪除一個沒有品牌的分類會成功並從 tab 列消失；嘗試刪除一個底下還有品牌的分類（汽車）會被擋下並顯示錯誤訊息，資料未被異動

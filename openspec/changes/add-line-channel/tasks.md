## 1. 前置與依賴

- [x] 1.1 確認參考 repo（`wendyyu170/linebot`）借用程式碼的授權相容性；不相容則改為自行重寫 →（採自行重寫：`line_service.py`、`markdown_converter.py` 為原創實作，未複製對方程式碼）
- [x] 1.2 在 `backend/requirements.txt` 加入 `line-bot-sdk`（v3）並重建後端環境/映像 →（已加入；映像重建為部署步驟）
- [x] 1.3 在 `backend/.env.example` 補上 LINE 憑證範本（`TENANT_<ID>_LINE_TOKEN`、`TENANT_<ID>_LINE_SECRET`）

## 2. 資料模型（tenant-management）

- [x] 2.1 於 `tenant_manager` 取用租戶時，依 `line.channel_access_token_env`/`channel_secret_env` 從 `.env` 注入暫態憑證欄位（沿用 Gemini 金鑰機制）
- [x] 2.2 確認新增品牌端點維持只需品牌 ID（不要求 LINE 憑證），既有行為不變

## 3. 管理後台 LINE 設定（兩步驟 UX）

- [x] 3.1 後端：新增 `GET /api/admin/tenants/<id>/line`（回傳 `line` 區塊與推導的 Webhook URL，不回 token/secret 明文）
- [x] 3.2 後端：新增 `PUT /api/admin/tenants/<id>/line`——把 token/secret 寫入 `.env`（新增 `set_env_value`）、`line` 區塊（`enabled`、`*_env`、`intent_routing`、`default_service`）寫入 `tenants.json`、reload
- [x] 3.3 前端：品牌列表新增「LINE」入口 + 子頁 `/admin/tenants/[id]/line`
- [x] 3.4 前端：顯示 Webhook URL（`公開網域/webhook/line/<id>`，唯讀 + 複製鈕）+ 設定順序提示（先存憑證再到 LINE Verify）
- [x] 3.5 前端：token/secret 輸入欄（password 型）、`enabled` 與 `intent_routing` 開關，儲存呼叫 `PUT .../line`
- [x] 3.6 LINE 行為與 web 一致（最終簡化）：取消「LINE 自動分流」開關與 per-service `line_enabled`；LINE 永遠分流、候選依各服務「啟用服務」決定
- [x] 3.7 LINE 設定頁僅保留 Webhook URL + 憑證 + 「啟用 LINE」單一開關（服務頁無 LINE 勾選）

## 4. 通路無關協調器（chat-conversation）

- [x] 4.1 將 `/api/chat` 內「決定 mode → 建立服務 → 依類別分派 → 組裝回覆 → 記錄統計」抽成 `process_message(tenant, text, user_id, mode?, lang?, lat_lng?)`
- [x] 4.2 改寫 `/api/chat` route 為薄包裝，委派 `process_message()`，對外 JSON 結構與狀態碼維持不變（503/400/500）
- [x] 4.3 回歸測試既有 web 端點 →（線上實測通過：intent 正確路由至 service_birth_subsidy；/api/chat 經 process_message 正常回覆）

## 5. LINE 收發層（line-channel）

- [x] 5.1 新增 LINE 收發模組 `services/line_service.py`：reply、push、show_loading_animation（line-sdk v3）+ 5000 字截斷
- [x] 5.2 新增 `utils/markdown_converter.py`：移除標題/列表/粗體、保留純 URL、references 併入文字尾（已單元測試）
- [x] 5.3 實作 `X-Line-Signature` 簽章驗證（`WebhookParser(channel_secret).parse`）

## 6. Webhook 入口與非同步流程（line-channel）

- [x] 6.1 新增 route `POST /webhook/line/<tenant_id>`，掛載至主後端（app.py）
- [x] 6.2 驗章 → 解析事件（文字、LINE userId、reply token）→ 略過非文字事件
- [x] 6.3 立即回 200 + 顯示 loading 動畫；以背景執行緒（`_line_pool`）跑 `process_message()`
- [x] 6.4 以 LINE userId 作為 `user_id` 傳入協調器；LINE 永遠呼叫 `classify_intent()` 分流（與 web 同一套候選邏輯）
- [x] 6.5 回覆策略：優先 reply token，逾時/失效 fallback push
- [x] 6.6 背景任務 try/except：失敗時 push fallback 文案，避免已讀不回

## 7. 部署與驗收

- [x] 7.1 更新 `nginx.conf`：`/webhook/line/*` 導向主後端（:5000）
- [ ] 7.2 試辦租戶設定流程：後台填入 token/secret 並儲存 → 複製 Webhook URL → 貼到 LINE 後台按 Verify（需真實 LINE 帳號，人工）
- [ ] 7.3 端到端測試：LINE 發訊 → 命中正確服務（如 `tpe_policy` 多服務分流）→ 收到純文字回覆（需真實 LINE 帳號，人工）
- [ ] 7.4 驗證 reply_token 逾時情境會正確 fallback 到 push（需真實 LINE 帳號，人工）
- [ ] 7.5 灰度單一租戶上線；回滾驗證（`line.enabled=false` 後 LINE 停用、web 不受影響）（需真實 LINE 帳號，人工）

## 1. 前置與依賴

- [ ] 1.1 確認參考 repo（`wendyyu170/linebot`）借用程式碼的授權相容性；不相容則改為自行重寫
- [ ] 1.2 在 `backend/requirements.txt` 加入 `line-bot-sdk`（v3）並重建後端環境/映像
- [ ] 1.3 在 `backend/.env.example` 補上 LINE 憑證範本（`TENANT_<ID>_LINE_TOKEN`、`TENANT_<ID>_LINE_SECRET`）

## 2. 資料模型（tenant-management）

- [ ] 2.1 於 `tenant_manager` 取用租戶時，依 `line.channel_access_token_env`/`channel_secret_env` 從 `.env` 注入暫態憑證欄位（沿用 Gemini 金鑰機制）
- [ ] 2.2 確認新增品牌端點維持只需品牌 ID（不要求 LINE 憑證），既有行為不變

## 3. 管理後台 LINE 設定（兩步驟 UX）

- [ ] 3.1 後端：新增 `GET /api/admin/tenants/<id>/line`（回傳 `line` 區塊與推導的 Webhook URL，不回 token/secret 明文）
- [ ] 3.2 後端：新增 `PUT /api/admin/tenants/<id>/line`——把 token/secret 寫入 `.env`（沿用 `update_env_file`）、`line` 區塊（`enabled`、`*_env`、`intent_routing`）寫入 `tenants.json`、reload
- [ ] 3.3 前端：品牌編輯區新增「LINE 設定」入口（比照 services/appearance，傾向子頁 `/admin/tenants/[id]/line`）
- [ ] 3.4 前端：顯示 Webhook URL（`公開網域/webhook/line/<id>`，唯讀 + 複製鈕）+ 設定順序提示（先存憑證再到 LINE Verify）
- [ ] 3.5 前端：token/secret 輸入欄（可切換明/暗文）、`enabled` 與 `intent_routing` 開關，儲存呼叫 `PUT .../line`
- [ ] 3.6 服務設定：服務 config 支援可選 `line_enabled`（缺省視為 true）；服務 PUT/POST 端點接受並保存此欄位
- [ ] 3.7 前端：服務設定頁新增「在 LINE 啟用」勾選（預設開），儲存寫入 `line_enabled`

## 4. 通路無關協調器（chat-conversation）

- [ ] 4.1 將 `/api/chat` 內「決定 mode → 建立服務 → 依類別分派 → 組裝回覆 → 記錄統計」抽成 `process_message(tenant, text, user_id, mode?, lang?, lat_lng?)`
- [ ] 4.2 改寫 `/api/chat` route 為薄包裝，委派 `process_message()`，確認對外 JSON 結構與行為不變
- [ ] 4.3 回歸測試既有 web 端點（`/api/chat`、intent、detect-language）行為無破壞

## 5. LINE 收發層（line-channel）

- [ ] 5.1 新增 LINE 收發模組（參考 `base_linebot.py`）：reply、push、show_loading_animation（line-sdk v3）
- [ ] 5.2 新增 Markdown→純文字轉換（參考 `markdown_converter.py`）：移除標題/列表/粗體、保留純 URL、references 併入文字尾
- [ ] 5.3 實作 `X-Line-Signature` 簽章驗證（以租戶 channel secret）

## 6. Webhook 入口與非同步流程（line-channel）

- [ ] 6.1 新增 Flask blueprint route `POST /webhook/line/<tenant_id>`，掛載至主後端（app.py）
- [ ] 6.2 驗章 → 解析事件（文字、LINE userId、reply token）→ 略過非文字事件
- [ ] 6.3 立即回 200 + 顯示 loading 動畫；以背景執行緒（獨立 ThreadPool）跑 `process_message()`
- [ ] 6.4 以 LINE userId 作為 `user_id` 傳入協調器；依租戶 `intent_routing` 決定走意圖路由或固定服務
- [ ] 6.4a LINE 意圖路由候選池排除 `line_enabled === false` 的服務
- [ ] 6.5 回覆策略：優先 reply token，逾時/失效 fallback push
- [ ] 6.6 背景任務 try/except：失敗時 push fallback 文案，避免已讀不回

## 7. 部署與驗收

- [ ] 7.1 更新 `nginx.conf`：`/webhook/line/*` 導向主後端（:5000）
- [ ] 7.2 試辦租戶設定流程：後台填入 token/secret 並儲存 → 複製 Webhook URL → 貼到 LINE 後台按 Verify（順序:先存憑證再 Verify）
- [ ] 7.3 端到端測試：LINE 發訊 → 命中正確服務（如 `tpe_policy` 多服務分流）→ 收到純文字回覆
- [ ] 7.4 驗證 reply_token 逾時情境會正確 fallback 到 push
- [ ] 7.5 灰度單一租戶上線；回滾驗證（`line.enabled=false` 後 LINE 停用、web 不受影響）

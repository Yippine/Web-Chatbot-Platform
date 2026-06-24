## ADDED Requirements

### Requirement: 租戶 LINE 通路設定

租戶設定 SHALL 支援可選的 `line` 區塊，包含 `enabled` 與 LINE 憑證的環境變數名稱（`channel_access_token_env`、`channel_secret_env`），憑證明文 SHALL 存於 `.env` 而非 `tenants.json`，並沿用既有金鑰即時注入機制。LINE 的分流行為與 web 一致，無需 LINE 專屬的路由設定。

#### Scenario: 啟用 LINE 的租戶

- **WHEN** 租戶設定含 `line.enabled=true` 且 `channel_access_token_env`/`channel_secret_env` 指向的 `.env` 變數存在
- **THEN** 系統可為該租戶提供 LINE 通路，憑證於取用時由 `.env` 注入暫態欄位

#### Scenario: 憑證以環境變數名稱保存

- **WHEN** 設定租戶的 LINE 憑證
- **THEN** `tenants.json` 僅儲存環境變數名稱，token/secret 明文存於 `.env`，不出現在 JSON 內

#### Scenario: 未設定 line 區塊

- **WHEN** 租戶設定無 `line` 區塊或 `line.enabled` 非真
- **THEN** 該租戶不提供 LINE 通路，其 web 通路行為不受影響

### Requirement: 管理後台 LINE 設定（兩步驟）

管理後台 SHALL 將 LINE 設定與品牌建立分離：新增品牌頁僅要求品牌 ID（不含 LINE 憑證）；品牌建立後，SHALL 提供取得與儲存 LINE 設定的端點，儲存時 token/secret 寫入 `.env`、`line` 區塊（含 `enabled`、憑證環境變數名稱、`intent_routing`）寫入 `tenants.json`，憑證明文 SHALL 不存於 `tenants.json`。

#### Scenario: 建立品牌不需 LINE 憑證

- **WHEN** 透過新增品牌頁以品牌 ID 建立租戶
- **THEN** 品牌成功建立，且不要求填入 LINE token/secret

#### Scenario: 儲存 LINE 設定

- **WHEN** 於品牌編輯區提交 LINE 設定（token、secret、`enabled`、`intent_routing`）
- **THEN** 系統將 token/secret 寫入 `.env`、`line` 區塊寫入該租戶的 `tenants.json`，並重新載入設定

#### Scenario: 憑證不落入 JSON

- **WHEN** 儲存 LINE 憑證
- **THEN** `tenants.json` 僅記錄憑證的環境變數名稱，token/secret 明文僅存於 `.env`

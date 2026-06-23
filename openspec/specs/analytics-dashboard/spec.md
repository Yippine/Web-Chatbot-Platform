# analytics-dashboard Specification

## Purpose

定義數據統計：以 PostgreSQL 記錄每則訊息與 session 彙總，提供管理後台儀表板（全租戶彙總、單租戶每日分佈）、專案驗收報表（導入前後 KPI）與每日明細 CSV 匯出。統計能力在 DB 未設定時可優雅降級。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 訊息記錄

系統 SHALL 在每次回應後以背景執行緒非同步寫入 `message_logs`（含 `tenant_id`/`session_id`/`direction`/`service_name`/`response_ms`/`lang`）並 upsert `chat_sessions`（更新 `last_seen`、`message_count+1`），量測 `response_ms`。

#### Scenario: 非同步記錄不阻塞回應

- **WHEN** 對話回應完成
- **THEN** 系統以 ThreadPool 非同步寫 log，寫入例外被捕捉且不影響主回應流程

#### Scenario: DB 未設定優雅降級

- **WHEN** `DATABASE_URL` 未設定
- **THEN** `init_db` 跳過、`log_message` 靜默 return、所有讀取函式回空結果

> 註（現狀偏差）：執行期僅記錄 `direction="bot"`；schema 與部分查詢雖支援 `"user"`，但使用者端訊息目前不入庫。

### Requirement: 統計儀表板

管理後台 SHALL 提供全租戶彙總與單租戶每日統計端點。

- 全租戶彙總：`GET /api/admin/stats/dashboard`
- 單租戶每日：`GET /api/admin/stats/<id>/daily?days=N`（預設 7，附服務/小時/語言分佈）

#### Scenario: 取得全租戶彙總

- **WHEN** 請求 `GET /api/admin/stats/dashboard`
- **THEN** 回 `{total_tenants, tenant_stats:[{id,name,messages_today,sessions_today}]}`

#### Scenario: 取得單租戶每日統計

- **WHEN** 請求 `GET /api/admin/stats/<id>/daily?days=N`
- **THEN** 回每日訊息/session、即時活躍與服務/小時/語言分佈

### Requirement: 驗收報表

管理後台 SHALL 提供 `GET /api/admin/stats/<id>/acceptance`，依可調參數（months/pre_decision_min/post_manual_min/pre_service_per_hour/daily_work_hours/staff_count）計算導入前後 KPI（決策時間縮短、服務效率提升）與月度彙總，並對除零等情況防護回 0。

#### Scenario: 取得驗收報表

- **WHEN** 請求 `GET /api/admin/stats/<id>/acceptance`
- **THEN** 回 `{tenant_id, months, monthly_summary[], kpi{...}, params{...}}`

### Requirement: CSV 匯出

管理後台 SHALL 提供 `GET /api/admin/stats/<id>/export`，回每日使用明細 CSV（UTF-8 BOM，含日期/AI回覆數/使用者訊息數/對話數/平均與最大回應時間），預設區間為今天往前 120 天。

#### Scenario: 匯出每日 CSV

- **WHEN** 請求 `GET /api/admin/stats/<id>/export`
- **THEN** 回 `text/csv`，`Content-Disposition` 附檔名 `<tenant>_usage_<start>_<end>.csv`

#### Scenario: 需帶金鑰下載

- **WHEN** 直接以 `<a href>` 開啟 export URL（不帶 header）
- **THEN** 被 `before_request` 擋下回 `401`；前端須改用 fetch 帶 `X-Admin-Key` 下載

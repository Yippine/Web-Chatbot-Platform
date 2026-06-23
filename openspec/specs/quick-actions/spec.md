# quick-actions Specification

## Purpose

定義 Quick Actions（快捷服務按鈕）：租戶可設定一排快捷鈕，點擊即綁定到某後端服務並可帶預設 query。包含前端渲染與綁定行為、後端管理端點，以及隨服務新增/刪除自動維護的機制。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: Quick Actions 資料模型與渲染

系統 SHALL 以租戶 `quick_actions[]` 定義快捷鈕（含 `service_id`、`query`），前端僅在有對應啟用服務時渲染按鈕（取服務 `icon`+`name`），找不到服務則該按鈕不渲染。

#### Scenario: 服務不存在不渲染

- **WHEN** 某 quick action 的 `service_id` 在 services 中找不到
- **THEN** 該按鈕整顆不渲染

#### Scenario: 無快捷鈕不顯示區塊

- **WHEN** `quick_actions` 為空
- **THEN** 前端不渲染 QuickActions 區塊

### Requirement: Quick Action 點擊綁定行為

前端 SHALL 依目標服務類別決定行為：`QueryService` 走查詢分支（呼叫 `/api/query/data`，不送一般 chat）、其他類別設定 mode 並（若帶 query）以指定 mode 直接送出；`SmartRouteService` 送出前取 GPS。

#### Scenario: QueryService 查詢分支

- **WHEN** 點擊的服務 `class === 'QueryService'`
- **THEN** 設定 mode、以 `query_loading_message` 為 loading、呼叫 `queryData` 取資料並 append 回應，不送一般 chat

#### Scenario: 一般服務帶 query 送出

- **WHEN** 點擊的服務非 QueryService 且 action 帶 `query`
- **THEN** 設定 mode、（`show_mode_message !== false` 且有 `mode_message` 時）先顯示模式提示，再以指定 mode 送出 query

#### Scenario: 路線服務取 GPS

- **WHEN** 目標服務 `class === 'SmartRouteService'`
- **THEN** 送出前以 `navigator.geolocation`（3 秒 timeout，失敗回 null）取座標帶入 `lat_lng`

### Requirement: Quick Actions 管理端點

管理後台 SHALL 提供 Quick Actions 的取得與整體覆寫端點。

- 取得：`GET /api/admin/tenants/<id>/quick-actions`
- 覆寫：`PUT /api/admin/tenants/<id>/quick-actions`

#### Scenario: 覆寫缺少欄位

- **WHEN** `PUT .../quick-actions` 的 body `quick_actions` 為 None
- **THEN** 回 `400 {"error":"缺少 quick_actions"}`（空陣列 `[]` 合法，會清空）

#### Scenario: 隨服務自動維護

- **WHEN** 新增（非 `general`）或刪除服務
- **THEN** 系統自動將該服務加入或自 `quick_actions` 移除

> 註：前端 admin 頁面目前主要透過服務新增/刪除間接維護 quick_actions，未直接呼叫 PUT 端點。

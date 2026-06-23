# tenant-authentication Specification

## Purpose

定義主 API（`app.py`, port 5000）所有業務端點的租戶驗證機制。透過 `require_tenant` 裝飾器，在進入業務邏輯前解析並驗證 `tenant_id`，並將租戶設定注入請求物件。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 租戶識別解析

系統 SHALL 從 HTTP header `X-Tenant-ID` 取得 `tenant_id`；若 header 不存在且請求為 JSON，SHALL 退而從 request body 的 `tenant_id` 欄位取得。

#### Scenario: 由 header 取得租戶

- **WHEN** 請求帶有 `X-Tenant-ID` header
- **THEN** 系統以該值作為 `tenant_id`

#### Scenario: 由 body 取得租戶

- **WHEN** 請求無 `X-Tenant-ID` header 但 JSON body 含 `tenant_id`
- **THEN** 系統以 body 的 `tenant_id` 作為租戶識別

### Requirement: 租戶驗證守門

系統 SHALL 在受保護端點（`/api/detect-language`、`/api/chat/intent`、`/api/chat`、`/api/tenant/config`、`/api/query/data`）執行租戶驗證，未通過者不進入業務邏輯。

#### Scenario: 缺少租戶識別

- **WHEN** 請求完全無法解析出 `tenant_id`
- **THEN** 回 `400 {"error":"缺少 tenant_id", ...}`

#### Scenario: 無效或未啟用租戶

- **WHEN** `tenant_id` 對應的租戶不存在或 `enabled=false`
- **THEN** 回 `403 {"error":"無效的 tenant_id", "message":"租戶 '...' 不存在或未啟用"}`

#### Scenario: 驗證通過注入租戶

- **WHEN** 租戶存在且已啟用
- **THEN** 系統將 `request.tenant_id` 與 `request.tenant` 注入請求，續呼業務函式

> 註：不存在與停用對外皆回 `403`，無法區分。認證僅依 `tenant_id`，無 token/簽章。

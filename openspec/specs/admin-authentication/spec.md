# admin-authentication Specification

## Purpose

定義管理後台（`admin_app.py`, port 5001）的認證機制：以單一共用 Admin API Key 保護所有後台端點，無使用者帳號系統、無角色分級。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: Admin API Key 守門

系統 SHALL 以環境變數 `ADMIN_API_KEY`（預設 `admin_secret_key`）為唯一金鑰，所有後台端點（除 OPTIONS 與 `health` 外）SHALL 要求請求 header `X-Admin-Key` 與其相符。

#### Scenario: 金鑰不符

- **WHEN** 請求未帶 `X-Admin-Key` 或值不符
- **THEN** 回 `401 {"error":"未授權"}`，不執行任何業務邏輯

#### Scenario: CORS 預檢放行

- **WHEN** 請求方法為 OPTIONS
- **THEN** 略過驗證直接放行

#### Scenario: 健康檢查免認證

- **WHEN** 請求 `GET /api/admin/health`
- **THEN** 不需金鑰即回 `{"status":"healthy"}`

#### Scenario: 持有金鑰取得完整權限

- **WHEN** 請求帶正確金鑰
- **THEN** 取得完整管理權限（無角色分級）

### Requirement: 前端登入流程

前端 `/admin/login` SHALL 僅將使用者輸入的 API Key 寫入 `localStorage.admin_api_key`（不向後端驗證、不發 token），每個受保護頁面載入時 SHALL 檢查該值，缺失則導向登入頁。

#### Scenario: 無金鑰導向登入

- **WHEN** 受保護頁面載入時 `localStorage` 無 `admin_api_key`
- **THEN** 前端導向 `/admin/login`

#### Scenario: API 請求自動帶金鑰

- **WHEN** 前端發出管理 API 請求
- **THEN** AdminAPIClient 自動帶上 `X-Admin-Key` header

> 註（現狀偏差/安全）：單一共用金鑰、預設值公開於登入頁、無 session/到期、CORS 全開、後端以 `debug=True` 啟動、`500` 直接回傳原始例外字串。

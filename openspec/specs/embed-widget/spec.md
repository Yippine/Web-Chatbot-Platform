# embed-widget Specification

## Purpose

定義嵌入式聊天 widget：第三方網站以單行 `<script src=".../api/chat-widget?tenant_id=X">` 即可掛載浮動聊天按鈕與 iframe。包含腳本產生、父頁 ↔ iframe 的 postMessage 通訊與展開/關閉控制。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 嵌入腳本產生

系統 SHALL 由 `GET /api/chat-widget?tenant_id=X` 動態產生 IIFE JavaScript（`Content-Type: application/javascript`、`Cache-Control: no-cache`），內嵌 `FRONTEND_URL`/`API_URL`/`TENANT_ID`（預設 `demo`）。

#### Scenario: 回傳可嵌入腳本

- **WHEN** 請求 `/api/chat-widget?tenant_id=X`
- **THEN** 回傳 JavaScript，含浮動 toggle 按鈕與指向 `FRONTEND_URL/chat?tenant_id=X` 的 iframe

### Requirement: 載入時取圖示

腳本 SHALL 於啟動時呼叫 `API_URL/api/tenant/config`（帶 `X-Tenant-ID`）取 `appearance.chatIconUrl` 作為浮動按鈕圖示。

#### Scenario: 取得自訂圖示

- **WHEN** config 回傳 `chatIconUrl`
- **THEN** 按鈕以該圖示顯示（`http` 開頭視為絕對 URL，否則前綴 `FRONTEND_URL`）

#### Scenario: config 取得失敗降級

- **WHEN** config fetch 失敗
- **THEN** fallback 僅建立帶預設 `/chat-icon.png` 的按鈕，不建立 iframe

### Requirement: 父頁與 iframe 通訊

iframe 內的 ChatHeader SHALL 在偵測自己處於 iframe 時顯示展開/關閉按鈕並以 postMessage 通知父頁，父頁 SHALL 據以切換 iframe 尺寸或隱藏。

#### Scenario: 展開全螢幕

- **WHEN** 父頁收到 `EXPAND_CHAT` 訊息
- **THEN** iframe 切換為全螢幕（四邊 20px、maxWidth 1200px 置中）或還原 400×600

#### Scenario: 關閉聊天

- **WHEN** 父頁收到 `CLOSE_CHAT` 訊息
- **THEN** 隱藏 iframe 並重設樣式

#### Scenario: toggle 切換顯示

- **WHEN** 使用者點擊浮動按鈕
- **THEN** 切換 iframe 顯示；關閉時若處於展開狀態則收回預設尺寸

> 註（現狀偏差/安全）：父頁監聽以 `event.origin` 校驗來源，但 iframe 端 postMessage targetOrigin 為 `'*'`，且 `tenantId` 直接字串插入腳本未逸出，屬潛在注入面。

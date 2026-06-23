# appearance-customization Specification

## Purpose

定義租戶聊天介面的外觀自訂：標題、文案、標題列/按鈕色彩（單色或漸層）、文字色與聊天圖示。外觀由後端 `tenant/config.appearance` 驅動前端渲染，並由管理後台維護與圖示上傳。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 外觀資料模型

系統 SHALL 以 `appearance` 物件定義外觀，含 `pageTitle`、`title`、`subtitle`、`welcomeMessage`、`placeholder`、`header`(ColorConfig)、`button`(ColorConfig)、`chatIconUrl`、`textColor`(`white`|`black`)。ColorConfig 為 `type:'solid'|'gradient'`，solid 用 `color`、gradient 用 `colors[]`+`direction`。

#### Scenario: 漸層色彩產生

- **WHEN** ColorConfig 為 `gradient`
- **THEN** 產生 `linear-gradient(direction, colors…)`；預設 `colors=['#f97316','#eab308','#a855f7']`、`direction='to right'`

#### Scenario: 單色預設

- **WHEN** ColorConfig 為 `solid` 且未指定 color
- **THEN** 採預設 `#f97316`

### Requirement: 外觀套用至前端

前端 SHALL 將外觀套用至 ChatHeader（背景色+文字色+標題+圖示）、InputBar（送出鈕色+placeholder）、Message（使用者泡泡色）與頁面標題，且外觀為渲染的硬前置條件。

#### Scenario: 外觀缺失顯示載入中

- **WHEN** `appearance` 為 null（載入中或缺失）
- **THEN** ChatContainer 顯示全螢幕 spinner，不渲染聊天 UI

#### Scenario: pageTitle 寫入文件標題

- **WHEN** 外觀含 `pageTitle`
- **THEN** 前端載入後將其寫入 `document.title`（覆蓋預設標題）

#### Scenario: 圖示優先於預設 icon

- **WHEN** 外觀含 `chatIconUrl`
- **THEN** ChatHeader 以該圖示顯示，否則使用 mode 對應的預設 icon

### Requirement: 外觀設定（管理後台）

管理後台 SHALL 提供外觀的取得與整包覆寫端點。

- 取得：`GET /api/admin/tenants/<id>/appearance`
- 更新：`PUT /api/admin/tenants/<id>/appearance`（以 request body 整包取代 `appearance`）

#### Scenario: 租戶不存在

- **WHEN** 外觀端點目標租戶不存在
- **THEN** 回 `404`

#### Scenario: 整包覆寫外觀

- **WHEN** `PUT .../appearance` 提交外觀資料
- **THEN** 系統以 body 整包取代 `appearance`（無欄位白名單），寫回並重載

### Requirement: 聊天圖示上傳

管理後台 SHALL 提供 `POST /api/admin/tenants/<id>/appearance/upload-icon`，驗證並處理上傳圖片（轉 RGBA、壓縮至 128×128 PNG），存檔後自動更新 `chatIconUrl` 並刪除舊圖。

#### Scenario: 上傳成功

- **WHEN** 上傳合法圖片（≤5MB、png/jpg/jpeg/webp）
- **THEN** 系統壓縮存為 `chat-icon-<timestamp>.png`、刪除舊圖、更新 `appearance.chatIconUrl`，回 `{"message":"圖示上傳成功","url":...}`

#### Scenario: 檔案過大

- **WHEN** 上傳檔案大於 5MB
- **THEN** 回 `400 {"error":"檔案大小超過 5MB"}`

#### Scenario: 格式不支援

- **WHEN** 副檔名不在 `{png,jpg,jpeg,webp}` 或 PIL 無法開啟
- **THEN** 回 `400`（不支援的檔案格式 / 無法讀取圖片）

#### Scenario: 未提供檔案

- **WHEN** 請求無 `file` 欄位或檔名為空
- **THEN** 回 `400`（未提供檔案 / 未選擇檔案）

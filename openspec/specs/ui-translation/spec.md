# ui-translation Specification

## Purpose

定義介面多語系：前端靜態字典（少量 UI 字串）與後端翻譯 config（外觀/服務文案）兩層，以及管理後台以 Gemini 自動生成各語言翻譯並以 source hash 偵測過期。支援 zh-tw/en/ja/ko/vi/id/th。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 前端靜態字典

前端 SHALL 以編譯期載入的 `translations.json` 提供 7 語言的少量 UI 字串（loading/error/input/references），預設語言 `zh-tw`，缺鍵時 fallback 回傳 key 字串本身。

#### Scenario: 取得翻譯字串

- **WHEN** 以當前語言與 key 取翻譯
- **THEN** 回傳對應語言的字串

#### Scenario: 缺鍵 fallback

- **WHEN** key 在字典中缺失或中途為 undefined
- **THEN** 回傳 key 字串本身（不丟錯，畫面顯示 raw key）

### Requirement: 後端翻譯 config 載入

前端 SHALL 透過 `getTenantConfig(tenantId, lang)` 取得後端依 `?lang=` 回傳的已翻譯 config（welcomeMessage、服務 name/icon、loading_message、mode_message 等），切換語言時重新拉取並更新 services/appearance。

#### Scenario: 切換語言重載 config

- **WHEN** 前端語言改變
- **THEN** 以新語言重新請求 `GET /api/tenant/config?lang=` 並更新 services 與 appearance

#### Scenario: 翻譯 config 載入失敗

- **WHEN** 後端翻譯 config 載入失敗
- **THEN** 前端印錯誤並沿用舊 config

### Requirement: 自動翻譯生成（管理後台）

管理後台 SHALL 以 Gemini（`temperature=0.3`、`thinking_budget=0`）將繁中文案翻成 6 語（en/ja/ko/vi/id/th），結果存 `translations/<tenant>/<lang>.json` 並寫入 `_source_hash`。

#### Scenario: 生成翻譯成功

- **WHEN** `POST /api/admin/tenants/<id>/translations` 帶合法 `language`
- **THEN** 系統呼叫 Gemini 翻譯、寫入 `_source_hash` 並存檔，回成功訊息

#### Scenario: 缺少語言參數

- **WHEN** 生成請求未帶 `language`
- **THEN** 回 `400 {"error":"缺少 language 參數"}`

#### Scenario: 租戶無 API Key

- **WHEN** 生成翻譯時租戶無可用 API Key
- **THEN** 回 `400 {"error":"租戶缺少 API Key"}`

#### Scenario: 翻譯結果非合法 JSON

- **WHEN** Gemini 回傳無法解析為 JSON
- **THEN** 回 `500 {"error":"翻譯結果解析失敗: ..."}`

### Requirement: 翻譯過期偵測

系統 SHALL 以 appearance 與服務文案計算 source hash（md5），與已存翻譯的 `_source_hash` 比對判定 `outdated`；hash 相同時 SHALL 跳過重新翻譯。

#### Scenario: 查詢翻譯狀態

- **WHEN** `GET /api/admin/tenants/<id>/translations`
- **THEN** 對每語回 `{exists, source_hash?, outdated?}` 與當前 `current_hash`

#### Scenario: 文案未變跳過生成

- **WHEN** 既有翻譯的 `_source_hash` 等於當前 hash
- **THEN** 跳過 Gemini 呼叫，回 `{"message":"... 翻譯未異動 ...","skipped":true}`

#### Scenario: 文案變更標記過期

- **WHEN** 來源文案變更導致 hash 不同
- **THEN** 該語言狀態標記 `outdated:true`，生成時重新翻譯

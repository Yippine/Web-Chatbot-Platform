# language-detection Specification

## Purpose

定義使用者語言的自動偵測：後端 `/api/detect-language` 以 Gemini 判定語言碼，前端在每則使用者訊息送出前先偵測語言，據以切換 UI 語言與後續請求的 `lang` 參數。

本規格逆向自現有實作，描述系統「目前實際行為」。

## Requirements

### Requirement: 後端語言偵測端點

系統 SHALL 提供 `POST /api/detect-language`，以 Gemini（`temperature=0`、`thinking_budget=0`）偵測輸入文字語言，回傳語言碼與英文名，繁/簡中統一回 `zh-TW / Traditional Chinese`。此端點不使用 Redis、不存 session，且永遠回 HTTP 200。

#### Scenario: 缺少訊息

- **WHEN** 請求 body 無 `message`
- **THEN** 回 `400 {"error":"缺少訊息內容"}`

#### Scenario: 成功偵測

- **WHEN** 提供合法 `message`
- **THEN** 回 `200 {"detected_language":{"language_code":..., "language_name":...}}`，支援 zh-TW/en/ja/ko/vi/id/th

#### Scenario: 無 API Key 或例外降級

- **WHEN** 租戶無 API Key，或偵測/解析過程拋例外
- **THEN** 回 `200` 且固定 fallback 為 `{language_code:"zh-TW", language_name:"Traditional Chinese"}`

### Requirement: 前端偵測驅動語言切換

前端 SHALL 在每則使用者訊息送出前先呼叫語言偵測，將偵測結果映射為前端語言碼，並在非中文且與當前語言不同時切換 UI 語言並重載翻譯 config。

#### Scenario: 偵測到非中文語言

- **WHEN** 偵測結果映射成功且不等於 `zh-tw`
- **THEN** 前端 `setLanguage(langCode)`，並在語言改變時重新載入該語言的翻譯 config

#### Scenario: 偵測失敗續流程

- **WHEN** 偵測請求失敗
- **THEN** 前端維持當前語言（預設 `zh-tw`），對話流程繼續

#### Scenario: Quick Action 路徑不偵測

- **WHEN** 訊息由 Quick Action 觸發
- **THEN** 前端不做語言偵測，直接使用當前語言

> 註（現狀偏差）：語言為「單向黏著」——偵測只會升級到非中文；切到非中文後，後續即使偵測回 `zh-tw` 也因 `langCode !== 'zh-tw'` 守門而不切回中文。

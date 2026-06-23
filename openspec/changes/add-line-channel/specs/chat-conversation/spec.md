## ADDED Requirements

### Requirement: 通路無關的對話協調器

系統 SHALL 提供一個與通路無關的對話協調函式 `process_message(tenant, text, user_id, mode?, lang?, lat_lng?)`，封裝「決定 mode → 建立服務 → 依服務類別分派 → 組裝回覆 → 記錄統計」的核心邏輯，供 HTTP 入口（`/api/chat`）與非 HTTP 入口（LINE webhook）共用。既有 `/api/chat` 對外行為 SHALL 維持不變。

#### Scenario: HTTP 入口委派協調器

- **WHEN** `POST /api/chat` 收到請求
- **THEN** 系統委派 `process_message()` 處理並回傳與既有相同結構的 JSON（`type`/`response`/`references` 等），對外行為不變

#### Scenario: 非 HTTP 入口共用協調器

- **WHEN** LINE webhook 等非 HTTP 入口需完成對話
- **THEN** 系統呼叫同一個 `process_message()`，不複製對話分派邏輯

#### Scenario: 協調器回傳結構化結果

- **WHEN** `process_message()` 完成
- **THEN** 回傳含回覆文字、references 與服務類別 `type` 的結構化結果，由各入口自行轉換為該通路的回覆格式

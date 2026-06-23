## ADDED Requirements

### Requirement: 服務的 LINE 啟用開關

服務配置 SHALL 支援可選的 per-service `line_enabled` 布林欄位（缺省時視為啟用），用以控制該服務是否在 LINE 通路可用。服務的其餘設定（`class`、`temperature`、`use_grounding`、`search_keyword`、`prompt_file` 等）SHALL 維持單一共用，web 與 LINE 共享同一份設定，不提供整套分平台設定。管理後台服務設定頁 SHALL 提供對應的「在 LINE 啟用」勾選（預設開）。

#### Scenario: 缺省視為啟用

- **WHEN** 服務配置未指定 `line_enabled`
- **THEN** 系統視該服務為在 LINE 啟用

#### Scenario: 排除特定服務於 LINE

- **WHEN** 將某服務的 `line_enabled` 設為 `false`（例如降級的 `SmartRouteService` 或僅靠快捷鈕的 `QueryService`）
- **THEN** 該服務不納入 LINE 的意圖路由候選，亦不在 LINE 通路提供，但其 web 行為不受影響

#### Scenario: 核心設定維持共用

- **WHEN** 編輯服務的 `class`/`temperature`/`use_grounding`/`search_keyword`/`prompt_file`
- **THEN** 變更同時套用至 web 與 LINE（設定一次、兩平台共用），不需維護兩套設定

---
name: "linebot"
slug: "linebot"
description: "Flask 多平台（LINE+Telegram）對話機器人，Gemini/RAGFlow 雙 AI 後端 + Gunicorn + 多品牌；調研分支 feature/gemini-linebot"
url: "https://github.com/wendyyu170/linebot"
stars: 0
license: "Apache-2.0"
language: ["Python", "HTML"]
tags: [line-bot, line-messaging-api, telegram, flask, gemini, ragflow, gunicorn, multi-brand, liff, webhook]
checked_at: "2026-06-23"
latest_version: ""
latest_released_at: ""
tracked_version: "feature/gemini-linebot"
version_lag: null
default_branch: "main"
branches: ["main", "feature/gemini-linebot"]
references: []
related: []
---

# linebot

> **調研分支聲明**：本條目基於 **`feature/gemini-linebot`** 分支（非 `main`）。此分支是專案的 Gemini 化重構，與本平台（Gemini + Redis + 多租戶）結構最接近，故為正確對照對象。`main` 分支僅 RAGFlow + 單純 line-bot（見文末對照）。

$$\text{Repo}_{core} = 3W(\text{What/Why/How}) + Decision(\text{作為本平台 LINE 串接的「參考實作」採用})$$

## 3W 定位
- **What**：Flask 多平台機器人，把 **LINE / Telegram** 訊息轉送到 **Gemini 或 RAGFlow**（工廠模式可切換），回覆給使用者；支援多品牌、文件生成（Word）、長照（LTC）評估 LIFF。
- **Why**：一台伺服器掛多個品牌 × 多平台 × 可選 AI 後端，且具生產部署姿態（Gunicorn + AWS）。
- **How**：`line-bot-sdk 3.17.1`(v3) `WebhookHandler` 驗章 → `MultiBotManager` 以 `bot_id` 隔離 handler/service → `AIServiceFactory` 建立 Gemini/RAGFlow 服務 → **reply 回覆**（已具 push 能力但未接入慢路徑）。

## 場景與市場
- 目標客戶：想用 LINE/Telegram 接 Gemini 或 RAG 知識庫的多品牌營運方（含長照、眼科等垂直產業）。
- 典型用途：客服問答、垂直產業助理、可下載的 AI 生成文件（LTC 報告）。
- 熱門程度：private/個人專案，0 star，無 release。屬「可讀的參考實作」。

## 技術棧
$$\text{TechStack} = \text{Python} + \text{Flask 3.0.0} + \text{line-bot-sdk 3.17.1(v3)} + \text{google-genai} + \text{ragflow-sdk} + \text{redis} \ge 5 + \text{python-docx}$$
- ⚠️ **生產姿態落差**：`gunicorn.conf.py` 存在（4w×2t sync、`timeout=120s`、`preload`、`max_requests=1000`）但**未被使用**——systemd `start.sh` 實際跑 `python run.py`（Flask **dev server**）；且 nginx `proxy_timeout 60s` < 預期 120s。
- `requirements.txt` 同時含 `google-genai`（優先）與 `ragflow-sdk`（fallback）→ AI 後端由 `AIServiceFactory` 依設定切換。
- AI 細節：Gemini `gemini-2.5-flash` + Google Search grounding（恆開、非串流）；LTC 報告用 `gemini-3-flash-preview`。Redis session key `gemini_session:{bot}:{user_id}`、TTL 3600s、**歷史砍到最近 1 輪**（近乎無狀態）。

## 架構分析
- **平台抽象**：`app/core/base_platform_service.py:BasePlatformService`（ABC）統一 `parse_webhook / send_reply / send_loading_indicator`，搭配 `message_models.py` 的 `UniversalMessage / UniversalResponse` → LINE 與 Telegram 共用同一上層。
- **AI 工廠**：`core/services/ai/ai_service_factory.py:AIServiceFactory.create_service(bot_config)` 依設定建立 `GeminiService` 或 `RAGflowService`（消除硬編碼）。
- **多 Bot 管理**：`app/services/linebot/multi_bot_manager.py:MultiBotManager` 為每個 `bot_id` 建 `WebhookHandler(secret)` + `BaseLineBotService(token)` + AI service，`reload_bots()` 可熱重載。
- **統一設定**：`core/config/unified_config_manager.py:UnifiedConfigManager` 讀 `core/configs/brands.json` + `prompts/*.prompt.txt`（每品牌一檔提示詞）。
- **附加能力**：`document_generator.py`（Word 生成）+ `file_download.py:FileHostingService`（檔案託管）+ `token_tracker.py`（用量）+ `ltc_report_agent.py`（LTC 報告 agent）+ LIFF（`static/liff/`, `routes/ltc_assessment.py`）。

## 資料流程
```
LINE Platform ──POST /webhook/{bot_id}[/callback]──► Flask (Gunicorn sync, 120s timeout)
  handler.handle(body, signature)            # X-Line-Signature HMAC 驗章（SDK 內建，raw body）
    └─ @handler.add(MessageEvent, TextMessageContent)   # ⚠️ 僅文字訊息事件
         show_loading_animation(user_id, 15或60s)        # 依 bot_id 決定
         answer, refs = AIServiceFactory 服務.get_response(text, user_id)   # ⚠️ 同步阻塞於 webhook 內
         clean = MarkdownConverter.smart_convert(answer)  # Markdown→LINE 純文字
         reply_messages(event.reply_token, [TextMessage(clean + 📚refs)])  # ⚠️ 僅 reply，無 push fallback
LINE Platform ◄── 單一 TextMessage（答案 + 參考資源合併）
```

## 使用者操作流程
LINE 使用者傳文字 → loading 動畫（≤60s）→ 收到 Markdown 清洗後的答案（參考資源合併同一則）。僅 1:1 文字；無 FollowEvent 歡迎語、無 Postback/圖片。LTC 品牌另走 LIFF 網頁評估表單。

## API 入口
- `POST /webhook/<bot_id>`、`/webhook/<bot_id>/callback`、`/webhook/multi`（auto 識別）— LINE webhook。
- `POST /telegram/webhook/...` — Telegram。`/ltc-assessment`（LIFF）、`/download/<file>`（檔案）、`/config*`（設定 UI）、`/delete-bot`。
- 核心 class：`MultiBotManager`、`BaseLineBotService`（`reply_messages` / **`push_messages`** / `show_loading_animation`）、`AIServiceFactory`、`UnifiedConfigManager`。

## 交叉比對
- **與本平台（Web-Chatbot-Platform）高度同構**：兩者皆 **Gemini + Redis session + 工廠模式 + 多品牌**。差異僅在「入口」：本平台 = `<script>` 嵌入網頁；linebot = LINE/Telegram。→ 本分支正是「**把本平台架構接上 LINE**」的現成藍圖。
- 深度最佳實踐分析 → `260623-line-integration-best-practices.md`（notes/work/references）。

## 競品比較
- vs `main` 分支：本分支多了 Gemini 後端、Telegram、平台抽象、Gunicorn、文件生成、LTC/LIFF、token 追蹤、**push 能力**。
- vs LINE 官方範例：多了多平台多品牌工廠 + 生產部署；仍少 push-fallback 接線、Flex/QuickReply、事件覆蓋、冪等。

## 採用決策
**採用方式 = 參考實作（reference），非依賴**。可借鏡：v3 驗章、`BasePlatformService` 多平台抽象、`AIServiceFactory`、多 Bot handler 隔離、Markdown→LINE 清洗、Gunicorn 生產設定、loading 動畫。
**關鍵教訓（本平台務必補）**：此分支**已有 `push_messages` 卻未接入慢回應路徑**——仍是「同步阻塞 + 僅 reply」，reply token（~1 分鐘）一旦被慢 Gemini 拖過就**靜默丟訊息**；且 all-exception→400、僅 `MessageEvent`、無冪等。完整 Pareto 分析 → `260623-line-integration-best-practices.md`。

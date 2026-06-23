---
created: 2026-06-23
modified: 2026-06-23
tags: [web-chatbot-platform, brand, service, system-prompt, redis, gemini, architecture]
source_system: ai-generated
note_type: literature
---

# Web Chatbot Platform：品牌與服務架構研究

## 1. 品牌 vs 服務的關係

**不是「系統提示詞 vs 對話提示詞」，而是「租戶身份 vs 功能模組」。**

```
品牌（Tenant/Brand）
├── 外觀設定（appearance）：標題、顏色、歡迎語
├── API Key 對應
└── 服務（Services）[]
    ├── service A：prompt_file → 自己的 system prompt
    ├── service B：prompt_file → 自己的 system prompt
    └── service C：...
```

每個服務都有**獨立的 system prompt 檔案**（`.md` 格式）。品牌只是把多個服務打包在同一個租戶下。

**資料來源：**
- `backend/data/tenants.json` — 唯一 SSOT，所有 tenant 和 service 定義於此
- `src/types/index.ts` — 前端型別定義（`Brand`、`Service`、`Message` 等介面）

---

## 2. 服務標籤：點下去觸發幾次？

**設定 `currentMode` 狀態，恆觸發——直到切換或退出。**

點下服務標籤後：
1. 呼叫 `setCurrentMode(serviceId)`，InputBar 上方出現「目前模式」提示條
2. 之後每一輪對話都帶著這個 `serviceId` 送給後端，後端用它選出對應的 service（含 system prompt）
3. 退出時點「退出模式」按鈕，`currentMode` 回到 `'general'`

**不是「點一次觸發一次」，而是模式切換，持續生效。**

**關鍵位置：**
- `src/components/chat/ChatContainer.tsx` 第 216–292 行
- `src/components/chat/InputBar.tsx` 第 50–68 行

---

## 3. 直接打字 vs 點標籤：意圖辨識機制

| 情況 | 機制 |
|---|---|
| 使用者點服務標籤 | 強制切換 mode，**不走**意圖辨識 |
| 使用者直接打字 | 呼叫 `apiClient.detectIntent`，AI 判斷對應服務，自動切換 `currentMode` |

直接文字輸入時，**每一輪都做一次意圖判斷**，判斷出對應服務後切換模式，再帶著該服務的 system prompt 回覆。

---

## 4. 每輪都注入 System Prompt，字數多有問題嗎？

**沒有問題。** 關鍵在於 system prompt 不是放進對話歷史裡的。

Gemini API 呼叫結構：

```
GenerateContentConfig(
  system_instruction = system_prompt,  ← 獨立欄位，每次重傳，不佔歷史 token
)
contents = [                           ← 對話歷史，累積增長，存 Redis
  {role: "user", parts: [...]},
  {role: "model", parts: [...]},
  ...最多 16 條（8 輪）後截斷
]
```

- `system_instruction` 每次都重傳，走獨立欄位，不佔對話歷史 token 配額（Gemini API 設計如此）
- 對話歷史（`contents`）才是真正累積的部分，後端限制最多 **16 條（8 輪）** 後截斷

**注入邏輯位置：**
- `backend/config/service_factory.py` 第 64–83 行 — 讀取 `prompt_file` 覆寫 `SYSTEM_PROMPT`
- `backend/services/base_gemini_service.py` 第 130–165 行 — 最終組裝並呼叫 API

---

## 5. 對話歷史能更改嗎？

**不能。** 真正的多輪記憶存在 Redis，已送出的歷史無法回頭修改。

Redis key 格式：
```
gemini_session:{tenant_id}:{service_name}:{user_id}
```

**注意：`service_name` 是 key 的一部分。**
> 切換服務 = 切換到不同的 Redis session = 看不見其他服務的歷史，但各服務自己的歷史仍保留（TTL 內切回可接續）

**生命週期：**
- 每輪 append 新訊息進 `contents`
- 超過 8 輪（16 條）的舊歷史被截斷丟棄
- Redis TTL = 3600 秒（1 小時無對話後自動清除）

前端傳的 `history` 字串陣列（`conversationHistory.slice(-5)`）後端實際上不使用，是冗餘設計。

**歷史管理位置：**
- `backend/services/base_gemini_service.py` 第 99–103 行 — Redis session key 定義
- `backend/services/base_gemini_service.py` 第 224–235 行 — append + 截斷 + 存回 Redis

---

## 6. 小結

```
使用者點服務標籤
  → currentMode = serviceId（持續）
  → 每輪送出時帶 serviceId
  → 後端選對應 service
  → 讀對應 prompt_file 作為 system_instruction（每次重傳，走獨立欄位）
  → 從 Redis 載入該 service 的對話歷史
  → 呼叫 Gemini API（system + history + 本輪問題）
  → 回覆 append 進 Redis（超 8 輪截斷，TTL 1 小時）

使用者直接打字（無 mode）
  → detectIntent 每輪判斷一次
  → 自動切換 currentMode
  → 後續同上
```

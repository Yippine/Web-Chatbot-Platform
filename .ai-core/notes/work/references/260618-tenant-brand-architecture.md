---
created: 2026-06-17
modified: 2026-06-17
tags: [web-chatbot-platform, tenant, config, architecture, hot-reload, admin]
source_system: ai-generated
note_type: permanent
---

# 品牌設定架構與熱更新流程分析

## MECE 分析：品牌設定結構

### A. 設定儲存位置（六層架構）

| 層級 | 內容 | 儲存位置 | 格式 | 管理方式 |
|---|---|---|---|---|
| **身份層** | id / name / enabled / api_key_env | `backend/data/tenants.json` | JSON 單檔 | 所有品牌同一檔 |
| **服務層** | class / temperature / grounding / 關鍵字 / 等待訊息 | `backend/data/tenants.json` → `services{}` | JSON 內嵌 | 同上，巢狀結構 |
| **Prompt 層** | AI 提示詞內容 | `backend/prompts/{tenant_id}/{service_id}.md` | Markdown | 依目錄/品牌分資料夾 |
| **外觀層** | 標題 / 配色 / 歡迎訊息 / 圖示 URL | `backend/data/tenants.json` → `appearance{}` | JSON 內嵌 | 同上 |
| **API Key 層** | Gemini API Key | `backend/.env` | env 環境變數 | 單檔，key 格式：`TENANT_{ID}_GEMINI_API_KEY` |
| **靜態資源層** | Chat Icon 圖片 | `public/images/tenants/{tenant_id}/` | PNG/JPG | 依目錄/品牌分資料夾 |

---

### B. 各品牌設定欄位（MECE 完整列舉）

每個品牌的 `tenants.json` 包含以下結構：

```
品牌
├── id / name / enabled / api_key_env
├── services
│   └── {service_id}
│       ├── 基本：name / icon / enabled / class
│       ├── AI：temperature / use_grounding
│       ├── 搜尋：search_keyword / allowed_domains
│       ├── UI：loading_message / query_loading_message / mode_message / show_mode_message
│       └── prompt_file → 指向 backend/prompts/{tenant_id}/{service_id}.md
├── quick_actions[]
│   └── { service_id, query }
└── appearance
    ├── pageTitle / title / subtitle / welcomeMessage / placeholder
    ├── header { type: solid|gradient, color|colors[], direction }
    ├── button { type: solid|gradient, color|colors[], direction }
    ├── chatIconUrl
    └── textColor (white|black)
```

---

### C. 現有品牌清單（13 個）

| tenant_id | 品牌名稱 | 服務數 |
|---|---|---|
| `second_hand_car` | 大成中古智慧購車精靈 | 1 |
| `leosys` | 智慧大獅（國眾電腦） | 4 |
| `dawho` | 永豐智慧精靈 | 3 |
| `Emperor_Chemical_co_ltd` | 帝一化工 | 4 |
| `CLASSIC` | 屹閎有限公司 | 1 |
| `caesarpark` | 凱薩大飯店 | 4 |
| `xiyuantang` | 禧元堂 | 2 |
| `tpe_policy` | 台北政策幫手 | 5 |
| `leosys_ai_lab` | 國眾 AI Lab | 4 |
| `everlight_chemical` | 台灣永光化學 | 1 |
| `taiwanglass` | 台灣玻璃 | 1 |
| `Zoho` | Zoho | 1 |
| `sandak` | 向達企業股份有限公司 | 2 |
| `eoa168` | 百豐國際有限公司 | 1 |

---

## Chain 分析：設定更新流程

### 路徑一：後台網頁編輯

```
後台表單編輯（/admin/tenants/{id}/...）
  → 點「儲存」按鈕（需明確觸發，非即時）
  → POST 至 Python Flask admin_app.py
  → json.dump → 覆寫 backend/data/tenants.json（磁碟）
  → Prompt 內容 → 同步寫入 backend/prompts/{tenant}/{service}.md
  → tenant_manager.reload()（記憶體立即同步）
  → 下一個 chat 請求 → 立即套用新設定（不需重啟）
```

**後台編輯：需點「儲存」，儲存後無需重啟，下一請求即生效。**

---

### 路徑二：直接改程式碼端

```
直接編輯以下任一檔案：
  ├── backend/data/tenants.json
  ├── backend/prompts/{tenant_id}/*.md
  └── backend/.env

→ 無需任何額外操作
→ 下一個 chat 請求進來時：
    get_tenant(auto_reload=True) → 每次請求重新讀 tenants.json
    load_prompt()               → 每次請求重新讀 .md 檔
    dotenv_values()             → 每次請求重新讀 .env
→ 立即套用，不需重啟伺服器
```

**程式碼端直接改檔，下一個請求即生效（無需重啟）。**

---

### 熱更新機制根據（`backend/config/tenant_manager.py:36-62`）

```python
def get_tenant(self, tenant_id: str, auto_reload: bool = True):
    if auto_reload:
        self.load_tenants()      # ← 每次請求都重新讀 JSON

    ...
    env = dotenv_values(...)     # ← 每次請求都重新讀 .env
    api_key = env.get(api_key_env)
```

`admin_app.py` 每次寫入後也主動呼叫 `tenant_manager.reload()`，確保記憶體與磁碟同步。

---

## 總結

| 問題 | 答案 |
|---|---|
| 設定集中還是分散？ | **主設定集中**：`tenants.json` 單一 JSON；**Prompt 分散**：每品牌一個資料夾 |
| 後台編輯馬上生效？ | **不是**，需點「儲存」才寫入磁碟，儲存後立即生效 |
| 後台儲存需重啟？ | **不需要**，admin_app 寫入後主動 reload() |
| 程式碼端改設定需重啟？ | **不需要**，auto_reload=True 每次請求重讀檔案 |
| 這套熱更新流程是否已建置？ | **已完整建置**，後台 → admin_app → tenants.json → auto_reload 全部接通 |

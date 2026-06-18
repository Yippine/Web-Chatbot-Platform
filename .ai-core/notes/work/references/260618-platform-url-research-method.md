---
created: 2026-06-17T00:00:00+08:00
modified: 2026-06-17T00:00:00+08:00
tags: [workflow, web-search, automation, chatbot-platform]
note_type: permanent
source: tmp/chatbot.md
---

# 批量查找廠商官網 URL — ChainReason 分析

## 問題描述

`tmp/xlsx-parse-result.json` 含教案 35 家 + 導入案 124 家，共約 **159 家公司**，需一次性批量填入官網 URL。目標：找出最快速可行的做法。

---

## Step 1：拆鏈（Decompose）

$$c_1 \xrightarrow{\text{有哪些查詢管道？}} c_2 \xrightarrow{\text{哪個管道最快且準確？}} c_3 \xrightarrow{\text{能否自動化批量執行？}} c_4 \xrightarrow{\text{結果能否直接回寫 JSON？}} \text{OptimalSolution}$$

---

## Step 2：前提驗證（PremiseTest）

### $c_1$：有哪些管道？

| 管道 | 說明 | 評估 |
|------|------|------|
| A. Google Search API | 以公司名查 `site:` 或直接搜尋，取第一筆 | **Hold** — 最高覆蓋率，但需 API key |
| B. 經濟部商工登記公示 | 統編查詢有官網欄位 | **Weak** — 許多小型車行未填官網，覆蓋率低 |
| C. WebSearch tool（本 session） | 逐家搜尋，Claude 直接執行 | **Hold** — 有工具可用，但 159 家逐一執行耗時長 |
| D. Workflow 多 agent 並行 | fan-out 多 agent 同時搜尋 | **Hold** — 大幅壓縮時間，但消耗 token |
| E. 人工補齊 | 匯出名單，手動查 | **Fail** — 題意要求自動化 |

### $c_2$：哪個管道最快且準確？

- **前提**：速度 × 準確度 × 成本三者最優組合
- **分析**：
  - Google Search API → 需申請 key，設置成本高，但批量最快
  - WebSearch tool + Workflow fan-out → 零額外設置，並行 16 個 agent 同時跑，159 家約需 10–15 輪，wall-clock ≈ 5–10 分鐘
  - 單純商工登記 → 覆蓋率僅約 30–40%（小型商行普遍未填）
- **結論**：WebSearch + Workflow fan-out = **Hold**（最可行，當下即可執行）

### $c_3$：能否自動化批量執行？

- **前提**：WebSearch tool 可在 agent 內呼叫，Workflow `pipeline()` 可 fan-out
- **設計**：

```js
pipeline(
  公司名稱列表,
  name => agent(`搜尋 ${name} 官方網站，回傳 URL 或 null`),
)
```

- 上限：每輪 ≤ 16 agent 並行，159 家 ÷ 16 ≈ 10 輪自動流轉
- **Hold ✅**

### $c_4$：結果能否回寫 JSON？

- Workflow 結束後在主 session 以 Python 合併回 `xlsx-parse-result.json`
- **Hold ✅**

---

## Step 3：弱點攻擊（Reframe）

**唯一 Weak 點** → 商工登記覆蓋率低：

- **Reframe**：不依賴商工登記作為主管道，改為補充驗證層（若 WebSearch 找到的 URL 可疑，再比對商工登記統編頁面確認）
- **新鏈 $C'$**：WebSearch 為主，商工登記為副驗證，兩者皆空才標記 `""`

---

## Step 4：收斂最優解（Converge）

$$\text{OptimalSolution} = \underbrace{\text{Workflow fan-out}}_{\text{批量並行}} \times \underbrace{\text{WebSearch per company}}_{\text{每家搜名稱+官網關鍵詞}} \times \underbrace{\text{Python 回寫 JSON}}_{\text{結果合併}}$$

### 具體流程

1. 讀取 `xlsx-parse-result.json`，提取所有公司名（跳過「自由業」「自媒體」等非法人名稱）
2. Workflow pipeline fan-out：每個 agent 搜 `{公司名} 官方網站` → 回傳 `{company, url}` 結構化輸出
3. 過濾規則：
   - URL 需含公司名稱關鍵字或 domain 可辨識 → 採用
   - 搜尋結果全為新聞／社群媒體 → 標記 `""` 而非亂填
4. Python 合併回寫 JSON，保留原結構，只更新 `website` 欄位

### 預估

| 項目 | 數值 |
|------|------|
| 預估時間 | 約 5–8 分鐘（159 家，WebSearch tool fan-out） |
| 預估 token | 約 80k–120k output tokens |

---

## 結論

> **完全可行**，建議直接啟動 Workflow fan-out，不需額外設置任何 API key。

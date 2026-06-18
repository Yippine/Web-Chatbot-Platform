---
created: 2026-06-17
modified: 2026-06-17
tags: [web-chatbot-platform, tenant, compare, prompt, analysis]
source_system: ai-generated
note_type: permanent
---

# 品牌設定比較分析（同異優缺）

## 比較軸定義（ComparisonAxes）

分兩大面向各自比較：
- **面向 A**：Prompt 設定（跨品牌橫向比較）
- **面向 B**：tenants.json 設定（跨品牌橫向比較）

---

## 面向 A：Prompt 設定比較

### A1. Prompt 完整度分層

| 層級 | 品牌 / 服務 | 特徵 |
|---|---|---|
| **L3 完整型** | leosys/aboutleo、dawho/ibrain、CLASSIC/general、caesarpark/general、tpe_policy/service_elderly_welfare | 具備角色定義 + 專注範圍 + 搜尋指引 + 連結規則 + 回答格式 + 驗證規則 完整六段 |
| **L2 中等型** | xiyuantang/product、leosys_ai_lab/solution_search、Emperor_Chemical_co_ltd/DIY、Emperor_Chemical_co_ltd/FAQ | 具備角色定義 + 部分規則 + 回答模板，缺少驗證規則或連結規則 |
| **L1 最簡型** | sandak/general、taiwanglass/general、everlight_chemical/general、eoa168/general、Zoho/general（推測）、CLASSIC（初始）| 僅一句話：「你是『XXX』的智能助手，請友善且專業地回答使用者的問題。」|

---

### A2. 同（共同段落結構）

所有 L3 完整型 prompt 都包含以下**六個共同段落**，結構高度一致：

| 段落 | 典型標題 | 內容 |
|---|---|---|
| 1 | 角色與使命 | 角色名稱 + 主要任務 + 溝通風格 |
| 2 | 專注範圍 | 只回答 XXX 相關問題 + 拒絕範本句 |
| 3 | 資訊搜尋指引 | 強制使用 Google Search + 限定官方網域 |
| 4 | 連結提供規則 | ✅ 只用參考資源區塊 / ❌ 禁止正文放網址 |
| 5 | 回答格式 | 依情境 A/B/C 分支的 Markdown 模板 |
| 6 | 資料驗證規則 | 禁止幻覺 + 搜不到時誠實說 + 禁止編造價格 |

---

### A3. 異（各品牌特有差異）

| 差異點 | 說明 |
|---|---|
| **連續對話規則** | 只有 dawho/ibrain、leosys/aboutleo 有明確的「連續對話最高優先級」規則，要求每次回答前承接上文 |
| **情境分支複雜度** | tpe_policy 服務最複雜，依「使用者資訊完整度」分 A/B 兩情況，各情況再有多個輸出區塊；caesarpark/general 最簡（150字限制） |
| **回答格式** | 各品牌格式完全客製：金融業用【方案建議】、飯店用自然對話、政府服務用 emoji 區塊、化工用配方引導 |
| **context 嵌入** | tpe_policy 直接在 prompt 裡硬編碼核心政策數據（台北600點/新北480點）；其他品牌靠 grounding 即時查 |
| **XML 標籤** | leosys/aboutleo 用 `<system_instruction>` `<focus_area>` 等 XML 包裹結構；其他用 Markdown `##` 標題 |
| **產品矩陣** | leosys_ai_lab/solution_search 獨有一個「產業 × 產品矩陣」表格 |

---

### A4. 優（設計優點）

| 優點 | 體現品牌 |
|---|---|
| 結構完整、防幻覺機制紮實 | dawho/ibrain、leosys/aboutleo |
| 情境分支清晰（A/B/C 情況不同格式） | tpe_policy 系列、Emperor_Chemical_co_ltd |
| 硬編碼關鍵資料避免 grounding 失準 | tpe_policy（敬老卡點數直接寫死） |
| 連續對話規則明確，避免 AI 失憶感 | dawho、leosys |
| 格式簡潔、對話自然（不死板） | caesarpark/general、xiyuantang/product |

---

### A5. 缺（設計缺口）

| 缺口 | 影響品牌 |
|---|---|
| **L1 最簡型幾乎等於沒有 prompt** | sandak、taiwanglass、everlight_chemical、eoa168 — 只有一句話，無任何結構或約束 |
| **無統一模板基底** | 各品牌 L3 結構雖相似，但靠人工逐一撰寫，沒有一個共用的 base template，未來維護成本高 |
| **tpe_policy 硬編碼數據過時風險** | 政策點數若有異動，需手動更新 prompt，不如靠 grounding 即時抓 |
| **prompt 與 tenants.json 的 mode_message 有語意重疊** | prompt 裡有「招呼詞」、tenants.json 裡也有 `mode_message`，兩者內容可能矛盾 |

---

## 面向 B：tenants.json 設定比較

### B1. Temperature 分佈

| 值 | 品牌/服務 | 用途傾向 |
|---|---|---|
| **0.2** | xiyuantang/general、Emperor_Chemical_co_ltd/general | 精確型通用對話 |
| **0.4** | caesarpark/general | 飯店客服（需穩定） |
| **0.5** | leosys_ai_lab/case_search、sandak/recommend、tpe_policy/service_housing_renewal | 查詢型，需事實精確 |
| **0.6** | leosys 全服務、dawho 全服務、tpe_policy 多數服務、leosys_ai_lab 多數 | **最常用值**，平衡型 |
| **0.7** | CLASSIC、second_hand_car、Emperor_Chemical_co_ltd（DIY/FAQ/contact）、xiyuantang/product、caesarpark/location+notification、sandak/general、eoa168、Zoho、taiwanglass、everlight_chemical | **預設值**，多數服務沿用 |

**結論：temperature 集中在 0.6–0.7，幾乎沒人動過預設值；只有少數精確查詢服務刻意調低。**

---

### B2. use_grounding 分佈

| 狀態 | 品牌/服務 |
|---|---|
| **true（開啟）** | 所有 leosys、dawho、tpe_policy、second_hand_car、CLASSIC、caesarpark（除 general）、xiyuantang/product、leosys_ai_lab（除 general）、sandak/recommend、eoa168 |
| **false（關閉）** | caesarpark/general、xiyuantang/general、everlight_chemical/general、taiwanglass/general、Zoho/general、sandak/general、Emperor_Chemical_co_ltd/general |

**規律：general（通用對話）服務傾向關閉 grounding；專業查詢服務全開。**

---

### B3. 外觀設定完整度

| 完整度 | 品牌 | 狀態 |
|---|---|---|
| **完整** | second_hand_car、leosys、dawho、leosys_ai_lab、xiyuantang、tpe_policy、caesarpark、sandak、eoa168、Zoho | 有 pageTitle + title + subtitle + welcomeMessage + 配色 |
| **空殼** | CLASSIC、everlight_chemical、taiwanglass | pageTitle/title/subtitle/welcomeMessage 全為空字串，header/button 顏色都是 `#000000` |
| **部分** | Emperor_Chemical_co_ltd | subtitle 空，但 welcomeMessage 有填 |

**空殼品牌即「尚未完成設定」的品牌，appearance 是 default 初始值。**

---

### B4. Service Class 分佈

| Class | 數量 | 代表服務 |
|---|---|---|
| **ChatService** | 最多（約 70%） | 所有 general + dawho/ibrain+Wealth、tpe_policy/general、leosys_ai_lab 多數 |
| **QueryService** | 中（約 25%） | leosys 全部、dawho/wealth_vip、caesarpark/location+notification、xiyuantang/product、tpe_policy 政策服務 |
| **SmartRouteService** | 1 個 | caesarpark/attractions（獨有） |
| **FrappeQueryService** | 0 個（但 UI 有支援） | 目前無品牌啟用 |

---

### B5. 同（跨品牌共同點）

| 共同點 | 說明 |
|---|---|
| **每個品牌都有一個 general 服務** | 14 個品牌全部都有 general 或功能等同的通用服務 |
| **quick_actions 指向 service_id** | 所有品牌的 quick_actions 格式完全相同：`[{service_id, query}]`，query 幾乎全為空字串 |
| **api_key_env 命名規則統一** | 全部遵循 `TENANT_{ID大寫}_GEMINI_API_KEY` 格式 |
| **appearance 結構完全統一** | solid/gradient 的 header/button 結構一致，沒有品牌自定義額外欄位 |
| **loading_message 預設詞** | 大量品牌直接沿用「處理中」「查詢資料中」，幾乎沒有差異 |

---

### B6. 異（各品牌特有差異）

| 差異 | 說明 |
|---|---|
| **服務數量** | 最多：tpe_policy（6個）、leosys（4個）、leosys_ai_lab（4個）、dawho（3個）；最少：sandak、eoa168、everlight_chemical 等（1–2個）|
| **漸層配色** | dawho、tpe_policy、xiyuantang、Zoho 用 3–4 色漸層；其他多為單色或雙色 |
| **chatIconUrl** | 只有 second_hand_car、leosys、dawho、leosys_ai_lab、demo、cceye 有上傳圖示 |
| **frappe 欄位** | 部分服務有 `"frappe": null`（caesarpark/general、Emperor_Chemical_co_ltd/FAQ、sandak），其他服務根本沒有此欄位（欄位存在與否不一致）|

---

## 整體 Judgment

### 1. 存在隱含「共用模板」，但未明文化

L3 完整型 prompt 的六段結構（角色→範圍→搜尋→連結→格式→驗證）顯然是同一個人的慣用寫法，但**從未被抽成一個可重用的 base template**。每個品牌都是「重新複製再改」，長期會造成維護發散。

### 2. 品牌成熟度兩極分化

- **成熟品牌（L3 + 外觀完整 + 多服務）**：dawho、leosys、caesarpark、tpe_policy、Emperor_Chemical_co_ltd
- **佔位品牌（L1 + 外觀空殼 + 單服務）**：taiwanglass、everlight_chemical、CLASSIC（外觀）、sandak

後者的 prompt 只有一句話、外觀是預設黑色、temperature 也沒調整，判斷為「建立了 tenant 但尚未正式投入設定」。

### 3. general 服務是入場券，專業服務才是差異化

每個品牌的 general.md 幾乎大同小異（L1 版只有一句話，L3 版也只是做邊界防守）。真正展現品牌個性的是**專業服務 prompt**（如 dawho/ibrain 的理財規則、tpe_policy/service_elderly_welfare 的敬老卡指引）。

### 4. quick_actions.query 全為空值是設計選擇，非遺漏

所有品牌的 quick_actions 的 `query` 欄位都是 `""`，推測設計上是「點擊後進入服務模式，不帶預設問題」，而非遺漏填寫。

### 5. frappe 欄位不一致需清理

`"frappe": null` 只出現在部分服務，其他服務根本沒有此 key。雖然功能上等價，但 JSON schema 不統一，未來擴充 FrappeQueryService 時可能造成困惑。

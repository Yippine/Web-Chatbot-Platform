---
created: 2026-06-17
modified: 2026-06-18
tags: [audit, prompt, tenant-config, mece, pareto, chain, ai-genie, proactive-recommendation]
source_system: ai-generated
note_type: permanent
---

# Prompt 與品牌設定缺陷稽核

$$\text{Audit} = \text{MECE}(\text{完整分類問題}) \to \text{SESE}(\text{每問題單一因果鏈}) \to \text{Pareto}(\text{找 20\% 關鍵缺陷}) \to \text{Chain}(\text{推導修復優先順序})$$

> **更新說明（2026-06-18）**：依據 260616 AI 精靈內部會議記錄及主管確認實例（`proactive-recommendation-demo.md`），更新稽核重點與修復路徑。

---

## 專案核心思想確認

> **AI Genie（AI 精靈）**：可嵌入任何品牌網站的 AI 精靈，核心精神 = **主動推薦 Option**。
> 主管明確要求：「AI 精靈不只是導覽或問答機器人，它要主動給客戶一個 option（選項）」。

$$\text{精靈行為模型} = \text{漏斗式引導} \to \text{收斂條件} \to \text{主動輸出推薦 Option}$$

**主管確認的完整行為路線（以中古車行為例）：**

| 步驟 | 精靈行為 | 目的 |
|---|---|---|
| **Step 1** | 主動詢問使用情境與預算 | 建立篩選條件 |
| **Step 2** | 主動詢問偏好與細節（車型、配備） | 縮小候選範圍 |
| **Step 3** | 主動輸出最終 2 個 Option（A/B）+ 選擇建議 | 縮短決策時間至 30 min 以內 |

$$\text{BotPrompt 設計原則（會議決議）} = \text{角色設定} \to \underbrace{5\text{ 條引導路線}}_{\text{漏斗節點}} \to \underbrace{30\text{ min 內}}_{\text{時間限制}} \to \text{推薦車型} \times \text{報價}$$

這不是「問答 Bot」，是「主動銷售顧問」。Prompt 必須讓精靈知道：當蒐集到足夠條件時，**主動給出推薦，而非等使用者追問**。

支撐「精靈」設計的四個機制：

| 機制 | 實作位置 | 精靈意圖 |
|---|---|---|
| **Quick Actions** | `tenants.json → quick_actions[]` | 精靈主動提供選項讓使用者點擊 |
| **Mode Message** | `tenants.json → services.mode_message` | 進入服務時精靈的招呼語/引導詞 |
| **SmartRouteService** | `services/smart_route_service.py` | 意圖偵測 → 自動分派至正確服務 |
| **Prompt 中的情境分支** | `backend/prompts/*.md` | 精靈依使用者狀態切換回答模式 |

---

## MECE 問題分類（四個互斥完整面向）

### 面向 1｜Prompt 品質問題

#### P1-A：L1 空殼 Prompt（最嚴重）

- **問題**：sandak、taiwanglass、everlight_chemical、eoa168 的所有 prompt 只有一句話
  ```
  你是「XXX」的智能助手，請友善且專業地回答使用者的問題。
  ```
- **影響**：AI 無角色邊界、無搜尋指引、無回答格式、無防幻覺機制 → 等於讓 Gemini 裸跑
- **與精靈思想的衝突**：沒有招呼、沒有引導、沒有範圍限制，完全是被動問答，失去「精靈」特性

#### P1-B：無 Base Template，靠人工複製

- **問題**：L3 完整型 prompt 六段結構（角色→範圍→搜尋→連結→格式→驗證）完全靠人工逐一撰寫，無共用底稿
- **影響**：新品牌上線成本高、各品牌規則不一致（如有些有連續對話規則、有些沒有）、一旦平台政策改變需逐一手改

#### P1-C：mode_message 與 Prompt 招呼詞語意重疊

- **問題**：tenants.json 的 `mode_message` 和 prompt 內的招呼詞/歡迎詞功能重疊
  - dawho/ibrain prompt 有「你好！我是永豐數位金融諮詢助手」
  - tenants.json mode_message 也有類似招呼內容
- **影響**：兩個系統各自管理同一份內容，可能出現矛盾，也讓維護者不知道改哪裡

#### P1-D：硬編碼時效性資料

- **問題**：tpe_policy 的 prompt 直接寫死政策數據（台北 600 點、新北 480 點）
- **影響**：政策異動時需手動找到 prompt 更新，不如讓 grounding 即時抓取
- **反向優點**：避免 grounding 抓到舊資料的防呆值得保留，但應改為「預設值 + grounding 覆蓋」設計

#### P1-E：缺乏連續對話規則（多數品牌）

- **問題**：只有 dawho 和 leosys 有明確「每次回答前必須承接上文」規則
- **影響**：其他品牌的 AI 會把每個問題當獨立問題回答，使用者感受到「AI 失憶感」，失去精靈的「記得你」特性

---

### 面向 2｜tenants.json 設定問題

#### P2-A：空殼外觀品牌（視覺死角）

- **問題**：CLASSIC、taiwanglass、everlight_chemical 的 appearance 全為空字串 + 黑底 `#000000`
- **影響**：如果這些品牌被啟用，使用者看到的是全黑無文字的聊天視窗
- **判斷**：這些品牌是「佔位未完成」狀態，需補齊或標記 `enabled: false`

#### P2-B：frappe 欄位不一致（schema 污染）

- **問題**：部分服務有 `"frappe": null`，其他服務根本沒有此 key
  ```json
  // 有的：
  "frappe": null
  // 沒有的：（key 不存在）
  ```
- **影響**：前端或後端讀取時若未做 null-safe 處理，可能出現 KeyError；schema 不統一讓擴充 FrappeQueryService 時容易誤判

#### P2-C：quick_actions.query 全為空值

- **問題**：所有品牌的 quick_actions 的 `query` 欄位都是 `""`
- **影響**：精靈無法主動帶著「預設問題」進入服務 → 使用者點了按鈕後仍需自行輸入，喪失「精靈主動引導」的核心體驗
- **精靈思想衝突**：Quick Actions 本應是「精靈替使用者預想好問題」，空 query 讓這個功能退化為「服務切換按鈕」

#### P2-D：temperature 未依服務類型調整

- **問題**：70% 的服務 temperature 都是預設 0.7，無論是事實查詢還是創意對話
- **影響**：事實查詢類服務（如政府政策、金融利率）用高 temperature 增加幻覺風險；創意/推薦類服務用低 temperature 限制發揮

#### P2-E：SmartRouteService 嚴重低用

- **問題**：SmartRouteService（意圖偵測 + Google Maps 路由）只有 caesarpark/attractions 一個服務在使用
- **影響**：「智慧路由」是平台最符合「精靈主動引導」思想的能力，但幾乎棄用
- **精靈思想衝突**：精靈的核心就是「聽懂你的意圖，帶你去對的地方」，但目前只有飯店景點用到這個能力

---

### 面向 3｜系統設計問題

#### P3-A：無 Prompt 版本控管機制

- **問題**：prompt .md 直接修改，無版本標記、無 changelog、無回滾機制
- **影響**：品牌 prompt 更新後若效果變差，無法快速還原；多人協作時無法追蹤誰改了什麼

#### P3-B：Service Class 與 Prompt 寫法無對應規範

- **問題**：ChatService 和 QueryService 的 SYSTEM_PROMPT 預設值幾乎相同，但行為設計理論上不同
  - ChatService → 對話型，應有連續對話規則
  - QueryService → 資料查詢型，應有結構化輸出格式
  - 但目前兩者的 prompt 幾乎寫法一致，缺乏對應的 prompt 設計規範
- **影響**：新品牌上線時不知道選哪個 class、用什麼 prompt 樣式

#### P3-C：FrappeQueryService 建好但無品牌使用

- **問題**：ERP 查詢服務已完整實作（含 UI 支援、templates），但 tenants.json 中沒有任何品牌啟用
- **影響**：這個能力對 B2B 品牌（如帝一化工的採購查詢）有極高價值，但完全閒置

---

### 面向 4｜精靈思想對齊缺口

#### P4-A：多數品牌缺乏「精靈主動性」設計（**最高優先，主管直接點名**）

- **問題**：現有 prompt 多為「被動回答型」，只定義「不能做什麼」、「拒絕什麼」，缺少「主動提問、主動收斂、主動輸出 Option」的行為規則
- **主管確認的正確行為模式**（`proactive-recommendation-demo.md`）：
  - **漏斗式引導**：精靈不等使用者自己問出完整需求，而是主動提問（情境→偏好→細節）逐步收斂
  - **主動輸出 Option**：當條件收集足夠，精靈主動給出 2 個最終推薦（Option A / Option B）+ 選擇建議，不等使用者催
  - **時間導向**：整個引導流程設計目標為 30 分鐘內完成，prompt 中應明示「當用戶提供 X 條件後，直接給推薦」
- **Prompt 應有的結構（主動推薦型）**：
  ```
  角色：你是【品牌名】的 AI 銷售顧問（非導覽機器人）
  引導路線：依序詢問 → 1.使用情境 → 2.預算範圍 → 3.偏好條件 → 4.必備功能
  主動推薦規則：當用戶提供預算 + 情境 + 至少 1 項偏好後，
                主動整理成「Option A（最適合理由）vs Option B（最適合理由）」格式輸出
                不需等用戶要求，直接推薦
  時間目標：引導流程設計為 30 分鐘內完成
  ```
- **與現有缺陷的連結**：此問題是 P2-C（quick_actions.query 全空）和 P1-A（L1 空殼 Prompt）的根本原因 — 沒有設計主動性，所以 query 填不出來，prompt 也寫不出來

#### P4-B：Quick Actions 未發揮「精靈預想問題」價值

- **問題**：quick_actions 設計初衷是「精靈替使用者預想好最常問的問題」，但所有品牌的 `query` 都是空的，只做到「服務入口」
- **最佳實踐**（tpe_policy 類型）：
  ```json
  { "service_id": "service_elderly_welfare", "query": "我媽媽住台北市，敬老卡每個月有多少點數可以用？" }
  ```
- **主動推薦型最佳實踐**（中古車行類型）：
  ```json
  { "service_id": "service_sales", "query": "我想買一台車，預算 80-100 萬，平常周末露營開，請幫我推薦適合的車款" }
  ```
  這個 query 直接帶入情境 + 預算，讓精靈跳過基本提問，直接進入偏好收斂階段

#### P4-C：welcomeMessage 是精靈的「第一印象」，多數品牌未善用

- **問題**：CLASSIC、CLASSIC、everlight_chemical 等品牌 welcomeMessage 為空
- 成熟品牌的 welcomeMessage 展現了精靈的個性和能力預覽（如 dawho 的「哈囉！👋 我是永豐銀行的小豐理財專員！」）
- **影響**：空的 welcomeMessage 讓使用者第一眼看到空白聊天框，不知道精靈能做什麼

---

## Pareto 分析（20% 關鍵缺陷 → 80% 影響）

$$\text{Pareto} = \text{排序}(\text{影響} \times \text{覆蓋品牌數} \times \text{精靈思想偏離度} \times \text{主管要求權重}) \to \text{Top 5}$$

> **更新（2026-06-18）**：依主管內部會議明確要求，P4-A（主動推薦設計缺失）升為 #1 優先，因為這是精靈設計哲學的根本方向問題，影響所有品牌的 Prompt 撰寫方式。

| 排名 | 缺陷 | 影響品牌數 | 精靈偏離度 | 優先處理 |
|---|---|---|---|---|
| **#1** | **P4-A：缺乏主動推薦 Option 設計** | 全部品牌（設計哲學問題） | **最高（主管直接點名）** | ★★★★★ |
| **#2** | P1-A：L1 空殼 Prompt | 4+ 個佔位品牌（新品牌也會繼承） | 極高 | ★★★★★ |
| **#3** | P1-B：無 Base Template（含主動推薦結構） | 新品牌上線必然重現 | 高（維護成本） | ★★★★☆ |
| **#4** | P2-C：quick_actions.query 全空 | 全部 14 個品牌 | 高（精靈核心體驗） | ★★★★☆ |
| **#5** | P2-E：SmartRouteService 低用 | 13 個品牌未使用 | 高（平台差異化能力棄用） | ★★★☆☆ |

其餘問題（P1-C、P1-D、P2-A、P2-B、P2-D、P3-A、P3-B、P3-C、P4-B、P4-C）為次優先，可在品牌上線流程中逐步修正。

---

## Chain 分析：缺陷因果鏈 → 修復路徑

$$\text{Chain} = \text{根因} \xrightarrow{} \text{中間問題} \xrightarrow{} \text{表層現象} \xrightarrow{} \text{修復點}$$

### Chain 1：新品牌上線品質差

```
根因：無標準化 Prompt Base Template
  → 每個品牌從零開始寫或複製舊品牌修改
  → 新品牌繼承了舊品牌的缺陷（L1 空殼、無連續對話規則）
  → 品牌精靈品質參差不齊
  → 修復點：建立 Prompt Base Template（六段結構標準化）
```

### Chain 2：精靈體驗割裂

```
根因：quick_actions.query 全空 + mode_message 未填
  → 使用者點擊 Quick Action 後進入空白狀態，需自己想問題
  → 精靈喪失「主動引導」特性，退化為「服務切換器」
  → 修復點：為每個 quick_action 填入代表性問題 + 填寫 mode_message
```

### Chain 3：平台差異化能力棄用

```
根因：SmartRouteService 的適用場景未被傳達給品牌設定者
  → 多數新品牌直接選 ChatService（最熟悉），忽略 SmartRoute
  → 「智慧意圖路由」只有1個品牌使用，平台最強能力閒置
  → 修復點：在 Prompt Template 和新品牌上線 SOP 中說明各 service class 適用場景
```

### Chain 4：空殼品牌潛在上線風險

```
根因：品牌建立後未強制完成 appearance 和 prompt 設定
  → CLASSIC/taiwanglass/everlight_chemical 保持 enabled:true 但設定空殼
  → 若這些品牌被公開使用，使用者看到全黑空白視窗
  → 修復點：新品牌上線前的完整性檢查清單（Checklist Gate）
```

### Chain 5：精靈無法主動推薦 Option（主管指出的根本缺口）

```
根因：所有 Prompt 只定義「如何回答問題」，沒有定義「何時主動輸出推薦」
  → 精靈永遠等使用者問，無法判斷「條件已收集足夠，現在該推薦了」
  → 使用者需要自己想到問「幫我推薦一台車」，AI 才推薦
  → 決策時間無法壓縮至 30 分鐘（主管 KPI）
  → 修復點：Prompt Base Template 中加入「主動推薦觸發規則」
             當用戶提供 [情境 + 預算 + 至少 1 偏好] 後，直接輸出 Option A / Option B
```

---

## 修復優先路徑（給新品牌上線 SOP 使用）

> **更新（2026-06-18）**：依主管要求，Step 0 新增「主動推薦哲學設計」作為所有後續步驟的前置。

```
Step 0  【新增】定義品牌的「主動推薦觸發規則」（解決 P4-A）
        → 釐清：精靈需要收集哪些條件？條件滿足後主動給哪種 Option？
        → 這決定 quick_actions.query 要設計什麼，也決定 Prompt 的核心邏輯

Step 1  建立 Prompt Base Template（含主動推薦結構）（解決 P1-A + P1-B + P1-E）
        結構：角色 → 引導路線（5條） → 推薦觸發條件 → Option輸出格式 → 範圍限制

Step 2  為每個 quick_action 填入「帶條件的引導問句」（解決 P2-C + P4-B）
        好的 query = 已帶入情境 + 預算，讓精靈跳過基本提問直接進入偏好收斂

Step 3  填寫 mode_message 和 welcomeMessage（預告精靈能力）（解決 P4-C）
        welcomeMessage 應明示「我可以在 30 分鐘內幫你找到最適合的選擇」

Step 4  依服務類型選擇正確 class 並調整 temperature（解決 P2-D + P3-B）
        推薦型服務：temperature 0.7-0.9（需要創意組合）
        事實查詢型：temperature ≤ 0.3（需要準確性）

Step 5  上線前 Checklist 驗證：appearance 非空殼、prompt 非 L1（解決 P2-A）
Step 6  （可選）評估是否適合 SmartRouteService（解決 P2-E）
```

---

## 結論

> 這個平台的核心思想是「AI 精靈 = 主動推薦 Option 的銷售顧問」，不是被動問答機器人。  
>
> **主管確認的設計標準（260616 會議）**：精靈必須在 30 分鐘內，透過漏斗式引導，主動給客戶一個具體的推薦 Option，而不是等客戶自己想到要問推薦。
>
> **現有最關鍵的缺口**：Prompt 沒有「主動推薦觸發規則」，導致精靈永遠是被動等待。這比 L1 空殼問題更根本 — 即使 Prompt 很完整，但沒有主動推薦邏輯，精靈仍然只是功能完整的問答機器。  
>
> **修復優先序**：先定義「精靈要主動推薦什麼、什麼時候推薦」（設計哲學），再建 Template（技術規範），再批量套用（執行）。

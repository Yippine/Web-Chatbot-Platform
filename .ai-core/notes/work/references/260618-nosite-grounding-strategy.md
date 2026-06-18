---
name: 005_r01_chain_no-website-strategy
task: build-tenant-brands-from-xlsx
item_id: "005"
role: chain
status: completed
created: 2026-06-18
modified: 2026-06-18
---

# ChainReason 報告：122 家無官網車行品牌精靈建立策略

## 鏈路圖

$$c_1(\text{有替代資料}) \xrightarrow{Hold} c_2(\text{平台可信可分離}) \xrightarrow{Hold} c_3(\text{Google API 可抓}) \xrightarrow{Hold} c_4'(\text{FB/IG Reframe}) \xrightarrow{} c_5(\text{執行策略})$$

## 驗證結果

| 鏈節 | Premise | 結果 | 說明 |
|------|---------|------|------|
| $c_1$ | 有車行專屬資料可 grounding | **Hold** | 8891/SUM 平台車商專頁等同虛擬官網 |
| $c_2$ | 替代來源可信且可分離車行 | **Hold** | 8891 有獨立 `findBuz-info-ID` 頁，SUM 認證頁；不會混淆 |
| $c_3$ | Google Search API 能索引 | **Hold** | 8891/SUM 為 SEO 導向商業平台，公開索引，無封鎖 |
| $c_4$ | FB/IG 可作為 grounding | **Fail** | 登入牆+反爬蟲，Google 無法完整索引動態內容 |
| $c_4'$ | Reframe：分層處理 | **Hold** | Tier B 用平台頁，Tier C 通用版，Tier D 暫緩 |

## Reframe 紀錄

**鏈斷點**：$c_4$ — FB/Instagram 防爬蟲機制導致 Google 無法有效索引車源內容

**上層原因**：假設「所有車行都有可機器讀取的數位存在」，此前提對純社群媒體車行不成立

**新路徑 $C'_4$**：
- 有 8891/SUM 頁面 → 直接用（Tier B，約 70-80% 車行）
- 僅 FB 粉專 → 通用版 prompt + 聲明資料來源有限（Tier C）
- 三無 → 暫不建立（Tier D）

## OptimalSolution

### 策略分層

| Tier | 條件 | 建立方式 | 預估家數 |
|------|------|---------|---------|
| A | 有官方網站 | grounding 官網 | 2（已完成） |
| B | 無官網，有 8891/SUM 刊登 | grounding 平台車商專頁 | ~10-14 |
| C | 僅 FB 粉專 | 通用版 prompt，聲明限制 | 低優先 |
| D | 三無 | 暫緩 | — |

### Tier B tenant 配置

```json
"allowed_domains": "auto.8891.com.tw",
"search_keyword": "廠商名稱 彰化 中古車",
"use_grounding": true
```

### 達到 20 家 KPI 路徑

| 來源 | 家數 |
|------|------|
| Tier A（已完成） | 2 |
| training_case 有官網（百豐、向達等） | ~6-8 |
| garage Tier B（8891 有刊登） | ~10-14 |
| 合計 | 18-24（可達 KPI） |

## 下一步行動

1. **`-r research`**：批量查驗 garage 122 家哪些在 8891/SUM 有刊登頁（決定 Tier B 名單）
2. **建立 Tier B template**：tenant config + prompt 通用範本
3. **優先建前 13 家**（6/24 deadline）

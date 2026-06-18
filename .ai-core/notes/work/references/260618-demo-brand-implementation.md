---
created: 2026-06-18
modified: 2026-06-18
tags: [impl-report, hl_motor, changyi_tyre, tenant, 004, dev, demo]
task: build-tenant-brands-from-xlsx
item_id: "004"
source_workflow: workflow-role-dev
note_type: permanent
---

# 004 Impl Report — 匯聯汽車 + 昌一輪胎 新品牌建置

$$\text{004} = \text{planning} \to \text{execution} \to \text{sese-review} \to \text{8/8 Pass}$$

## 交付物

| 項目 | 路徑 | 狀態 |
|---|---|---|
| 匯聯汽車 Prompt | `backend/prompts/hl_motor/general.md` | ✅ 建立 |
| 昌一輪胎 Prompt | `backend/prompts/changyi_tyre/general.md` | ✅ 建立（輪胎行業改寫） |
| hl_motor tenant | `backend/data/tenants.json → hl_motor` | ✅ 新增 |
| changyi_tyre tenant | `backend/data/tenants.json → changyi_tyre` | ✅ 新增 |
| 既有 tenant | second_hand_car / leosys / dawho 等 | ✅ 未受影響 |

## 驗收結果

**8/8 Pass**

## 上線前待辦

| 項目 | 說明 |
|---|---|
| `TENANT_HL_MOTOR_GEMINI_API_KEY` | 需加入 `.env` |
| `TENANT_CHANGYI_TYRE_GEMINI_API_KEY` | 需加入 `.env` |
| backend restart | 新 tenant 生效 |
| chatIconUrl | 目前為空字串，6/22 demo 前可補圖示（非阻塞） |

## 關鍵設計決策

| 決策 | 原因 |
|---|---|
| changyi_tyre 引導路線改為輪胎行業 5 條 | Route 1 詢問車型/規格，與中古車行業完全不同 |
| changyi_tyre 溝通禁令改寫 | 輪胎行業禁令：不保證有貨、輪圈損壞轉技師 |
| 配色 hl_motor=藍、changyi_tyre=綠 | 品牌視覺區隔，demo 可直接使用 |

## 後續

003 + 004 完成，xlsx-parse-result.json 中有官網的廠商已建置：
- ✅ second_hand_car（大成中古）— 補全
- ✅ hl_motor（匯聯汽車）— 新建
- ✅ changyi_tyre（昌一輪胎）— 新建

---
name: 005_r02_research_platform-url-results
task: build-tenant-brands-from-xlsx
item_id: "005"
role: research
status: completed
created: 2026-06-18
modified: 2026-06-18
---

# Research 報告：122 家無官網車行平台 URL 查詢結果

## 統計摘要

| Tier | 說明 | 家數 |
|------|------|------|
| A | 有官方網站（已建立） | 2 |
| B | 有平台頁（8891/SUM/abccar/hotcar） | 66 |
| C | 僅 Facebook 粉專 | 9 |
| D | 三無（暫緩） | 46 |

## ⚠️ 抽查驗證（重要：平台可用性差異）

| 車行 | 平台 | 車款資訊 | 價格 | 結論 |
|------|------|---------|------|------|
| 宏安汽車商行 | SUM | ✅ 完整（5+ 筆：三菱 ZINGER、HYUNDAI CUSTIN 等） | ✅ 9.8–118.8萬 | **最佳** |
| 展順汽車商行 | 8891 itemList | ✅ 完整（14 輛：三菱、現代、日產等） | ✅ 13.8–46.8萬 | **良好** |
| 三隻小豬車坊 | 8891 info | ❌ 僅頁面標題，無車款 | ❌ | **⚠️ 需改用 itemList URL** |
| 正峰汽車商行 | abccar | ❌ 僅標題（JS 渲染） | ❌ | **⚠️ Google grounding 再測** |

### 8891 URL 格式差異（關鍵）

```
findBuz-info-{ID}     → 車商資料頁（WebFetch 抓不到車款）
findBuz-itemList-{ID} → 車輛列表頁（✅ 可抓到完整車款 + 價格）
```

**行動：8891 的 platform_url 應優先換成 itemList 格式。**

### 平台可用性結論

| 平台 | Gemini grounding 可用性 | 備註 |
|------|----------------------|------|
| **SUM** | ✅ 最佳 | 靜態頁、車款+價格完整、Google 索引良好 |
| **8891 itemList** | ✅ 良好 | 需確認使用 itemList URL |
| **abccar** | ⚠️ 待確認 | JS 渲染；但 Google 索引後 Gemini grounding 仍可能可用 |
| **hotcar** | ⚠️ 待確認 | 僅 2 家，維修保固頁非車款頁 |

## Tier B 完整清單（按平台優先排序）

| # | 廠商名稱 | 平台 | URL |
|---|--------|------|-----|
| 1 | 中彰投汽車有限公司 | 8891 | https://www.8891.com.tw/findBuz-info-1539.html |
| 2 | 正峰汽車商行 | abccar | https://www.abccar.com.tw/dealer/47152 |
| 3 | 宏安汽車商行 | sum | https://www.sum.com.tw/storeinfo-14604.php |
| 4 | 永春中古汽車有限公司 | sum | https://www.sum.com.tw/storeinfo-16601.php |
| 5 | 尚宏汽車商行 | abccar | https://www.abccar.com.tw/dealer/218114 |
| 6 | 匯新中古汽車有限公司 | sum | https://www.sum.com.tw/storeinfo-22601.php |
| 7 | 銘新汽車商行 | abccar | https://www.abccar.com.tw/dealer/224811 |
| 8 | 宏威汽車商行 | abccar | https://www.abccar.com.tw/dealer/217215 |
| 9 | 三隻小豬車坊 | 8891 | https://www.8891.com.tw/findBuz-info-2745.html |
| 10 | 尚鼎汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-193.html |
| 11 | 源豐汽車商行 | abccar | https://www.abccar.com.tw/dealer/67078 |
| 12 | 安心汽車商行 | abccar | https://www.abccar.com.tw/dealer/34632 |
| 13 | 聯成商行 | abccar | https://www.abccar.com.tw/dealer/77451 |
| 14 | 永濠中古汽車商行 | sum | https://www.sum.com.tw/storeinfo-10611.php |
| 15 | 朕極汽車有限公司 | 8891 | https://www.8891.com.tw/findBuz-info-15076.html |
| 16 | 全宥汽車商行 | abccar | https://www.abccar.com.tw/dealer/217218 |
| 17 | 力彰汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-4778.html |
| 18 | 中信汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-2045.html |
| 19 | 中美汽車商行 | abccar | https://www.abccar.com.tw/dealer/16799 |
| 20 | 六信國際汽車有限公司 | 8891 | https://auto.8891.com.tw/findBuz-info-1565.html |
| 21 | 世和汽車商行 | sum | https://www.sum.com.tw/storeinfo-43011.php |
| 22 | 弘益汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-5882.html |
| 23 | 永大國際汽車有限公司 | sum | https://www.sum.com.tw/storeinfo-14608.php |
| 24 | 永崴車業行 | hotcar | https://www.hotcar.com.tw/Maintain/WarrantyDetail?vSeqNo=30203 |
| 25 | 光信汽車商行 | abccar | https://www.abccar.com.tw/dealer/217216 |
| 26 | 高通汽車有限公司 | 8891 | https://www.8891.com.tw/findBuz-info-1306.html |
| 27 | 銓鎰汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-2567.html |
| 28 | 福大汽車有限公司 | 8891 | https://www.8891.com.tw/findBuz-info-1526.html |
| 29 | 佳昇汽車商行 | 8891 | https://auto.8891.com.tw/findBuz-info-2695.html |
| 30 | 百通汽車有限公司 | abccar | https://www.abccar.com.tw/dealer/35053 |
| 31 | 展順汽車商行 | 8891 | https://auto.8891.com.tw/findBuz-itemList-962.html |
| 32 | 歐力克汽車有限公司 | 8891 | https://www.8891.com.tw/findBuz-info-292.html |
| 33 | 富凯中古汽车有限公司 | abccar | https://www.abccar.com.tw/dealer/212018 |
| 34 | 盛通車業 | 8891 | https://www.8891.com.tw/findBuz-info-2893.html |
| 35 | 格瑞汽車有限公司 | abccar | https://www.abccar.com.tw/dealer/217224 |
| 36 | 信通汽車商行 | abccar | https://www.abccar.com.tw/dealer/231995 |
| 37 | 永星汽車有限公司 | abccar | https://www.abccar.com.tw/dealer/230954 |
| 38 | 兆亨車業股份有限公司 | 8891 | https://auto.8891.com.tw/findBuz-info-6915.html |
| 39 | 億豐汽車商行 | abccar | https://www.abccar.com.tw/dealer/234533 |
| 40 | 格上汽車商行 | abccar | https://www.abccar.com.tw/dealer/217247 |
| 41 | 大成汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-13150.html |
| 42 | 千祥汽車有限公司 | 8891 | https://www.8891.com.tw/findBuz-info-2728.html |
| 43 | 鑫益汽車商行 | abccar | https://www.abccar.com.tw/dealer/211691 |
| 44 | 信豐汽車商行 | abccar | https://www.abccar.com.tw/dealer/220725 |
| 45 | 上太汽車有限公司 | abccar | https://www.abccar.com.tw/dealer/29627 |
| 46 | 佑順汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-11828.html |
| 47 | 永隆汽車商行 | sum | https://www.sum.com.tw/storeinfo-73001.php |
| 48 | 僑輪汽車商行 | abccar | https://www.abccar.com.tw/dealer/201687 |
| 49 | 順興汽車商行 | 8891 | https://auto.8891.com.tw/findBuz-info-1316.html |
| 50 | 晟運汽車商行 | abccar | https://www.abccar.com.tw/dealer/217195 |
| 51 | 明億汽車商行 | abccar | https://www.abccar.com.tw/dealer/72661 |
| 52 | 承龍汽車有限公司 | abccar | https://www.abccar.com.tw/dealer/223314 |
| 53 | 全盛汽車商行 | sum | https://www.sum.com.tw/storeinfo-64018.php |
| 54 | 世億汽車商行 | abccar | https://www.abccar.com.tw/dealer/217203 |
| 55 | 中港汽車商行 | sum | https://www.sum.com.tw/storeinfo-71018.php |
| 56 | 永興汽車商行 | abccar | https://www.abccar.com.tw/dealer/217263 |
| 57 | 第一便宜中古車行 | 8891 | https://www.8891.com.tw/findBuz-info-7972.html |
| 58 | 見昌汽車商行 | abccar | https://www.abccar.com.tw/dealer/28036 |
| 59 | 鴻宇汽車有限公司 | abccar | https://www.abccar.com.tw/dealer/214844 |
| 60 | 永川泰汽車商行 | abccar | https://www.abccar.com.tw/dealer/42234 |
| 61 | 名威企業有限公司 | abccar | https://www.abccar.com.tw/dealer/219329 |
| 62 | 易佳廷汽車商行 | hotcar | https://www.hotcar.com.tw/UsedCarSell/DealerDetail?vSeqNo=28538 |
| 63 | 品尊汽車有限公司 | abccar | https://www.abccar.com.tw/dealer/6246 |
| 64 | 聚勝汽車商行 | 8891 | https://www.8891.com.tw/findBuz-info-9859.html |
| 65 | 高盛汽車有限公司 | 8891 | https://www.8891.com.tw/findBuz-itemList-5507.html |
| 66 | 永新隆汽車商行(新永隆汽車) | 8891 | https://www.8891.com.tw/findBuz-info-3439.html |

## Tier C（9 家，僅 FB，低優先）

- 上騰汽車有限公司
- 愛國汽車商行
- 宣瑩環保有限公司
- 三灃汽車商行
- 保羅汽車商行
- 弘富汽車實業股份有限公司
- 禾詮汽車股份有限公司
- 阿財汽車商行
- 玄川汽車有限公司

## Tier D（46 家，三無，暫緩）

- 伊麗安股份有限公司
- 弘舜汽車商行
- 勁利安股份有限公司
- 一森國際有限公司
- 卡司汽車商行
- 鴻成汽車商行
- 品辰汽車商行
- 祁恩汽車廣場
- 速俐潔車業
- 粁富汽車有限公司
- 正浩國際有限公司
- 車之速汽車商行
- 麗楹汽車商行
- 上喬汽車商行
- 慶曜汽車商行
- 大方汽車商行
- 埔心汽車商行
- 永新隆汽車商行
- 東達汽車商行
- 享進實業股份有限公司
- 羿隆有限公司
- 東岸汽車商行
- 富寓有限公司
- 三好汽車商行
- 燁鋒汽車修配廠
- 冠譽汽車商行
- 上發汽車商行
- 宏泰汽車商行
- 車興汽車商行
- 冠紳汽車有限公司
- 蕎億汽車商行
- 東環汽車商行
- 家福汽車行
- 沅和汽車商行
- 旺昇汽車商行
- 彰化汽車商行
- 驣吉汽車商行
- 鴨哥車業
- 敬升車業有限公司
- 瀚鈴汽車商行
- 允鋐國際車業有限公司
- 信宗汽車商行
- 森將企業有限公司
- 啟原拖吊有限公司
- 合璝汽車有限公司
- 定洋有限公司

## 6/24 KPI 建議優先清單（13 家）

已完成 Tier A 2 家，優先挑 SUM 認證車商：

| # | 廠商 | 平台 | allowed_domains |
|---|------|------|----------------|
| 3 | 宏安汽車商行 | sum | www.sum.com.tw |
| 4 | 永春中古汽車有限公司 | sum | www.sum.com.tw |
| 5 | 匯新中古汽車有限公司 | sum | www.sum.com.tw |
| 6 | 永濠中古汽車商行 | sum | www.sum.com.tw |
| 7 | 世和汽車商行 | sum | www.sum.com.tw |
| 8 | 永大國際汽車有限公司 | sum | www.sum.com.tw |
| 9 | 中彰投汽車有限公司 | 8891 | auto.8891.com.tw |
| 10 | 三隻小豬車坊 | 8891 | auto.8891.com.tw |
| 11 | 尚鼎汽車商行 | 8891 | auto.8891.com.tw |
| 12 | 朕極汽車有限公司 | 8891 | auto.8891.com.tw |
| 13 | 力彰汽車商行 | 8891 | auto.8891.com.tw |

## 資料儲存

- `platform_url` + `platform_tier` 已寫入：`.ai-core/tasks/build-tenant-brands-from-xlsx/resources/xlsx-parse-result.json`
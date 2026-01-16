# 三創智慧導覽 Chatbot 後端

基於 Gemini + Google Search 的智慧路線規劃和個人化推薦服務

## 功能特色

### 1. 智慧路線規劃
- ✅ 單一路線規劃（起點→終點）
- ✅ 多目的地最佳路線
- ✅ 考慮特殊需求（推嬰兒車、行動不便等）
- ✅ 即時搜尋三創官網最新資訊

### 2. 個人化推薦引擎
- ✅ 基於對話分析用戶興趣
- ✅ 推薦相關店家和樓層
- ✅ 關聯商品推薦
- ✅ 用戶意圖分析

## 快速開始

### 1. 安裝依賴
```bash
cd backend
pip install -r requirements.txt
```

### 2. 設定環境變數
```bash
cp .env.example .env
# 編輯 .env，填入你的 GEMINI_API_KEY
```

### 3. 測試服務
```bash
python test_services.py
```

### 4. 啟動 API 服務
```bash
python app.py
```

服務將運行在 `http://localhost:5000`

## API 端點

### 路線規劃

#### POST `/api/route/plan`
規劃單一路線

**Request:**
```json
{
  "start": "停車場 B3",
  "end": "Apple Store",
  "context": "推嬰兒車"
}
```

**Response:**
```json
{
  "route": "【從停車場 B3 到 Apple Store 2F】\n⏱️ 預估時間：約 3 分鐘...",
  "references": ["https://www.syntrend.com.tw/floor.html"]
}
```

#### POST `/api/route/multi`
規劃多目的地路線

**Request:**
```json
{
  "destinations": ["Apple Store", "攝影器材", "展演廳"]
}
```

### 個人化推薦

#### POST `/api/recommend`
獲取個人化推薦

**Request:**
```json
{
  "query": "我想買相機",
  "history": ["預算3萬左右", "喜歡拍風景"],
  "profile": {
    "interests": ["攝影"],
    "budget": "中等"
  }
}
```

#### POST `/api/recommend/related`
推薦關聯商品

**Request:**
```json
{
  "product": "相機"
}
```

#### POST `/api/analyze/intent`
分析用戶意圖

**Request:**
```json
{
  "conversation": ["我想買相機", "預算3萬左右", "喜歡Sony"]
}
```

**Response:**
```json
{
  "interests": ["攝影"],
  "budget": "中等",
  "needs": ["相機"],
  "preferences": {"brand": "Sony"}
}
```

## 技術架構

```
backend/
├── app.py                          # Flask API 主程式
├── services/
│   ├── smart_route_service.py      # 智慧路線規劃
│   └── recommendation_service.py   # 個人化推薦引擎
├── test_services.py                # 測試腳本
├── requirements.txt                # Python 依賴
└── .env                            # 環境變數
```

## 核心技術

- **Gemini 2.5 Flash**: 快速 AI 推理（2-3秒回應）
- **Google Search Grounding**: 即時搜尋三創官網
- **Flask**: 輕量級 API 框架
- **CORS**: 支援跨域請求

## 性能指標

- 單一路線規劃：2-3 秒
- 多目的地規劃：3-5 秒
- 個人化推薦：2-4 秒
- 意圖分析：1-2 秒

## 成本估算

基於 Gemini 2.5 Flash 定價：
- 輸入：$0.075 / 1M tokens
- 輸出：$0.30 / 1M tokens
- Google Search：$0.035 / 次（每日前 1500 次免費）

預估每次查詢成本：$0.001 - $0.005

## 下一步開發

- [ ] 加入 Redis 快取常見路線
- [ ] 整合用戶行為追蹤
- [ ] 支援語音輸入
- [ ] 室內定位整合

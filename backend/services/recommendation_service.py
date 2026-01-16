"""
三創個人化推薦引擎 - 基於 Gemini Web Search
"""
from typing import Dict, Optional
from .base_gemini_service import BaseGeminiService

class RecommendationService(BaseGeminiService):
    """基於對話分析的個人化推薦引擎"""
    
    def __init__(self, api_key: str, service_name: str = "recommend", tenant_id: str = "default",
                 default_temperature: float = 0.7, default_use_grounding: bool = True,
                 default_search_keyword: str = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature,
                         default_use_grounding, default_search_keyword)
    
    SYSTEM_PROMPT = """# 角色與使命
你是**「三創智慧導覽助手」**，專為三創數位生活園區設計的產品推薦專家。主要任務是根據使用者需求，推薦三創園區內各櫃位販售的具體商品。溝通風格：**親切、專業、精準**。

## 專注範圍
**你只推薦三創數位生活園區內實際販售的商品**

**非三創問題**：當使用者詢問與三創園區無關的問題時，禮貌拒絕：「很抱歉，我是專門提供三創數位生活園區商品推薦服務的智慧助手，無法回答三創園區以外的問題。」

## 資訊搜尋指引
**強制要求**：你必須使用 Google Search 工具來回答每一個與三創園區相關的問題。
- 即使你認為你知道答案，也必須先執行 Google Search 搜尋
- 必須只搜尋三創數位生活園區官方網站（syntrend.com.tw）的櫃位與商品資訊
- 搜尋時會自動加入 "三創生活" 關鍵字（由系統處理）
- 系統會自動過濾並只提供三創園區相關的參考資源給用戶

## 連結提供規則
**核心原則**：
- ✅ **完全依靠「📚 參考資源」區塊提供連結，系統會自動從 Google Search 結果中提取相關連結並顯示在「📚 參考資源」區塊**
- ❌ **絕對不要在回答正文中添加任何連結以及參考資源資訊**

## 推薦原則
1. **以產品為主**：優先推薦具體商品（品牌、型號、規格）
2. **考慮預算**：根據使用者預算推薦合適價位的商品
3. **提供選擇**：推薦 2-3 個不同品牌/型號供比較
4. **標註櫃位**：說明商品在哪個櫃位/樓層可以找到
5. **優惠資訊**：若有當前優惠活動，一併告知
6. **價格顯示規則**：
   - 若搜尋結果有明確價格 → 顯示「約 $X,XXX 元」
   - 若搜尋結果無價格資訊 → **必須完整顯示**「價格未列出，歡迎親臨櫃位詢問」（不可自行改寫此句）

## 回答格式
**嚴格遵守以下格式，不可自行修改**：

【推薦商品】
**商品名稱**（品牌 + 型號）
   - 價格：約 $X,XXX 元 或 價格未列出，歡迎親臨櫃位詢問
   - 特色：核心賣點（1-2列點說明）
   - 適合對象：誰適合買
   - 販售櫃位：XX 櫃位（X 樓）

"""
    
    def get_recommendations(self, user_query: str, user_id: str = "default", response_language: Optional[str] = None) -> Dict:
        """
        獲取產品推薦
        
        Args:
            user_query: 使用者查詢（如：「我想買相機」）
            user_id: 使用者 ID
            response_language: 回應語言
        """
        result = self.generate_content(user_query, user_id=user_id, temperature=0.7, response_language=response_language)
        
        return {
            "recommendations": result["text"],
            "references": result["references"]
        }



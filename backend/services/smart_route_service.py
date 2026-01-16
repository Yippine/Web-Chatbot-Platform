"""
三創智慧路線規劃服務 - 基於 Gemini Web Search（優化版）
"""
from typing import Dict, Optional
from .base_gemini_service import BaseGeminiService

class SmartRouteService(BaseGeminiService):
    """使用 Gemini + Google Search 提供智慧路線規劃"""
    
    def __init__(self, api_key: str, service_name: str = "route", tenant_id: str = "default", 
                 default_temperature: float = 0.7, default_use_grounding: bool = True, 
                 default_search_keyword: str = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature, 
                         default_use_grounding, default_search_keyword)
    
    SYSTEM_PROMPT = """# 角色與使命
你是**「三創智慧導覽助手」**，專為三創數位生活園區設計的對話機器人。主要任務是協助訪客快速查詢樓層配置、店家介紹、路線導航等資訊。溝通風格：**親切、專業、高效**。

## 專注範圍
**你只回答三創數位生活園區相關的問題**，包括：
- 樓層配置與路線導航
- 店家位置與導引
- 園區設施位置（停車場、電梯、廁所等）
- 無障礙設施資訊

**非三創問題**：當使用者詢問與三創園區無關的問題時，禮貌拒絕：「很抱歉，我是專門提供三創數位生活園區導覽服務的智慧助手，無法回答三創園區以外的問題。」

## 資訊搜尋指引
**強制要求**：你必須使用 Google Search 工具來回答每一個與三創園區相關的問題。
- 即使你認為你知道答案，也必須先執行 Google Search 搜尋
- 必須只搜尋三創數位生活園區官方網站（syntrend.com.tw）的內容
- 搜尋時會自動加入 "三創生活" 關鍵字（由系統處理）
- 系統會自動過濾並只提供三創園區相關的參考資源給用戶

## 連結提供規則
**核心原則**：
- ✅ **完全依靠「📚 參考資源」區塊提供連結，系統會自動從 Google Search 結果中提取相關連結並顯示在「📚 參考資源」區塊**
- ❌ **絕對不要在回答正文中添加任何連結以及參考資源資訊**

## 路線導航處理
**模糊查詢處理**：當使用者只提供目的地（如「我要怎麼去三星櫃位？」），你應該：
1. 先提供該店家/設施的位置資訊（樓層、區域）
2. 提供從常見起點（如1F大廳、停車場入口）的導航建議
3. 不要要求使用者提供起點，直接給出實用的導航資訊

**完整查詢處理**：當使用者提供起點和終點時，按以下格式回覆：

【從 {起點} 到 {終點}】
⏱️ 預估時間：約 X 分鐘
📍 距離：約 X 公尺

導航步驟：
1. 從起點...
2. 經過...
3. 到達終點

💡 提示：營業時間、無障礙設施等額外資訊

考慮用戶特殊需求（如推嬰兒車、行動不便）。
"""
    
    def plan_route(
        self, 
        start: Optional[str] = None, 
        end: Optional[str] = None, 
        user_context: Optional[str] = None,
        user_id: str = "default",
        response_language: Optional[str] = None
    ) -> Dict:
        """
        規劃路線（優化版）
        
        Args:
            start: 起點（可選）
            end: 終點（可選）
            user_context: 用戶額外需求
            user_id: 使用者 ID（用於 session 管理）
            response_language: 回應語言
        """
        question = self._build_question(start, end, user_context)
        result = self.generate_content(question, user_id=user_id, temperature=0.1, response_language=response_language)
        
        return {
            "route": result["text"],
            "references": result["references"]
        }
    
    def plan_multi_stops(self, destinations: list, user_id: str = "default", response_language: Optional[str] = None) -> Dict:
        """
        規劃多目的地路線
        
        Args:
            destinations: 目的地列表
            user_id: 使用者 ID
            response_language: 回應語言
        """
        question = f"""請規劃三創園區的最佳參觀路線，目的地包括：
{', '.join(destinations)}

請提供：
1. 建議的參觀順序（考慮樓層動線）
2. 每段路線的導航步驟
3. 總預估時間
"""
        
        result = self.generate_content(question, user_id=user_id, temperature=0.3, response_language=response_language)
        
        return {
            "route": result["text"],
            "references": result["references"]
        }
    
    def _build_question(self, start: Optional[str], end: Optional[str], context: Optional[str]) -> str:
        """構建查詢問題"""
        if end and not start:
            question = f"我要怎麼去{end}？"
        elif start and end:
            question = f"如何從{start}到{end}？"
        elif start and not end:
            question = f"{start}附近有什麼店家或設施？"
        else:
            question = "請介紹三創園區的樓層配置"
        
        if context:
            question += f" 特殊需求：{context}"
        
        return question

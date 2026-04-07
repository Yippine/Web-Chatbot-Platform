"""
智慧路線規劃服務
"""
from typing import Dict, Optional
from .base_gemini_service import BaseGeminiService

class SmartRouteService(BaseGeminiService):
    """使用 Gemini + Google Search 提供智慧路線規劃"""
    
    # 預設提示詞 (如果沒有從檔案載入)
    SYSTEM_PROMPT = "你是一個專業的路線導航助手。"
    
    def __init__(self, api_key: str, service_name: str = "route", tenant_id: str = "default", 
                 default_temperature: float = 0.7, default_use_grounding: bool = True, 
                 default_search_keyword: str = None, config: Dict = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature, 
                         default_use_grounding, default_search_keyword, config)
    
    def plan_route(
        self, 
        start: Optional[str] = None, 
        end: Optional[str] = None, 
        user_context: Optional[str] = None,
        user_id: str = "default",
        response_language: Optional[str] = None
    ) -> Dict:
        """
        規劃路線
        
        Args:
            start: 起點（可選）
            end: 終點（可選）
            user_context: 用戶額外需求
            user_id: 使用者 ID
            response_language: 回應語言
        """
        question = self._build_question(start, end, user_context)
        result = self.generate_content(question, user_id=user_id, response_language=response_language)
        
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
        question = f"""請規劃最佳參觀路線，目的地包括：{', '.join(destinations)}
                    請提供：
                    1. 建議的參觀順序
                    2. 每段路線的導航步驟
                    3. 總預估時間
                    """
        
        result = self.generate_content(question, user_id=user_id, response_language=response_language)
        
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
        
        if context:
            question += f" 特殊需求：{context}"
        
        return question

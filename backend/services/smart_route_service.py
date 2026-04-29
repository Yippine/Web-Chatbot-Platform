"""
智慧路線規劃服務
"""
from typing import Dict, Optional
from google.genai import types
from .base_gemini_service import BaseGeminiService


INTENT_SYSTEM_PROMPT = (
    "You are an intent classifier. "
    "Determine if the user's question requires map/location-based tools "
    "(nearby places, navigation, restaurants, attractions, souvenirs, directions, transit). "
    "Reply ONLY with YES or NO. No other text."
)


class SmartRouteService(BaseGeminiService):
    """使用 Gemini + Google Maps/Search 提供智慧路線規劃"""
    
    SYSTEM_PROMPT = "你是一個專業的路線導航助手。"
    
    def __init__(self, api_key: str, service_name: str = "route", tenant_id: str = "default", 
                 default_temperature: float = 0.7, default_use_grounding: bool = True, 
                 default_search_keyword: str = None, config: Dict = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature, 
                         default_use_grounding, default_search_keyword, config)
    
    def plan_route(
        self, 
        message: str = "",
        start: Optional[str] = None, 
        end: Optional[str] = None, 
        user_context: Optional[str] = None,
        user_id: str = "default",
        response_language: Optional[str] = None,
        lat_lng: Optional[Dict] = None
    ) -> Dict:
        """
        規劃路線（自動判斷使用 Maps 或 Search）
        
        Args:
            message: 使用者原始訊息（優先使用）
            start: 起點（向下相容，可選）
            end: 終點（向下相容，可選）
            user_context: 用戶額外需求（向下相容，可選）
            user_id: 使用者 ID
            response_language: 回應語言
            lat_lng: 使用者座標 {"latitude": float, "longitude": float}
        """
        # 優先使用原始訊息，避免扭曲語意
        question = message or end or user_context or ""
        
        use_maps = self._classify_intent(question)
        effective_lat_lng = lat_lng if (use_maps and lat_lng) else None
        
        print(f"[{self.service_name}] 意圖分類: {'Maps' if use_maps else 'Search'} | lat_lng: {effective_lat_lng is not None}")
        
        result = self.generate_content(
            question, 
            user_id=user_id, 
            response_language=response_language,
            use_maps=use_maps,
            lat_lng=effective_lat_lng,
            use_grounding=not use_maps
        )
        
        return {
            "route": result["text"],
            "references": result["references"],
            "maps_widget_token": result.get("maps_widget_token"),
            "tool_used": "maps" if use_maps else "search"
        }
    
    def plan_multi_stops(self, destinations: list, user_id: str = "default", 
                         response_language: Optional[str] = None, lat_lng: Optional[Dict] = None) -> Dict:
        """
        規劃多目的地路線
        
        Args:
            destinations: 目的地列表
            user_id: 使用者 ID
            response_language: 回應語言
            lat_lng: 使用者座標
        """
        question = f"""請規劃最佳參觀路線，目的地包括：{', '.join(destinations)}
                    請提供：
                    1. 建議的參觀順序
                    2. 每段路線的導航步驟
                    3. 總預估時間
                    """
        
        result = self.generate_content(
            question, 
            user_id=user_id, 
            response_language=response_language,
            use_maps=True,
            lat_lng=lat_lng,
            use_grounding=False
        )
        
        return {
            "route": result["text"],
            "references": result["references"],
            "maps_widget_token": result.get("maps_widget_token"),
            "tool_used": "maps"
        }
    
    def _classify_intent(self, query: str) -> bool:
        """
        用 Gemini 判斷是否需要 Maps Grounding。
        獨立呼叫，不存 session、不用工具。
        失敗時 fallback 到 False（用 Search）。
        """
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=query,
                config=types.GenerateContentConfig(
                    system_instruction=INTENT_SYSTEM_PROMPT,
                    temperature=0,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    max_output_tokens=5,
                ),
            )
            answer = response.text.strip().upper()
            print(f"[{self.service_name}] 意圖分析回應: '{answer}'")
            return answer == "YES"
        except Exception as e:
            print(f"[{self.service_name}] ⚠️ 意圖分析失敗，fallback 到 Search: {e}")
            return False

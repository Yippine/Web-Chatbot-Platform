"""
通用對話問答服務
整合一般對話、推薦等問答功能
"""
from typing import Dict, Optional
from .base_gemini_service import BaseGeminiService

class ChatService(BaseGeminiService):
    """通用對話問答引擎"""
    
    # 預設提示詞 (如果沒有從檔案載入)
    SYSTEM_PROMPT = "你是一個智能助手。"
    
    def __init__(self, api_key: str, service_name: str = "chat", tenant_id: str = "default",
                 default_temperature: float = 0.7, default_use_grounding: bool = True,
                 default_search_keyword: str = None, config: Dict = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature,
                         default_use_grounding, default_search_keyword, config)
    
    def chat(
        self, 
        message: str, 
        user_id: str = "default",
        response_language: Optional[str] = None
    ) -> Dict:
        """
        對話問答
        
        Args:
            message: 使用者訊息
            user_id: 使用者 ID
            response_language: 回應語言
        
        Returns:
            {
                "response": "回答內容",
                "references": ["參考連結1", "參考連結2"]
            }
        """
        result = self.generate_content(message, user_id=user_id, response_language=response_language)
        
        return {
            "response": result["text"],
            "references": result["references"]
        }

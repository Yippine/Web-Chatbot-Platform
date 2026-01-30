"""
通用查詢問答服務
整合活動、樓層等資訊查詢功能
"""
from typing import Dict, List, Optional
import time
from .base_gemini_service import BaseGeminiService

class QueryService(BaseGeminiService):
    """通用查詢問答引擎"""
    
    # 預設提示詞 (如果沒有從檔案載入)
    SYSTEM_PROMPT = "你是一個智能查詢助手。"
    
    def __init__(self, api_key: str, service_name: str = "query", tenant_id: str = "default",
                 default_temperature: float = 0.7, default_use_grounding: bool = True,
                 default_search_keyword: str = None, config: Dict = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature,
                         default_use_grounding, default_search_keyword, config)
        # 快取資料（避免重複查詢）
        self._data_cache = None
        self._cache_timestamp = 0
    
    def query_data(
        self, 
        query: str, 
        history: List[str] = None,
        user_id: str = "default",
        response_language: Optional[str] = None
    ) -> Dict:
        """
        問答功能 - 根據使用者問題回答
        
        Args:
            query: 查詢內容
            history: 對話歷史
            user_id: 使用者 ID
            response_language: 回應語言
        
        Returns:
            {
                "response": "回答內容",
                "references": ["參考連結1", "參考連結2"]
            }
        """
        result = self.generate_content(query, user_id=user_id, response_language=response_language)
        
        return {
            "response": result["text"],
            "references": result["references"]
        }
    
    def get_data(
        self, 
        response_language: Optional[str] = None,
        cache_ttl: int = 300
    ) -> Dict:
        """
        查詢資料功能 - 取得完整資料列表
        
        Args:
            response_language: 回應語言
            cache_ttl: 快取有效時間（秒），預設 5 分鐘
        
        Returns:
            {
                "data": "資料內容",
                "references": ["參考連結1", "參考連結2"]
            }
        """
        # 檢查快取
        if self._data_cache and (time.time() - self._cache_timestamp < cache_ttl):
            return self._data_cache
        
        # 使用固定的預設查詢
        query = "完整資料"
        
        result = self.generate_content(query, user_id="get_data", response_language=response_language)
        
        # 更新快取
        self._data_cache = {
            "data": result["text"],
            "references": result["references"]
        }
        self._cache_timestamp = time.time()
        
        return self._data_cache

"""
三創樓層導覽服務 - 基於 Gemini Web Search（優化版）
"""
from typing import Dict, List, Optional
import time
from .base_gemini_service import BaseGeminiService

class FloorService(BaseGeminiService):
    """三創樓層導覽查詢引擎（優化版）"""
    
    def __init__(self, api_key: str, service_name: str = "floor", tenant_id: str = "default",
                 default_temperature: float = 0.7, default_use_grounding: bool = True,
                 default_search_keyword: str = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature,
                         default_use_grounding, default_search_keyword)
        # 快取樓層資訊（避免重複查詢）
        self._floor_cache = None
        self._cache_timestamp = 0
        self._cache_ttl = 3600  # 快取 1 小時
    
    SYSTEM_PROMPT = """# 角色與使命
你是**「三創智慧導覽助手」**，專為三創數位生活園區設計的對話機器人。主要任務是協助訪客查詢樓層配置、店家位置、櫃位資訊。溝通風格：**親切、專業、高效**。

## 專注範圍
**你只回答三創數位生活園區相關的樓層問題**，包括：
- 各樓層配置和主題
- 店家位置和櫃位(包含營業時間和聯絡資訊)
- 品牌資訊(包含營業時間和聯絡資訊)
- 樓層設施(包含廁所、緊急出口、急救設施等)

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

## 樓層資訊回答格式（必須遵守）
當被問到樓層資訊時，請按以下格式回答：

【樓層概覽】
三創生活共有 X 個樓層...

【各樓層介紹】
🏢 B1-B6 停車場
- 功能：停車服務

🏢 1F 品牌旗艦
- 主題：[樓層主題]
- 主要店家：[列出主要品牌]

🏢 2F-3F [樓層名稱]
- 主題：[樓層主題]
- 主要店家：[列出主要品牌]

請包含：
1. 樓層主題和特色
2. 主要店家和品牌(如果沒有，直接不列出)
3. 停車場資訊（如果相關）
4. 樓層設施（如果相關）
"""
    
    def get_all_floors(self, response_language: Optional[str] = None) -> Dict:
        """
        查詢三創生活所有樓層簡介（帶快取）
        
        Args:
            response_language: 回應語言
        """
        # 檢查快取
        current_time = time.time()
        if self._floor_cache and (current_time - self._cache_timestamp) < self._cache_ttl:
            print(f"[{self.service_name}] ✅ 使用快取的樓層資訊（0秒）")
            return self._floor_cache
        
        print(f"[{self.service_name}] 🔄 快取過期或不存在，重新查詢...")
        
        # 極簡查詢（格式要求已在 SYSTEM_PROMPT）
        query = "介紹各樓層的店家跟設施"
        
        # 使用時間戳作為 user_id，避免歷史累積（每次都是新 session）
        user_id = f"floor_query_{int(current_time)}"
        
        result = self.generate_content(
            query, 
            user_id=user_id,
            temperature=0.7, 
            search_keyword="三創生活",
            response_language=response_language
        )
        
        # 快取結果
        response = {
            "floors": result["text"],
            "references": result["references"]
        }
        self._floor_cache = response
        self._cache_timestamp = current_time
        
        print(f"[{self.service_name}] ✅ 樓層資訊已快取")
        
        return response
    
    def search_floor(
        self, 
        user_query: str, 
        conversation_history: Optional[List[str]] = None,
        user_id: str = "default",
        response_language: Optional[str] = None
    ) -> Dict:
        """
        根據用戶查詢搜尋樓層或櫃位資訊
        
        Args:
            user_query: 使用者查詢
            conversation_history: 對話歷史
            user_id: 使用者 ID
            response_language: 回應語言
        """
        query = f"{user_query}"
        
        result = self.generate_content(
            query, 
            user_id=user_id,
            temperature=0.6,
            search_keyword="三創生活",
            response_language=response_language
        )
        
        return {
            "floors": result["text"],
            "references": result["references"]
        }
    
    def clear_cache(self):
        """清除快取（用於手動更新）"""
        self._floor_cache = None
        self._cache_timestamp = 0
        print(f"[{self.service_name}] 快取已清除")

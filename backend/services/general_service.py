"""
三創通用對話服務 - 處理閒聊與功能介紹
"""
from typing import Dict, Optional
from .base_gemini_service import BaseGeminiService

class GeneralService(BaseGeminiService):
    """處理閒聊、問候、功能介紹等一般問題"""
    
    def __init__(self, api_key: str, service_name: str = "general", tenant_id: str = "default",
                 default_temperature: float = 0.7, default_use_grounding: bool = True,
                 default_search_keyword: str = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature,
                         default_use_grounding, default_search_keyword)
    
    SYSTEM_PROMPT = """# 角色與使命
你是**「三創智慧導覽助手」**，專為三創數位生活園區設計的對話機器人。

## 你的職責
處理**無法明確分類**的問題，包括：

### 1. 問候與閒聊
- 「你好」「謝謝」「再見」 → 簡短友善回應

### 2. 功能介紹
- 「你能做什麼？」「有什麼功能？」 → 介紹可用功能：
  * 🗺️ 路線導航（怎麼去、在哪裡）
  * 🎯 商品推薦（想買、推薦）
  * 🎪 活動查詢（最近活動、優惠）
  * 📍 樓層店家（幾樓、店家列表）

### 3. 三創園區簡介
- 「三創是什麼？」「園區介紹」 → 簡短介紹（2-3句話）

### 4. 非三創問題
- 禮貌拒絕：「很抱歉，我只能回答三創數位生活園區相關問題。」

## 回答原則
- 極簡回答（不超過 3 句話）
- 與三創生活園區相關問題，使用 Google Search，其餘閒聊不需要
- 友善親切的語氣
"""
    
    def chat(self, message: str, user_id: str = "default", response_language: Optional[str] = None) -> Dict:
        """
        處理一般對話
        
        Args:
            message: 使用者訊息
            user_id: 使用者 ID
            response_language: 回應語言
        """
        result = self.generate_content(
            message, 
            user_id=user_id, 
            temperature=0.7,
            use_grounding=True,  # 統一開啟搜尋，讓 Gemini 自行決定是否使用
            response_language=response_language
        )
        
        return {
            "text": result["text"],
            "references": result.get("references", [])
        }

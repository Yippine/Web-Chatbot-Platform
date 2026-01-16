"""
語言偵測與翻譯服務
"""
import json
from typing import Dict
from .base_gemini_service import BaseGeminiService

class LanguageService(BaseGeminiService):
    """語言偵測與翻譯服務"""
    
    def __init__(self, api_key: str, service_name: str = "language", tenant_id: str = "default",
                 default_temperature: float = 0.7, default_use_grounding: bool = True,
                 default_search_keyword: str = None):
        super().__init__(api_key, service_name, tenant_id, default_temperature,
                         default_use_grounding, default_search_keyword)
    
    SYSTEM_PROMPT = "You are a language detection and translation assistant."
    
    def detect_language(self, text: str) -> Dict[str, str]:
        """
        偵測文字語言
        
        Args:
            text: 要偵測的文字
            
        Returns:
            {"language_code": "en", "language_name": "English"}
        """
        prompt = f"""偵測以下文字的語言，並以 JSON 格式回傳結果。

格式要求：
{{"language_code": "語言代碼", "language_name": "語言英文名稱"}}

語言代碼範例：
- 繁體中文: zh-TW
- 簡體中文: zh-CN
- 英文: en
- 日文: ja
- 韓文: ko
- 泰文: th
- 其他語言請使用標準 ISO 639-1 代碼

語言英文名稱範例：
- Traditional Chinese
- Simplified Chinese
- English
- Japanese
- Korean
- Thai

文字：{text}

只回傳 JSON，不要加任何說明。"""
        
        result = self.generate_content(
            prompt,
            user_id="language_detect",
            temperature=0,
            use_grounding=False
        )
        
        try:
            # 清理可能的 markdown 格式
            response_text = result["text"].strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            language_info = json.loads(response_text)
            return {
                "language_code": language_info.get("language_code", "zh-TW"),
                "language_name": language_info.get("language_name", "Traditional Chinese")
            }
        except json.JSONDecodeError as e:
            print(f"[language] JSON 解析失敗: {e}, 原始回應: {result['text']}")
            # 預設回傳繁體中文
            return {"language_code": "zh-TW", "language_name": "Traditional Chinese"}
    
    def translate_to_traditional_chinese(self, text: str) -> str:
        """
        將文字翻譯成繁體中文
        
        Args:
            text: 要翻譯的文字
            
        Returns:
            翻譯後的繁體中文字串
        """
        prompt = f"""請將以下文字翻譯成繁體中文，只回傳翻譯結果，不要加任何說明。

文字：{text}"""
        
        result = self.generate_content(
            prompt,
            user_id="translate",
            temperature=0.3,
            use_grounding=False
        )
        
        return result["text"].strip()

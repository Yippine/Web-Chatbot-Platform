"""
Gemini 服務基礎類別（優化版）
整合 Redis Session 管理 + 並行 URL 處理
"""
from google import genai
from google.genai import types
from typing import Dict, Optional, List
import redis
import json
import os
import time
import concurrent.futures
import requests

class BaseGeminiService:
    """Gemini API 通用服務基礎類別（多租戶版）"""
    
    SYSTEM_PROMPT = ""  # 子類別需覆寫
    
    def __init__(
        self, 
        api_key: str, 
        service_name: str = "general",
        tenant_id: str = "default",
        default_temperature: float = 0.7,
        default_use_grounding: bool = True,
        default_search_keyword: str = None,
        config: Dict = None
    ):
        self.client = genai.Client(api_key=api_key)
        self.service_name = service_name
        self.tenant_id = tenant_id
        self.default_temperature = default_temperature
        self.default_use_grounding = default_use_grounding
        self.default_search_keyword = default_search_keyword
        self.config = config or {}
        
        # 初始化 Redis
        self.redis_client = self._init_redis()
    
    def _init_redis(self) -> redis.Redis:
        """初始化 Redis 客戶端"""
        try:
            redis_host = os.getenv('REDIS_HOST', 'localhost')
            redis_port = int(os.getenv('REDIS_PORT', 6379))
            redis_db = int(os.getenv('REDIS_DB', 0))
            redis_password = os.getenv('REDIS_PASSWORD', None)
            
            client = redis.Redis(
                host=redis_host,
                port=redis_port,
                db=redis_db,
                password=redis_password if redis_password else None,
                decode_responses=True
            )
            client.ping()
            print(f"[{self.service_name}] Redis 連線成功")
            return client
        except Exception as e:
            print(f"[{self.service_name}] Redis 連線失敗: {e}")
            raise
    
    def generate_content(
        self, 
        query: str, 
        user_id: str = "default",
        temperature: float = None,
        use_grounding: bool = None,
        use_maps: bool = False,
        lat_lng: Optional[Dict] = None,
        system_prompt: Optional[str] = None,
        search_keyword: Optional[str] = None,
        response_language: Optional[str] = None
    ) -> Dict:
        """
        通用內容生成方法（多租戶版）
        
        Args:
            query: 查詢內容
            user_id: 使用者 ID（用於 session 管理）
            temperature: 溫度參數 (None 則使用預設值)
            use_grounding: 是否使用 Google Search (None 則使用預設值)
            use_maps: 是否使用 Google Maps Grounding
            lat_lng: 使用者座標 {"latitude": float, "longitude": float}
            system_prompt: 自訂系統提示
            search_keyword: 搜尋關鍵字 (None 則使用預設值)
            response_language: 回應語言（如 "English", "Japanese"）
        """
        # 使用預設值
        if temperature is None:
            temperature = self.default_temperature
        if use_grounding is None:
            use_grounding = self.default_use_grounding
        if search_keyword is None:
            search_keyword = self.default_search_keyword
        
        start_time = time.time()
        
        # 從 Redis 載入對話歷史 (包含 tenant_id)
        session_key = f"gemini_session:{self.tenant_id}:{self.service_name}:{user_id}"
        session_load_start = time.time()
        contents = self._load_session_from_redis(session_key)
        session_load_time = time.time() - session_load_start
        
        # 準備查詢（加上搜尋關鍵字）
        search_query = f"{search_keyword} {query}" if search_keyword and use_grounding else query
        
        # 判斷是否嘗試 url_context
        allowed_domains = self.config.get('allowed_domains', '')
        use_url_context = bool(allowed_domains)
        
        # 注入 allowed_domains URL
        if use_url_context:
            domains_list = [d.strip() for d in allowed_domains.split(',') if d.strip()]
            domain_urls = ' '.join([f"https://{d}" if not d.startswith('http') else d for d in domains_list])
            search_query_with_url = f"{search_query}\n請參考以下網站的內容：{domain_urls}"
        else:
            search_query_with_url = search_query
        
        # 記錄最終查詢
        if use_grounding or use_url_context or use_maps:
            print(f"[Grounding] 最終查詢: {search_query_with_url}")

        # 語言指令改貼在這一輪使用者訊息旁邊（而非只放在 system prompt 尾端）：
        # 多輪對話中，模型會傾向延續歷史已建立的語言，埋在長 system prompt 裡的指令
        # 蓋不過已經好幾輪的對話紀錄；貼在當前這輪訊息旁邊的指令權重更高，才切得過去。
        # 中文也要提醒（不能只在非中文時才提醒），否則從外語切回中文時，
        # 歷史裡剛建立的外語回覆會反過來把中文拉走。
        if response_language:
            search_query_with_url += f"\n\n[Respond in {response_language} only, regardless of what language earlier turns in this conversation used.]"

        # 添加使用者問題到對話歷史
        contents.append(types.Content(
            role="user",
            parts=[types.Part(text=search_query_with_url)]
        ))
        
        # 準備 system prompt（加入語言指令）
        final_system_prompt = system_prompt or self.SYSTEM_PROMPT
        if response_language and response_language != "Traditional Chinese":
            language_instruction = f"\n\n## CRITICAL INSTRUCTION - LANGUAGE REQUIREMENT\n**YOU MUST respond in {response_language} language. This is mandatory. All your response content MUST be in {response_language}, including all section titles, labels, descriptions, and formatting markers. Translate everything to {response_language}.**"
            final_system_prompt = final_system_prompt + language_instruction
        
        # 有使用搜尋工具時，禁止模型輸出內部推理過程
        if use_url_context or use_grounding or use_maps:
            final_system_prompt += "\n\n## 回答規則\n絕對不要在回答中描述你的搜尋過程、網頁瀏覽行為、工具使用情況或內部推理步驟。直接回答使用者的問題。"
        
        # 組裝 tools
        tools = []
        if use_maps:
            tools.append(types.Tool(google_maps=types.GoogleMaps()))
        elif use_grounding:
            tools.append({"google_search": {}})
        if use_url_context:
            tools.append({"url_context": {}})
        
        # Maps tool_config（傳入使用者座標）
        tool_config = None
        if use_maps and lat_lng:
            tool_config = types.ToolConfig(
                retrieval_config=types.RetrievalConfig(
                    lat_lng=types.LatLng(
                        latitude=lat_lng["latitude"],
                        longitude=lat_lng["longitude"]
                    )
                )
            )
        
        # 配置
        config = types.GenerateContentConfig(
            tools=tools if tools else None,
            tool_config=tool_config,
            system_instruction=final_system_prompt,
            temperature=temperature,
            thinking_config=types.ThinkingConfig(thinking_budget=0)
        )
        
        # 呼叫 Gemini API（含 503 retry）
        api_call_start = time.time()
        response = self._call_gemini_with_retry(contents, config)
        api_call_time = time.time() - api_call_start
        
        answer_text = self._extract_text_only(response)
        
        # 檢查 url_context 是否抓取失敗，自動 fallback 到純 google_search
        fell_back_to_search = False
        if use_url_context and not answer_text.strip():
            print(f"[{self.service_name}] ⚠️ 空白訊息調查: url_context 啟用但回應為空，可能是內容抓取問題")
        if use_url_context and (self._is_url_context_failed(response) or not answer_text.strip()):
            print(f"[{self.service_name}] ⚠️ url_context 失敗或空白，fallback 到 google_search")
            contents.pop()
            contents.append(types.Content(
                role="user",
                parts=[types.Part(text=search_query)]
            ))
            config = types.GenerateContentConfig(
                tools=[{"google_search": {}}] if use_grounding else None,
                system_instruction=final_system_prompt,
                temperature=temperature,
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            )
            fallback_start = time.time()
            response = self._call_gemini_with_retry(contents, config)
            api_call_time += time.time() - fallback_start
            answer_text = self._extract_text_only(response)
            fell_back_to_search = True
        
        # 若仍為空（含非 url_context 場景），再 retry 一次
        if not answer_text or not answer_text.strip():
            print(f"[{self.service_name}] ⚠️ 回應為空，retry...")
            if not fell_back_to_search:
                contents.pop()
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part(text=search_query)]
                ))
            retry_config = types.GenerateContentConfig(
                tools=[{"google_search": {}}] if use_grounding else None,
                system_instruction=final_system_prompt,
                temperature=temperature,
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            )
            retry_start = time.time()
            response = self._call_gemini_with_retry(contents, retry_config)
            api_call_time += time.time() - retry_start
            answer_text = self._extract_text_only(response)
            if not answer_text or not answer_text.strip():
                print(f"[{self.service_name}] ⚠️ retry 仍為空，使用 fallback 訊息")
                answer_text = "抱歉，AI 模型暫時無法回應，請稍後再試一次~~~"
        
        # 更新對話歷史
        contents.append(types.Content(
            role="model",
            parts=[types.Part(text=answer_text)]
        ))
        
        # 限制歷史長度（保留最近8輪，對應5條引導路線+確認來回）
        if len(contents) > 16:
            contents = contents[-16:]
        
        # 保存到 Redis
        session_save_start = time.time()
        self._save_session_to_redis(session_key, contents)
        session_save_time = time.time() - session_save_start
        
        # 提取參考連結（並行處理）
        url_process_start = time.time()
        try:
            if use_maps:
                references = self._extract_maps_references(response)
            elif use_grounding:
                references = self._extract_references_parallel(response)
            else:
                references = []
        except Exception as e:
            print(f"[{self.service_name}] ❌ URL 處理失敗: {e}")
            references = []
        url_process_time = time.time() - url_process_start
        
        total_time = time.time() - start_time
        
        # 性能統計
        print(f"[{self.service_name}] ⏱️  Session 載入: {session_load_time:.3f}s")
        print(f"[{self.service_name}] ⏱️  Gemini API: {api_call_time:.3f}s")
        print(f"[{self.service_name}] ⏱️  URL 處理: {url_process_time:.3f}s")
        print(f"[{self.service_name}] ⏱️  Session 保存: {session_save_time:.3f}s")
        print(f"[{self.service_name}] ⏱️  總計: {total_time:.3f}s")
        
        # 提取 Maps widget token（預留）
        maps_widget_token = None
        if use_maps:
            try:
                grounding = response.candidates[0].grounding_metadata
                maps_widget_token = getattr(grounding, 'google_maps_widget_context_token', None)
            except Exception:
                pass
        
        # 空白訊息調查 log
        if not answer_text or not answer_text.strip():
            print(f"[{self.service_name}] 🚨 空白訊息調查: generate_content 最終回傳空白!")
            print(f"  - query: '{query[:80]}'")
            print(f"  - use_grounding: {use_grounding}, use_url_context: {use_url_context}, use_maps: {use_maps}")
            print(f"  - user_id: {user_id}, tenant_id: {self.tenant_id}")
        
        return {
            "text": answer_text,
            "references": references,
            "maps_widget_token": maps_widget_token
        }
    
    def _call_gemini_with_retry(self, contents, config, max_retries: int = 2):
        """呼叫 Gemini API，遇到 503/429 自動 retry"""
        for attempt in range(max_retries + 1):
            try:
                return self.client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=contents,
                    config=config
                )
            except Exception as e:
                error_str = str(e)
                is_retryable = '503' in error_str or '429' in error_str or 'UNAVAILABLE' in error_str or 'RESOURCE_EXHAUSTED' in error_str
                if is_retryable and attempt < max_retries:
                    wait = (attempt + 1) * 2  # 2s, 4s
                    print(f"[{self.service_name}] ⚠️ Gemini API {error_str[:80]}，{wait}s 後 retry ({attempt+1}/{max_retries})")
                    time.sleep(wait)
                    continue
                raise
    
    def _extract_text_only(self, response) -> str:
        """從 response 中只提取非 thinking 的文字內容"""
        try:
            # 檢查 candidates 是否為空（安全過濾等情況）
            if not response.candidates:
                print(f"[{self.service_name}] ⚠️ 空白訊息調查: candidates 為空! finish_reason={getattr(response, 'prompt_feedback', None)}")
                return response.text or ""
            
            candidate = response.candidates[0]
            # 檢查 finish_reason
            finish_reason = getattr(candidate, 'finish_reason', None)
            if finish_reason and str(finish_reason) not in ('STOP', 'FinishReason.STOP', '1'):
                print(f"[{self.service_name}] ⚠️ 空白訊息調查: finish_reason={finish_reason}")
            
            # 檢查 content 是否存在
            if not candidate.content or not candidate.content.parts:
                print(f"[{self.service_name}] ⚠️ 空白訊息調查: content 或 parts 為空! finish_reason={finish_reason}")
                return response.text or ""
            
            parts = candidate.content.parts
            text_parts = []
            for part in parts:
                # 跳過 thought=True 的 parts（推理過程）
                if getattr(part, 'thought', False):
                    continue
                if hasattr(part, 'text') and part.text:
                    text_parts.append(part.text)
            
            result = ''.join(text_parts) if text_parts else response.text
            
            # 關鍵 log：如果最終結果為空
            if not result or not result.strip():
                print(f"[{self.service_name}] ⚠️ 空白訊息調查: _extract_text_only 結果為空!")
                print(f"  - parts 數量: {len(parts)}")
                print(f"  - thought parts: {sum(1 for p in parts if getattr(p, 'thought', False))}")
                print(f"  - text parts (非空): {len(text_parts)}")
                print(f"  - response.text: '{(response.text or '')[:100]}'")
                print(f"  - finish_reason: {finish_reason}")
            
            return result or ""
        except Exception as e:
            print(f"[{self.service_name}] ⚠️ 空白訊息調查: _extract_text_only 異常: {e}")
            fallback = response.text if hasattr(response, 'text') else ""
            print(f"  - fallback response.text: '{(fallback or '')[:100]}'")
            return fallback or ""
    
    def _is_url_context_failed(self, response) -> bool:
        """檢查 url_context 是否抓取失敗"""
        try:
            candidate = response.candidates[0]
            metadata = getattr(candidate, 'url_context_metadata', None)
            if not metadata:
                return False
            url_metadata_list = getattr(metadata, 'url_metadata', [])
            for item in url_metadata_list:
                status = getattr(item, 'url_retrieval_status', None)
                if status and 'ERROR' in str(status):
                    return True
            return False
        except Exception:
            return False
    
    def _extract_maps_references(self, response) -> List[Dict]:
        """提取 Maps Grounding 參考資料"""
        if not hasattr(response, 'candidates') or not response.candidates:
            return []
        
        candidate = response.candidates[0]
        if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
            return []
        
        metadata = candidate.grounding_metadata
        if not hasattr(metadata, 'grounding_chunks') or not metadata.grounding_chunks:
            return []
        
        refs = []
        for chunk in metadata.grounding_chunks:
            if hasattr(chunk, 'maps') and chunk.maps:
                refs.append({
                    "type": "maps",
                    "title": getattr(chunk.maps, 'title', ''),
                    "uri": getattr(chunk.maps, 'uri', '').rstrip(')'),
                    "place_id": getattr(chunk.maps, 'place_id', '')
                })
            elif hasattr(chunk, 'web') and chunk.web:
                refs.append({
                    "type": "web",
                    "title": getattr(chunk.web, 'title', ''),
                    "uri": getattr(chunk.web, 'uri', '').rstrip(')')
                })
        
        print(f"[{self.service_name}] Maps refs: {len(refs)} 個")
        return refs
    
    def _extract_references_parallel(self, response, max_refs: int = 3) -> List[str]:
        """並行提取參考連結（優化版）"""
        if not hasattr(response, 'candidates') or not response.candidates:
            return []
        
        candidate = response.candidates[0]
        if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
            return []
        
        metadata = candidate.grounding_metadata
        if not hasattr(metadata, 'grounding_chunks') or not metadata.grounding_chunks:
            return []
        
        # 提取原始 URLs
        raw_urls = []
        for chunk in metadata.grounding_chunks:
            if hasattr(chunk, 'web') and hasattr(chunk.web, 'uri'):
                raw_urls.append(chunk.web.uri)
        
        if not raw_urls:
            return []
        
        print(f"[{self.service_name}] 找到 {len(raw_urls)} 個原始 URL")
        
        # 並行處理 URLs（加強錯誤處理）
        valid_urls = []
        start_time = time.time()
        timeout = 3  # 總超時 3 秒
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                future_to_url = {
                    executor.submit(self._process_single_url, url): url
                    for url in raw_urls
                }
                
                for future in concurrent.futures.as_completed(future_to_url, timeout=timeout):
                    try:
                        if time.time() - start_time > timeout:
                            print(f"[{self.service_name}] ⏱️  達到總超時限制")
                            break
                        
                        result = future.result(timeout=0.5)
                        if result and result not in valid_urls:
                            valid_urls.append(result)
                            if len(valid_urls) >= max_refs:
                                break
                    except concurrent.futures.TimeoutError:
                        print(f"[{self.service_name}] ⚠️  單個 URL 超時")
                        continue
                    except Exception as e:
                        print(f"[{self.service_name}] ⚠️  URL 處理錯誤: {type(e).__name__}")
                        continue
        except concurrent.futures.TimeoutError:
            print(f"[{self.service_name}] ⏱️  並行處理總超時（已收集 {len(valid_urls)} 個連結）")
        except Exception as e:
            print(f"[{self.service_name}] ❌ 並行處理異常: {type(e).__name__} - {str(e)[:100]}")
        
        print(f"[{self.service_name}] 最終保留 {len(valid_urls)} 個參考連結")
        return valid_urls
    
    def _process_single_url(self, url: str) -> Optional[str]:
        """處理單個 URL"""
        try:
            # 解析 Vertex AI 重定向
            if 'vertexaisearch.cloud.google.com/grounding-api-redirect' in url:
                response = requests.head(url, allow_redirects=True, timeout=0.8)
                url = response.url
            
            # 檢查是否在允許的網域列表中
            allowed_domains = self.config.get('allowed_domains', '')
            if allowed_domains:
                domains = [d.strip() for d in allowed_domains.split(',') if d.strip()]
                for domain in domains:
                    if domain in url:
                        return url
                return None
            
            # 如果沒有設定 allowed_domains，不保留任何 URL
            return None
        except Exception:
            return None
    
    def _load_session_from_redis(self, session_key: str) -> List[types.Content]:
        """從 Redis 載入對話歷史"""
        try:
            history_json = self.redis_client.get(session_key)
            if history_json:
                history_data = json.loads(history_json)
                contents = [self._deserialize_content(c) for c in history_data]
                # 空白訊息調查：檢查是否有空的 session 資料
                empty_parts = [i for i, c in enumerate(contents) if all(p.text == "..." for p in c.parts)]
                if empty_parts:
                    print(f"[{self.service_name}] ⚠️ 空白訊息調查: Redis session 含有佔位符 parts, indices={empty_parts}, key={session_key}")
                return contents
            return []
        except Exception as e:
            print(f"[{self.service_name}] 載入 session 失敗: {e}")
            return []
    
    def _save_session_to_redis(self, session_key: str, contents: List[types.Content], ttl: int = 3600):
        """保存對話歷史到 Redis（過濾無效資料）"""
        try:
            history_data = [self._serialize_content(c) for c in contents]
            # 過濾掉 parts 為空的 content，避免存入損壞資料
            history_data = [c for c in history_data if c["parts"]]
            history_json = json.dumps(history_data, ensure_ascii=False)
            self.redis_client.setex(session_key, ttl, history_json)
        except Exception as e:
            print(f"[{self.service_name}] 保存 session 失敗: {e}")
    
    def _serialize_content(self, content: types.Content) -> dict:
        """序列化 Content（過濾空 parts）"""
        parts = [{"text": part.text} for part in content.parts if hasattr(part, 'text') and part.text]
        return {
            "role": content.role,
            "parts": parts
        }
    
    def _deserialize_content(self, data: dict) -> types.Content:
        """反序列化 Content（過濾空 parts，防止 API 400 錯誤）"""
        parts = [types.Part(text=part["text"]) for part in data.get("parts", []) if part.get("text")]
        if not parts:
            parts = [types.Part(text="...")]
        return types.Content(
            role=data["role"],
            parts=parts
        )
    
    def clear_user_history(self, user_id: str):
        """清除使用者對話歷史"""
        try:
            session_key = f"gemini_session:{self.tenant_id}:{self.service_name}:{user_id}"
            self.redis_client.delete(session_key)
            print(f"[{self.service_name}] 已清除使用者 {user_id} 的對話歷史")
        except Exception as e:
            print(f"[{self.service_name}] 清除歷史失敗: {e}")

"""
服務工廠
根據租戶設定動態建立服務實例
"""
from typing import Dict, Optional
from services.smart_route_service import SmartRouteService
from services.recommendation_service import RecommendationService
from services.event_service import EventService
from services.floor_service import FloorService
from services.general_service import GeneralService
from services.language_service import LanguageService

class ServiceFactory:
    """服務工廠類別"""
    
    # 服務類別映射
    SERVICE_CLASSES = {
        'SmartRouteService': SmartRouteService,
        'RecommendationService': RecommendationService,
        'EventService': EventService,
        'FloorService': FloorService,
        'GeneralService': GeneralService,
        'LanguageService': LanguageService
    }
    
    def __init__(self, tenant_manager):
        self.tenant_manager = tenant_manager
        self.service_cache = {}  # 快取: {tenant_id}_{service_name} -> service_instance
    
    def create_service(self, tenant_id: str, service_name: str):
        """
        根據租戶設定建立服務實例
        
        Args:
            tenant_id: 租戶 ID
            service_name: 服務名稱 (如 'route', 'recommend')
        
        Returns:
            服務實例或 None
        """
        # 檢查快取
        cache_key = f"{tenant_id}_{service_name}"
        if cache_key in self.service_cache:
            return self.service_cache[cache_key]
        
        # 取得租戶設定
        tenant = self.tenant_manager.get_tenant(tenant_id)
        if not tenant:
            print(f"[ServiceFactory] 租戶不存在: {tenant_id}")
            return None
        
        # 取得服務設定
        service_config = tenant.get('services', {}).get(service_name)
        if not service_config:
            print(f"[ServiceFactory] 服務不存在: {tenant_id}/{service_name}")
            return None
        
        if not service_config.get('enabled', True):
            print(f"[ServiceFactory] 服務未啟用: {tenant_id}/{service_name}")
            return None
        
        # 取得服務類別
        class_name = service_config.get('class')
        service_class = self.SERVICE_CLASSES.get(class_name)
        if not service_class:
            print(f"[ServiceFactory] 未知的服務類別: {class_name}")
            return None
        
        # 取得 API Key
        api_key = tenant.get('gemini_api_key')
        if not api_key:
            print(f"[ServiceFactory] 租戶缺少 API Key: {tenant_id}")
            return None
        
        # 載入自訂 prompt (如果有)
        custom_prompt = None
        prompt_file = service_config.get('prompt_file')
        if prompt_file:
            custom_prompt = self.tenant_manager.load_prompt(prompt_file)
        
        # 建立服務實例
        try:
            service_instance = service_class(
                api_key=api_key,
                service_name=service_name,
                tenant_id=tenant_id,
                default_temperature=service_config.get('temperature', 0.7),
                default_use_grounding=service_config.get('use_grounding', True),
                default_search_keyword=service_config.get('search_keyword')
            )
            
            # 如果有自訂 prompt,覆寫 SYSTEM_PROMPT
            if custom_prompt:
                service_instance.SYSTEM_PROMPT = custom_prompt
            
            # 快取服務實例
            self.service_cache[cache_key] = service_instance
            
            print(f"[ServiceFactory] 建立服務: {tenant_id}/{service_name} ({class_name})")
            return service_instance
            
        except Exception as e:
            print(f"[ServiceFactory] 建立服務失敗: {e}")
            return None
    
    def clear_cache(self, tenant_id: str = None):
        """清除快取"""
        if tenant_id:
            # 清除特定租戶的快取
            keys_to_remove = [k for k in self.service_cache.keys() if k.startswith(f"{tenant_id}_")]
            for key in keys_to_remove:
                del self.service_cache[key]
            print(f"[ServiceFactory] 清除租戶快取: {tenant_id}")
        else:
            # 清除所有快取
            self.service_cache.clear()
            print("[ServiceFactory] 清除所有快取")

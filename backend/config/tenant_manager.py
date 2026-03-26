"""
租戶設定管理器
負責載入和管理多租戶設定
"""
import json
import os
from typing import Dict, Optional

class TenantManager:
    """租戶設定管理器"""
    
    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.environ.get(
                'TENANTS_CONFIG_PATH',
                os.path.join(os.path.dirname(__file__), 'tenants.json')
            )
        self.config_path = config_path
        self.tenants = {}
        self.load_tenants()
    
    def load_tenants(self):
        """從 JSON 載入所有租戶設定"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.tenants = json.load(f)
                print(f"[TenantManager] 載入 {len(self.tenants)} 個租戶設定")
            else:
                print(f"[TenantManager] 設定檔不存在: {self.config_path}")
                self.tenants = {}
        except Exception as e:
            print(f"[TenantManager] 載入設定失敗: {e}")
            self.tenants = {}
    
    def get_tenant(self, tenant_id: str, auto_reload: bool = True) -> Optional[Dict]:
        """取得特定租戶設定"""
        # 自動重新載入設定（開發模式）
        if auto_reload:
            self.load_tenants()
        
        tenant = self.tenants.get(tenant_id)
        if tenant is None:
            print(f"[TenantManager] 租戶不存在: {tenant_id}")
            return None
        
        if not tenant.get('enabled', True):
            print(f"[TenantManager] 租戶未啟用: {tenant_id}")
            return None
        
        # 從環境變數讀取 API Key
        api_key_env = tenant.get('api_key_env')
        if api_key_env:
            api_key = os.getenv(api_key_env)
            if api_key:
                tenant['gemini_api_key'] = api_key
            else:
                print(f"[TenantManager] 警告: 環境變數 {api_key_env} 未設定")
        
        return tenant
    
    def load_prompt(self, prompt_file: str) -> str:
        """載入提示詞檔案"""
        try:
            prompt_path = os.path.join(os.path.dirname(__file__), '..', prompt_file)
            if os.path.exists(prompt_path):
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    return f.read()
            else:
                print(f"[TenantManager] 提示詞檔案不存在: {prompt_path}")
                return ""
        except Exception as e:
            print(f"[TenantManager] 載入提示詞失敗: {e}")
            return ""
    
    def reload(self):
        """重新載入設定 (支援熱更新)"""
        print("[TenantManager] 重新載入設定")
        self.load_tenants()
    
    def list_tenants(self) -> Dict:
        """列出所有租戶"""
        return self.tenants
    
    def tenant_exists(self, tenant_id: str) -> bool:
        """檢查租戶是否存在"""
        return tenant_id in self.tenants

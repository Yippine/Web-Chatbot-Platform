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
        # 檔案指紋 (mtime, size)：內容沒變就不重讀，避免每次請求都 parse 整份設定
        self._config_stamp = None
        self._env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        self._env_cache = {}
        self._env_stamp = None
        self.load_tenants()
    
    @staticmethod
    def _file_stamp(path: str):
        """回傳檔案的 (mtime, size)；讀不到回 None。"""
        try:
            st = os.stat(path)
            return (st.st_mtime, st.st_size)
        except OSError:
            return None

    def _load_env(self) -> Dict:
        """讀取 .env（依檔案指紋快取，沒變動就沿用上次結果）。"""
        stamp = self._file_stamp(self._env_path)
        if stamp != self._env_stamp:
            from dotenv import dotenv_values
            self._env_cache = dotenv_values(self._env_path)
            self._env_stamp = stamp
        return self._env_cache

    def load_tenants(self, force: bool = False):
        """從 JSON 載入所有租戶設定。

        依檔案指紋判斷是否真的要重讀：LINE webhook 每則訊息都會走 get_tenant()，
        沒有這層快取就會每次都重新 parse 整份 tenants.json。
        """
        stamp = self._file_stamp(self.config_path)
        if not force and stamp is not None and stamp == self._config_stamp:
            return
        try:
            if stamp is not None:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.tenants = json.load(f)
                self._config_stamp = stamp
                print(f"[TenantManager] 載入 {len(self.tenants)} 個租戶設定")
            else:
                print(f"[TenantManager] 設定檔不存在: {self.config_path}")
                self.tenants = {}
                self._config_stamp = None
        except Exception as e:
            print(f"[TenantManager] 載入設定失敗: {e}")
            self.tenants = {}
            self._config_stamp = None
    
    def get_tenant(self, tenant_id: str, auto_reload: bool = True) -> Optional[Dict]:
        """取得特定租戶設定"""
        # 自動重新載入設定（開發模式）
        if auto_reload:
            self.load_tenants()
        
        raw = self.tenants.get(tenant_id)
        if raw is None:
            print(f"[TenantManager] 租戶不存在: {tenant_id}")
            return None

        if not raw.get('enabled', True):
            print(f"[TenantManager] 租戶未啟用: {tenant_id}")
            return None

        # 回傳副本：下方注入的憑證只活在這份副本，不會污染 self.tenants
        # （admin 端會把 list_tenants() 的結果寫回 tenants.json，污染了就外洩）
        tenant = dict(raw)
        line_config = dict(raw.get('line') or {})
        if 'line' in raw:
            tenant['line'] = line_config

        # 從 .env 檔案即時讀取 API Key / LINE 憑證（免重啟容器）
        api_key_env = raw.get('api_key_env')
        token_env = line_config.get('channel_access_token_env')
        secret_env = line_config.get('channel_secret_env')
        if api_key_env or token_env or secret_env:
            env = self._load_env()

            if api_key_env:
                api_key = env.get(api_key_env)
                if api_key:
                    tenant['gemini_api_key'] = api_key
                else:
                    print(f"[TenantManager] 警告: {api_key_env} 未設定於 .env")

            # LINE 憑證即時注入暫態欄位（不落 tenants.json）
            if token_env:
                line_config['channel_access_token'] = env.get(token_env)
            if secret_env:
                line_config['channel_secret'] = env.get(secret_env)

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
        self.load_tenants(force=True)
    
    def list_tenants(self) -> Dict:
        """列出所有租戶"""
        return self.tenants
    
    def tenant_exists(self, tenant_id: str) -> bool:
        """檢查租戶是否存在"""
        return tenant_id in self.tenants

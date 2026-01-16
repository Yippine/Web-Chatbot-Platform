"""
租戶驗證中介層
"""
from functools import wraps
from flask import request, jsonify

def require_tenant(tenant_manager):
    """
    租戶驗證裝飾器
    
    從請求中提取 tenant_id 並驗證,將租戶設定注入 request.tenant
    
    Args:
        tenant_manager: TenantManager 實例
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 從 header 或 body 提取 tenant_id
            tenant_id = request.headers.get('X-Tenant-ID')
            
            if not tenant_id and request.is_json:
                tenant_id = request.json.get('tenant_id')
            
            if not tenant_id:
                return jsonify({
                    "error": "缺少 tenant_id",
                    "message": "請在 header (X-Tenant-ID) 或 body 中提供 tenant_id"
                }), 400
            
            # 驗證租戶
            tenant = tenant_manager.get_tenant(tenant_id)
            if not tenant:
                return jsonify({
                    "error": "無效的 tenant_id",
                    "message": f"租戶 '{tenant_id}' 不存在或未啟用"
                }), 403
            
            # 注入租戶設定到 request
            request.tenant_id = tenant_id
            request.tenant = tenant
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator

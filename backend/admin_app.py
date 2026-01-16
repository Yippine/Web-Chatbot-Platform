"""
管理後台 API
提供租戶管理、設定編輯等功能
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from config.tenant_manager import TenantManager
from config.service_factory import ServiceFactory

app = Flask(__name__)
CORS(app)

# 初始化
tenant_manager = TenantManager()
service_factory = ServiceFactory(tenant_manager)

# 簡單的 API Key 驗證
ADMIN_API_KEY = os.getenv('ADMIN_API_KEY', 'admin_secret_key')

def require_admin():
    """驗證管理員權限"""
    api_key = request.headers.get('X-Admin-Key')
    if api_key != ADMIN_API_KEY:
        return jsonify({"error": "未授權"}), 401
    return None

@app.before_request
def check_admin():
    """所有請求都需要管理員權限 (除了 OPTIONS 和 health)"""
    # 跳過 OPTIONS 請求 (CORS 預檢)
    if request.method == 'OPTIONS':
        return None
    
    if request.endpoint and request.endpoint != 'health':
        error = require_admin()
        if error:
            return error

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

# ==================== 租戶管理 ====================

@app.route("/admin/tenants", methods=["GET"])
def list_tenants():
    """列出所有租戶"""
    try:
        tenants = tenant_manager.list_tenants()
        return jsonify({
            "tenants": [
                {
                    "id": tid,
                    "name": t.get("name"),
                    "enabled": t.get("enabled", True),
                    "services_count": len(t.get("services", {}))
                }
                for tid, t in tenants.items()
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>", methods=["GET"])
def get_tenant(tenant_id):
    """取得租戶詳細資訊"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            # 嘗試從所有租戶中取得（包含未啟用的）
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        return jsonify({"tenant": tenant})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants", methods=["POST"])
def create_tenant():
    """建立新租戶"""
    try:
        data = request.json
        tenant_id = data.get("id")
        
        if not tenant_id:
            return jsonify({"error": "缺少租戶 ID"}), 400
        
        # 檢查是否已存在
        if tenant_manager.tenant_exists(tenant_id):
            return jsonify({"error": "租戶 ID 已存在"}), 409
        
        # 建立租戶設定
        new_tenant = {
            "id": tenant_id,
            "name": data.get("name", "新租戶"),
            "gemini_api_key": data.get("gemini_api_key", ""),
            "enabled": data.get("enabled", True),
            "services": data.get("services", {}),
            "quick_actions": data.get("quick_actions", [])
        }
        
        # 更新設定檔
        tenants = tenant_manager.list_tenants()
        tenants[tenant_id] = new_tenant
        
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定
        tenant_manager.reload()
        
        return jsonify({"message": "租戶建立成功", "tenant": new_tenant}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>", methods=["PUT"])
def update_tenant(tenant_id):
    """更新租戶設定"""
    try:
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        
        # 更新租戶資訊
        tenant = tenants[tenant_id]
        if "name" in data:
            tenant["name"] = data["name"]
        if "gemini_api_key" in data:
            tenant["gemini_api_key"] = data["gemini_api_key"]
        if "enabled" in data:
            tenant["enabled"] = data["enabled"]
        if "services" in data:
            tenant["services"] = data["services"]
        if "quick_actions" in data:
            tenant["quick_actions"] = data["quick_actions"]
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定並清除快取
        tenant_manager.reload()
        service_factory.clear_cache(tenant_id)
        
        return jsonify({"message": "租戶更新成功", "tenant": tenant})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>", methods=["DELETE"])
def delete_tenant(tenant_id):
    """刪除租戶"""
    try:
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        # 刪除租戶
        del tenants[tenant_id]
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定並清除快取
        tenant_manager.reload()
        service_factory.clear_cache(tenant_id)
        
        return jsonify({"message": "租戶刪除成功"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== 提示詞管理 ====================

@app.route("/admin/tenants/<tenant_id>/prompts", methods=["GET"])
def list_prompts(tenant_id):
    """列出租戶的所有提示詞檔案"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        services = tenant.get("services", {})
        prompts = []
        
        for service_name, service_config in services.items():
            prompt_file = service_config.get("prompt_file")
            if prompt_file:
                prompts.append({
                    "service": service_name,
                    "file": prompt_file,
                    "exists": os.path.exists(os.path.join(
                        os.path.dirname(tenant_manager.config_path), 
                        '..', 
                        prompt_file
                    ))
                })
        
        return jsonify({"prompts": prompts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>/prompts/<service_name>", methods=["GET"])
def get_prompt(tenant_id, service_name):
    """讀取特定服務的提示詞"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        service_config = tenant.get("services", {}).get(service_name)
        if not service_config:
            return jsonify({"error": "服務不存在"}), 404
        
        prompt_file = service_config.get("prompt_file")
        if not prompt_file:
            return jsonify({"error": "服務沒有設定提示詞檔案"}), 404
        
        content = tenant_manager.load_prompt(prompt_file)
        
        return jsonify({
            "service": service_name,
            "file": prompt_file,
            "content": content
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>/prompts/<service_name>", methods=["PUT"])
def update_prompt(tenant_id, service_name):
    """更新提示詞內容"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        service_config = tenant.get("services", {}).get(service_name)
        if not service_config:
            return jsonify({"error": "服務不存在"}), 404
        
        prompt_file = service_config.get("prompt_file")
        if not prompt_file:
            return jsonify({"error": "服務沒有設定提示詞檔案"}), 404
        
        data = request.json
        content = data.get("content")
        
        if content is None:
            return jsonify({"error": "缺少提示詞內容"}), 400
        
        # 儲存提示詞
        prompt_path = os.path.join(
            os.path.dirname(tenant_manager.config_path),
            '..',
            prompt_file
        )
        
        # 確保目錄存在
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # 清除服務快取
        service_factory.clear_cache(tenant_id)
        
        return jsonify({"message": "提示詞更新成功"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>/prompts", methods=["POST"])
def create_prompt(tenant_id):
    """建立新提示詞檔案"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        service_name = data.get("service")
        content = data.get("content", "")
        
        if not service_name:
            return jsonify({"error": "缺少服務名稱"}), 400
        
        # 建立提示詞檔案路徑
        prompt_file = f"prompts/{tenant_id}/{service_name}.md"
        prompt_path = os.path.join(
            os.path.dirname(tenant_manager.config_path),
            '..',
            prompt_file
        )
        
        # 確保目錄存在
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        
        # 儲存提示詞
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            "message": "提示詞建立成功",
            "file": prompt_file
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== 服務設定管理 ====================

@app.route("/admin/tenants/<tenant_id>/services", methods=["GET"])
def list_services(tenant_id):
    """列出租戶的所有服務設定"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        services = tenant.get("services", {})
        return jsonify({"services": services})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>/services/<service_name>", methods=["PUT"])
def update_service(tenant_id, service_name):
    """更新服務設定"""
    try:
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        tenant = tenants[tenant_id]
        services = tenant.get("services", {})
        
        if service_name not in services:
            return jsonify({"error": "服務不存在"}), 404
        
        data = request.json
        service = services[service_name]
        
        # 更新服務設定
        if "enabled" in data:
            service["enabled"] = data["enabled"]
        if "class" in data:
            service["class"] = data["class"]
        if "prompt_file" in data:
            service["prompt_file"] = data["prompt_file"]
        if "temperature" in data:
            service["temperature"] = data["temperature"]
        if "use_grounding" in data:
            service["use_grounding"] = data["use_grounding"]
        if "search_keyword" in data:
            service["search_keyword"] = data["search_keyword"]
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定並清除快取
        tenant_manager.reload()
        service_factory.clear_cache(tenant_id)
        
        return jsonify({"message": "服務更新成功", "service": service})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>/services", methods=["POST"])
def add_service(tenant_id):
    """新增服務"""
    try:
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        service_name = data.get("name")
        
        if not service_name:
            return jsonify({"error": "缺少服務名稱"}), 400
        
        tenant = tenants[tenant_id]
        services = tenant.get("services", {})
        
        if service_name in services:
            return jsonify({"error": "服務已存在"}), 409
        
        # 建立新服務
        new_service = {
            "enabled": data.get("enabled", True),
            "class": data.get("class", "GeneralService"),
            "prompt_file": data.get("prompt_file", f"prompts/{tenant_id}/{service_name}.md"),
            "temperature": data.get("temperature", 0.7),
            "use_grounding": data.get("use_grounding", True),
            "search_keyword": data.get("search_keyword")
        }
        
        services[service_name] = new_service
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定
        tenant_manager.reload()
        
        return jsonify({"message": "服務新增成功", "service": new_service}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>/services/<service_name>", methods=["DELETE"])
def delete_service(tenant_id, service_name):
    """刪除服務"""
    try:
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        tenant = tenants[tenant_id]
        services = tenant.get("services", {})
        
        if service_name not in services:
            return jsonify({"error": "服務不存在"}), 404
        
        # 刪除服務
        del services[service_name]
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定並清除快取
        tenant_manager.reload()
        service_factory.clear_cache(tenant_id)
        
        return jsonify({"message": "服務刪除成功"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== Quick Actions 管理 ====================

@app.route("/admin/tenants/<tenant_id>/quick-actions", methods=["GET"])
def get_quick_actions(tenant_id):
    """取得固定問題"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        quick_actions = tenant.get("quick_actions", [])
        return jsonify({"quick_actions": quick_actions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/tenants/<tenant_id>/quick-actions", methods=["PUT"])
def update_quick_actions(tenant_id):
    """更新固定問題"""
    try:
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        quick_actions = data.get("quick_actions")
        
        if quick_actions is None:
            return jsonify({"error": "缺少 quick_actions"}), 400
        
        # 更新固定問題
        tenants[tenant_id]["quick_actions"] = quick_actions
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定
        tenant_manager.reload()
        
        return jsonify({"message": "固定問題更新成功", "quick_actions": quick_actions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

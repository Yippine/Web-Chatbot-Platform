"""
管理後台 API
提供租戶管理、設定編輯等功能
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from PIL import Image
import io
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

def update_env_file(tenant_id: str, api_key: str):
    """更新 .env 檔案中的租戶 API Key"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    env_key = f"TENANT_{tenant_id.upper()}_GEMINI_API_KEY"
    
    # 讀取現有 .env
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            env_lines = f.readlines()
    
    # 更新或新增
    key_found = False
    for i, line in enumerate(env_lines):
        if line.startswith(f"{env_key}="):
            env_lines[i] = f"{env_key}={api_key}\n"
            key_found = True
            break
    
    if not key_found:
        env_lines.append(f"{env_key}={api_key}\n")
    
    # 寫回 .env
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(env_lines)
    
    return env_key

def remove_env_key(tenant_id: str):
    """從 .env 移除租戶 API Key"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    env_key = f"TENANT_{tenant_id.upper()}_GEMINI_API_KEY"
    
    if not os.path.exists(env_path):
        return
    
    with open(env_path, 'r', encoding='utf-8') as f:
        env_lines = f.readlines()
    
    # 過濾掉該 key
    env_lines = [line for line in env_lines if not line.startswith(f"{env_key}=")]
    
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(env_lines)

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

@app.route("/api/admin/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

# ==================== 租戶管理 ====================

@app.route("/api/admin/tenants", methods=["GET"])
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

@app.route("/api/admin/tenants/<tenant_id>", methods=["GET"])
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

@app.route("/api/admin/tenants", methods=["POST"])
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
        
        # 取得 API Key 並寫入 .env
        api_key = data.get("gemini_api_key", "")
        if api_key:
            env_key = update_env_file(tenant_id, api_key)
        else:
            env_key = f"TENANT_{tenant_id.upper()}_GEMINI_API_KEY"
        
        # 建立租戶設定 (不儲存 API Key，改存環境變數名稱)
        new_tenant = {
            "id": tenant_id,
            "name": data.get("name", "新租戶"),
            "api_key_env": env_key,
            "enabled": data.get("enabled", True),
            "services": data.get("services", {}),
            "quick_actions": data.get("quick_actions", []),
            "appearance": {
                "pageTitle": "",
                "title": "",
                "subtitle": "",
                "welcomeMessage": "",
                "placeholder": "",
                "header": {
                    "type": "solid",
                    "color": "#000000"
                },
                "button": {
                    "type": "solid",
                    "color": "#000000"
                },
                "chatIconUrl": "",
                "textColor": "white"
            }
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

@app.route("/api/admin/tenants/<tenant_id>", methods=["PUT"])
def update_tenant(tenant_id):
    """更新租戶設定"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        
        # 更新租戶資訊
        tenant = tenants[tenant_id]
        if "name" in data:
            tenant["name"] = data["name"]
        if "gemini_api_key" in data:
            # 更新 .env 而不是 tenants.json
            api_key = data["gemini_api_key"]
            if api_key:
                env_key = update_env_file(tenant_id, api_key)
                tenant["api_key_env"] = env_key
                # 移除舊的 gemini_api_key 欄位（如果存在）
                tenant.pop("gemini_api_key", None)
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

@app.route("/api/admin/tenants/<tenant_id>", methods=["DELETE"])
def delete_tenant(tenant_id):
    """刪除租戶"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        # 從 .env 移除 API Key
        remove_env_key(tenant_id)
        
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

# ==================== 服務設定管理 ====================

@app.route("/api/admin/service-classes", methods=["GET"])
def get_service_classes():
    """取得可用的服務類別清單"""
    try:
        from config.service_factory import ServiceFactory
        
        classes = [
            {
                "value": class_name,
                "label": class_name,
                "description": {
                    "ChatService": "對話問答服務",
                    "QueryService": "資料查詢服務",
                    "SmartRouteService": "路線導航服務"
                }.get(class_name, "")
            }
            for class_name in ServiceFactory.SERVICE_CLASSES.keys()
        ]
        
        return jsonify({"classes": classes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/services/<service_name>", methods=["GET"])
def get_service(tenant_id, service_name):
    """取得服務詳細資訊 (包含提示詞內容)"""
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        if not tenant:
            all_tenants = tenant_manager.list_tenants()
            tenant = all_tenants.get(tenant_id)
            if not tenant:
                return jsonify({"error": "租戶不存在"}), 404
        
        services = tenant.get("services", {})
        if service_name not in services:
            return jsonify({"error": "服務不存在"}), 404
        
        service = services[service_name]
        
        # 載入提示詞內容
        prompt_content = ""
        prompt_file = service.get("prompt_file")
        if prompt_file:
            prompt_content = tenant_manager.load_prompt(prompt_file)
        
        return jsonify({
            "service": service,
            "prompt_content": prompt_content
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/services", methods=["GET"])
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

@app.route("/api/admin/tenants/<tenant_id>/services/<service_name>", methods=["PUT"])
def update_service(tenant_id, service_name):
    """更新服務設定 (包含提示詞)"""
    try:
        tenant_manager.reload()
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
        if "name" in data:
            service["name"] = data["name"]
        if "icon" in data:
            service["icon"] = data["icon"]
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
        if "allowed_domains" in data:
            service["allowed_domains"] = data["allowed_domains"]
        if "mode_message" in data:
            service["mode_message"] = data["mode_message"]
        if "show_mode_message" in data:
            service["show_mode_message"] = data["show_mode_message"]
        if "loading_message" in data:
            service["loading_message"] = data["loading_message"]
        if "query_loading_message" in data:
            service["query_loading_message"] = data["query_loading_message"]
        
        # 更新提示詞內容 (如果有提供)
        if "prompt_content" in data:
            prompt_file = service.get("prompt_file")
            if prompt_file:
                prompt_path = os.path.join(
                    os.path.dirname(tenant_manager.config_path),
                    '..',
                    prompt_file
                )
                os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
                with open(prompt_path, 'w', encoding='utf-8') as f:
                    f.write(data["prompt_content"])
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定並清除快取
        tenant_manager.reload()
        service_factory.clear_cache(tenant_id)
        
        return jsonify({"message": "服務更新成功", "service": service})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/services", methods=["POST"])
def add_service(tenant_id):
    """新增服務"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        service_id = data.get("service_id")
        
        if not service_id:
            return jsonify({"error": "缺少服務 ID"}), 400
        
        tenant = tenants[tenant_id]
        services = tenant.get("services", {})
        
        if service_id in services:
            return jsonify({"error": "服務已存在"}), 409
        
        # 建立新服務
        new_service = {
            "name": data.get("name", ""),
            "icon": data.get("icon", "⚙️"),
            "enabled": data.get("enabled", True),
            "class": data.get("class", "ChatService"),
            "prompt_file": data.get("prompt_file", f"prompts/{tenant_id}/{service_id}.md"),
            "temperature": data.get("temperature", 0.7),
            "use_grounding": data.get("use_grounding", True),
            "search_keyword": data.get("search_keyword", ""),
            "allowed_domains": data.get("allowed_domains", ""),
            "loading_message": data.get("loading_message", "處理中"),
            "query_loading_message": data.get("query_loading_message", "查詢資料中"),
            "mode_message": data.get("mode_message", ""),
            "show_mode_message": data.get("show_mode_message", False)
        }
        
        services[service_id] = new_service
        
        # 建立提示詞檔案 (如果有提供內容)
        if "prompt_content" in data:
            prompt_file = new_service.get("prompt_file")
            if prompt_file:
                prompt_path = os.path.join(
                    os.path.dirname(tenant_manager.config_path),
                    '..',
                    prompt_file
                )
                os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
                with open(prompt_path, 'w', encoding='utf-8') as f:
                    f.write(data["prompt_content"])
        
        # 自動新增到 Quick Actions
        quick_actions = tenant.get("quick_actions", [])
        quick_actions.append({
            "service_id": service_id,
            "query": ""
        })
        tenant["quick_actions"] = quick_actions
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定
        tenant_manager.reload()
        
        return jsonify({"message": "服務新增成功", "service": new_service}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/services/<service_name>", methods=["DELETE"])
def delete_service(tenant_id, service_name):
    """刪除服務"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        tenant = tenants[tenant_id]
        services = tenant.get("services", {})
        
        if service_name not in services:
            return jsonify({"error": "服務不存在"}), 404
        
        # 刪除服務
        del services[service_name]
        
        # 同時從 Quick Actions 中移除
        quick_actions = tenant.get("quick_actions", [])
        tenant["quick_actions"] = [qa for qa in quick_actions if qa.get("service_id") != service_name]
        
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

@app.route("/api/admin/tenants/<tenant_id>/quick-actions", methods=["GET"])
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

@app.route("/api/admin/tenants/<tenant_id>/quick-actions", methods=["PUT"])
def update_quick_actions(tenant_id):
    """更新固定問題"""
    try:
        tenant_manager.reload()
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

# ==================== 外觀設定管理 ====================

@app.route("/api/admin/tenants/<tenant_id>/appearance", methods=["GET"])
def get_appearance(tenant_id):
    """取得租戶外觀設定"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        tenant = tenants[tenant_id]
        appearance = tenant.get("appearance", {})
        
        return jsonify({"appearance": appearance})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/appearance", methods=["PUT"])
def update_appearance(tenant_id):
    """更新租戶外觀設定"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        
        # 更新外觀設定
        tenants[tenant_id]["appearance"] = data
        
        # 儲存設定
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 重新載入設定
        tenant_manager.reload()
        
        return jsonify({"message": "外觀設定更新成功", "appearance": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/appearance/upload-icon", methods=["POST"])
def upload_chat_icon(tenant_id):
    """上傳聊天圖示"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        # 檢查是否有檔案
        if 'file' not in request.files:
            return jsonify({"error": "未提供檔案"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "未選擇檔案"}), 400
        
        # 檢查檔案大小 (5MB)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > 5 * 1024 * 1024:
            return jsonify({"error": "檔案大小超過 5MB"}), 400
        
        # 檢查檔案格式
        allowed_extensions = {'png', 'jpg', 'jpeg', 'webp'}
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        if file_ext not in allowed_extensions:
            return jsonify({"error": "不支援的檔案格式，請使用 PNG, JPG, JPEG 或 WebP"}), 400
        
        # 開啟圖片
        try:
            img = Image.open(file.stream)
        except Exception as e:
            return jsonify({"error": f"無法讀取圖片: {str(e)}"}), 400
        
        # 轉換為 RGBA (支援透明背景)
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # 壓縮到 128x128
        img.thumbnail((128, 128), Image.Resampling.LANCZOS)
        
        # 建立目錄
        upload_dir = os.environ.get(
            'UPLOAD_IMAGES_PATH',
            os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'images', 'tenants')
        )
        tenant_dir = os.path.join(upload_dir, tenant_id)
        os.makedirs(tenant_dir, exist_ok=True)
        
        # 使用時間戳作為檔名
        import time
        timestamp = int(time.time())
        output_path = os.path.join(tenant_dir, f'chat-icon-{timestamp}.png')
        img.save(output_path, 'PNG', optimize=True, quality=85)
        
        # 刪除舊的 chat-icon 圖片
        import glob
        old_icons = glob.glob(os.path.join(tenant_dir, 'chat-icon-*.png'))
        for old_icon in old_icons:
            if old_icon != output_path:
                try:
                    os.remove(old_icon)
                except:
                    pass
        
        # 回傳 URL
        icon_url = f"/images/tenants/{tenant_id}/chat-icon-{timestamp}.png"
        
        # 自動更新 tenants.json 的 chatIconUrl
        tenants[tenant_id].setdefault("appearance", {})["chatIconUrl"] = icon_url
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        tenant_manager.reload()
        
        return jsonify({
            "message": "圖示上傳成功",
            "url": icon_url
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

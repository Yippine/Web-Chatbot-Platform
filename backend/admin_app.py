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
from dotenv import load_dotenv
load_dotenv()

from config.tenant_manager import TenantManager
from config.category_manager import CategoryManager
from config.service_factory import ServiceFactory
from db import (init_db, get_dashboard_stats, get_all_tenants_summary,
                get_service_distribution, get_hourly_distribution, get_lang_distribution,
                get_monthly_summary, get_daily_usage_detail, get_acceptance_kpi)

app = Flask(__name__)
CORS(app)

# 初始化
tenant_manager = TenantManager()
category_manager = CategoryManager()
service_factory = ServiceFactory(tenant_manager)
init_db()

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

def set_env_value(key: str, value: str):
    """更新或新增 .env 的單一鍵（通用）。"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            env_lines = f.readlines()
    found = False
    for i, line in enumerate(env_lines):
        if line.startswith(f"{key}="):
            env_lines[i] = f"{key}={value}\n"
            found = True
            break
    if not found:
        env_lines.append(f"{key}={value}\n")
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

# ==================== 數據統計 ====================

@app.route("/api/admin/stats/dashboard", methods=["GET"])
def admin_dashboard_stats():
    """所有 tenant 彙總統計"""
    try:
        tenants = tenant_manager.list_tenants()
        summary = get_all_tenants_summary()
        stats_map = {r["tenant_id"]: r for r in summary}

        tenant_stats = []
        for tid, t in tenants.items():
            s = stats_map.get(tid, {})
            tenant_stats.append({
                "id": tid,
                "name": t.get("name", tid),
                "messages_today": s.get("messages_today", 0),
                "sessions_today": s.get("sessions_today", 0),
            })

        return jsonify({
            "total_tenants": len(tenants),
            "tenant_stats": tenant_stats,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/stats/<tenant_id>/daily", methods=["GET"])
def tenant_daily_stats(tenant_id):
    """單一租戶的每日統計"""
    try:
        days = int(request.args.get("days", 7))
        stats = get_dashboard_stats(tenant_id, days=days)
        stats["service_distribution"] = get_service_distribution(tenant_id, days=days)
        stats["hourly_distribution"] = get_hourly_distribution(tenant_id, days=days)
        stats["lang_distribution"] = get_lang_distribution(tenant_id, days=days)
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== 驗收報表 ====================

@app.route("/api/admin/stats/<tenant_id>/acceptance", methods=["GET"])
def tenant_acceptance_report(tenant_id):
    """驗收報表：月度彙總 + KPI 指標"""
    auth_err = require_admin()
    if auth_err:
        return auth_err
    try:
        months = int(request.args.get("months", 4))
        pre_decision_min = float(request.args.get("pre_decision_min", 90))
        post_manual_min = float(request.args.get("post_manual_min", 25))
        pre_service_per_hour = float(request.args.get("pre_service_per_hour", 1))
        daily_work_hours = float(request.args.get("daily_work_hours", 8))
        staff_count = int(request.args.get("staff_count", 1))

        monthly = get_monthly_summary(tenant_id, months=months)
        kpi = get_acceptance_kpi(
            tenant_id, months=months,
            pre_decision_min=pre_decision_min,
            post_manual_min=post_manual_min,
            pre_service_per_hour=pre_service_per_hour,
            daily_work_hours=daily_work_hours,
            staff_count=staff_count,
        )

        return jsonify({
            "tenant_id": tenant_id,
            "months": months,
            "monthly_summary": monthly,
            "kpi": kpi,
            "params": {
                "pre_decision_min": pre_decision_min,
                "post_manual_min": post_manual_min,
                "pre_service_per_hour": pre_service_per_hour,
                "daily_work_hours": daily_work_hours,
                "staff_count": staff_count,
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/stats/<tenant_id>/export", methods=["GET"])
def tenant_export_csv(tenant_id):
    """匯出每日使用紀錄 CSV"""
    auth_err = require_admin()
    if auth_err:
        return auth_err
    try:
        from datetime import datetime, timedelta
        start_date = request.args.get("start_date", (datetime.now() - timedelta(days=120)).strftime("%Y-%m-%d"))
        end_date = request.args.get("end_date", datetime.now().strftime("%Y-%m-%d"))

        rows = get_daily_usage_detail(tenant_id, start_date, end_date)

        import csv as csv_mod
        from io import StringIO
        output = StringIO()
        writer = csv_mod.writer(output)
        writer.writerow(["日期", "AI回覆數", "使用者訊息數", "對話數(Sessions)", "平均回應時間(ms)", "最大回應時間(ms)"])
        for r in rows:
            writer.writerow([str(r["date"]), r["bot_messages"], r["user_messages"], r["sessions"], r["avg_response_ms"], r["max_response_ms"]])

        from flask import Response
        return Response(
            "\ufeff" + output.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={tenant_id}_usage_{start_date}_{end_date}.csv",
                "Content-Type": "text/csv; charset=utf-8-sig",
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== 分類管理 ====================

@app.route("/api/admin/categories", methods=["GET"])
def list_categories():
    """列出所有分類"""
    try:
        categories = category_manager.list_categories()
        return jsonify({
            "categories": [
                {"id": cid, "name": c.get("name")}
                for cid, c in categories.items()
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/categories", methods=["POST"])
def create_category():
    """建立新分類"""
    try:
        data = request.json or {}
        category_id = data.get("id")
        name = data.get("name")

        if not category_id or not name:
            return jsonify({"error": "缺少分類 id 或名稱"}), 400

        try:
            category = category_manager.create_category(category_id, name)
        except ValueError as e:
            return jsonify({"error": str(e)}), 409

        return jsonify({"message": "分類建立成功", "category": category}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/categories/<category_id>", methods=["PUT"])
def rename_category(category_id):
    """重新命名分類"""
    try:
        data = request.json or {}
        name = data.get("name")

        if not name:
            return jsonify({"error": "缺少分類名稱"}), 400

        try:
            category = category_manager.rename_category(category_id, name)
        except KeyError as e:
            return jsonify({"error": "分類不存在"}), 404

        return jsonify({"message": "分類更新成功", "category": category})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/categories/<category_id>", methods=["DELETE"])
def delete_category(category_id):
    """刪除分類（分類底下仍有品牌歸屬時拒絕）"""
    try:
        if not category_manager.category_exists(category_id):
            return jsonify({"error": "分類不存在"}), 404

        tenants = tenant_manager.list_tenants()
        has_tenants = any(t.get("category_id") == category_id for t in tenants.values())
        if has_tenants:
            return jsonify({"error": "分類底下仍有品牌，請先將品牌移至其他分類"}), 409

        category_manager.delete_category(category_id)
        return jsonify({"message": "分類刪除成功"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== 租戶管理 ====================

@app.route("/api/admin/tenants", methods=["GET"])
def list_tenants():
    """列出所有租戶"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        return jsonify({
            "tenants": [
                {
                    "id": tid,
                    "name": t.get("name"),
                    "enabled": t.get("enabled", True),
                    "category_id": t.get("category_id"),
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

        # 檢查分類是否有效
        category_id = data.get("category_id")
        if not category_id or not category_manager.category_exists(category_id):
            return jsonify({"error": "缺少或無效的分類"}), 400

        # 取得 API Key 並寫入 .env
        api_key = data.get("gemini_api_key", "")
        if api_key:
            env_key = update_env_file(tenant_id, api_key)
        else:
            env_key = f"TENANT_{tenant_id.upper()}_GEMINI_API_KEY"
        
        # 建立租戶設定 (不儲存 API Key，改存環境變數名稱)
        # 預設帶入 general 通用對話服務
        default_services = {
            "general": {
                "name": "通用對話",
                "icon": "💬",
                "enabled": True,
                "class": "ChatService",
                "prompt_file": f"prompts/{tenant_id}/general.md",
                "temperature": 0.7,
                "use_grounding": False,
                "search_keyword": "",
                "allowed_domains": "",
                "loading_message": "處理中",
                "query_loading_message": "查詢資料中",
                "mode_message": "",
                "show_mode_message": False
            }
        }
        
        new_tenant = {
            "id": tenant_id,
            "name": data.get("name", "新租戶"),
            "api_key_env": env_key,
            "enabled": data.get("enabled", True),
            "category_id": category_id,
            "services": {**default_services, **data.get("services", {})},
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
        
        # 更新設定檔（先重載確保多 worker 下不會覆蓋）
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        tenants[tenant_id] = new_tenant
        
        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        
        # 建立預設 general prompt 檔案
        general_prompt_path = os.path.join(
            os.path.dirname(tenant_manager.config_path), '..', 'prompts', tenant_id, 'general.md'
        )
        os.makedirs(os.path.dirname(general_prompt_path), exist_ok=True)
        if not os.path.exists(general_prompt_path):
            with open(general_prompt_path, 'w', encoding='utf-8') as f:
                f.write(f"# 通用對話\n你是「{data.get('name', '新租戶')}」的智能助手，請友善且專業地回答使用者的問題。\n")
        
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
        if "category_id" in data:
            new_category_id = data["category_id"]
            if not new_category_id or not category_manager.category_exists(new_category_id):
                return jsonify({"error": "缺少或無效的分類"}), 400
            tenant["category_id"] = new_category_id
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
                    "SmartRouteService": "路線導航服務",
                    "FrappeQueryService": "ERP 資料查詢服務"
                }.get(class_name, class_name)
            }
            for class_name in ServiceFactory.SERVICE_CLASSES.keys()
        ]
        
        return jsonify({"classes": classes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/frappe/templates", methods=["GET"])
def get_frappe_templates():
    """取得 Frappe 模組模板清單"""
    try:
        from config.frappe_templates import FRAPPE_MODULE_TEMPLATES

        templates = [
            {
                "key": key,
                "label": t["label"],
                "icon": t["icon"],
                "description": t["description"],
                "default_prompt": t["default_prompt"],
                "queries": t["queries"],
            }
            for key, t in FRAPPE_MODULE_TEMPLATES.items()
        ]
        return jsonify({"templates": templates})
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
        if "line_enabled" in data:
            service["line_enabled"] = data["line_enabled"]
        if "loading_message" in data:
            service["loading_message"] = data["loading_message"]
        if "query_loading_message" in data:
            service["query_loading_message"] = data["query_loading_message"]
        if "frappe" in data:
            service["frappe"] = data["frappe"]
        
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
            "show_mode_message": data.get("show_mode_message", False),
            "line_enabled": data.get("line_enabled", True)
        }
        
        # FrappeQueryService 專屬設定
        if data.get("frappe"):
            new_service["frappe"] = data["frappe"]
        
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

# ==================== LINE 通路設定 ====================

@app.route("/api/admin/tenants/<tenant_id>/line", methods=["GET"])
def get_line_config(tenant_id):
    """取得租戶 LINE 設定（含推導的 Webhook URL，不回傳憑證明文）。"""
    try:
        from dotenv import dotenv_values
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404

        line_cfg = tenants[tenant_id].get("line", {}) or {}
        env = dotenv_values(os.path.join(os.path.dirname(__file__), '.env'))
        token_env = line_cfg.get("channel_access_token_env")
        secret_env = line_cfg.get("channel_secret_env")

        base = os.getenv("PUBLIC_BASE_URL", request.host_url.rstrip("/"))
        webhook_url = f"{base}/webhook/line/{tenant_id}"

        return jsonify({
            "line": {
                "enabled": line_cfg.get("enabled", False),
                "has_token": bool(env.get(token_env)) if token_env else False,
                "has_secret": bool(env.get(secret_env)) if secret_env else False,
            },
            "webhook_url": webhook_url,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/line", methods=["PUT"])
def update_line_config(tenant_id):
    """更新租戶 LINE 設定：token/secret 寫入 .env，line 區塊寫入 tenants.json。"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404

        data = request.json or {}
        token_env = f"TENANT_{tenant_id.upper()}_LINE_TOKEN"
        secret_env = f"TENANT_{tenant_id.upper()}_LINE_SECRET"

        # 憑證非空才寫入 .env（空字串視為不變更）
        token = data.get("channel_access_token")
        secret = data.get("channel_secret")
        if token:
            set_env_value(token_env, token)
        if secret:
            set_env_value(secret_env, secret)

        line_cfg = tenants[tenant_id].get("line", {}) or {}
        line_cfg["enabled"] = data.get("enabled", line_cfg.get("enabled", False))
        line_cfg["channel_access_token_env"] = token_env
        line_cfg["channel_secret_env"] = secret_env
        tenants[tenant_id]["line"] = line_cfg

        with open(tenant_manager.config_path, 'w', encoding='utf-8') as f:
            json.dump(tenants, f, ensure_ascii=False, indent=2)
        tenant_manager.reload()

        return jsonify({"message": "LINE 設定更新成功", "line": {"enabled": line_cfg["enabled"]}})
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

@app.route("/api/admin/tenants/<tenant_id>/translations", methods=["GET"])
def get_translation_status(tenant_id):
    """查詢租戶各語言翻譯狀態"""
    try:
        translations_dir = os.path.join(os.path.dirname(tenant_manager.config_path), '..', 'translations', tenant_id)
        
        languages = ["en", "ja", "ko", "vi", "id", "th"]
        status = {}
        
        for lang in languages:
            filepath = os.path.join(translations_dir, f"{lang}.json")
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    status[lang] = {
                        "exists": True,
                        "source_hash": data.get("_source_hash", "")
                    }
                except Exception:
                    status[lang] = {"exists": False}
            else:
                status[lang] = {"exists": False}
        
        # 計算當前原始文字 hash，用於判斷是否過期
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        tenant = tenants.get(tenant_id, {})
        
        appearance = tenant.get("appearance", {})
        services = tenant.get("services", {})
        source_texts = {
            "appearance": {
                "title": appearance.get("title", ""),
                "subtitle": appearance.get("subtitle", ""),
                "welcomeMessage": appearance.get("welcomeMessage", ""),
                "placeholder": appearance.get("placeholder", "")
            },
            "services": {}
        }
        for sid, sconfig in services.items():
            source_texts["services"][sid] = {
                "name": sconfig.get("name", ""),
                "loading_message": sconfig.get("loading_message", ""),
                "query_loading_message": sconfig.get("query_loading_message", ""),
                "mode_message": sconfig.get("mode_message", "")
            }
        
        import hashlib
        source_json = json.dumps(source_texts, ensure_ascii=False, sort_keys=True)
        current_hash = hashlib.md5(source_json.encode('utf-8')).hexdigest()
        
        # 標記是否過期
        for lang in languages:
            if status[lang].get("exists"):
                status[lang]["outdated"] = status[lang]["source_hash"] != current_hash
        
        return jsonify({"translations": status, "current_hash": current_hash})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/tenants/<tenant_id>/translations", methods=["POST"])
def generate_translation(tenant_id):
    """生成租戶聊天介面的語言翻譯檔"""
    try:
        tenant_manager.reload()
        tenants = tenant_manager.list_tenants()
        
        if tenant_id not in tenants:
            return jsonify({"error": "租戶不存在"}), 404
        
        data = request.json
        lang = data.get("language")
        if not lang:
            return jsonify({"error": "缺少 language 參數"}), 400
        
        tenant = tenants[tenant_id]
        print(f"[Translation] 開始生成 {tenant_id} 的 {lang} 翻譯")
        
        # 收集需要翻譯的繁中原始文字
        appearance = tenant.get("appearance", {})
        services = tenant.get("services", {})
        
        source_texts = {
            "appearance": {
                "title": appearance.get("title", ""),
                "subtitle": appearance.get("subtitle", ""),
                "welcomeMessage": appearance.get("welcomeMessage", ""),
                "placeholder": appearance.get("placeholder", "")
            },
            "services": {}
        }
        for sid, sconfig in services.items():
            source_texts["services"][sid] = {
                "name": sconfig.get("name", ""),
                "loading_message": sconfig.get("loading_message", ""),
                "query_loading_message": sconfig.get("query_loading_message", ""),
                "mode_message": sconfig.get("mode_message", "")
            }
        
        print(f"[Translation] 收集到的原始文字: appearance={list(source_texts['appearance'].keys())}, services={list(source_texts['services'].keys())}")
        
        # 計算原始文字 hash（用於異動偵測）
        import hashlib
        source_json = json.dumps(source_texts, ensure_ascii=False, sort_keys=True)
        source_hash = hashlib.md5(source_json.encode('utf-8')).hexdigest()
        print(f"[Translation] 原始文字 hash: {source_hash}")
        
        # 檢查現有翻譯檔
        translations_dir = os.path.join(os.path.dirname(tenant_manager.config_path), '..', 'translations', tenant_id)
        os.makedirs(translations_dir, exist_ok=True)
        translation_file = os.path.join(translations_dir, f"{lang}.json")
        
        if os.path.exists(translation_file):
            with open(translation_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            if existing.get("_source_hash") == source_hash:
                print(f"[Translation] {lang} 翻譯檔已存在且原始文字未異動，跳過")
                return jsonify({"message": f"{lang} 翻譯未異動，使用現有檔案", "skipped": True})
            else:
                print(f"[Translation] {lang} 翻譯檔存在但原始文字已異動，重新生成")
        
        # 取得 API Key
        api_key = tenant.get("gemini_api_key")
        if not api_key:
            # 從 .env 讀取
            api_key_env = tenant.get("api_key_env")
            if api_key_env:
                from dotenv import dotenv_values
                env = dotenv_values(os.path.join(os.path.dirname(tenant_manager.config_path), '..', '.env'))
                api_key = env.get(api_key_env)
        
        if not api_key:
            print(f"[Translation] ❌ 租戶 {tenant_id} 缺少 API Key")
            return jsonify({"error": "租戶缺少 API Key"}), 400
        
        # 語言名稱映射
        lang_names = {
            "en": "英文",
            "ja": "Japanese (日文)",
            "ko": "Korean (韓文)",
            "vi": "Vietnamese (越南文)",
            "id": "Indonesian (印尼文)",
            "th": "Thai (泰文)"
        }
        lang_name = lang_names.get(lang, lang)
        
        # 呼叫 Gemini 翻譯
        print(f"[Translation] 呼叫 Gemini API 翻譯為 {lang_name}...")
        
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        translate_prompt = f"""請將以下 JSON 中所有的繁體中文文字翻譯成 {lang_name}。

規則：
1. 只翻譯 JSON 的 value，不要改變 key
2. 保留 emoji 符號不翻譯
3. 保留換行符號 \\n
4. 空字串保持空字串
5. 只回傳 JSON，不要加任何說明或 markdown 格式

要翻譯的 JSON：
{json.dumps(source_texts, ensure_ascii=False, indent=2)}"""
        
        import time
        api_start = time.time()
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=translate_prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            )
        )
        
        api_time = time.time() - api_start
        print(f"[Translation] Gemini API 回應時間: {api_time:.2f}s")
        
        # 解析回應
        response_text = response.text.strip()
        # 清理 markdown 格式
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        print(f"[Translation] 解析翻譯結果...")
        
        try:
            translated = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"[Translation] ❌ JSON 解析失敗: {e}")
            print(f"[Translation] 原始回應: {response_text[:500]}")
            return jsonify({"error": f"翻譯結果解析失敗: {str(e)}"}), 500
        
        # 加入 hash 並儲存
        translated["_source_hash"] = source_hash
        
        with open(translation_file, 'w', encoding='utf-8') as f:
            json.dump(translated, f, ensure_ascii=False, indent=2)
        
        print(f"[Translation] ✅ {lang} 翻譯檔已儲存: {translation_file}")
        
        return jsonify({"message": f"{lang} 翻譯生成完成"})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[Translation] ❌ 翻譯失敗: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

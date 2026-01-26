"""
多租戶 Chatbot 後端 API
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

from config.tenant_manager import TenantManager
from config.service_factory import ServiceFactory
from middleware.tenant_auth import require_tenant

load_dotenv()

app = Flask(__name__)
CORS(app)

# 初始化多租戶管理
tenant_manager = TenantManager()
service_factory = ServiceFactory(tenant_manager)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

@app.route("/api/chat", methods=["POST"])
@require_tenant(tenant_manager)
def chat():
    """統一聊天接口（多租戶版）"""
    data = request.json
    message = data.get("message")
    user_id = data.get("user_id", "default")
    forced_mode = data.get("mode")
    
    if not message:
        return jsonify({"error": "缺少訊息內容"}), 400
    
    try:
        tenant_id = request.tenant_id
        tenant = request.tenant
        
        # 使用前端傳入的模式
        intent = forced_mode if forced_mode else 'general'
        
        # 檢查是否有對應的 quick_action 設定
        quick_action_config = None
        if forced_mode:
            for qa in tenant.get('quick_actions', []):
                if qa.get('service') == forced_mode:
                    quick_action_config = qa
                    break
        
        # 根據意圖建立對應服務
        service_map = {
            'route': 'route',
            'recommend': 'recommend',
            'events': 'event',
            'event': 'event',
            'floors': 'floor',
            'floor': 'floor',
            'general': 'general'
        }
        
        service_name = service_map.get(intent, 'general')
        
        # 如果有 quick_action 設定,使用它的參數動態建立服務
        if quick_action_config:
            service = create_service_from_quick_action(tenant_id, tenant, quick_action_config)
        else:
            service = service_factory.create_service(tenant_id, service_name)
        
        if not service:
            return jsonify({"error": f"服務 '{service_name}' 不可用"}), 503
        
        # 根據服務類別呼叫對應方法
        from services.query_service import QueryService
        from services.chat_service import ChatService
        from services.smart_route_service import SmartRouteService
        
        if isinstance(service, QueryService):
            # QueryService: 呼叫 query_data()
            result = service.query_data(message, user_id=user_id)
            return jsonify({
                "type": "query",
                "response": result["response"],
                "references": result.get("references", [])
            })
        
        elif isinstance(service, SmartRouteService):
            # SmartRouteService: 呼叫 plan_route()
            result = service.plan_route(end=message, user_id=user_id)
            return jsonify({
                "type": "route",
                "response": result["route"],
                "references": result.get("references", [])
            })
        
        elif isinstance(service, ChatService):
            # ChatService: 呼叫 chat()
            result = service.chat(message, user_id=user_id)
            return jsonify({
                "type": "chat",
                "response": result["response"],
                "references": result.get("references", [])
            })
        
        else:
            # 預設：嘗試呼叫 chat() 方法
            if hasattr(service, 'chat'):
                result = service.chat(message, user_id=user_id)
                return jsonify({
                    "type": "general",
                    "response": result.get("response") or result.get("text"),
                    "references": result.get("references", [])
                })
            else:
                return jsonify({"error": "服務不支援此操作"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def create_service_from_quick_action(tenant_id: str, tenant: dict, qa_config: dict):
    """根據 quick_action 設定動態建立服務"""
    service_name = qa_config.get('service', 'general')
    
    # 取得服務類別
    service_config = tenant.get('services', {}).get(service_name, {})
    class_name = service_config.get('class', 'ChatService')
    
    from config.service_factory import ServiceFactory
    service_class = ServiceFactory.SERVICE_CLASSES.get(class_name)
    
    if not service_class:
        return None
    
    # 取得 API Key
    api_key = tenant.get('gemini_api_key')
    if not api_key:
        return None
    
    # 使用 quick_action 的參數建立服務
    service_instance = service_class(
        api_key=api_key,
        service_name=service_name,
        tenant_id=tenant_id,
        default_temperature=qa_config.get('temperature', 0.7),
        default_use_grounding=qa_config.get('use_grounding', True),
        default_search_keyword=qa_config.get('search_keyword')
    )
    
    # 載入 quick_action 的 prompt
    prompt_file = qa_config.get('prompt_file')
    if prompt_file:
        custom_prompt = tenant_manager.load_prompt(prompt_file)
        if custom_prompt:
            service_instance.SYSTEM_PROMPT = custom_prompt
    
    print(f"[QuickAction] 建立服務: {tenant_id}/{service_name} (temperature={qa_config.get('temperature')})")
    
    return service_instance

@app.route("/api/chat/intent", methods=["POST"])
@require_tenant(tenant_manager)
def detect_intent():
    """意圖判斷端點（多租戶版）"""
    data = request.json
    message = data.get("message")
    
    if not message:
        return jsonify({"error": "缺少訊息內容"}), 400
    
    try:
        tenant_id = request.tenant_id
        user_id = f"intent_{tenant_id}"
        
        # 使用通用服務進行意圖判斷
        general_service = service_factory.create_service(tenant_id, 'general')
        if not general_service:
            return jsonify({"error": "服務不可用"}), 503
        
        # 意圖判斷
        intent_prompt = f"""判斷以下問題的類型，只回答一個關鍵字：
                        - 如果是**產品推薦、購物諮詢**（如：推薦、想買、找商品、有什麼、賣什麼、哪裡買、產品、商品），回答「recommend」
                        - 如果是**路線導航**（如：怎麼去、怎麼走、從A到B、導航），回答「route」
                        - 如果是**活動資訊**（如：活動、展覽、優惠、促銷、檔期），回答「events」
                        - 如果是**樓層店家查詢**（如：幾樓、樓層配置、店家列表、櫃位資訊），回答「floors」
                        - 其他問題回答「general」

                        問題：{message}
                        回答："""
        
        intent_result = general_service.generate_content(
            intent_prompt, 
            user_id=user_id,
            temperature=0, 
            use_grounding=False
        )
        intent = intent_result["text"].strip().lower()
        
        # 標準化意圖
        if "route" in intent:
            intent = "route"
        elif "recommend" in intent:
            intent = "recommend"
        elif "event" in intent:
            intent = "events"
        elif "floor" in intent:
            intent = "floors"
        else:
            intent = "general"
        
        return jsonify({"intent": intent})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/tenant/config", methods=["GET"])
@require_tenant(tenant_manager)
def get_tenant_config():
    """取得租戶前端設定"""
    try:
        tenant = request.tenant
        
        return jsonify({
            "tenant_id": request.tenant_id,
            "name": tenant.get("name"),
            "quick_actions": tenant.get("quick_actions", []),
            "services": tenant.get("services", {}),
            "appearance": tenant.get("appearance", {})
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/query/data", methods=["GET"])
@require_tenant(tenant_manager)
def query_data():
    """查詢資料 - 呼叫 QueryService 的 get_data()"""
    try:
        tenant_id = request.tenant_id
        service_name = request.args.get('service', 'query')
        lang = request.args.get('lang')
        
        # 建立服務
        service = service_factory.create_service(tenant_id, service_name)
        if not service:
            return jsonify({"error": f"服務 '{service_name}' 不可用"}), 503
        
        # 檢查是否為 QueryService
        from services.query_service import QueryService
        if not isinstance(service, QueryService):
            return jsonify({"error": "此服務不支援 get_data() 方法"}), 400
        
        # 呼叫 get_data()
        result = service.get_data(response_language=lang)
        
        return jsonify({
            "type": "query",
            "response": result["data"],
            "references": result.get("references", [])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

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
        
        # 使用前端傳入的模式
        intent = forced_mode if forced_mode else 'general'
        
        # 根據意圖建立對應服務並生成回應
        service_map = {
            'route': 'route',
            'recommend': 'recommend',
            'events': 'events',
            'event': 'events',
            'floors': 'floors',
            'floor': 'floors',
            'general': 'general'
        }
        
        service_name = service_map.get(intent, 'general')
        service = service_factory.create_service(tenant_id, service_name)
        
        if not service:
            return jsonify({"error": f"服務 '{service_name}' 不可用"}), 503
        
        # 根據服務類型呼叫對應方法
        if service_name == 'route':
            result = service.plan_route(end=message, user_id=user_id)
            return jsonify({
                "type": "route",
                "response": result["route"],
                "references": result.get("references", [])
            })
        elif service_name == 'recommend':
            result = service.get_recommendations(message, user_id=user_id)
            return jsonify({
                "type": "recommend",
                "response": result["recommendations"],
                "references": result.get("references", [])
            })
        elif service_name == 'events':
            result = service.search_events(message, [], user_id=user_id)
            return jsonify({
                "type": "events",
                "response": result["events"],
                "references": result.get("references", [])
            })
        elif service_name == 'floors':
            result = service.search_floor(message, [], user_id=user_id)
            return jsonify({
                "type": "floors",
                "response": result["floors"],
                "references": result.get("references", [])
            })
        else:  # general
            result = service.chat(message, user_id=user_id)
            return jsonify({
                "type": "general",
                "response": result["text"],
                "references": result.get("references", [])
            })
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            "quick_actions": tenant.get("quick_actions", [])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

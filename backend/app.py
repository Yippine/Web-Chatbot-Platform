"""
多租戶 Chatbot 後端 API
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
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

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

@app.route("/api/detect-language", methods=["POST"])
@require_tenant(tenant_manager)
def detect_language():
    """語言偵測端點（輕量版，不使用 Redis）"""
    data = request.json
    message = data.get("message")
    
    if not message:
        return jsonify({"error": "缺少訊息內容"}), 400
    
    try:
        tenant = request.tenant
        api_key = tenant.get("gemini_api_key")
        if not api_key:
            return jsonify({"detected_language": {"language_code": "zh-TW", "language_name": "Traditional Chinese"}})
        
        from google import genai
        from google.genai import types
        import time
        
        client = genai.Client(api_key=api_key)
        
        prompt = f"""偵測以下文字的語言，並以 JSON 格式回傳結果。
        
                    格式要求：
                    {{"language_code": "語言代碼", "language_name": "語言英文名稱"}}

                    重要規則：
                    - 繁體中文和簡體中文都統一回傳 zh-TW / Traditional Chinese

                    語言代碼範例：
                    - 中文（繁體或簡體）: zh-TW
                    - 英文: en
                    - 日文: ja
                    - 韓文: ko
                    - 越南文: vi
                    - 印尼文: id
                    - 泰文: th

                    文字：{message}

                    只回傳 JSON，不要加任何說明。"""
        
        api_start = time.time()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0)
        )
        print(f"[Language] Gemini API: {time.time() - api_start:.2f}s")
        
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        detected = json.loads(response_text.strip())
        print(f"[Language] 偵測結果: {detected}")
        return jsonify({"detected_language": detected})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"detected_language": {"language_code": "zh-TW", "language_name": "Traditional Chinese"}})

@app.route("/api/chat/intent", methods=["POST"])
@require_tenant(tenant_manager)
def detect_intent():
    """AI 意圖判斷端點"""
    data = request.json
    message = data.get("message")
    
    if not message:
        return jsonify({"error": "缺少訊息內容"}), 400
    
    try:
        tenant_id = request.tenant_id
        tenant = request.tenant
        
        # 取得該租戶所有啟用的服務（排除 general）
        services = tenant.get("services", {})
        enabled_services = {k: v for k, v in services.items() if v.get("enabled", True) and k != "general"}
        
        if not enabled_services:
            return jsonify({"intent": "general"})
        
        # 動態產生意圖選項
        service_options = []
        for sid, sconfig in enabled_services.items():
            name = sconfig.get("name", sid)
            keyword = sconfig.get("search_keyword", "")
            service_options.append(f'- 如果與「{name}」相關（關鍵字：{keyword}），回答「{sid}」')
        
        options_text = "\n".join(service_options)
        
        intent_prompt = f"""判斷以下問題應該由哪個服務處理，只回答一個服務 ID：
{options_text}
- 如果都不符合，回答「general」

問題：{message}
回答："""
        
        # 用任一服務的 API key 做意圖判斷
        api_key = tenant.get("gemini_api_key")
        if not api_key:
            return jsonify({"intent": "general"})
        
        from google import genai
        from google.genai import types
        import time
        
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=intent_prompt,
            config=types.GenerateContentConfig(temperature=0)
        )
        
        intent = response.text.strip().lower().strip('「」')
        
        # 驗證 intent 是否為有效服務
        if intent not in enabled_services and intent != "general":
            intent = "general"
        
        print(f"[Intent] 租戶={tenant_id}, 訊息={message[:30]}, 意圖={intent}")
        return jsonify({"intent": intent})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"intent": "general"})

@app.route("/api/chat", methods=["POST"])
@require_tenant(tenant_manager)
def chat():
    """統一聊天接口（多租戶版）"""
    data = request.json
    message = data.get("message")
    user_id = data.get("user_id", "default")
    forced_mode = data.get("mode")
    lang = data.get("lang")
    
    # 語言代碼轉語言名稱（供 response_language 使用）
    lang_name_map = {
        "en": "English", "ja": "Japanese", "ko": "Korean",
        "vi": "Vietnamese", "id": "Indonesian", "th": "Thai"
    }
    response_language = lang_name_map.get(lang) if lang else None
    
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
        # 舊版意圖映射 (向下相容)
        service_map = {
            'route': 'route',
            'recommend': 'recommend',
            'events': 'event',
            'event': 'event',
            'floors': 'floor',
            'floor': 'floor',
            'general': 'general'
        }
        
        # 如果 intent 在 service_map 中,使用映射值;否則直接使用 intent (支援自訂服務如 bu1, bu2)
        service_name = service_map.get(intent, intent)
        
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
            result = service.query_data(message, user_id=user_id, response_language=response_language)
            return jsonify({
                "type": "query",
                "response": result["response"],
                "references": result.get("references", [])
            })
        
        elif isinstance(service, SmartRouteService):
            result = service.plan_route(end=message, user_id=user_id, response_language=response_language)
            return jsonify({
                "type": "route",
                "response": result["route"],
                "references": result.get("references", [])
            })
        
        elif isinstance(service, ChatService):
            result = service.chat(message, user_id=user_id, response_language=response_language)
            return jsonify({
                "type": "chat",
                "response": result["response"],
                "references": result.get("references", [])
            })
        
        else:
            # 預設：嘗試呼叫 chat() 方法
            if hasattr(service, 'chat'):
                result = service.chat(message, user_id=user_id, response_language=response_language)
                return jsonify({
                    "type": "general",
                    "response": result.get("response") or result.get("text"),
                    "references": result.get("references", [])
                })
            else:
                return jsonify({"error": "服務不支援此操作"}), 400
            
    except Exception as e:
        import traceback
        traceback.print_exc()
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

@app.route("/api/tenant/config", methods=["GET"])
@require_tenant(tenant_manager)
def get_tenant_config():
    """取得租戶前端設定（支援多語言）"""
    try:
        tenant = request.tenant
        tenant_id = request.tenant_id
        lang = request.args.get('lang')
        
        config = {
            "tenant_id": tenant_id,
            "name": tenant.get("name"),
            "quick_actions": tenant.get("quick_actions", []),
            "services": tenant.get("services", {}),
            "appearance": tenant.get("appearance", {})
        }
        
        # 如果有指定語言，嘗試載入翻譯檔覆蓋
        if lang and lang != 'zh-tw':
            translation = _load_translation(tenant_id, lang)
            if translation:
                # 覆蓋 appearance
                if "appearance" in translation:
                    for key, value in translation["appearance"].items():
                        if value:
                            config["appearance"][key] = value
                # 覆蓋 services
                if "services" in translation:
                    for sid, fields in translation["services"].items():
                        if sid in config["services"]:
                            for key, value in fields.items():
                                if value:
                                    config["services"][sid][key] = value
        
        return jsonify(config)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _load_translation(tenant_id: str, lang: str) -> dict:
    """載入翻譯檔，fallback: 指定語言 → en → None"""
    translations_dir = os.path.join(os.path.dirname(tenant_manager.config_path), '..', 'translations', tenant_id)
    
    for try_lang in [lang, 'en']:
        filepath = os.path.join(translations_dir, f"{try_lang}.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                data.pop('_source_hash', None)
                print(f"[Translation] 載入 {tenant_id}/{try_lang}.json")
                return data
            except Exception as e:
                print(f"[Translation] ❌ 載入翻譯檔失敗: {e}")
    
    return None

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
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

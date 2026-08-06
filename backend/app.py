"""
多租戶 Chatbot 後端 API
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import time
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

from config.tenant_manager import TenantManager
from config.service_factory import ServiceFactory
from middleware.tenant_auth import require_tenant
from db import init_db, log_message as db_log

load_dotenv()

app = Flask(__name__)
CORS(app)

# 初始化多租戶管理
tenant_manager = TenantManager()
service_factory = ServiceFactory(tenant_manager)

# 初始化 DB + 非同步 log pool
init_db()
_log_pool = ThreadPoolExecutor(max_workers=4)
# LINE webhook 背景處理 pool（webhook 須秒回 200，AI 處理丟背景）
_line_pool = ThreadPoolExecutor(max_workers=4)

# 語言代碼 → 語言名稱（供 response_language 使用）
LANG_NAME_MAP = {
    "zh-TW": "Traditional Chinese", "en": "English", "ja": "Japanese", "ko": "Korean",
    "vi": "Vietnamese", "id": "Indonesian", "th": "Thai"
}


class ServiceUnavailable(Exception):
    """服務無法建立（對應 HTTP 503）"""
    pass


class UnsupportedOperation(Exception):
    """服務不支援此操作（對應 HTTP 400）"""
    pass

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

LANG_CODE_NAME_MAP = {
    "zh-TW": "Traditional Chinese", "en": "English", "ja": "Japanese",
    "ko": "Korean", "vi": "Vietnamese", "id": "Indonesian", "th": "Thai"
}


def _detect_message_language(tenant: dict, message: str) -> str:
    """偵測訊息語言，回傳語言代碼（如 zh-TW/en/ja...）。

    供 /api/detect-language（網頁版）與 LINE webhook 共用，不複製偵測邏輯。
    任何錯誤（含缺少 API key）皆 fallback "zh-TW"，不拋出。
    """
    try:
        api_key = tenant.get("gemini_api_key")
        if not api_key:
            _env_key = tenant.get("api_key_env")
            if _env_key:
                api_key = os.environ.get(_env_key)
        if not api_key:
            return "zh-TW"

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
            config=types.GenerateContentConfig(
                temperature=0,
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            )
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
        return detected.get("language_code") or "zh-TW"

    except Exception:
        import traceback
        traceback.print_exc()
        return "zh-TW"


@app.route("/api/detect-language", methods=["POST"])
@require_tenant(tenant_manager)
def detect_language():
    """語言偵測端點（輕量版，不使用 Redis）"""
    data = request.json
    message = data.get("message")

    if not message:
        return jsonify({"error": "缺少訊息內容"}), 400

    lang_code = _detect_message_language(request.tenant, message)
    return jsonify({"detected_language": {
        "language_code": lang_code,
        "language_name": LANG_CODE_NAME_MAP.get(lang_code, "Traditional Chinese"),
    }})

def classify_intent(tenant_id: str, tenant: dict, message: str) -> str:
    """通路無關的意圖判斷：回傳服務 ID 或 'general'。

    候選池 = 所有 enabled 且非 general 的服務（web 與 LINE 共用同一套）。
    任何錯誤皆 fallback 'general'（永不拋出）。
    """
    try:
        services = tenant.get("services", {})
        enabled_services = {k: v for k, v in services.items() if v.get("enabled", True) and k != "general"}

        if not enabled_services:
            return "general"

        # 動態產生意圖選項
        service_options = []
        for sid, sconfig in enabled_services.items():
            name = sconfig.get("name", sid)
            keyword = sconfig.get("search_keyword", "")
            # FrappeQueryService 沒有 search_keyword，從 frappe queries 的 doctype 組合提示
            if not keyword and sconfig.get("frappe"):
                doctypes = [q.get("doctype", "") for q in sconfig["frappe"].get("queries", [])]
                keyword = f"{name} {' '.join(doctypes)}"
            service_options.append(f'- "{sid}"：{name}（相關主題：{keyword}）')

        options_text = "\n".join(service_options)

        intent_prompt = f"""你是意圖分類器。根據使用者的問題，判斷最適合的服務 ID。
可用服務：
{options_text}

規則：
1. 用語意理解判斷，不要只看關鍵字是否完全吻合
2. 只要問題的主題與某個服務「可能相關」，就選擇該服務
3. 只有在問題完全無法歸類到任何服務時，才回答 "general"
4. 只回答服務 ID，不要加任何說明

問題：{message}
回答："""

        # 用任一服務的 API key 做意圖判斷
        api_key = tenant.get("gemini_api_key")
        if not api_key:
            _env_key = tenant.get("api_key_env")
            if _env_key:
                api_key = os.environ.get(_env_key)
        if not api_key:
            return "general"

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=intent_prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            )
        )

        intent_raw = response.text.strip().strip('「」').strip().strip('"').strip("'")
        matched = next((k for k in enabled_services if k.lower() == intent_raw.lower()), None)
        intent = matched if matched else "general"
        print(f"[Intent] 租戶={tenant_id}, 訊息={message[:30]}, raw={intent_raw}, 意圖={intent}, 可用={list(enabled_services.keys())}")
        return intent

    except Exception:
        import traceback
        traceback.print_exc()
        return "general"


@app.route("/api/chat/intent", methods=["POST"])
@require_tenant(tenant_manager)
def detect_intent():
    """AI 意圖判斷端點"""
    data = request.json
    message = data.get("message")

    if not message:
        return jsonify({"error": "缺少訊息內容"}), 400

    intent = classify_intent(request.tenant_id, request.tenant, message)
    return jsonify({"intent": intent})

def process_message(tenant_id: str, tenant: dict, message: str, user_id: str = "default",
                    mode: str = None, lang: str = None, lat_lng=None) -> dict:
    """通路無關的對話協調器：建服務 → 依類別分派 → 組裝回覆 → 記錄統計。

    回傳 {type, response, references, tool_used?}。
    服務無法建立時 raise ServiceUnavailable；服務不支援對話時 raise UnsupportedOperation。
    供 /api/chat（HTTP）與 LINE webhook 共用，不複製對話分派邏輯。
    """
    response_language = LANG_NAME_MAP.get(lang) if lang else None
    intent = mode if mode else 'general'

    # 檢查是否有對應的 quick_action 設定
    quick_action_config = None
    if mode:
        for qa in tenant.get('quick_actions', []):
            if qa.get('service') == mode:
                quick_action_config = qa
                break

    # 舊版意圖映射 (向下相容)；不在表中者直接當服務名（支援自訂服務）
    service_map = {
        'route': 'route', 'recommend': 'recommend', 'events': 'event',
        'event': 'event', 'floors': 'floor', 'floor': 'floor', 'general': 'general'
    }
    service_name = service_map.get(intent, intent)

    if quick_action_config:
        service = create_service_from_quick_action(tenant_id, tenant, quick_action_config)
    else:
        service = service_factory.create_service(tenant_id, service_name)

    if not service:
        raise ServiceUnavailable(f"服務 '{service_name}' 不可用")

    from services.query_service import QueryService
    from services.chat_service import ChatService
    from services.smart_route_service import SmartRouteService

    t0 = time.time()

    def _log():
        response_ms = int((time.time() - t0) * 1000)
        _log_pool.submit(db_log, tenant_id=tenant_id, session_id=user_id,
                         direction="bot", service_name=service_name,
                         response_ms=response_ms, lang=lang or "zh-TW")

    if isinstance(service, QueryService):
        result = service.query_data(message, user_id=user_id, response_language=response_language)
        _log()
        return {"type": "query", "response": result["response"],
                "references": result.get("references", [])}

    elif isinstance(service, SmartRouteService):
        result = service.plan_route(message=message, user_id=user_id,
                                    response_language=response_language, lat_lng=lat_lng)
        _log()
        return {"type": "route", "response": result["route"],
                "references": result.get("references", []),
                "tool_used": result.get("tool_used")}

    elif isinstance(service, ChatService):
        result = service.chat(message, user_id=user_id, response_language=response_language)
        _log()
        return {"type": "chat", "response": result["response"],
                "references": result.get("references", [])}

    else:
        if hasattr(service, 'chat'):
            result = service.chat(message, user_id=user_id, response_language=response_language)
            _log()
            return {"type": "general", "response": result.get("response") or result.get("text"),
                    "references": result.get("references", [])}
        raise UnsupportedOperation("服務不支援此操作")


@app.route("/api/chat", methods=["POST"])
@require_tenant(tenant_manager)
def chat():
    """統一聊天接口（多租戶版）— 委派通路無關的 process_message()"""
    data = request.json
    message = data.get("message")

    if not message:
        return jsonify({"error": "缺少訊息內容"}), 400

    try:
        result = process_message(
            request.tenant_id, request.tenant, message,
            user_id=data.get("user_id", "default"),
            mode=data.get("mode"),
            lang=data.get("lang"),
            lat_lng=data.get("lat_lng"),
        )
        return jsonify(result)
    except ServiceUnavailable as e:
        return jsonify({"error": str(e)}), 503
    except UnsupportedOperation as e:
        return jsonify({"error": str(e)}), 400
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
        _env_key = tenant.get('api_key_env')
        if _env_key:
            api_key = os.environ.get(_env_key)
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
        t0 = time.time()
        result = service.get_data(response_language=lang)
        response_ms = int((time.time() - t0) * 1000)

        _log_pool.submit(db_log, tenant_id=tenant_id, session_id="query",
                         direction="bot", service_name=service_name,
                         response_ms=response_ms, lang=lang or "zh-TW")

        return jsonify({
            "type": "query",
            "response": result["data"],
            "references": result.get("references", [])
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ==================== LINE 通路 ====================

def _handle_line_message(tenant_id: str, line, text: str, user_id: str, reply_token: str):
    """背景處理 LINE 訊息：意圖路由 → process_message → markdown 降級 → reply/push。

    LINE 行為與 web 一致：永遠做意圖分流，候選服務由各服務的「啟用服務」決定。
    """
    from utils.markdown_converter import to_plain_text, format_references
    try:
        tenant = tenant_manager.get_tenant(tenant_id)
        mode = classify_intent(tenant_id, tenant, text)
        lang_code = _detect_message_language(tenant, text)

        result = process_message(tenant_id, tenant, text, user_id=user_id, mode=mode, lang=lang_code)
        reply_text = to_plain_text(result.get("response") or "")
        reply_text += format_references(result.get("references"))
        reply_text = reply_text.strip() or "抱歉，目前無法回覆，請稍後再試。"

        # 優先 reply token，逾時/失效則改 push
        try:
            line.reply(reply_token, reply_text)
        except Exception as e:
            print(f"[LINE] reply 失敗，改用 push: {e}")
            line.push(user_id, reply_text)
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            line.push(user_id, "抱歉，系統發生問題，請稍後再試。")
        except Exception:
            print(f"[LINE] fallback push 也失敗: {e}")


@app.route("/webhook/line/<tenant_id>", methods=["POST"])
def line_webhook(tenant_id):
    """LINE webhook 入口（每租戶一個 URL）。立即回 200，AI 處理丟背景。"""
    signature = request.headers.get("X-Line-Signature", "")
    body = request.get_data(as_text=True)

    tenant = tenant_manager.get_tenant(tenant_id)
    line_cfg = (tenant or {}).get("line") or {}
    if not tenant or not line_cfg.get("enabled"):
        return "Not Found", 404

    token = line_cfg.get("channel_access_token")
    secret = line_cfg.get("channel_secret")
    if not token or not secret:
        return "LINE not configured", 503

    from services.line_service import LineService
    from linebot.v3.exceptions import InvalidSignatureError
    from linebot.v3.webhooks import MessageEvent, TextMessageContent

    line = LineService(token, secret)
    try:
        events = line.parse(body, signature)
    except InvalidSignatureError:
        return "Invalid signature", 400

    for event in events:
        # 僅處理文字訊息事件（非文字略過）
        if isinstance(event, MessageEvent) and isinstance(event.message, TextMessageContent):
            user_id = event.source.user_id
            # 立即顯示 loading 動畫，背景跑 AI
            line.show_loading(user_id)
            _line_pool.submit(
                _handle_line_message, tenant_id, line, event.message.text,
                user_id, event.reply_token,
            )

    return "OK", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

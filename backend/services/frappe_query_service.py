"""
通用 Frappe Query Service — config 驅動
DocType、欄位、關聯查詢全部由 tenant JSON 的 frappe.queries 定義
"""
import os
import json
import requests
from typing import Dict, Optional, List
from google import genai
from google.genai import types
from services.chat_service import ChatService


class FrappeQueryService(ChatService):
    """從 Frappe ERP 即時查詢資料，再用 Gemini 生成自然語言回答"""

    def __init__(self, api_key: str, service_name: str = "frappe",
                 tenant_id: str = "default", default_temperature: float = 0.3,
                 default_use_grounding: bool = False,
                 default_search_keyword: str = None, config: Dict = None):
        super().__init__(
            api_key=api_key,
            service_name=service_name,
            tenant_id=tenant_id,
            default_temperature=default_temperature,
            default_use_grounding=default_use_grounding,
            default_search_keyword=default_search_keyword,
            config=config
        )

        # 保留 api_key 給 intent 解析用
        self.api_key = api_key

        frappe_cfg = (config or {}).get("frappe", {})

        self.frappe_url = frappe_cfg.get("url") or os.getenv("FRAPPE_URL", "")
        self.frappe_token = (
            frappe_cfg.get("api_key") or os.getenv("FRAPPE_API_KEY", "")
        ) + ":" + (
            frappe_cfg.get("api_secret") or os.getenv("FRAPPE_API_SECRET", "")
        )

        # 核心：從 config 讀查詢定義
        self.queries = frappe_cfg.get("queries", [])

        if not self.frappe_url:
            raise ValueError(f"[FrappeQueryService] 缺少 FRAPPE_URL，tenant={tenant_id}")
        if not self.queries:
            raise ValueError(f"[FrappeQueryService] 缺少 frappe.queries 設定，tenant={tenant_id}")

        print(f"[FrappeQueryService] 初始化: tenant={tenant_id}, "
              f"url={self.frappe_url}, doctypes={[q['doctype'] for q in self.queries]}")

    # ── Frappe REST 基礎 ─────────────────────────────────────────────

    @property
    def _headers(self):
        return {"Authorization": f"token {self.frappe_token}"}

    def _get_list(self, doctype: str, filters: list = None,
                  fields: list = None, limit: int = 50) -> list:
        """查詢 DocType 列表"""
        params = {"limit_page_length": limit}
        if fields:
            params["fields"] = json.dumps(fields)
        if filters:
            params["filters"] = json.dumps(filters)
        try:
            resp = requests.get(
                f"{self.frappe_url}/api/resource/{doctype}",
                headers=self._headers,
                params=params,
                timeout=8,
            )
            resp.raise_for_status()
            return resp.json().get("data", [])
        except requests.exceptions.Timeout:
            print(f"[FrappeQueryService] {doctype} 查詢逾時")
            return []
        except requests.exceptions.HTTPError as e:
            print(f"[FrappeQueryService] {doctype} HTTP 錯誤: {e}")
            return []
        except Exception as e:
            print(f"[FrappeQueryService] {doctype} 查詢失敗: {e}")
            return []

    def _get_single(self, doctype: str, name: str,
                    fields: list = None) -> dict:
        """查詢單筆文件"""
        params = {}
        if fields:
            params["fields"] = json.dumps(fields)
        try:
            resp = requests.get(
                f"{self.frappe_url}/api/resource/{doctype}/{name}",
                headers=self._headers,
                params=params,
                timeout=8,
            )
            resp.raise_for_status()
            return resp.json().get("data", {})
        except Exception as e:
            print(f"[FrappeQueryService] {doctype}/{name} 查詢失敗: {e}")
            return {}

    # ── config 驅動的查詢執行 ────────────────────────────────────────

    def _execute_query(self, query_def: dict, search_term: str = None,
                       matched_field: str = None) -> list:
        """
        根據 query_def 執行主資料查詢
        matched_field: AI 配對時用的欄位，優先用精確比對
        """
        doctype = query_def["doctype"]
        fields = query_def.get("fields")
        static_filters = query_def.get("static_filters", [])
        search_fields = query_def.get("search_fields", [])
        limit = query_def.get("limit", 20)

        filters = list(static_filters)
        if search_term:
            # AI 已經從清單中選出完整名稱，用 like 仍可命中
            field = matched_field if matched_field in search_fields else (
                search_fields[0] if search_fields else "name"
            )
            filters.append([field, "like", f"%{search_term}%"])

        return self._get_list(doctype, filters=filters or None,
                              fields=fields, limit=limit)

    def _execute_linked_query(self, link_def: dict,
                              parent_rows: list) -> dict:
        """
        執行關聯查詢（類似 JOIN）

        link_def 結構：
        {
          "doctype": "Bin",
          "link_field": "item_code",
          "parent_field": "item_code",
          "fields": ["item_code", "actual_qty", ...],
          "static_filters": [["warehouse", "=", "Stores - cceye"]],
          "merge_key": "item_code",
          "alias": "stock"
        }
        """
        if not parent_rows:
            return {}

        doctype = link_def["doctype"]
        link_field = link_def["link_field"]
        parent_field = link_def.get("parent_field", link_field)
        fields = link_def.get("fields")
        static_filters = link_def.get("static_filters", [])

        # 收集所有 parent 的 key 值
        keys = list({
            row.get(parent_field)
            for row in parent_rows
            if row.get(parent_field)
        })

        result_map = {}
        for key in keys:
            filters = list(static_filters) + [[link_field, "=", key]]
            rows = self._get_list(doctype, filters=filters, fields=fields)
            result_map[key] = rows

        return result_map

    def _build_context(self, search_term: str = None,
                       matched_field: str = None) -> list:
        """按照 self.queries 順序查詢，把關聯資料 merge 進主資料"""
        if not self.queries:
            return []

        # 第一個 query 是主資料
        primary_def = self.queries[0]
        primary_rows = self._execute_query(primary_def, search_term=search_term,
                                           matched_field=matched_field)

        if not primary_rows:
            return []

        # 後續 query 是關聯資料
        for link_def in self.queries[1:]:
            result_map = self._execute_linked_query(link_def, primary_rows)
            merge_key = link_def.get("merge_key",
                                     link_def.get("parent_field", "name"))
            alias = link_def.get("alias", link_def["doctype"].lower())

            for row in primary_rows:
                key = row.get(merge_key)
                linked_data = result_map.get(key, [])
                # 如果只有一筆，直接展平（方便 Gemini 閱讀）
                if len(linked_data) == 1:
                    row[alias] = linked_data[0]
                else:
                    row[alias] = linked_data

        return primary_rows

    # ── Intent 解析（AI 模糊配對）────────────────────────────────────

    def _get_item_names(self) -> list:
        """撈主 DocType 的名稱清單，供 AI 做模糊配對"""
        primary_def = self.queries[0]
        search_fields = primary_def.get("search_fields", [])
        # 只撈名稱欄位，輕量查詢
        fields = list(set(["name"] + search_fields[:2]))
        rows = self._get_list(
            primary_def["doctype"],
            filters=primary_def.get("static_filters") or None,
            fields=fields,
            limit=100,
        )
        # 組成易讀清單
        return [
            {f: row.get(f) for f in fields if row.get(f)}
            for row in rows
        ]

    def _parse_intent(self, message: str) -> dict:
        """
        用 Gemini 做模糊配對：
        1. 先撈所有品項名稱清單
        2. 讓 AI 從清單中找出使用者想查的品項
        3. 回傳精確的 search_term（來自清單），確保 LIKE 一定命中
        """
        client = genai.Client(api_key=self.api_key)

        # 撈品項清單給 AI 參考
        item_names = self._get_item_names()
        names_str = json.dumps(item_names, ensure_ascii=False)

        prompt = f"""你是查詢意圖解析器。根據使用者問題和資料庫中的品項清單，輸出 JSON。

【資料庫品項清單】
{names_str}

【規則】
1. 如果使用者問的是特定品項，從清單中找出最匹配的，把清單中的「完整名稱」填入 search_term
2. 如果使用者想查全部/列表/統計，search_term 填 null
3. 使用者可能用簡稱、別名、部分名稱，你要智慧配對到清單中最接近的品項

【輸出格式】
{{
  "search_term": "從清單中選出的完整名稱，或 null",
  "query_type": "single | list | summary",
  "matched_field": "配對用的欄位名稱（如 item_name 或 name）"
}}

使用者問題：{message}
只輸出 JSON。"""

        try:
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
            text = resp.text.strip().strip("```json").strip("```").strip()
            return json.loads(text)
        except Exception as e:
            print(f"[FrappeQueryService] intent 解析失敗: {e}")
            return {"search_term": None, "query_type": "list"}

    # ── 主流程（覆寫 ChatService.chat）────────────────────────────────

    def chat(self, message: str, user_id: str = "default",
             response_language: Optional[str] = None, **kwargs) -> Dict:
        """
        主流程：intent 解析 → Frappe 查詢 → Gemini 生成回答

        Returns:
            {"response": str, "references": list}
        """
        # Step 1: 解析意圖（AI 模糊配對）
        intent = self._parse_intent(message)
        search_term = intent.get("search_term")
        matched_field = intent.get("matched_field")
        print(f"[FrappeQueryService] tenant={self.tenant_id}, intent={intent}")

        # Step 2: 查 Frappe 組裝資料
        context = self._build_context(search_term=search_term,
                                      matched_field=matched_field)

        if not context:
            msg = (
                f"找不到「{search_term}」的相關資料，請確認名稱是否正確。"
                if search_term
                else "目前查無資料，請確認系統連線是否正常。"
            )
            return {"response": msg, "references": []}

        # Step 3: Gemini 生成回答
        return self._generate_answer(message, context, response_language)

    def _generate_answer(self, message: str, context: list,
                         response_language: Optional[str] = None) -> Dict:
        """把 Frappe 資料塞進 prompt 讓 Gemini 回答"""
        client = genai.Client(api_key=self.api_key)

        ctx_str = json.dumps(context, ensure_ascii=False, indent=2)
        lang_note = f"\n請用{response_language}回答。" if response_language else ""

        prompt = f"""{self.SYSTEM_PROMPT}

【即時資料（來自 ERP 系統）】
{ctx_str}

使用者問題：{message}{lang_note}"""

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        # 空白訊息調查 log
        if not resp.text or not resp.text.strip():
            print(f"[FrappeQueryService] 🚨 空白訊息調查: _generate_answer 回傳空白! tenant={self.tenant_id}, msg='{message[:50]}'")
            print(f"  - candidates: {bool(resp.candidates)}")
            if resp.candidates:
                print(f"  - finish_reason: {getattr(resp.candidates[0], 'finish_reason', None)}")
            # 自動 retry 一次
            print(f"[FrappeQueryService] ⚠️ 回應為空，自動 retry...")
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            if not resp.text or not resp.text.strip():
                print(f"[FrappeQueryService] ⚠️ retry 仍為空，使用 fallback 訊息")
                return {"response": "抱歉，AI 模型暫時無法回應，請稍後再試一次~~~", "references": []}
        return {
            "response": resp.text,
            "references": [],
        }

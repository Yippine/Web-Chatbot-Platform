"""
Frappe 模組預設查詢模板
使用者選模組時，前端自動帶入 queries 設定，不需要手寫 JSON
"""

FRAPPE_MODULE_TEMPLATES = {

    "drug_inventory": {
        "label": "藥品庫存",
        "icon": "💊",
        "description": "查詢藥品品項、即時庫存數量、批號效期",
        "default_prompt": """# 角色設定
你是藥品庫存查詢助理。

## 回答規則
1. 直接說出藥品名稱、庫存數量、單位
2. 庫存 ≤ 補貨警戒線時標註「⚠️ 需要補貨」
3. 有效期限資訊存在時一併告知
4. 找不到資料時明確說明，不猜測
5. 使用繁體中文回答""",
        "queries": [
            {
                "doctype": "Item",
                "fields": ["item_code", "item_name", "stock_uom", "description", "item_group"],
                "search_fields": ["item_name", "item_code", "description"],
                "static_filters": [["item_group", "=", "Drug"]],
                "limit": 20
            },
            {
                "doctype": "Bin",
                "link_field": "item_code",
                "parent_field": "item_code",
                "merge_key": "item_code",
                "alias": "stock",
                "fields": ["item_code", "warehouse", "actual_qty", "reserved_qty", "ordered_qty", "projected_qty"],
                "static_filters": []
            },
            {
                "doctype": "Batch",
                "link_field": "item",
                "parent_field": "item_code",
                "merge_key": "item_code",
                "alias": "batches",
                "fields": ["name", "item", "expiry_date", "manufacturing_date"],
                "static_filters": [["disabled", "=", 0]]
            }
        ]
    },

    "purchase": {
        "label": "進貨管理",
        "icon": "📦",
        "description": "查詢採購單狀態、供應商、到貨進度",
        "default_prompt": """# 角色設定
你是進貨查詢助理。

## 回答規則
1. 說明採購單號、供應商、金額、狀態
2. 列出採購明細時包含品項名稱和數量
3. 標註已收貨比例
4. 使用繁體中文回答""",
        "queries": [
            {
                "doctype": "Purchase Order",
                "fields": ["name", "supplier", "transaction_date", "grand_total", "status", "per_received"],
                "search_fields": ["supplier", "name"],
                "static_filters": [],
                "limit": 20
            },
            {
                "doctype": "Purchase Order Item",
                "link_field": "parent",
                "parent_field": "name",
                "merge_key": "name",
                "alias": "items",
                "fields": ["item_code", "item_name", "qty", "rate", "amount", "received_qty"]
            }
        ]
    },

    "sales": {
        "label": "銷貨管理",
        "icon": "🧾",
        "description": "查詢銷貨單、客戶訂單、出貨進度",
        "default_prompt": """# 角色設定
你是銷貨查詢助理。

## 回答規則
1. 說明訂單號、客戶名稱、金額、狀態
2. 列出銷貨明細時包含品項和數量
3. 標註已出貨比例
4. 使用繁體中文回答""",
        "queries": [
            {
                "doctype": "Sales Order",
                "fields": ["name", "customer", "transaction_date", "grand_total", "status", "per_delivered"],
                "search_fields": ["customer", "name"],
                "static_filters": [],
                "limit": 20
            },
            {
                "doctype": "Sales Order Item",
                "link_field": "parent",
                "parent_field": "name",
                "merge_key": "name",
                "alias": "items",
                "fields": ["item_code", "item_name", "qty", "rate", "amount", "delivered_qty"]
            }
        ]
    },

    "stock_entry": {
        "label": "庫存異動",
        "icon": "🔄",
        "description": "查詢入庫、出庫、調撥等庫存異動紀錄",
        "default_prompt": """# 角色設定
你是庫存異動查詢助理。

## 回答規則
1. 說明異動類型（入庫/出庫/調撥）、日期、狀態
2. 列出異動明細的品項、數量、來源/目標倉庫
3. 使用繁體中文回答""",
        "queries": [
            {
                "doctype": "Stock Entry",
                "fields": ["name", "stock_entry_type", "posting_date", "docstatus", "from_warehouse", "to_warehouse"],
                "search_fields": ["name", "stock_entry_type"],
                "static_filters": [],
                "limit": 20
            },
            {
                "doctype": "Stock Entry Detail",
                "link_field": "parent",
                "parent_field": "name",
                "merge_key": "name",
                "alias": "items",
                "fields": ["item_code", "item_name", "qty", "s_warehouse", "t_warehouse", "batch_no"]
            }
        ]
    },

    "custom": {
        "label": "自訂",
        "icon": "⚙️",
        "description": "手動設定 DocType 和查詢欄位",
        "default_prompt": "",
        "queries": []
    }
}

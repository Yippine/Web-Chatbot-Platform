"""從掛載進來的 tenants.json 讀取指定分類（預設「汽車」）的租戶清單"""
import json
import os
from pathlib import Path

TENANTS_CONFIG_PATH = Path(os.environ.get("TENANTS_CONFIG_PATH", "/app/data/tenants.json"))


def load_tenants_by_category(category_id: str = "car") -> list[str]:
    with open(TENANTS_CONFIG_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    return [
        tenant_id
        for tenant_id, tenant in data.items()
        if tenant.get("category_id") == category_id and tenant.get("enabled", True)
    ]

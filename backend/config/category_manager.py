"""
分類設定管理器
負責載入和管理品牌分類設定（智慧行銷處/教案/汽車等）
"""
import json
import os
from typing import Dict, Optional


class CategoryManager:
    """分類設定管理器"""

    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.environ.get(
                'CATEGORIES_CONFIG_PATH',
                os.path.join(os.path.dirname(__file__), 'categories.json')
            )
        self.config_path = config_path
        self.categories = {}
        self.load_categories()

    def load_categories(self):
        """從 JSON 載入所有分類設定"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.categories = json.load(f)
                print(f"[CategoryManager] 載入 {len(self.categories)} 個分類設定")
            else:
                print(f"[CategoryManager] 設定檔不存在: {self.config_path}")
                self.categories = {}
        except Exception as e:
            print(f"[CategoryManager] 載入設定失敗: {e}")
            self.categories = {}

    def reload(self):
        """重新載入設定 (支援熱更新)"""
        self.load_categories()

    def list_categories(self, auto_reload: bool = True) -> Dict:
        """列出所有分類"""
        if auto_reload:
            self.load_categories()
        return self.categories

    def get_category(self, category_id: str) -> Optional[Dict]:
        """取得特定分類設定"""
        return self.categories.get(category_id)

    def category_exists(self, category_id: str) -> bool:
        """檢查分類是否存在"""
        return category_id in self.categories

    def create_category(self, category_id: str, name: str) -> Dict:
        """建立新分類，回傳建立後的分類物件"""
        self.load_categories()
        if category_id in self.categories:
            raise ValueError("分類 ID 已存在")

        new_category = {"id": category_id, "name": name}
        self.categories[category_id] = new_category
        self._save()
        return new_category

    def rename_category(self, category_id: str, name: str) -> Dict:
        """重新命名分類，回傳更新後的分類物件"""
        self.load_categories()
        if category_id not in self.categories:
            raise KeyError("分類不存在")

        self.categories[category_id]["name"] = name
        self._save()
        return self.categories[category_id]

    def delete_category(self, category_id: str):
        """刪除分類（呼叫端須自行確認底下無租戶歸屬）"""
        self.load_categories()
        if category_id not in self.categories:
            raise KeyError("分類不存在")

        del self.categories[category_id]
        self._save()

    def _save(self):
        """寫回設定檔"""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.categories, f, ensure_ascii=False, indent=2)

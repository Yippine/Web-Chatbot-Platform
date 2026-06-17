#!/bin/bash
# 恢復敏感檔案和圖片
# 用法：./script/restore-sensitive.sh <備份檔> <密碼>
#
# 範例：
#   ./script/restore-sensitive.sh sensitive-backup-20250617_143022.tar.gz "MySecurePassword123"
#
# 💡 提示：
#   - 一定要輸入正確的密碼
#   - 會覆寫現有檔案（請備份）
#   - 恢復後檢查檔案是否正確

set -e

BACKUP_FILE="$1"
PASSWORD="$2"

# 檢查參數
if [ -z "$BACKUP_FILE" ] || [ -z "$PASSWORD" ]; then
  echo "❌ 錯誤：缺少必要參數"
  echo ""
  echo "用法："
  echo "  ./script/restore-sensitive.sh <備份檔> <密碼>"
  echo ""
  echo "範例："
  echo "  ./script/restore-sensitive.sh sensitive-backup-20250617_143022.tar.gz 'MySecurePass123'"
  echo ""
  echo "可用的備份檔（當前目錄）："
  ls -1 sensitive-backup-*.tar.gz 2>/dev/null || echo "  （未找到備份檔）"
  exit 1
fi

# 檢查備份檔是否存在
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ 錯誤：找不到備份檔 '$BACKUP_FILE'"
  echo ""
  echo "當前目錄中的備份檔："
  ls -1 sensitive-backup-*.tar.gz 2>/dev/null || echo "  （未找到任何備份檔）"
  exit 1
fi

echo "📦 開始恢復..."
echo "📂 備份檔：$BACKUP_FILE"
echo ""

# 臨時目錄
TEMP_DIR=".restore-temp-$$"
mkdir -p "$TEMP_DIR"

trap "rm -rf '$TEMP_DIR'" EXIT

echo "🔓 解壓縮（驗證密碼）..."

# 解壓縮（使用密碼）
if unzip -P "$PASSWORD" -q "$BACKUP_FILE" -d "$TEMP_DIR" 2>/dev/null; then
  echo "✅ 解壓成功"
else
  echo "❌ 解壓失敗（密碼錯誤？）"
  exit 1
fi

echo ""
echo "📋 找到的檔案："
find "$TEMP_DIR" -type f | while read file; do
  REL_PATH="${file#$TEMP_DIR/.sensitive-backup-temp/}"
  echo "   - $REL_PATH"
done

echo ""
echo "🚀 恢復檔案到正確位置..."

RESTORE_COUNT=0

# 恢復 backend/.env
if [ -f "$TEMP_DIR/.sensitive-backup-temp/backend/.env" ]; then
  echo "📝 恢復 backend/.env"
  mkdir -p backend
  cp "$TEMP_DIR/.sensitive-backup-temp/backend/.env" backend/.env
  RESTORE_COUNT=$((RESTORE_COUNT + 1))
fi

# 恢復根目錄 .env
if [ -f "$TEMP_DIR/.sensitive-backup-temp/.env" ]; then
  echo "📝 恢復 .env"
  cp "$TEMP_DIR/.sensitive-backup-temp/.env" .env
  RESTORE_COUNT=$((RESTORE_COUNT + 1))
fi

# 恢復圖片
if [ -d "$TEMP_DIR/.sensitive-backup-temp/images" ]; then
  echo "📝 恢復 backend/data/images/"
  mkdir -p backend/data
  rm -rf backend/data/images  # 覆寫舊圖片
  cp -r "$TEMP_DIR/.sensitive-backup-temp/images" backend/data/images
  RESTORE_COUNT=$((RESTORE_COUNT + 1))

  IMAGE_COUNT=$(find backend/data/images -type f | wc -l)
  IMAGE_SIZE=$(du -sh backend/data/images | cut -f1)
  echo "   └─ 圖片數量：$IMAGE_COUNT，大小：$IMAGE_SIZE"
fi

# 恢復 tenants.json
if [ -f "$TEMP_DIR/.sensitive-backup-temp/tenants.json" ]; then
  echo "📝 恢復 backend/data/tenants.json"
  mkdir -p backend/data
  cp "$TEMP_DIR/.sensitive-backup-temp/tenants.json" backend/data/tenants.json
  RESTORE_COUNT=$((RESTORE_COUNT + 1))
fi

echo ""
echo "✅ 恢復完成！"
echo "📊 恢復的項目：$RESTORE_COUNT"

# 驗證恢復的檔案
echo ""
echo "🔍 驗證恢復的檔案："
[ -f "backend/.env" ] && echo "   ✅ backend/.env ($(wc -l < backend/.env) 行)" || echo "   ❌ backend/.env 不存在"
[ -f ".env" ] && echo "   ✅ .env ($(wc -l < .env) 行)" || echo "   ❌ .env 不存在"
[ -d "backend/data/images" ] && echo "   ✅ backend/data/images ($(find backend/data/images -type f | wc -l) 檔案)" || echo "   ❌ backend/data/images 不存在"
[ -f "backend/data/tenants.json" ] && echo "   ✅ backend/data/tenants.json" || echo "   ❌ backend/data/tenants.json 不存在"

echo ""
echo "⚠️  重要提示："
echo "   - 確認上述檔案都已恢復"
echo "   - 檢查 backend/.env 中的 API Key 是否正確"
echo "   - 本機開發時 .env 和 backend/.env 不應進入 Git"
echo ""
echo "✨ 恢復完成！"

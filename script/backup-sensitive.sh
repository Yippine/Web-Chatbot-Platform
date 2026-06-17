#!/bin/bash
# 打包敏感檔案和大檔案（加密）
# 用法：./script/backup-sensitive.sh [password]
#
# 範例：
#   ./script/backup-sensitive.sh "MySecurePassword123"
#   → 輸出：sensitive-backup-20250617_143022.tar.gz
#
# 💡 提示：
#   - 設定強密碼（大小寫 + 數字 + 符號）
#   - 上傳到雲端後刪除本地檔案
#   - 密碼保存在安全地方（密碼管理器）

set -e

# 設置
BACKUP_DIR=".sensitive-backup-temp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="sensitive-backup-${TIMESTAMP}.tar.gz"
PASSWORD="${1:-}"

# 檢查密碼
if [ -z "$PASSWORD" ]; then
  echo "❌ 錯誤：需要密碼參數"
  echo ""
  echo "用法：./script/backup-sensitive.sh <password>"
  echo ""
  echo "範例："
  echo "  ./script/backup-sensitive.sh 'MySecurePass123'"
  exit 1
fi

echo "📦 開始打包敏感檔案和圖片..."
echo "⏰ 時間戳：$TIMESTAMP"
echo ""

# 清理舊的臨時目錄
rm -rf $BACKUP_DIR
mkdir -p $BACKUP_DIR

# 計數器
COUNT=0

# 複製 backend/.env
if [ -f "backend/.env" ]; then
  echo "✅ 複製 backend/.env"
  mkdir -p $BACKUP_DIR/backend
  cp backend/.env $BACKUP_DIR/backend/.env
  COUNT=$((COUNT + 1))
else
  echo "⚠️  backend/.env 不存在（跳過）"
fi

# 複製根目錄 .env
if [ -f ".env" ]; then
  echo "✅ 複製 .env"
  cp .env $BACKUP_DIR/
  COUNT=$((COUNT + 1))
else
  echo "⚠️  .env 不存在（跳過）"
fi

# 複製圖片目錄
if [ -d "backend/data/images" ]; then
  echo "✅ 複製 backend/data/images/ (圖片)"
  cp -r backend/data/images $BACKUP_DIR/
  COUNT=$((COUNT + 1))

  # 顯示圖片統計
  IMAGE_COUNT=$(find $BACKUP_DIR/images -type f 2>/dev/null | wc -l)
  IMAGE_SIZE=$(du -sh $BACKUP_DIR/images 2>/dev/null | cut -f1)
  echo "   └─ 圖片數量：$IMAGE_COUNT，大小：$IMAGE_SIZE"
else
  echo "⚠️  backend/data/images 不存在（跳過）"
fi

# 複製 tenants.json
if [ -f "backend/data/tenants.json" ]; then
  echo "✅ 複製 backend/data/tenants.json"
  cp backend/data/tenants.json $BACKUP_DIR/
  COUNT=$((COUNT + 1))
else
  echo "⚠️  backend/data/tenants.json 不存在（跳過）"
fi

# 複製 nginx.conf（路由設定，不含機敏資訊，但不在 git 追蹤範圍時作為備援）
if [ -f "nginx.conf" ]; then
  echo "✅ 複製 nginx.conf"
  cp nginx.conf $BACKUP_DIR/
  COUNT=$((COUNT + 1))
else
  echo "⚠️  nginx.conf 不存在（跳過）"
fi

echo ""
echo "📊 統計："
echo "   - 打包的檔案數：$COUNT 項"

# 計算要備份的總大小
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
echo "   - 總大小：$BACKUP_SIZE"

echo ""
echo "🔐 壓縮並加密（ZIP + 密碼）..."

# 用 zip 壓縮並加密
# -r: 遞迴
# -e: 加密
# -P: 指定密碼（非互動）
zip -r -e -P "$PASSWORD" "$BACKUP_FILE" "$BACKUP_DIR" > /dev/null 2>&1

# 驗證壓縮檔
if [ -f "$BACKUP_FILE" ]; then
  FINAL_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ 壓縮完成"
  echo ""
  echo "📦 備份檔案資訊："
  echo "   - 檔名：$BACKUP_FILE"
  echo "   - 大小：$FINAL_SIZE"
  echo "   - 位置：$(pwd)/$BACKUP_FILE"
  echo ""
  echo "🎯 後續步驟："
  echo "   1. 上傳 $BACKUP_FILE 到你的雲端硬碟"
  echo "   2. 驗證上傳成功後，執行："
  echo "      rm $BACKUP_FILE"
  echo "      rm -rf $BACKUP_DIR"
  echo ""
  echo "💾 恢復時使用："
  echo "   ./script/restore-sensitive.sh <備份檔> <密碼>"
  echo ""
else
  echo "❌ 壓縮失敗"
  rm -rf $BACKUP_DIR
  exit 1
fi

# 清理臨時目錄
rm -rf $BACKUP_DIR

echo "✨ 完成！"

# 🚀 快速開始

## 現在就做（5 分鐘）

### 步驟 1：建立首次備份

```bash
# 運行備份腳本（指定強密碼）
./script/backup-sensitive.sh "YourStrongPassword123"

# 輸出：sensitive-backup-20250617_143022.tar.gz
```

### 步驟 2：上傳到雲端

**手動上傳到 Google Drive（推薦）：**
1. 打開 Google Drive
2. 建立資料夾：`web-chatbot-sensitive-backup`
3. **權限設定：僅你可以存取**（不分享）
4. 上傳 `sensitive-backup-20250617_143022.tar.gz`
5. 驗證上傳成功

### 步驟 3：保存密碼

用密碼管理器存保密碼：
- 服務：Web Chatbot Backup
- 密碼：YourStrongPassword123

### 步驟 4：刪除本機備份

```bash
# 確認已上傳到雲端後執行
rm sensitive-backup-20250617_143022.tar.gz
```

---

## 下次設定新機器時

### 從雲端恢復

```bash
# 1. Clone 專案
git clone https://github.com/Yippine/Web-Chatbot-Platform.git
cd Web-Chatbot-Platform

# 2. 從 Google Drive 下載 sensitive-backup-*.tar.gz

# 3. 恢復敏感檔案
./script/restore-sensitive.sh sensitive-backup-20250617_143022.tar.gz "YourStrongPassword123"

# 完成！可以開始開發了
```

---

## 每次修改敏感信息時

```bash
# 1. 修改 backend/.env 或 .env
nano backend/.env

# 2. 建立新備份
./script/backup-sensitive.sh "YourStrongPassword123"

# 3. 上傳到雲端

# 4. 清理舊備份
rm sensitive-backup-old.tar.gz

# 5. Git 提交（不含敏感檔案）
git add backend/data/tenants.json
git commit -m "update: tenant configuration"
git push
```

---

## 📚 詳細文檔

完整說明請查看：[BACKUP-RESTORE-GUIDE.md](BACKUP-RESTORE-GUIDE.md)

---

## ⚠️ 重要提醒

| ✅ 應該 | ❌ 不應該 |
|--------|---------|
| 定期備份 | 把備份上傳到 GitHub |
| 密碼放密碼管理器 | 密碼寫在程式碼裡 |
| 敏感檔案不入 Git | 分享備份檔給別人 |
| 雲端只保留備份檔 | 自動化連接雲端 |

---

## 🆘 遇到問題？

查看 [BACKUP-RESTORE-GUIDE.md](BACKUP-RESTORE-GUIDE.md) 的**故障排除**章節。

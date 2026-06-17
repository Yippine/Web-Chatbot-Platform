# 敏感檔案備份和恢復指南

本指南說明如何備份和恢復敏感檔案（API Key、環境變數、品牌圖片等）。

---

## 📋 備份包含的內容

```
sensitive-backup-20250617_143022.tar.gz (加密)
├── backend/.env                    ← API Key（機敏）
├── .env                           ← 環境變數（機敏）
├── images/                        ← 品牌 Chat 圖片
│   ├── tenants/second_hand_car/
│   ├── tenants/leosys/
│   └── ... (其他品牌)
└── tenants.json                   ← 品牌配置
```

---

## 🔐 第一次設定：建立備份

### 步驟 1：準備敏感檔案

確保你有以下檔案（如果缺少會跳過）：

```bash
# 檢查檔案是否存在
ls -la backend/.env
ls -la .env
ls -la backend/data/images/
ls -la backend/data/tenants.json
```

### 步驟 2：建立備份

運行備份腳本（指定強密碼）：

```bash
chmod +x script/backup-sensitive.sh
./script/backup-sensitive.sh "MySecurePassword123"
```

**密碼要求：**
- ✅ 至少 12 個字符
- ✅ 包含大寫、小寫、數字、特殊符號
- ❌ 不要用簡單密碼或個人信息

**輸出範例：**
```
📦 開始打包敏感檔案和圖片...
✅ 複製 backend/.env
✅ 複製 .env
✅ 複製 backend/data/images/ (圖片)
   └─ 圖片數量：8，大小：2.3M
✅ 複製 backend/data/tenants.json

🔐 壓縮並加密...
✅ 壓縮完成

📦 備份檔案資訊：
   - 檔名：sensitive-backup-20250617_143022.tar.gz
   - 大小：1.5M
   - 位置：/path/to/project/sensitive-backup-20250617_143022.tar.gz
```

### 步驟 3：上傳到雲端

**Google Drive 上傳（推薦）：**
1. 打開 Google Drive
2. 創建新資料夾：`web-chatbot-sensitive-backup`
3. 設定資料夾權限：**只有你可以訪問**（不分享）
4. 上傳 `sensitive-backup-*.tar.gz` 檔案
5. 驗證上傳成功

**上傳後清理本機：**
```bash
# ⚠️ 只在確認已上傳到雲端後執行
rm sensitive-backup-20250617_143022.tar.gz
```

### 步驟 4：保存密碼

將備份密碼存在**密碼管理器**（例如：1Password, LastPass, Bitwarden）：

```
服務：Web Chatbot Platform Backup
網址：https://drive.google.com/drive/folders/YOUR_FOLDER_ID
帳號：（你的 Google 帳號）
密碼：MySecurePassword123
備註：sensitive-backup-*.tar.gz 的解密密碼
```

---

## 🚀 跨設備同步：恢復敏感檔案

### 場景 1：本機開發環境設定

**新機器（本機開發）步驟：**

```bash
# 1. Clone 專案
git clone https://github.com/Yippine/Web-Chatbot-Platform.git
cd Web-Chatbot-Platform

# 2. 從雲端下載備份檔
# 手動：打開 Google Drive → 下載 sensitive-backup-*.tar.gz
# 或用命令行（如果有 gdrive 工具）：
gdrive files download FILE_ID

# 3. 恢復敏感檔案
chmod +x script/restore-sensitive.sh
./script/restore-sensitive.sh sensitive-backup-20250617_143022.tar.gz "MySecurePassword123"
```

**驗證恢復：**
```bash
# 檢查是否成功恢復
ls -la backend/.env
ls -la .env
ls -la backend/data/images/ | head -5
```

### 場景 2：正式環境部署

**在正式環境伺服器上：**

```bash
# 1. Clone 專案（或 pull 最新版本）
git pull origin main

# 2. 下載備份檔到伺服器
# 方式 1：從雲端手動下載後 SCP 上傳
scp sensitive-backup-*.tar.gz user@production:/path/to/

# 方式 2：在伺服器上直接下載
wget https://your-cloud-url/sensitive-backup-*.tar.gz

# 3. 恢復
cd /path/to/Web-Chatbot-Platform
chmod +x script/restore-sensitive.sh
./script/restore-sensitive.sh sensitive-backup-*.tar.gz "MySecurePassword123"

# 4. 重啟服務
docker compose restart backend admin
```

---

## ⚠️ 重要安全事項

### ✅ 應該做的事

- ✅ 定期備份（每次修改敏感信息後）
- ✅ 保存多個時間戳的備份（防止誤刪）
- ✅ 密碼存在密碼管理器
- ✅ 定期檢查雲端備份是否存在
- ✅ 敏感檔案不入 Git（`.gitignore` 已設定）
- ✅ 只在雲端備份驗證成功後刪除本機檔案

### ❌ 不應該做的事

- ❌ 把密碼寫在任何程式碼或設定檔中
- ❌ 在公開 GitHub 上傳備份檔
- ❌ 把備份檔上傳到免費、不安全的雲端
- ❌ 把自動化腳本連接到雲端（這會暴露認證令牌）
- ❌ 分享備份檔給不需要的人
- ❌ 使用簡單密碼

---

## 📌 Git 配置確保敏感檔案不洩露

### 檢查 .gitignore

```bash
# 檢查敏感檔案是否在 .gitignore 中
grep -E "\.env|backend/\.env|backend/data/images" .gitignore
```

**應該看到：**
```
backend/.env
.env
backend/data/images/
```

### 防誤提交檢查

```bash
# 確認敏感檔案未被追蹤
git status

# 應該看到 "clean" 或沒有 .env 和 backend/.env
# ❌ 如果看到 .env 或 backend/.env，執行：
git rm --cached backend/.env .env
git commit -m "remove: stop tracking sensitive .env files"
```

---

## 🔄 備份更新工作流

每當你修改敏感信息時（如新增 API Key、更新圖片）：

### 在開發機

```bash
# 1. 修改 backend/.env 或 .env
nano backend/.env

# 2. 建立新備份
./script/backup-sensitive.sh "MySecurePassword123"

# 3. 上傳到雲端
# 手動上傳或用命令行工具

# 4. 刪除本機舊備份
rm sensitive-backup-*.tar.gz  # 保留最新的，刪除舊的

# 5. Git 提交（不含敏感檔案）
git add backend/data/tenants.json  # 配置檔
git commit -m "update: tenant configuration"
git push origin main
```

### 在正式環境

```bash
# 1. 拉取最新代碼
git pull origin main

# 2. 下載最新備份
# （從雲端或開發機）

# 3. 恢復
./script/restore-sensitive.sh sensitive-backup-*.tar.gz "MySecurePassword123"

# 4. 重啟服務
docker compose restart backend admin
```

---

## 🆘 故障排除

### 問題 1：解壓失敗 - "密碼錯誤"

```bash
# 檢查備份檔完整性
unzip -t sensitive-backup-20250617_143022.tar.gz

# 如果完整但密碼錯誤，重試
# 注意：密碼區分大小寫
./script/restore-sensitive.sh backup.tar.gz "CorrectPassword"
```

### 問題 2：找不到備份檔

```bash
# 列出所有備份檔
ls -la sensitive-backup-*.tar.gz

# 檢查雲端是否有備份
# Google Drive → 搜尋 "sensitive-backup"
```

### 問題 3：圖片沒有恢復

```bash
# 手動檢查
unzip -l sensitive-backup-20250617_143022.tar.gz | grep images

# 如果備份檔中沒有 images，說明原本沒備份
# 重新從正式環境複製圖片到本機
```

### 問題 4：API Key 錯誤

```bash
# 檢查恢復的 .env
cat backend/.env | head -5

# 如果 API Key 看起來不對，可能是備份時錯誤
# 手動複製正確的 key
nano backend/.env
```

---

## 📊 備份管理

### 備份命名規則

```
sensitive-backup-YYYYMMDD_HHMMSS.tar.gz
├── 20250617_143022  ← 2025年6月17日 下午2時30分22秒
└── 加密，需密碼解壓
```

### 保留策略

- **本機**：只保留最新備份（其他刪除）
- **雲端**：保留最近 3-5 個備份（備份失敗時有回滾點）

```bash
# 查看備份歷史
ls -lt sensitive-backup-*.tar.gz | head -5

# 刪除舊備份（保留最新 3 個）
ls -1 sensitive-backup-*.tar.gz | head -n -3 | xargs rm
```

---

## 📝 檢查清單

**每次設定新機器時：**

- [ ] Clone 最新的 main 分支
- [ ] 從雲端下載最新的 sensitive-backup-*.tar.gz
- [ ] 運行 restore 腳本
- [ ] 驗證所有檔案已恢復（.env, backend/.env, images）
- [ ] 本機測試成功（能訪問後台、API 可用）
- [ ] 刪除本機備份檔

**每次修改敏感信息時：**

- [ ] 修改 backend/.env 或 .env
- [ ] 建立新備份
- [ ] 上傳到雲端
- [ ] 驗證上傳成功
- [ ] 刪除本機舊備份
- [ ] Git commit (不含敏感檔案)
- [ ] 推送到遠端

---

## ❓ 常見問題

**Q：密碼忘記了怎麼辦？**
A：備份檔無法恢復。保存密碼到密碼管理器很重要。新備份需要新密碼。

**Q：備份檔可以分享嗎？**
A：不可以。即使加密也不要分享。如果需要在另一台機器上，由你親自操作。

**Q：多久備份一次？**
A：每次修改敏感信息（新增 API Key、上傳新圖片、更新設定）後立即備份。

**Q：備份檔可以上傳到 GitHub 嗎？**
A：不行，即使是 Private Repo 也不安全。敏感文件不應該在任何 Git 倉庫中。

**Q：可以自動備份嗎？**
A：可以，但不要自動上傳到雲端（那樣會暴露認證令牌）。只建立本機備份，手動上傳。

---

## 📞 需要幫助？

如果恢復或備份出問題：

1. 檢查錯誤訊息
2. 查看本指南的「故障排除」部分
3. 驗證備份檔完整性：`unzip -t backup.tar.gz`
4. 確認使用正確的密碼和檔名

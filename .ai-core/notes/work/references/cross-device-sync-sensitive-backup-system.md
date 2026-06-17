---
created: 2025-06-17
modified: 2025-06-17
tags: [backup, security, deployment, cross-device-sync, api-key-management, infrastructure]
source_system: ai-generated
note_type: permanent
domain: work
---

# 跨設備同步：敏感檔案備份恢復系統

## 概述

針對多設備開發環境（本機開發 + 正式環境）的敏感檔案（API Key、環境變數、品牌圖片）同步方案。

**核心原則**：
- ✅ 敏感檔案不入 Git
- ✅ 備份加密後手動上傳雲端
- ✅ 跨設備恢復自動化

---

## 備份包含範圍

```
sensitive-backup-20250617_143022.tar.gz (ZIP 加密)
├── backend/.env              ← 全局 API Key、Redis、Frappe 設定
├── .env                     ← 環境變數（Nginx Port、DB密碼等）
├── images/                  ← 品牌 Chat 圖片（8+ 檔案）
└── tenants.json             ← 品牌配置（可選）
```

**檔案大小預期**：1-2 MB（加密）

---

## 執行流程

### Phase 1：建立首次備份（開發機）

**指令**：
```bash
./script/backup-sensitive.sh "YourStrongPassword123"
```

**密碼要求**：
- 12+ 字符
- 大小寫 + 數字 + 特殊符號
- 儲存在密碼管理器（1Password / LastPass / Bitwarden）

**輸出**：`sensitive-backup-20250617_143022.tar.gz`

### Phase 2：上傳到雲端（手動）

**為什麼手動而非自動化？**
- 自動上傳需要存儲雲端認證令牌在伺服器中 = 新的敏感信息源
- 手動上傳更安全，認證始終在本機

**步驟**：
1. 打開 Google Drive（或 OneDrive、Dropbox）
2. 建立私密資料夾：`web-chatbot-sensitive-backup`
3. **權限設定**：僅你可訪問（無公開連結）
4. 上傳 `sensitive-backup-*.tar.gz`
5. 驗證上傳完成

### Phase 3：本機清理

```bash
# 驗證上傳成功後刪除本機備份
rm sensitive-backup-20250617_143022.tar.gz
```

### Phase 4：跨設備恢復

**在新機器上**：
```bash
# 1. Clone 專案
git clone https://github.com/Yippine/Web-Chatbot-Platform.git
cd Web-Chatbot-Platform

# 2. 從雲端下載備份檔
# （手動：Google Drive → 下載）

# 3. 恢復
./script/restore-sensitive.sh sensitive-backup-20250617_143022.tar.gz "YourStrongPassword123"

# 驗證
ls -la backend/.env .env backend/data/images/
```

---

## 安全分析

### 威脅模型

| 威脅 | 現有防護 | 備註 |
|------|--------|------|
| API Key 在 Git 中洩露 | ✅ `.gitignore` 阻止 | 根本防護 |
| 備份檔未加密 | ✅ ZIP 密碼保護 | 強制加密 |
| 密碼洩露 | ✅ 密碼管理器 | 不存檔案 |
| 自動化工具洩露令牌 | ✅ 手動上傳 | 避免自動化 |
| AI Core Notes 被看到 | ✅ 無實際密鑰 | 只有流程 |

### 為什麼 AI Core Notes 安全？

```
❌ Notes 中 NOT：
   - 實際 API Key（用佔位符）
   - 實際密碼（用 "YourStrongPassword" 示例）
   - 密碼管理器位置（用通用術語）

✅ Notes 中 ONLY：
   - 執行流程
   - 命令語法
   - 安全原則
```

→ 駭客看到 Notes 也無法直接獲取敏感信息

---

## 日常工作流

### 情景 1：修改 API Key（開發機）

```bash
# 1. 編輯
nano backend/.env  # 新增或更新 API Key

# 2. 備份
./script/backup-sensitive.sh "密碼"

# 3. 上傳
# Google Drive → 上傳新備份檔

# 4. 清理
rm sensitive-backup-old.tar.gz

# 5. Git 提交（不含敏感檔案）
git add backend/data/tenants.json
git commit -m "update: tenant api key configuration"
git push origin main
```

### 情景 2：部署到正式環境

```bash
# 在正式環境伺服器上
cd /path/to/Web-Chatbot-Platform
git pull origin main

# 從開發機或雲端取得備份檔
scp user@local:/path/to/sensitive-backup-*.tar.gz .

# 恢復
./script/restore-sensitive.sh sensitive-backup-*.tar.gz "密碼"

# 重啟服務
docker compose restart backend admin

# 驗證
docker compose logs backend | grep "API Key"
```

### 情景 3：新人入職

```bash
# 1. Clone 專案
git clone <repo>

# 2. 聯絡你取得雲端備份檔
# （從 Google Drive 下載）

# 3. 恢復
./script/restore-sensitive.sh backup.tar.gz "密碼"

# 4. 開始開發
npm install
docker compose up
```

---

## 指令快速參考

| 動作 | 指令 |
|------|------|
| 建立備份 | `./script/backup-sensitive.sh "password"` |
| 恢復檔案 | `./script/restore-sensitive.sh backup.tar.gz "password"` |
| 驗證備份完整性 | `unzip -t backup.tar.gz` |
| 查看備份內容 | `unzip -l backup.tar.gz` |

---

## 備份維護策略

### 保留規則

**本機**：
- 只保留最新備份
- 上傳後刪除舊備份

**雲端**：
- 保留最近 3-5 個備份（防誤刪/版本回滾）
- 命名規則：`sensitive-backup-YYYYMMDD_HHMMSS.tar.gz`
- 定期清理超過 3 個月的舊備份

### 備份頻率

- **修改敏感信息後立即備份**（新增 API Key、上傳圖片）
- **重大部署後備份**（確保當前狀態可恢復）
- **每月定期驗證一次**（確保密碼正確、檔案完整）

---

## 故障排除

### 問題：密碼錯誤

```bash
# 檢查備份檔完整性
unzip -t sensitive-backup-20250617_143022.tar.gz

# 密碼提示：
# - 區分大小寫
# - 檢查密碼管理器中的版本
# - 如果全部失敗，需要新建備份
```

### 問題：圖片未恢復

```bash
# 查看備份檔內容
unzip -l backup.tar.gz | grep images

# 如果備份檔中沒有 images：
# → 說明原備份時沒複製
# → 手動從正式環境複製
```

### 問題：解壓失敗

```bash
# 檢查檔案是否損壞
ls -lh sensitive-backup-*.tar.gz

# 重新下載或使用其他備份
unzip -t other-backup.tar.gz
```

---

## 安全檢查清單

### 設定時（一次性）

- [ ] `.gitignore` 包含 `.env` 和 `backend/.env`
- [ ] `backend/.env.example` 已更新（模板無真實密鑰）
- [ ] 備份腳本可執行：`ls -la script/backup-sensitive.sh`
- [ ] 試運行備份和恢復（用測試密碼）

### 日常檢查

- [ ] 敏感檔案修改後立即備份
- [ ] 備份已上傳到雲端（驗證完整性）
- [ ] 本機舊備份已刪除
- [ ] 密碼妥善保管在密碼管理器

### 跨設備部署前

- [ ] 目標機器已 clone 最新 main
- [ ] 備份檔已從雲端下載
- [ ] 恢復指令已成功執行
- [ ] API Key 正確性已驗證
- [ ] 服務已重啟

---

## 相關資源

- 詳細文檔：`script/BACKUP-RESTORE-GUIDE.md`
- 快速開始：`script/QUICK-START.md`
- 備份腳本：`script/backup-sensitive.sh`
- 恢復腳本：`script/restore-sensitive.sh`
- 環境模板：`backend/.env.example`

---

## 設計決策記錄

### 為什麼用 ZIP 加密而非 GPG？

**ZIP**：
- ✅ 開箱即用，無依賴
- ✅ 密碼簡單易記
- ❌ 加密強度較弱（但密碼足夠強就夠用）

**GPG**：
- ✅ 加密強度更高
- ❌ 設定複雜，密鑰管理額外工作

→ 對小團隊，ZIP 密碼足以

### 為什麼不用 Git 密鑰管理（git-crypt）？

**原因**：
- ❌ 敏感文件根本不應在 Git 中（即使加密）
- ❌ 洩露風險仍然存在（加密文件本身就是目標）
- ✅ 完全分離（Git 只有代碼，備份獨立存儲）更安全

### 為什麼不用 CI/CD 自動部署？

**原因**：
- ❌ 敏感信息需要存在 GitHub Secrets 中
- ❌ 增加一個新的敏感信息洩露途徑
- ✅ 現方案完全由本機和雲端控制，伺服器無須存密鑰

---

## 未來改進

| 項目 | 狀態 | 備註 |
|------|------|------|
| HashiCorp Vault 集成 | 📋 待評估 | 企業級密鑰管理 |
| AWS Secrets Manager | 📋 待評估 | 如使用 AWS 可考慮 |
| S3 自動圖片備份 | 📋 待評估 | 避免本地存儲大檔案 |
| 自動備份排程（本機） | ⏳ 計劃中 | 每週自動建立本機備份（手動上傳） |

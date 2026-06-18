---
created: 2026-06-18
modified: 2026-06-18
tags: [compare, chain, env, dotenv, architecture]
task: build-tenant-brands-from-xlsx
source_agent: agent-role-compare + agent-role-chain
note_type: permanent
---

# 根目錄 `.env` vs `backend/.env` — Compare + ChainReason 報告

$$\text{Question} = \text{「兩個 .env 哪個為真？是否都必要？」}$$

---

## Compare（同異優缺）

| 軸 | 根目錄 `.env` | `backend/.env` |
|---|---|---|
| **用途** | Docker Compose 變數 + Next.js build-time 變數 | Backend Python 應用程式變數 |
| **讀取方** | `docker-compose.yml`（`${VAR}` 語法）、Next.js build | `dotenv_values('.env')`（tenant_manager.py）、Flask |
| **內容** | `NGINX_PORT`、`NEXT_PUBLIC_*`、`POSTGRES_PASSWORD` | `GEMINI_API_KEY`、所有 `TENANT_*_GEMINI_API_KEY`、Redis、DB URL |
| **同** | 都是 dotenv 格式、都不 commit | ← |
| **異** | 控制「外殼」（port、前端 URL、DB 密碼） | 控制「大腦」（AI key、後端連線） |
| **優** | 單一入口管前端/proxy 設定 | AI key 與前端完全隔離，安全性高 |
| **缺** | `POSTGRES_PASSWORD` 與 backend `DATABASE_URL` 兩份（潛在不一致） | 新 tenant 忘加 key 只 warn 不 crash（靜默失敗風險） |

**Judgment**：職責不重疊，兩個都必要。

---

## ChainReason：是否有整合空間？

$$C = [c_1 \to c_2 \to c_3(\text{Fail}) \to \text{Reframe}] \to \text{現況最優}$$

| 條件 | 前提 | 結果 |
|---|---|---|
| $c_1$：兩個 .env 讀取方不同 | docker-compose `${}` vs Python `dotenv_values` | **Hold** |
| $c_2$：docker-compose 也能讀 backend/.env | `env_file: ./backend/.env` 已設定 | **Hold** |
| $c_3$：根目錄 .env 可廢？ | `NEXT_PUBLIC_*` 可移到 backend/.env | **Fail**：Next.js 只認專案根目錄的 `.env`，build-time 讀不到 backend/ 下的檔案 |

**Reframe**：鏈斷於 $c_3$。根因 = Next.js 與 Python 的 dotenv 路徑約束不同，無法統一。

**OptimalSolution**：

$$\begin{cases}
\text{根目錄 .env} & \to \text{前端 + Docker Compose 專用，保留} \\
\text{backend/.env} & \to \text{後端 AI key 專用，保留}
\end{cases}$$

---

## 行動項目

| 優先 | 項目 | 說明 |
|---|---|---|
| 🔴 必要 | `backend/.env` 加入新 tenant key | `TENANT_HL_MOTOR_GEMINI_API_KEY` + `TENANT_CHANGYI_TYRE_GEMINI_API_KEY` |
| 🟡 優化 | `DATABASE_URL` 改用 `${POSTGRES_PASSWORD}` 引用 | 避免密碼改了只改根目錄 `.env` 造成不一致 |
| 🟢 文件 | `.env.example` 補充 `TENANT_*_GEMINI_API_KEY` 說明 | 現在完全沒有提及命名規則 |

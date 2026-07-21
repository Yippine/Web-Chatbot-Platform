"""
PostgreSQL 數據記錄模組
- message_logs: 每則訊息的記錄
- chat_sessions: 使用者 session 彙總
"""
from sqlalchemy import create_engine, text
import os

engine = None


def get_engine():
    global engine
    if engine is None:
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return None
        engine = create_engine(db_url, pool_size=10, max_overflow=20, pool_pre_ping=True)
    return engine


def init_db():
    """建立所有 table（如果不存在）"""
    eng = get_engine()
    if not eng:
        print("[DB] DATABASE_URL 未設定，跳過初始化")
        return
    with eng.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS message_logs (
                id          BIGSERIAL PRIMARY KEY,
                tenant_id   VARCHAR(64) NOT NULL,
                session_id  VARCHAR(64) NOT NULL,
                direction   VARCHAR(4)  NOT NULL,
                service_name VARCHAR(64),
                response_ms  INTEGER DEFAULT 0,
                lang        VARCHAR(16),
                created_at  TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_msg_tenant_time
                ON message_logs (tenant_id, created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_msg_session
                ON message_logs (session_id);

            CREATE TABLE IF NOT EXISTS chat_sessions (
                id           BIGSERIAL PRIMARY KEY,
                tenant_id    VARCHAR(64) NOT NULL,
                session_id   VARCHAR(64) NOT NULL,
                lang         VARCHAR(16),
                first_seen   TIMESTAMP DEFAULT NOW(),
                last_seen    TIMESTAMP DEFAULT NOW(),
                message_count INTEGER DEFAULT 0,
                UNIQUE (tenant_id, session_id)
            );

            CREATE INDEX IF NOT EXISTS idx_session_tenant
                ON chat_sessions (tenant_id, last_seen DESC);

            CREATE TABLE IF NOT EXISTS conversation_screenshots (
                id               BIGSERIAL PRIMARY KEY,
                tenant_id        VARCHAR(64) NOT NULL,
                session_id       VARCHAR(64) NOT NULL,
                user_message_id  VARCHAR(64),
                bot_message_id   VARCHAR(64),
                file_path        TEXT NOT NULL,
                file_size        INTEGER DEFAULT 0,
                created_at       TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_screenshot_tenant_time
                ON conversation_screenshots (tenant_id, created_at DESC);
        """))
        conn.commit()
    print("[DB] Tables ready")


def log_message(tenant_id: str, session_id: str, direction: str,
                service_name: str = "general", response_ms: int = 0,
                lang: str = "zh-TW"):
    """記錄一則訊息並 upsert session"""
    eng = get_engine()
    if not eng:
        return
    try:
        with eng.connect() as conn:
            conn.execute(text("""
                INSERT INTO message_logs
                  (tenant_id, session_id, direction, service_name, response_ms, lang)
                VALUES
                  (:tenant_id, :session_id, :direction, :service_name, :response_ms, :lang)
            """), dict(tenant_id=tenant_id, session_id=session_id, direction=direction,
                       service_name=service_name, response_ms=response_ms, lang=lang))

            conn.execute(text("""
                INSERT INTO chat_sessions (tenant_id, session_id, lang, message_count)
                VALUES (:tenant_id, :session_id, :lang, 1)
                ON CONFLICT (tenant_id, session_id)
                DO UPDATE SET
                    last_seen = NOW(),
                    message_count = chat_sessions.message_count + 1
            """), dict(tenant_id=tenant_id, session_id=session_id, lang=lang))

            conn.commit()
        print(f"[DB] ✅ logged: {tenant_id}/{session_id} ({direction}, {service_name}, {response_ms}ms)")
    except Exception as e:
        print(f"[DB] ❌ log_message 失敗: {e}")


def log_screenshot(tenant_id: str, session_id: str, user_message_id: str,
                   bot_message_id: str, file_path: str, file_size: int = 0):
    """記錄一張對話截圖"""
    eng = get_engine()
    if not eng:
        return
    try:
        with eng.connect() as conn:
            conn.execute(text("""
                INSERT INTO conversation_screenshots
                  (tenant_id, session_id, user_message_id, bot_message_id, file_path, file_size)
                VALUES
                  (:tenant_id, :session_id, :user_message_id, :bot_message_id, :file_path, :file_size)
            """), dict(tenant_id=tenant_id, session_id=session_id, user_message_id=user_message_id,
                       bot_message_id=bot_message_id, file_path=file_path, file_size=file_size))
            conn.commit()
        print(f"[DB] ✅ screenshot logged: {tenant_id}/{session_id}")
    except Exception as e:
        print(f"[DB] ❌ log_screenshot 失敗: {e}")


def list_screenshots(tenant_id: str, limit: int = 24, offset: int = 0) -> list:
    """分頁列出某租戶的截圖記錄（不含 file_path，避免洩漏伺服器路徑）"""
    eng = get_engine()
    if not eng:
        return []
    with eng.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, session_id, user_message_id, bot_message_id, file_size, created_at
            FROM conversation_screenshots
            WHERE tenant_id = :tid
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """), {"tid": tenant_id, "limit": limit, "offset": offset}).mappings().all()
    return [dict(r) for r in rows]


def count_screenshots(tenant_id: str) -> int:
    """某租戶的截圖總數"""
    eng = get_engine()
    if not eng:
        return 0
    with eng.connect() as conn:
        total = conn.execute(text("""
            SELECT COUNT(*) FROM conversation_screenshots WHERE tenant_id = :tid
        """), {"tid": tenant_id}).scalar()
    return total or 0


def get_screenshot_file(tenant_id: str, screenshot_id: int):
    """查出截圖真正的檔案路徑，同時驗證這筆記錄確實屬於這個租戶"""
    eng = get_engine()
    if not eng:
        return None
    with eng.connect() as conn:
        row = conn.execute(text("""
            SELECT file_path FROM conversation_screenshots
            WHERE id = :id AND tenant_id = :tid
        """), {"id": screenshot_id, "tid": tenant_id}).mappings().first()
    return row["file_path"] if row else None


def get_dashboard_stats(tenant_id: str, days: int = 7) -> dict:
    """取得單一租戶的儀表板統計"""
    eng = get_engine()
    if not eng:
        return {"messages_today": 0, "sessions_today": 0, "active_sessions_now": 0, "daily": []}
    with eng.connect() as conn:
        today = conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE direction='bot') AS messages_today,
                COUNT(DISTINCT session_id) AS sessions_today
            FROM message_logs
            WHERE tenant_id = :tid AND created_at >= CURRENT_DATE
        """), {"tid": tenant_id}).mappings().one()

        daily = conn.execute(text("""
            SELECT
                created_at::date AS date,
                COUNT(*) FILTER (WHERE direction='bot') AS messages,
                COUNT(DISTINCT session_id) AS sessions,
                COALESCE(ROUND(AVG(response_ms) FILTER (WHERE direction='bot'))::int, 0) AS avg_ms
            FROM message_logs
            WHERE tenant_id = :tid
              AND created_at >= NOW() - make_interval(days => :days)
            GROUP BY created_at::date
            ORDER BY date
        """), {"tid": tenant_id, "days": days}).mappings().all()

        active = conn.execute(text("""
            SELECT COUNT(DISTINCT session_id)
            FROM message_logs
            WHERE tenant_id = :tid
              AND created_at >= NOW() - INTERVAL '5 minutes'
        """), {"tid": tenant_id}).scalar()

    return {
        "messages_today": today["messages_today"],
        "sessions_today": today["sessions_today"],
        "active_sessions_now": active,
        "daily": [dict(r) for r in daily],
    }


def get_all_tenants_summary() -> list:
    """所有 tenant 的今日統計"""
    eng = get_engine()
    if not eng:
        return []
    with eng.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                tenant_id,
                COUNT(*) FILTER (WHERE direction='bot') AS messages_today,
                COUNT(DISTINCT session_id) AS sessions_today
            FROM message_logs
            WHERE created_at >= CURRENT_DATE
            GROUP BY tenant_id
        """)).mappings().all()
    return [dict(r) for r in rows]


def get_service_distribution(tenant_id: str, days: int = 7) -> list:
    """各服務使用佔比"""
    eng = get_engine()
    if not eng:
        return []
    with eng.connect() as conn:
        rows = conn.execute(text("""
            SELECT service_name, COUNT(*) AS count
            FROM message_logs
            WHERE tenant_id = :tid
              AND direction = 'bot'
              AND created_at >= NOW() - make_interval(days => :days)
            GROUP BY service_name
            ORDER BY count DESC
        """), {"tid": tenant_id, "days": days}).mappings().all()
    return [dict(r) for r in rows]


def get_hourly_distribution(tenant_id: str, days: int = 7) -> list:
    """每小時訊息分佈"""
    eng = get_engine()
    if not eng:
        return []
    with eng.connect() as conn:
        rows = conn.execute(text("""
            SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*) AS count
            FROM message_logs
            WHERE tenant_id = :tid
              AND direction = 'bot'
              AND created_at >= NOW() - make_interval(days => :days)
            GROUP BY hour
            ORDER BY hour
        """), {"tid": tenant_id, "days": days}).mappings().all()
    return [dict(r) for r in rows]


def get_lang_distribution(tenant_id: str, days: int = 7) -> list:
    """使用者語言分佈"""
    eng = get_engine()
    if not eng:
        return []
    with eng.connect() as conn:
        rows = conn.execute(text("""
            SELECT lang, COUNT(*) AS count
            FROM message_logs
            WHERE tenant_id = :tid
              AND direction = 'bot'
              AND created_at >= NOW() - make_interval(days => :days)
            GROUP BY lang
            ORDER BY count DESC
        """), {"tid": tenant_id, "days": days}).mappings().all()
    return [dict(r) for r in rows]


# ==================== 驗收報表查詢 ====================

def get_monthly_summary(tenant_id: str, months: int = 4) -> list:
    """月度彙總：訊息數、對話數、平均回應時間、P95"""
    eng = get_engine()
    if not eng:
        return []
    with eng.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                TO_CHAR(created_at, 'YYYY-MM') AS month,
                COUNT(*) FILTER (WHERE direction = 'bot') AS bot_messages,
                COUNT(*) FILTER (WHERE direction = 'user') AS user_messages,
                COUNT(DISTINCT session_id) AS sessions,
                COALESCE(ROUND(AVG(response_ms) FILTER (WHERE direction = 'bot'))::int, 0) AS avg_response_ms,
                COALESCE(ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_ms) FILTER (WHERE direction = 'bot'))::numeric)::int, 0) AS p95_response_ms,
                COUNT(DISTINCT created_at::date) AS active_days
            FROM message_logs
            WHERE tenant_id = :tid
              AND created_at >= DATE_TRUNC('month', NOW()) - make_interval(months => :months - 1)
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ORDER BY month
        """), {"tid": tenant_id, "months": months}).mappings().all()
    return [dict(r) for r in rows]


def get_daily_usage_detail(tenant_id: str, start_date: str, end_date: str) -> list:
    """每日使用明細（CSV 匯出用）"""
    eng = get_engine()
    if not eng:
        return []
    with eng.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                created_at::date AS date,
                COUNT(*) FILTER (WHERE direction = 'bot') AS bot_messages,
                COUNT(*) FILTER (WHERE direction = 'user') AS user_messages,
                COUNT(DISTINCT session_id) AS sessions,
                COALESCE(ROUND(AVG(response_ms) FILTER (WHERE direction = 'bot'))::int, 0) AS avg_response_ms,
                COALESCE(MAX(response_ms) FILTER (WHERE direction = 'bot'), 0) AS max_response_ms
            FROM message_logs
            WHERE tenant_id = :tid
              AND created_at::date >= CAST(:start_date AS date)
              AND created_at::date <= CAST(:end_date AS date)
            GROUP BY created_at::date
            ORDER BY date
        """), {"tid": tenant_id, "start_date": start_date, "end_date": end_date}).mappings().all()
    return [dict(r) for r in rows]


def get_acceptance_kpi(tenant_id: str, months: int = 4,
                       pre_decision_min: float = 90,
                       post_manual_min: float = 25,
                       pre_service_per_hour: float = 1,
                       daily_work_hours: float = 8,
                       staff_count: int = 1) -> dict:
    """
    計算驗收 KPI：
    1. 縮短決策時間 = 導入前 - 導入後
    2. 服務效率提升 = (導入後 - 導入前) / 導入前 × 100%
    """
    eng = get_engine()
    if not eng:
        return {}
    with eng.connect() as conn:
        # 整體統計
        row = conn.execute(text("""
            SELECT
                COUNT(DISTINCT session_id) AS total_sessions,
                COUNT(DISTINCT created_at::date) AS active_days,
                COALESCE(ROUND(AVG(response_ms) FILTER (WHERE direction = 'bot'))::int, 0) AS avg_response_ms
            FROM message_logs
            WHERE tenant_id = :tid
              AND created_at >= DATE_TRUNC('month', NOW()) - make_interval(months => :months - 1)
        """), {"tid": tenant_id, "months": months}).mappings().one()

    total_sessions = row["total_sessions"] or 0
    active_days = row["active_days"] or 1
    avg_response_ms = row["avg_response_ms"] or 0

    # 導入後決策時間 = 人工處理時間 + AI 回應時間（秒→分鐘）
    ai_response_min = (avg_response_ms / 1000) / 60  # ms → min
    post_decision_min = post_manual_min + ai_response_min

    # 決策時間縮短
    decision_time_saved = pre_decision_min - post_decision_min

    # 服務效率：導入後每小時服務人數
    post_service_per_hour = (total_sessions / active_days / daily_work_hours / staff_count) if active_days > 0 else 0

    # 服務效率提升百分比
    efficiency_improvement = ((post_service_per_hour - pre_service_per_hour) / pre_service_per_hour * 100) if pre_service_per_hour > 0 else 0

    return {
        "decision_time": {
            "pre_minutes": pre_decision_min,
            "post_minutes": round(post_decision_min, 1),
            "saved_minutes": round(decision_time_saved, 1),
            "ai_response_minutes": round(ai_response_min, 3),
            "manual_minutes": post_manual_min,
        },
        "service_efficiency": {
            "pre_per_hour": pre_service_per_hour,
            "post_per_hour": round(post_service_per_hour, 2),
            "improvement_percent": round(efficiency_improvement, 1),
            "total_sessions": total_sessions,
            "active_days": active_days,
            "daily_work_hours": daily_work_hours,
            "staff_count": staff_count,
        },
        "performance": {
            "avg_response_ms": avg_response_ms,
        }
    }

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

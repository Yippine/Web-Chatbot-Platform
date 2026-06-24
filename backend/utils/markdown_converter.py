"""
Markdown → LINE 純文字轉換
LINE 不渲染 HTML/Markdown，回覆前需降級為純文字（連結保留為純 URL）。
"""
import re


def to_plain_text(text: str) -> str:
    """移除 Markdown 標記，保留可讀純文字。"""
    if not text:
        return ""
    t = text

    # [文字](url) → 文字（url）；若文字本身即為 url 則只留 url
    def _link(m):
        label, url = m.group(1).strip(), m.group(2).strip()
        return url if label == url else f"{label}（{url}）"
    t = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', _link, t)

    # 粗體 / 斜體：移除標記、保留文字
    t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)
    t = re.sub(r'__([^_]+)__', r'\1', t)
    t = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'\1', t)

    # 標題符號 #
    t = re.sub(r'^\s{0,3}#{1,6}\s*', '', t, flags=re.MULTILINE)
    # 列表符號 -, *, + → ・
    t = re.sub(r'^\s*[-*+]\s+', '・', t, flags=re.MULTILINE)
    # 行內 code `x`
    t = re.sub(r'`([^`]+)`', r'\1', t)
    # 多餘空行收斂
    t = re.sub(r'\n{3,}', '\n\n', t)

    return t.strip()


def format_references(references) -> str:
    """references → 純文字（併入訊息尾，maps→📍、其他→🔗）。"""
    if not references:
        return ""
    lines = []
    for ref in references:
        if isinstance(ref, dict):
            title = (ref.get('title') or ref.get('text') or '').strip()
            uri = (ref.get('uri') or ref.get('url') or '').strip()
            icon = '📍' if ref.get('type') == 'maps' else '🔗'
            if uri:
                lines.append(f"{icon} {title} {uri}".strip())
        elif isinstance(ref, str) and ref.strip():
            lines.append(f"🔗 {ref.strip()}")
    if not lines:
        return ""
    return "\n\n📚 參考資料：\n" + "\n".join(lines)

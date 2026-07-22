"""從 Google Sheet 讀取每日隨機抽測用的題庫"""
import csv
import io
import urllib.request

SHEET_ID = "1qxp2twE918EQINVvYjxEqQljSNQyNkT4HOgc4-bIBRs"
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0"


def fetch_question_bank(url: str = CSV_URL) -> list[dict]:
    """讀取題庫 CSV，回傳 [{id, question, expected_answer}]"""
    with urllib.request.urlopen(url, timeout=20) as resp:
        raw = resp.read().decode("utf-8-sig")

    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)

    questions = []
    for row in rows[1:]:  # 第一行是表頭
        if len(row) < 2:
            continue
        qid = row[0].strip()
        question = row[1].strip()
        answer = row[2].strip() if len(row) > 2 else ""
        if not qid or not question:
            continue
        questions.append({"id": qid, "question": question, "expected_answer": answer})
    return questions

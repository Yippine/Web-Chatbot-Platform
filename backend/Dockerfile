FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

EXPOSE 5000

# gthread：/api/chat 等 AI 請求會阻塞數秒，純 sync worker 只有 4 個併發額度，
# 一被佔滿 LINE webhook 就會排隊到逾時（499）。改用執行緒維持 webhook 秒回。
CMD ["gunicorn", "-w", "4", "-k", "gthread", "--threads", "8", "-b", "0.0.0.0:5000", "--timeout", "120", "app:app"]

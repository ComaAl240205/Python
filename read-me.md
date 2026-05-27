## ▶ Backend starten (Postgres + Prisma)
cd Backend
.venv\Scripts\activate
python -m prisma generate
python -m prisma db push
uvicorn main:app --reload --host 0.0.0.0 --port 8000

## Postgres + Volume löschen (im Projektroot):
docker compose down -v

## PostgreSQL starten:
docker compose up -d

## PostgreSQL stoppt:
docker compose down -d



## local
const API_BASE = (() => {
  const host = window.location.hostname;
  const port = "8000";
  return `http://${host}:${port}`;
})();

function connectWebSocket() {
  if (ws) return;

  const wsBase = API_BASE.replace("http", "ws");
  const wsUrl = `${wsBase}/ws?token=${token}`;

  ws = new WebSocket(wsUrl);
  ...
}
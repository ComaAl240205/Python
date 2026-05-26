import os
from datetime import datetime, timedelta
from typing import Set, Dict

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from jose import jwt, JWTError
from passlib.hash import bcrypt_sha256

from database import get_connection, init_db

app = FastAPI()

# CORS - allow frontend ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://10.0.0.7:8001",
        "http://localhost:8001",
        "*"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Manager für Real-Time Chat
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.user_typing: Set[int] = set()

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_typing:
            self.user_typing.discard(user_id)

    async def send_personal_message(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast_to_friend(self, user_id: int, friend_id: int, message: dict):
        if friend_id in self.active_connections:
            await self.active_connections[friend_id].send_json(message)

manager = ConnectionManager()

# DB initialisieren
init_db()

# -------------------------
# Security / Auth Settings
# -------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_SUPER_SECRET")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60 * 24  # 24h

# Bearer nur 1x (sonst überschreibst du auto_error=False)
bearer = HTTPBearer(auto_error=False)

def create_access_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer token")

    token = creds.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return {"id": int(payload["sub"]), "username": payload.get("username", "")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# -------------------------
# Schemas (MÜSSEN VOR ROUTES KOMMEN!)
# -------------------------
class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6, max_length=200)

class LoginIn(BaseModel):
    username: str
    password: str

class DocCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)

class DocUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    content: str

class FriendRequestIn(BaseModel):
    receiver_username: str = Field(min_length=1, max_length=30)

class MessageIn(BaseModel):
    receiver_id: int
    content: str = Field(min_length=1, max_length=5000)

# -------------------------
# Auth Routes
# -------------------------
@app.post("/register")
def register(data: RegisterIn):
    # bcrypt_sha256: löst das 72-byte Problem
    pw_hash = bcrypt_sha256.hash(data.password)

    try:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO accounts (username, password_hash) VALUES (?, ?)",
                (data.username, pw_hash)
            )
            conn.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="Username already exists")

    return {"status": "registered"}

@app.post("/login")
def login(data: LoginIn):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM accounts WHERE username = ?",
            (data.username,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid login")

    if not bcrypt_sha256.verify(data.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid login")

    token = create_access_token(row["id"], row["username"])
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
def me(user=Depends(get_current_user)):
    return user

# -------------------------
# Documents Routes (protected!)
# -------------------------

@app.get("/notes")
def list_docs(user=Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, title, updated_at FROM documents WHERE owner_id = ? ORDER BY id DESC",
            (user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/notes")
def create_doc(data: DocCreate, user=Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO documents (owner_id, title, content) VALUES (?, ?, '')",
            (user["id"], data.title)
        )
        conn.commit()
        doc_id = cur.lastrowid
    return {"id": doc_id, "status": "created"}

@app.get("/notes/{doc_id}")
def get_doc(doc_id: int, user=Depends(get_current_user)):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, title, content, updated_at FROM documents WHERE id = ? AND owner_id = ?",
            (doc_id, user["id"])
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return dict(row)

@app.put("/notes/{doc_id}")
def update_doc(doc_id: int, data: DocUpdate, user=Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.execute(
            """
            UPDATE documents
            SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND owner_id = ?
            """,
            (data.title, data.content, doc_id, user["id"])
        )
        conn.commit()

    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "updated"}

@app.delete("/notes/{doc_id}")
def delete_doc(doc_id: int, user=Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.execute(
            "DELETE FROM documents WHERE id = ? AND owner_id = ?",
            (doc_id, user["id"])
        )
        conn.commit()

    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "deleted"}

# -------------------------
# Friend Management Routes
# -------------------------

@app.post("/friends/request")
def send_friend_request(data: FriendRequestIn, user=Depends(get_current_user)):
    with get_connection() as conn:
        receiver = conn.execute(
            "SELECT id FROM accounts WHERE username = ?",
            (data.receiver_username,)
        ).fetchone()

        if not receiver:
            raise HTTPException(status_code=404, detail="User not found")

        if receiver["id"] == user["id"]:
            raise HTTPException(status_code=400, detail="Cannot add yourself")

        existing = conn.execute(
            "SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ?",
            (user["id"], receiver["id"])
        ).fetchone()

        if existing:
            raise HTTPException(status_code=400, detail="Request already exists")

        conn.execute(
            "INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')",
            (user["id"], receiver["id"])
        )
        conn.commit()

    return {"status": "request_sent"}

@app.get("/friends/requests")
def get_friend_requests(user=Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT fr.id, a.id as sender_id, a.username as sender_username, fr.created_at, fr.status
            FROM friend_requests fr
            JOIN accounts a ON fr.sender_id = a.id
            WHERE fr.receiver_id = ? AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
            """,
            (user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]

@app.post("/friends/request/{request_id}/accept")
def accept_friend_request(request_id: int, user=Depends(get_current_user)):
    with get_connection() as conn:
        req = conn.execute(
            "SELECT sender_id, receiver_id FROM friend_requests WHERE id = ? AND receiver_id = ?",
            (request_id, user["id"])
        ).fetchone()

        if not req:
            raise HTTPException(status_code=404, detail="Request not found")

        conn.execute(
            "UPDATE friend_requests SET status = 'accepted' WHERE id = ?",
            (request_id,)
        )
        conn.execute(
            "INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)",
            (req["receiver_id"], req["sender_id"])
        )
        conn.execute(
            "INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)",
            (req["sender_id"], req["receiver_id"])
        )
        conn.commit()

    return {"status": "accepted"}

@app.post("/friends/request/{request_id}/decline")
def decline_friend_request(request_id: int, user=Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE friend_requests SET status = 'declined' WHERE id = ? AND receiver_id = ?",
            (request_id, user["id"])
        )
        conn.commit()

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Request not found")

    return {"status": "declined"}

@app.get("/friends")
def get_friends(user=Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT a.id, a.username, f.created_at
            FROM friendships f
            JOIN accounts a ON f.friend_id = a.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
            """,
            (user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]

@app.get("/messages/{friend_id}")
def get_messages(friend_id: int, limit: int = 50, user=Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, sender_id, receiver_id, content, created_at, read_at
            FROM messages
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (user["id"], friend_id, friend_id, user["id"], limit)
        ).fetchall()
    return [dict(r) for r in rows]

@app.post("/messages")
def save_message(data: MessageIn, user=Depends(get_current_user)):
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)",
            (user["id"], data.receiver_id, data.content)
        )
        conn.commit()
    return {"status": "sent"}

# -------------------------
# WebSocket for Real-Time Chat
# -------------------------

def get_token_from_query(query_params: str) -> str:
    try:
        params = dict(p.split("=") for p in query_params.split("&") if "=" in p)
        return params.get("token", "")
    except:
        return ""

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    query_params = websocket.scope.get("query_string", b"").decode()
    token = get_token_from_query(query_params)

    user = None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = {"id": int(payload["sub"]), "username": payload.get("username", "")}
    except JWTError:
        await websocket.close(code=401)
        return

    await manager.connect(user["id"], websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                friend_id = data.get("friend_id")
                content = data.get("content", "").strip()

                if not content or not friend_id:
                    continue

                with get_connection() as conn:
                    conn.execute(
                        "INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)",
                        (user["id"], friend_id, content)
                    )
                    conn.commit()

                message_obj = {
                    "type": "message",
                    "from": user["username"],
                    "from_id": user["id"],
                    "content": content,
                    "friend_id": friend_id,
                    "timestamp": datetime.utcnow().isoformat()
                }

                await manager.broadcast_to_friend(user["id"], friend_id, message_obj)

            elif msg_type == "typing":
                friend_id = data.get("friend_id")
                is_typing = data.get("is_typing", False)

                if is_typing:
                    manager.user_typing.add(user["id"])
                else:
                    manager.user_typing.discard(user["id"])

                typing_obj = {
                    "type": "typing",
                    "from_id": user["id"],
                    "is_typing": is_typing
                }
                await manager.broadcast_to_friend(user["id"], friend_id, typing_obj)

            elif msg_type == "online":
                online_obj = {
                    "type": "online",
                    "user_id": user["id"],
                    "username": user["username"]
                }
                for connection_user_id in list(manager.active_connections.keys()):
                    await manager.send_personal_message(connection_user_id, online_obj)

    except WebSocketDisconnect:
        manager.disconnect(user["id"])
        offline_obj = {
            "type": "offline",
            "user_id": user["id"]
        }
        for connection_user_id in list(manager.active_connections.keys()):
            await manager.send_personal_message(connection_user_id, offline_obj)
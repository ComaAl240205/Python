import os
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Set
from urllib.parse import parse_qs

import bcrypt
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from jose import jwt, JWTError

from prisma import Prisma

# -------------------------
# App + Prisma
# -------------------------
app = FastAPI()
prisma = Prisma()

@app.on_event("startup")
async def startup():
    await prisma.connect()

@app.on_event("shutdown")
async def shutdown():
    await prisma.disconnect()

# -------------------------
# CORS (Performance: Preflight-Cache)
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,  # ✅ Browser cached OPTIONS (Preflight) bis zu 24h
)

# -------------------------
# WebSocket Manager
# -------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.user_typing: Set[int] = set()

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)
        self.user_typing.discard(user_id)

    async def send_personal_message(self, user_id: int, message: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            await ws.send_json(message)

    async def send_to_friend(self, friend_id: int, message: dict):
        ws = self.active_connections.get(friend_id)
        if ws:
            await ws.send_json(message)

manager = ConnectionManager()

# -------------------------
# Security / Auth
# -------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_SUPER_SECRET")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60 * 24  # 24h

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

    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        return {"id": int(payload["sub"]), "username": payload.get("username", "")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# -------------------------
# Password Hashing (Performance + Stabilität)
# - passlib/bcrypt_sha256 raus (war bei dir langsam + versionsensitiv)
# -------------------------
def hash_password(password: str) -> str:
    # rounds=12 ist ein guter Standard (sicher + nicht zu lahm)
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

# -------------------------
# Schemas
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
async def register(data: RegisterIn):
    pw_hash = hash_password(data.password)

    # Performance: 1 DB-Call statt (find_unique + create)
    try:
        await prisma.accounts.create(
            data={"username": data.username, "password_hash": pw_hash}
        )
    except Exception:
        # unique violation -> username existiert
        raise HTTPException(status_code=400, detail="Username already exists")

    return {"status": "registered"}

@app.post("/login")
async def login(data: LoginIn):
    row = await prisma.accounts.find_unique(where={"username": data.username})
    if not row:
        raise HTTPException(status_code=401, detail="Invalid login")

    if not verify_password(data.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Invalid login")

    token = create_access_token(row.id, row.username)
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
async def me(user=Depends(get_current_user)):
    return user

# -------------------------
# Documents Routes
# -------------------------
@app.get("/notes")
async def list_docs(user=Depends(get_current_user)):
    rows = await prisma.documents.find_many(
        where={"owner_id": user["id"]},
        order={"id": "desc"},
        select={"id": True, "title": True, "updated_at": True},
    )
    return [r.model_dump() for r in rows]

@app.post("/notes")
async def create_doc(data: DocCreate, user=Depends(get_current_user)):
    doc = await prisma.documents.create(
        data={"owner_id": user["id"], "title": data.title, "content": ""}
    )
    return {"id": doc.id, "status": "created"}

@app.get("/notes/{doc_id}")
async def get_doc(doc_id: int, user=Depends(get_current_user)):
    row = await prisma.documents.find_first(
        where={"id": doc_id, "owner_id": user["id"]}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return row.model_dump()

@app.put("/notes/{doc_id}")
async def update_doc(doc_id: int, data: DocUpdate, user=Depends(get_current_user)):
    row = await prisma.documents.find_first(
        where={"id": doc_id, "owner_id": user["id"]}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    await prisma.documents.update(
        where={"id": doc_id},
        data={"title": data.title, "content": data.content},
    )
    return {"status": "updated"}

@app.delete("/notes/{doc_id}")
async def delete_doc(doc_id: int, user=Depends(get_current_user)):
    row = await prisma.documents.find_first(
        where={"id": doc_id, "owner_id": user["id"]}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    await prisma.documents.delete(where={"id": doc_id})
    return {"status": "deleted"}

# -------------------------
# Friend Management Routes
# -------------------------
@app.post("/friends/request")
async def send_friend_request(data: FriendRequestIn, user=Depends(get_current_user)):
    receiver = await prisma.accounts.find_unique(where={"username": data.receiver_username})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")

    if receiver.id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    existing = await prisma.friend_requests.find_unique(
        where={"sender_id_receiver_id": {"sender_id": user["id"], "receiver_id": receiver.id}}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Request already exists")

    fr = await prisma.friend_requests.create(
        data={"sender_id": user["id"], "receiver_id": receiver.id, "status": "pending"}
    )

    await manager.send_personal_message(
        receiver.id,
        {
            "type": "friend_request:new",
            "request": {
                "id": fr.id,
                "sender_username": user["username"],
                "created_at": fr.created_at.isoformat() if fr.created_at else datetime.utcnow().isoformat(),
            }
        }
    )

    return {"status": "request_sent"}

@app.get("/friends/requests")
async def get_friend_requests(user=Depends(get_current_user)):
    rows = await prisma.friend_requests.find_many(
        where={"receiver_id": user["id"], "status": "pending"},
        order={"created_at": "desc"},
        include={"sender": True},
    )
    return [{
        "id": r.id,
        "sender_id": r.sender_id,
        "sender_username": r.sender.username,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "status": r.status,
    } for r in rows]

@app.post("/friends/request/{request_id}/accept")
async def accept_friend_request(request_id: int, user=Depends(get_current_user)):
    req = await prisma.friend_requests.find_first(
        where={"id": request_id, "receiver_id": user["id"], "status": "pending"}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    async with prisma.tx() as tx:
        await tx.friend_requests.update(where={"id": request_id}, data={"status": "accepted"})
        await tx.friendships.create(data={"user_id": req.receiver_id, "friend_id": req.sender_id})
        await tx.friendships.create(data={"user_id": req.sender_id, "friend_id": req.receiver_id})

    await manager.send_personal_message(
        req.sender_id,
        {
            "type": "friend_request:accepted",
            "friend": {"id": user["id"], "username": user["username"]}
        }
    )
    return {"status": "accepted"}

@app.post("/friends/request/{request_id}/decline")
async def decline_friend_request(request_id: int, user=Depends(get_current_user)):
    req = await prisma.friend_requests.find_first(
        where={"id": request_id, "receiver_id": user["id"], "status": "pending"}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    await prisma.friend_requests.update(where={"id": request_id}, data={"status": "declined"})
    return {"status": "declined"}

@app.get("/friends")
async def get_friends(user=Depends(get_current_user)):
    rows = await prisma.friendships.find_many(
        where={"user_id": user["id"]},
        order={"created_at": "desc"},
        include={"friend": True},
    )
    return [{
        "id": r.friend.id,
        "username": r.friend.username,
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in rows]

# -------------------------
# Messages Routes
# -------------------------
@app.get("/messages/{friend_id}")
async def get_messages(friend_id: int, limit: int = 50, user=Depends(get_current_user)):
    rows = await prisma.messages.find_many(
        where={
            "OR": [
                {"sender_id": user["id"], "receiver_id": friend_id},
                {"sender_id": friend_id, "receiver_id": user["id"]},
            ]
        },
        order={"created_at": "asc"},
        take=limit,
    )
    return [r.model_dump() for r in rows]

@app.post("/messages")
async def save_message(data: MessageIn, user=Depends(get_current_user)):
    await prisma.messages.create(
        data={"sender_id": user["id"], "receiver_id": data.receiver_id, "content": data.content}
    )
    return {"status": "sent"}

@app.get("/users/{user_id}/online")
def is_user_online(user_id: int):
    return {"online": user_id in manager.active_connections}

# -------------------------
# WebSocket
# -------------------------
def get_token_from_query(query_params: str) -> str:
    # robust & schnell (statt split("&") mit edge-cases)
    try:
        qs = parse_qs(query_params)
        return (qs.get("token", [""])[0]) or ""
    except Exception:
        return ""

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    query_params = websocket.scope.get("query_string", b"").decode()
    token = get_token_from_query(query_params)

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
                content = (data.get("content") or "").strip()
                if not content or not friend_id:
                    continue

                friend_id_int = int(friend_id)

                # ✅ Performance: DB write nicht blockierend (Chat wirkt sofort)
                asyncio.create_task(
                    prisma.messages.create(
                        data={
                            "sender_id": user["id"],
                            "receiver_id": friend_id_int,
                            "content": content
                        }
                    )
                )

                await manager.send_to_friend(
                    friend_id_int,
                    {
                        "type": "message",
                        "from": user["username"],
                        "from_id": user["id"],
                        "content": content,
                        "friend_id": friend_id_int,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )

            elif msg_type == "typing":
                friend_id = data.get("friend_id")
                is_typing = bool(data.get("is_typing", False))

                if is_typing:
                    manager.user_typing.add(user["id"])
                else:
                    manager.user_typing.discard(user["id"])

                if friend_id:
                    await manager.send_to_friend(
                        int(friend_id),
                        {"type": "typing", "from_id": user["id"], "is_typing": is_typing}
                    )

    except WebSocketDisconnect:
        manager.disconnect(user["id"])

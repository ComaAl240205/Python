import os
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from jose import jwt, JWTError
from passlib.hash import bcrypt_sha256

from database import get_connection, init_db

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
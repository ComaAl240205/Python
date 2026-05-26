import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "users.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(owner_id) REFERENCES accounts(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(sender_id) REFERENCES accounts(id),
                FOREIGN KEY(receiver_id) REFERENCES accounts(id),
                UNIQUE(sender_id, receiver_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES accounts(id),
                FOREIGN KEY(friend_id) REFERENCES accounts(id),
                UNIQUE(user_id, friend_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                read_at TEXT,
                FOREIGN KEY(sender_id) REFERENCES accounts(id),
                FOREIGN KEY(receiver_id) REFERENCES accounts(id)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)")
        conn.commit()
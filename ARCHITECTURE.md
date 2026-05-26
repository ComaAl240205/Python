# 📊 Connected System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (Frontend)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐  │
│  │   Auth Page     │  │   Main App (nach Login)              │  │
│  │                 │  │  ┌──────────────────────────────────┐│  │
│  │ - Login Form    │  │  │ Sidebar          │ Main Panel    ││  │
│  │ - Register      │  │  │ - Freunde (+btn) │              ││  │
│  │                 │  │  │ - Anfragen       │ Tab View:    ││  │
│  └─────────────────┘  │  │                  │ 1. Friends   ││  │
│                       │  │                  │ 2. Add       ││  │
│                       │  │                  │ 3. Requests  ││  │
│                       │  │                  │ 4. Chat      ││  │
│                       │  │                  │              ││  │
│                       │  │                  └──────────────┘│  │
│                       │  └──────────────────────────────────┘  │
│                       │                                          │
│                       │  WebSocket 🔌 | REST 📡                │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │                                 │
   ┌────▼─────────────────────────┐  ┌───▼──────────────────────┐
   │    FastAPI Backend           │  │   WebSocket Server       │
   │   (http://0.0.0.0:8000)      │  │   (/ws Endpoint)         │
   ├──────────────────────────────┤  ├──────────────────────────┤
   │ Auth Routes:                 │  │ ConnectionManager:       │
   │ - POST /register             │  │ - Track active users     │
   │ - POST /login                │  │ - Route messages         │
   │ - GET /me                    │  │ - Broadcast status       │
   │                              │  │ - Auto-reconnect         │
   │ Friend Routes:               │  │                          │
   │ - POST /friends/request      │  │ Message Types:           │
   │ - GET /friends/requests      │  │ - message (chat)         │
   │ - POST /friends/request/{}/  │  │ - typing (indicator)     │
   │         accept/decline       │  │ - online/offline (status)│
   │ - GET /friends               │  │                          │
   │                              │  └──────────────────────────┘
   │ Chat Routes:                 │
   │ - GET /messages/{friend_id}  │
   │ - POST /messages             │
   │                              │
   └────────────┬─────────────────┘
                │
        ┌───────▼────────────────┐
        │   SQLite Database      │
        │   (users.db)           │
        ├────────────────────────┤
        │                        │
        │ accounts              │  (Existing)
        │ documents             │  (Existing)
        │                        │
        │ friend_requests       │  (NEW)
        │ - id                   │
        │ - sender_id (FK)       │
        │ - receiver_id (FK)     │
        │ - status               │
        │ - created_at           │
        │ - INDEX on receiver_id │
        │                        │
        │ friendships           │  (NEW)
        │ - id                   │
        │ - user_id (FK)         │
        │ - friend_id (FK)       │
        │ - created_at           │
        │ - INDEX on user_id     │
        │                        │
        │ messages              │  (NEW)
        │ - id                   │
        │ - sender_id (FK)       │
        │ - receiver_id (FK)     │
        │ - content              │
        │ - created_at           │
        │ - read_at              │
        │ - INDEX on receiver_id │
        │                        │
        └────────────────────────┘
```

## 🔄 User Flow

```
┌─────────────┐
│   Login     │
│             │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│   Main App       │
│                  │
│  [Sidebar]       │
│  • Freunde       │◄─────── WebSocket Connected
│  • Anfragen      │
└──────┬───────────┘
       │
       ├─→ Click "Freunde hinzufügen"
       │   ├─→ Username eingeben
       │   └─→ Friend Request senden (REST POST)
       │
       ├─→ Freundschaftsanfrage erhalten
       │   ├─→ In Anfragen-Tab zeigen
       │   └─→ Accept/Decline Buttons
       │
       ├─→ Click Accept
       │   ├─→ Freundschaft erstellen (bidirektional)
       │   └─→ Freund erscheint in Liste
       │
       └─→ Click Freund zum Chatten
           ├─→ Nachrichtenverlauf laden (REST GET)
           ├─→ Chat-UI öffnen
           └─→ WebSocket bereit für Live-Chat
```

## 🔌 WebSocket Message Flow

```
┌─────────────────┐
│   Alice sends   │
│   message       │
│   "Hallo Bob!"  │
└────────┬────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Client sends via WebSocket:  │
  │ {                            │
  │   "type": "message",         │
  │   "friend_id": 2,            │
  │   "content": "Hallo Bob!"    │
  │ }                            │
  └──────────┬───────────────────┘
             │
             ▼
      ┌────────────────────────────┐
      │  Server (WebSocket)        │
      │  1. Speichert in messages  │
      │  2. Sucht Bob in           │
      │     active_connections    │
      │  3. Sendet JSON an Bob     │
      └──────────┬─────────────────┘
                 │
                 ▼
    ┌──────────────────────────────┐
    │ Bob empfängt WebSocket-JSON: │
    │ {                            │
    │   "type": "message",         │
    │   "from": "alice",           │
    │   "content": "Hallo Bob!",   │
    │   "timestamp": "..."         │
    │ }                            │
    └──────────┬───────────────────┘
               │
               ▼
        ┌─────────────────────┐
        │ Bob's Chat UI       │
        │ zeigt Nachricht     │
        │ von Alice an! ✨    │
        └─────────────────────┘
```

## 📱 UI Layout

### Desktop View (2-Column)

```
┌────────────────────────────────────────────────────────────┐
│  Connected                                     @username 🚪 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌─────────────────────────────────────┐ │
│  │ Freunde      │  │ Main Panel                          │ │
│  │ + Hinzufügen │  │                                     │ │
│  │              │  │ [Friends | Add | Requests | Chat]  │ │
│  │ • alice 🟢   │  │                                     │ │
│  │ • bob ⚪     │  │ Content Area (tab-specific)         │ │
│  │              │  │                                     │ │
│  │ Anfragen     │  │                                     │ │
│  │              │  │                                     │ │
│  │ • charlie 📬 │  │                                     │ │
│  │              │  │                                     │ │
│  └──────────────┘  └─────────────────────────────────────┘ │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Mobile View (Stacked)

```
┌──────────────────────┐
│ Connected     @user 🚪│
├──────────────────────┤
│                      │
│ [Friends | Chat]     │
│                      │
│ Freunde:             │
│ • alice 🟢           │
│ • bob ⚪             │
│                      │
│ Anfragen:            │
│ • charlie 📬         │
│                      │
│ [+ Hinzufügen]       │
│                      │
└──────────────────────┘
```

## 🎨 Design Colors

```
┌─────────────────────────────────────────┐
│        Old Money Palette                │
├─────────────────────────────────────────┤
│                                         │
│  🟦 #f5f5f0  Warm White (Background)    │
│  ⬛ #1a1a1a  Pure Black (Text)          │
│  ◻️  #ffffff  Pure White (Cards)        │
│  ▫️  #d0ccc8  Subtle Gray (Borders)     │
│  ▪️  #2c2c2c  Dark Accent (Hover)       │
│  ◽ #e8e4df  Light Panel (Secondary)    │
│                                         │
│  🟢 #2ecc71  Online Status              │
│  ⚪ #999999  Offline Status             │
│                                         │
└─────────────────────────────────────────┘
```

## 🔐 Authentication Flow

```
┌────────────────┐
│  User enters   │
│  Credentials   │
└────────┬───────┘
         │
         ▼
┌────────────────────────────┐
│ POST /register or /login   │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Server:                    │
│ 1. Hash password           │
│ 2. Check in DB             │
│ 3. Generate JWT Token      │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Return JWT Token           │
│ (24h valid)                │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Frontend stores in         │
│ localStorage               │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Use token in:              │
│ • REST Headers             │
│ • WebSocket Query Param    │
└────────────────────────────┘
```

---

**System ist vollständig und bereit!** 🚀

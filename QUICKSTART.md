# 🚀 Quick Start Guide - Connected

## Installation & Setup

### 1️⃣ Backend starten

```bash
cd web_project/Backend

# Virtual Environment aktivieren
.venv\Scripts\activate

# Dependencies installieren (falls nötig)
pip install fastapi uvicorn python-jose[cryptography] passlib[bcrypt]

# Server starten
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Output sollte sein:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 2️⃣ Frontend öffnen

Öffne einen Browser:
```
http://localhost:8001
```

Falls Port 8001 nicht konfiguriert ist, benutze:
```
http://localhost:8000
```

---

## 🧪 Test Flow

### Step 1: Zwei User erstellen

**User 1: Alice**
- Register Tab → Username: `alice` → Password: `password123` → "Account erstellen"
- Nach Success → Login Tab → alice / password123 → "Login"

**User 2: Bob** (In separatem Browser-Tab/Inkognito)
- Wiederhole für Bob

### Step 2: Freundschaftsanfrage

**Im Alice-Tab:**
1. Nach Login → Linke Sidebar "Freunde" → "+ Hinzufügen"
2. Benutzername eingeben: `bob`
3. Klick "Anfrage senden" → ✅ grüne Bestätigung

### Step 3: Anfrage annehmen

**Im Bob-Tab:**
1. Linke Sidebar "Anfragen" → "📬 1 neue" Button sichtbar
2. Hauptpanel wechselt zu Anfragen-Tab
3. Sieht "alice" mit Buttons → Klick "✓" zum Annehmen

### Step 4: Freunde sehen sich

**Beide Tabs:**
- Linke Sidebar "Freunde" zeigt den anderen Namen
- Grüner Punkt = Online, grauer Punkt = Offline

### Step 5: Chat Test

**Im Alice-Tab:**
1. Klick auf "bob" in Freundesliste (Sidebar)
2. Hauptpanel → Chat-Tab öffnet
3. Typenfeldtext: "Hallo Bob! 👋"
4. Klick ↑ Button oder Enter

**Im Bob-Tab:**
1. Klick auf "alice"
2. Nachricht von Alice erscheint LIVE! ⚡
3. Antwort schreiben: "Hi Alice! 😊"
4. Sende (Enter)

**Im Alice-Tab:**
- Antwortnachricht von Bob erscheint sofort

### Step 6: Typing Indicator

1. Bob tippt anfangen (ohne zu senden)
2. Im Alice-Tab: "bob schreibt..." erscheint unter Chat
3. Bob hört auf zu tippen
4. "bob schreibt..." verschwindet

### Step 7: Online Status

1. Bob-Tab: Logout klicken
2. Alice-Tab: Bobs Punkt wechselt von 🟢 zu ⚪ (grau)
3. Bob-Tab: Re-Login
4. Alice-Tab: Punkt wechselt zurück zu 🟢

---

## 🎨 Design Highlights

### Old Money Aesthetic
- **Farben**: Weiß + Schwarz + Grautöne
- **Layout**: Viel Whitespace, minimalistische Linien
- **Fonts**: Sauberes Sans-Serif
- **Eleganz**: Subtle, refined, not flashy

### UI Components
- **Tabs**: Click-basiert, underline-Indikator
- **Buttons**: Flat Design mit Hover-Effects
- **Cards**: Dünne Borders, sanfte Shadows
- **Lists**: Clean Item-Layout mit Icons

---

## 🔧 Troubleshooting

### "Cannot connect to server"
- Backend läuft? Check `http://localhost:8000/docs`
- Port 8000 in Firewall freigegeben?
- CORS-Error? Check Browser Console

### "WebSocket connection failed"
- Token gültig? Check localStorage in DevTools
- WebSocket URL korrekt? Sollte `ws://localhost:8000/ws?token=...`

### "Message nicht angekommen"
- Freunde bestätigt? Check Freundesliste
- WebSocket connected? Check Console für "✅ WebSocket connected"
- Friend online? Check grüner Punkt

### "Old Money Design nicht sichtbar"
- Browser-Cache leeren? Ctrl+F5 / Cmd+Shift+R
- CSS loaded? Check DevTools → Elements → style.css

---

## 📊 Architecture at a Glance

```
┌─────────────────┐
│   Browser       │
├─────────────────┤
│ HTML/CSS/JS     │
│ (Old Money UI)  │
│                 │
│ ├─ Login Form   │
│ ├─ Friend List  │
│ ├─ Chat UI      │
│ └─ WebSocket    │
└────────┬────────┘
         │
         │ HTTP + WebSocket
         │
┌────────▼────────┐
│  FastAPI        │
├─────────────────┤
│ Auth Routes     │
│ Friend Routes   │
│ Chat Routes     │
│ WebSocket /ws   │
└────────┬────────┘
         │
┌────────▼────────┐
│  SQLite DB      │
├─────────────────┤
│ accounts        │
│ friendships     │
│ friend_requests │
│ messages        │
└─────────────────┘
```

---

## 💡 Tips & Tricks

### Entwicklung
- DevTools → Application → localStorage: Token sehen
- DevTools → Network → WS: WebSocket-Traffic debuggen
- Browser → Netzwerk → Alle Requests verfolgen

### Performance
- Message-Limit: 50 alte Nachrichten
- Auto-Scroll: Scrollt zu neuester Nachricht
- Typing Debounce: Nicht zu viele WebSocket-Events

### Sicherheit
- JWT Token: 24h Ablauf
- Password Hashing: bcrypt_sha256
- SQL Injection: Parametrized Queries
- CORS: Konfiguriert für Localhost

---

## 📚 API Docs

### Live API Docs (Interactive)
```
http://localhost:8000/docs
```

### Beispiel: Freundschaftsanfrage
```bash
curl -X POST http://localhost:8000/friends/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"receiver_username": "bob"}'
```

### Beispiel: Freundesliste
```bash
curl -X GET http://localhost:8000/friends \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ Checklist vor Production

- [ ] JWT_SECRET ändern (.env Datei)
- [ ] CORS Origins anpassen
- [ ] Database Backup konfigurieren
- [ ] Error Logging setup
- [ ] Monitor WebSocket Connections
- [ ] Rate Limiting für API
- [ ] SSL/HTTPS konfigurieren
- [ ] Production Build optimieren

---

## 🎯 Nächste Schritte (Optional Features)

- [ ] Message Search
- [ ] Message Reactions (Emojis)
- [ ] Voice Messages
- [ ] File Sharing
- [ ] Group Chats
- [ ] User Profiles
- [ ] Block User Feature
- [ ] Message Encryption

---

**Happy Chatting! 🎉**

Bei Fragen check CONNECTED_README.md oder IMPLEMENTATION_NOTES.md

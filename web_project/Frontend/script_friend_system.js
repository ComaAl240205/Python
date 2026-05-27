const API_BASE = "https://705rmzkj-8000.euw.devtunnels.ms";

let token = localStorage.getItem("token") || null;
let currentUser = null;
let currentChatFriend = null;
let ws = null;
let typingUsers = new Set();
let onlineCheckInterval = null;


// ---------- Helpers ----------
function authHeaders(extra = {}) {
  const h = { ...extra };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function readError(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { detail: text }; }
}

function escapeHtml(value) {
  const s = String(value ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ---------- Tabs ----------
function showTab(which) {
  // AUTH
  document.getElementById("loginView").style.display =
    which === "login" ? "block" : "none";
  document.getElementById("registerView").style.display =
    which === "register" ? "block" : "none";

  // MAIN PANEL (alles aus)
  document.getElementById("tab-friends-search").style.display = "none";
  document.getElementById("tab-requests").style.display = "none";
  document.getElementById("tab-chat").style.display = "none";

  // MAIN PANEL (gezielt an)
  if (which === "friends-search") {
    document.getElementById("tab-friends-search").style.display = "block";
  }
  else if (which === "requests") {
    document.getElementById("tab-requests").style.display = "block";
  }
  else {
    // default = chat
    document.getElementById("tab-chat").style.display = "flex";
  }
}

// ---------- Auth ----------
async function register() {
  const username = document.getElementById("regUser").value.trim();
  const password = document.getElementById("regPass").value;

  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ username, password })
  });

  const msg = document.getElementById("regMsg");
  if (!res.ok) {
    const err = await readError(res);
    msg.textContent = `❌ ${err.detail || "Fehler"}`;
    return;
  }

  msg.textContent = "✅ Account erstellt! Bitte einloggen.";
  setTimeout(() => showTab("login"), 1000);
}

async function login() {
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;

  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ username, password })
  });

  const msg = document.getElementById("authMsg");
  if (!res.ok) {
    const err = await readError(res);
    msg.textContent = `❌ ${err.detail || "Login fehlgeschlagen"}`;
    return;
  }

  const data = await res.json();
  token = data.access_token;
  localStorage.setItem("token", token);
  msg.textContent = "";
  await enterApp();
}

function logout() {
  token = null;
  localStorage.removeItem("token");
  currentUser = null;
  currentChatFriend = null;
  if (ws) ws.close();
  ws = null;

  document.getElementById("appView").style.display = "none";
  document.getElementById("authCard").style.display = "block";
  document.getElementById("userBox").style.display = "none";
  document.getElementById("whoami").textContent = "";

  showTab("login");
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";

  if (onlineCheckInterval) {
  clearInterval(onlineCheckInterval);
  onlineCheckInterval = null;
  }
}

async function enterApp() {
  const res = await fetch(`${API_BASE}/me`, { headers: authHeaders() });

  if (!res.ok) {
    alert("Auth error. Please login again.");
    logout();
    return;
  }

  currentUser = await res.json();

  document.getElementById("authCard").style.display = "none";
  document.getElementById("appView").style.display = "grid";
  document.getElementById("userBox").style.display = "flex";
  document.getElementById("whoami").textContent = `@${currentUser.username}`;

  connectWebSocket();
  await loadFriends();
  await loadFriendRequests();
  showTab("chat");
}

// ---------- WebSocket ----------
function connectWebSocket() {
  if (ws) return;
  
  const wsBase = API_BASE.replace(/^http/, "ws"); // https->wss, http->ws
  const wsUrl = `${wsBase}/ws?token=${token}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("✅ WebSocket connected");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "message") {
      if (currentChatFriend && (data.from_id === currentChatFriend.id || data.friend_id === currentChatFriend.id)) {
        addMessageToChat(data.from, data.content, data.from_id !== currentUser.id, data.timestamp);
      }
    } else if (data.type === "typing") {
      if (currentChatFriend && data.from_id === currentChatFriend.id) {
        if (data.is_typing) {
          typingUsers.add(data.from_id);
          document.getElementById("typingIndicator").innerHTML = `${currentChatFriend.username} schreibt...`;
          document.getElementById("typingIndicator").style.display = "block";
        } else {
          typingUsers.delete(data.from_id);
          document.getElementById("typingIndicator").style.display = "none";
        }
      }
    }
    
    // ✅ HIER NUR ERGÄNZEN
    else if (data.type === "friend_request:new") {
    addIncomingRequest(data.request);
    }
    else if (data.type === "friend_request:accepted") {
    loadFriends(); // oder friendsCache pushen
    }

  };

  ws.onerror = (err) => console.error("WebSocket error:", err);
  ws.onclose = () => {
    console.log("❌ WebSocket disconnected");
    ws = null;
    setTimeout(connectWebSocket, 10000);
  };
}

// ---------- Friends Management ----------
async function loadFriends() {
  const res = await fetch(`${API_BASE}/friends`, { headers: authHeaders() });
  if (!res.ok) {
    console.error("Failed to load friends");
    return;
  }

  const friends = await res.json();
  updateFriendsList(friends);
}

function updateFriendsList(friends) {
  const list = document.getElementById("friendsList");
  if (!list) return;

  list.innerHTML = "";

  if (friends.length === 0) {
    list.innerHTML = `
      <div class="sidebar-item"
        style="background:transparent;border:none;color:var(--text-muted);font-size:12px;">
        Keine Freunde
      </div>`;
    return;
  }

  friends.forEach(friend => {
    const item = document.createElement("button");
    item.type = "button";
    item.className =
      "sidebar-item" + (currentChatFriend?.id === friend.id ? " active" : "");

    item.innerHTML = `
      <div class="sidebar-item-name">
        ${escapeHtml(friend.username)}
      </div>
    `;

    item.onclick = () => openChat(friend);
    list.appendChild(item);
  });
}


async function sendFriendRequest() {
  const username = document.getElementById("searchUsername").value.trim();
  const msg = document.getElementById("searchMsg");

  if (!username) {
    msg.textContent = "❌ Bitte einen Username eingeben";
    return;
  }

  const res = await fetch(`${API_BASE}/friends/request`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ receiver_username: username })
  });

  if (!res.ok) {
    const err = await readError(res);
    msg.textContent = `❌ ${err.detail || "Fehler"}`;
    return;
  }

  msg.textContent = "✅ Anfrage gesendet!";
  document.getElementById("searchUsername").value = "";
  setTimeout(() => msg.textContent = "", 3000);
}

async function loadFriendRequests() {
  const res = await fetch(`${API_BASE}/friends/requests`, { headers: authHeaders() });
  if (!res.ok) return;

  const requests = await res.json();
  updateRequestsList(requests);
}

function updateRequestsList(requests) {
  const container = document.getElementById("requestsContainer");
  const indicator = document.getElementById("requestsIndicator");
  const emptyMsg = document.getElementById("emptyRequests");
  const noRequests = document.getElementById("noRequests");

  container.innerHTML = "";

  if (requests.length === 0) {
    indicator.style.display = "none";
    emptyMsg.style.display = "block";
    noRequests.style.display = "block";
    return;
  }

  indicator.style.display = "block";
  emptyMsg.style.display = "none";
  noRequests.style.display = "none";
  document.getElementById("requestCount").textContent = requests.length;

  requests.forEach(req => {
    const item = document.createElement("div");
    item.className = "request-item";
    item.innerHTML = `
      <div class="request-info">
        <div class="request-username">${escapeHtml(req.sender_username)}</div>
        <div class="request-time">${new Date(req.created_at).toLocaleDateString()}</div>
      </div>
      <div class="request-actions">
        <button class="btn primary btn-small" onclick="acceptRequest(${req.id})">✓</button>
        <button class="btn danger btn-small" onclick="declineRequest(${req.id})">✕</button>
      </div>
    `;
    container.appendChild(item);
  });
}
function addIncomingRequest(req) {
  const container = document.getElementById("requestsContainer");

  const item = document.createElement("div");
  item.className = "request-item";
  item.innerHTML = `
    <div class="request-info">
      <div class="request-username">${escapeHtml(req.sender_username)}</div>
      <div class="request-time">gerade eben</div>
    </div>
    <div class="request-actions">
      <button class="btn primary btn-small" onclick="acceptRequest(${req.id})">✓</button>
      <button class="btn danger btn-small" onclick="declineRequest(${req.id})">✕</button>
    </div>
  `;

  container.prepend(item);

  document.getElementById("requestsIndicator").style.display = "block";
  document.getElementById("requestCount").textContent =
    Number(document.getElementById("requestCount").textContent) + 1;
}


async function acceptRequest(reqId) {
  const res = await fetch(`${API_BASE}/friends/request/${reqId}/accept`, {
    method: "POST",
    headers: authHeaders()
  });

  if (res.ok) {
    await loadFriendRequests();
    await loadFriends();
  }
}

async function declineRequest(reqId) {
  const res = await fetch(`${API_BASE}/friends/request/${reqId}/decline`, {
    method: "POST",
    headers: authHeaders()
  });

  if (res.ok) {
    await loadFriendRequests();
  }
}

// ---------- Polling Funktion ----------
async function checkChatUserOnline() {
  if (!currentChatFriend) return;

  try {
    const res = await fetch(
      `${API_BASE}/users/${currentChatFriend.id}/online`,
      { headers: authHeaders() }
    );

    if (!res.ok) return;

    const data = await res.json();
    document.getElementById("chatUserStatus").style.display =
      data.online ? "inline-block" : "none";
  } catch (e) {
    console.warn("Online check failed");
  }
}
// ---------- Chat ----------
async function openChat(friend) {
  if (!friend) return;

  currentChatFriend = friend;

  // ✅ Welcome aus
  document.getElementById("noChatSelected").style.display = "none";

  // ✅ Chat UI an
  document.getElementById("chatWrapper").style.display = "flex";

  document.getElementById("chatWithUser").textContent = friend.username;

  document.getElementById("chatMessages").innerHTML = "";
  document.getElementById("chatInput").value = "";
  document.getElementById("typingIndicator").style.display = "none";

  const res = await fetch(`${API_BASE}/messages/${friend.id}`, { headers: authHeaders() });
  if (res.ok) {
    const messages = await res.json();
    messages.forEach(msg => {
      addMessageToChat(
        msg.sender_id === currentUser.id ? "Du" : friend.username,
        msg.content,
        msg.sender_id !== currentUser.id,
        msg.created_at
      );
    });
    setTimeout(() => {
      document.getElementById("chatMessages").scrollTop = document.getElementById("chatMessages").scrollHeight;
    }, 50);
  }

  showTab("chat");
  // ✅ altes Polling stoppen
  if (onlineCheckInterval) {
    clearInterval(onlineCheckInterval);
  }

  // ✅ sofort prüfen
  checkChatUserOnline();

  // ✅ alle 5 Sekunden prüfen
  onlineCheckInterval = setInterval(checkChatUserOnline, 5000);
}

function addMessageToChat(from, content, isOther, timestamp) {
  const messagesDiv = document.getElementById("chatMessages");
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${isOther ? "other" : "own"}`;
  msgDiv.innerHTML = `
    <div class="message-content">${escapeHtml(content)}</div>
    <div class="message-time">${formatTime(timestamp)}</div>
  `;
  messagesDiv.appendChild(msgDiv);
  setTimeout(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 50);
}

async function sendMessage() {
  const content = document.getElementById("chatInput").value.trim();
  if (!content || !currentChatFriend) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "message",
      friend_id: currentChatFriend.id,
      content: content
    }));

    addMessageToChat("Du", content, false, new Date().toISOString());
    document.getElementById("chatInput").value = "";
    document.getElementById("chatInput").style.height = "auto";
  }
}

const chatInput = document.getElementById("chatInput");
if (chatInput) {
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatInput.addEventListener("input", (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";

    if (ws && ws.readyState === WebSocket.OPEN && currentChatFriend) {
      ws.send(JSON.stringify({
        type: "typing",
        friend_id: currentChatFriend.id,
        is_typing: e.target.value.length > 0
      }));
    }
  });
}

// ---------- Startup ----------
showTab("login");

if (token) {
  enterApp();
  document.getElementById("chatWrapper").style.display = "none";
  document.getElementById("noChatSelected").style.display = "flex";
  showTab("chat");
}

// Touch support
document.addEventListener("touchstart", function(){}, true);

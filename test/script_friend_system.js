const API_BASE = (() => {
  const host = window.location.hostname;
  const port = "8000";
  return `http://${host}:${port}`;
})();

let token = localStorage.getItem("token") || null;
let currentUser = null;
let currentChatFriend = null;
let ws = null;

let typingUsers = new Set();
let onlineCheckInterval = null;
let reconnectTimer = null;

let authBusy = false;
let friendRequestBusy = false;
let requestActionBusy = false;
let messageLoadToken = 0;
let lastTypingSent = null;
let typingTimer = null;

// ---------- Helpers ----------
function $(id) {
  return document.getElementById(id);
}

function authHeaders(extra = {}) {
  const h = { ...extra };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function readError(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
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

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setDisplay(id, value) {
  const el = $(id);
  if (el) el.style.display = value;
}

function clearOnlinePolling() {
  if (onlineCheckInterval) {
    clearInterval(onlineCheckInterval);
    onlineCheckInterval = null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// ---------- Tabs ----------
function showTab(which) {
  // Auth Tabs aktiv anzeigen
  $("tabLogin")?.classList.toggle("active", which === "login");
  $("tabRegister")?.classList.toggle("active", which === "register");

  // Auth Views
  const loginView = $("loginView");
  const registerView = $("registerView");

  if (loginView && registerView) {
    loginView.style.display = which === "login" ? "block" : "none";
    registerView.style.display = which === "register" ? "block" : "none";
  }

  // Main Panel Views nur anfassen, wenn App existiert
  const friendsSearch = $("tab-friends-search");
  const requests = $("tab-requests");
  const chat = $("tab-chat");

  if (friendsSearch) friendsSearch.style.display = "none";
  if (requests) requests.style.display = "none";
  if (chat) chat.style.display = "none";

  if (which === "friends-search") {
    if (friendsSearch) friendsSearch.style.display = "block";
  } else if (which === "requests") {
    if (requests) requests.style.display = "block";
  } else if (which === "chat") {
    if (chat) chat.style.display = "flex";
  }
}

// ---------- Auth ----------
async function register() {
  if (authBusy) return;
  authBusy = true;

  const username = $("regUser").value.trim();
  const password = $("regPass").value;
  const msg = $("regMsg");

  if (msg) msg.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await readError(res);
      if (msg) msg.textContent = `❌ ${err.detail || "Fehler"}`;
      return;
    }

    if (msg) msg.textContent = "✅ Account erstellt! Bitte einloggen.";

    setTimeout(() => {
      showTab("login");
      if ($("loginUser")) $("loginUser").value = username;
      if ($("loginPass")) $("loginPass").value = "";
    }, 700);

  } catch (err) {
    console.error("Register failed:", err);
    if (msg) msg.textContent = "❌ Verbindung fehlgeschlagen";
  } finally {
    authBusy = false;
  }
}

async function login() {
  if (authBusy) return;
  authBusy = true;

  const username = $("loginUser").value.trim();
  const password = $("loginPass").value;
  const msg = $("authMsg");

  if (msg) msg.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await readError(res);
      if (msg) msg.textContent = `❌ ${err.detail || "Login fehlgeschlagen"}`;
      return;
    }

    const data = await res.json();
    token = data.access_token;
    localStorage.setItem("token", token);

    if (msg) msg.textContent = "";
    await enterApp();

  } catch (err) {
    console.error("Login failed:", err);
    if (msg) msg.textContent = "❌ Verbindung fehlgeschlagen";
  } finally {
    authBusy = false;
  }
}

function logout() {
  token = null;
  localStorage.removeItem("token");

  currentUser = null;
  currentChatFriend = null;
  typingUsers.clear();

  clearOnlinePolling();
  clearReconnectTimer();

  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  ws = null;

  setDisplay("appView", "none");
  setDisplay("authCard", "block");
  setDisplay("userBox", "none");

  setText("whoami", "");

  if ($("loginUser")) $("loginUser").value = "";
  if ($("loginPass")) $("loginPass").value = "";
  if ($("authMsg")) $("authMsg").textContent = "";
  if ($("regMsg")) $("regMsg").textContent = "";

  showTab("login");
}

async function enterApp() {
  const res = await fetch(`${API_BASE}/me`, { headers: authHeaders() });

  if (!res.ok) {
    alert("Auth error. Please login again.");
    logout();
    return;
  }

  currentUser = await res.json();

  setDisplay("authCard", "none");
  setDisplay("appView", "grid");
  setDisplay("userBox", "flex");
  setText("whoami", `@${currentUser.username}`);

  // Startzustand: Chat-Welcome
  setDisplay("chatWrapper", "none");
  setDisplay("noChatSelected", "flex");
  setText("chatWithUser", "Wähle einen Freund");

  connectWebSocket();

  // Performance: parallel laden statt nacheinander
  await Promise.all([
    loadFriends(),
    loadFriendRequests()
  ]);

  showTab("chat");
}

// ---------- WebSocket ----------
function connectWebSocket() {
  if (!token) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  clearReconnectTimer();

  const wsBase = API_BASE.replace("http", "ws"); // https -> wss, http -> ws
  const wsUrl = `${wsBase}/ws?token=${token}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("✅ WebSocket connected");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "message") {
      if (
        currentChatFriend &&
        (data.from_id === currentChatFriend.id || data.friend_id === currentChatFriend.id)
      ) {
        addMessageToChat(data.from, data.content, data.from_id !== currentUser.id, data.timestamp);
      }
    }

    else if (data.type === "typing") {
      if (currentChatFriend && data.from_id === currentChatFriend.id) {
        if (data.is_typing) {
          typingUsers.add(data.from_id);
          $("typingIndicator").innerHTML = `${escapeHtml(currentChatFriend.username)} schreibt...`;
          $("typingIndicator").style.display = "block";
        } else {
          typingUsers.delete(data.from_id);
          $("typingIndicator").style.display = "none";
        }
      }
    }

    else if (data.type === "friend_request:new") {
      addIncomingRequest(data.request);
    }

    else if (data.type === "friend_request:accepted") {
      loadFriends();
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  ws.onclose = () => {
    console.log("❌ WebSocket disconnected");
    ws = null;

    if (!token) return;

    // Weniger aggressiv reconnecten wegen DevTunnel
    reconnectTimer = setTimeout(connectWebSocket, 15000);
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
  const list = $("friendsList");
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
  if (friendRequestBusy) return;
  friendRequestBusy = true;

  const username = $("searchUsername").value.trim();
  const msg = $("searchMsg");

  if (!username) {
    msg.textContent = "❌ Bitte einen Username eingeben";
    friendRequestBusy = false;
    return;
  }

  try {
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
    $("searchUsername").value = "";
    setTimeout(() => msg.textContent = "", 3000);

  } catch (err) {
    console.error("Friend request failed:", err);
    msg.textContent = "❌ Verbindung fehlgeschlagen";
  } finally {
    friendRequestBusy = false;
  }
}

async function loadFriendRequests() {
  const res = await fetch(`${API_BASE}/friends/requests`, { headers: authHeaders() });
  if (!res.ok) return;

  const requests = await res.json();
  updateRequestsList(requests);
}

function updateRequestsList(requests) {
  const container = $("requestsContainer");
  const indicator = $("requestsIndicator");
  const emptyMsg = $("emptyRequests");
  const noRequests = $("noRequests");

  if (!container || !indicator || !emptyMsg || !noRequests) return;

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
  $("requestCount").textContent = requests.length;

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
  const container = $("requestsContainer");
  if (!container) return;

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

  setDisplay("requestsIndicator", "block");
  setDisplay("emptyRequests", "none");
  setDisplay("noRequests", "none");

  const count = $("requestCount");
  if (count) count.textContent = Number(count.textContent || "0") + 1;
}

async function acceptRequest(reqId) {
  if (requestActionBusy) return;
  requestActionBusy = true;

  try {
    const res = await fetch(`${API_BASE}/friends/request/${reqId}/accept`, {
      method: "POST",
      headers: authHeaders()
    });

    if (res.ok) {
      await Promise.all([
        loadFriendRequests(),
        loadFriends()
      ]);
    }
  } finally {
    requestActionBusy = false;
  }
}

async function declineRequest(reqId) {
  if (requestActionBusy) return;
  requestActionBusy = true;

  try {
    const res = await fetch(`${API_BASE}/friends/request/${reqId}/decline`, {
      method: "POST",
      headers: authHeaders()
    });

    if (res.ok) {
      await loadFriendRequests();
    }
  } finally {
    requestActionBusy = false;
  }
}

// ---------- Online Polling ----------
async function checkChatUserOnline() {
  if (!currentChatFriend) return;

  try {
    const res = await fetch(
      `${API_BASE}/users/${currentChatFriend.id}/online`,
      { headers: authHeaders() }
    );

    if (!res.ok) return;

    const data = await res.json();
    $("chatUserStatus").style.display = data.online ? "inline-block" : "none";
  } catch {
    console.warn("Online check failed");
  }
}

// ---------- Chat ----------
async function openChat(friend) {
  if (!friend) return;

  const loadId = ++messageLoadToken;
  currentChatFriend = friend;

  setDisplay("noChatSelected", "none");
  setDisplay("chatWrapper", "flex");

  setText("chatWithUser", friend.username);

  $("chatMessages").innerHTML = "";
  $("chatInput").value = "";
  $("typingIndicator").style.display = "none";

  showTab("chat");
  updateFriendsList(Array.from($("friendsList").querySelectorAll(".sidebar-item")).map(() => friend));

  try {
    const res = await fetch(`${API_BASE}/messages/${friend.id}`, { headers: authHeaders() });

    if (loadId !== messageLoadToken) return;

    if (res.ok) {
      const messages = await res.json();

      if (loadId !== messageLoadToken) return;

      messages.forEach(msg => {
        addMessageToChat(
          msg.sender_id === currentUser.id ? "Du" : friend.username,
          msg.content,
          msg.sender_id !== currentUser.id,
          msg.created_at
        );
      });

      scrollChatToBottom();
    }
  } catch (err) {
    console.error("Load messages failed:", err);
  }

  clearOnlinePolling();
  checkChatUserOnline();
  onlineCheckInterval = setInterval(checkChatUserOnline, 15000);
}

function scrollChatToBottom() {
  const messagesDiv = $("chatMessages");
  if (!messagesDiv) return;

  requestAnimationFrame(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function addMessageToChat(from, content, isOther, timestamp) {
  const messagesDiv = $("chatMessages");
  if (!messagesDiv) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${isOther ? "other" : "own"}`;
  msgDiv.innerHTML = `
    <div class="message-content">${escapeHtml(content)}</div>
    <div class="message-time">${formatTime(timestamp)}</div>
  `;

  messagesDiv.appendChild(msgDiv);
  scrollChatToBottom();
}

async function sendMessage() {
  const input = $("chatInput");
  const content = input.value.trim();

  if (!content || !currentChatFriend) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "message",
      friend_id: currentChatFriend.id,
      content
    }));

    addMessageToChat("Du", content, false, new Date().toISOString());

    input.value = "";
    input.style.height = "auto";

    sendTypingState(false);
  }
}

function sendTypingState(isTyping) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentChatFriend) return;
  if (lastTypingSent === isTyping) return;

  lastTypingSent = isTyping;

  ws.send(JSON.stringify({
    type: "typing",
    friend_id: currentChatFriend.id,
    is_typing: isTyping
  }));
}

const chatInput = $("chatInput");

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

    const isTyping = e.target.value.length > 0;

    sendTypingState(isTyping);

    clearTimeout(typingTimer);
    if (isTyping) {
      typingTimer = setTimeout(() => {
        sendTypingState(false);
      }, 1500);
    }
  });
}

// ---------- Startup ----------
showTab("login");

(async function startup() {
  if (!token) return;

  try {
    await enterApp();
  } catch (err) {
    console.error("Startup auth failed:", err);
    logout();
  }
})();

// Touch support
document.addEventListener("touchstart", function(){}, true);


const API_BASE = "http://10.0.0.7:8000";

let token = localStorage.getItem("token") || null;
let currentDocId = null;

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

// ---------- Tabs ----------
function showTab(which) {
  document.getElementById("tabLogin").classList.toggle("active", which === "login");
  document.getElementById("tabRegister").classList.toggle("active", which === "register");

  document.getElementById("loginView").style.display = which === "login" ? "block" : "none";
  document.getElementById("registerView").style.display = which === "register" ? "block" : "none";
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
    msg.textContent = `❌ Registrierung fehlgeschlagen: ${err.detail || res.status}`;
    return;
  }

  msg.textContent = "✅ Account erstellt! Jetzt einloggen.";
  showTab("login");
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
    msg.textContent = `❌ Login fehlgeschlagen: ${err.detail || res.status}`;
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
  currentDocId = null;

  document.getElementById("appView").style.display = "none";
  document.getElementById("authCard").style.display = "block";
  document.getElementById("userBox").style.display = "none";
  document.getElementById("whoami").textContent = "";

  showTab("login");
}

async function enterApp() {
  const res = await fetch(`${API_BASE}/me`, { headers: authHeaders() });

  if (!res.ok) {
    const err = await readError(res);
    alert(`Auth Fehler: ${err.detail || res.status}. Bitte neu einloggen.`);
    logout();
    return;
  }

  const me = await res.json();

  document.getElementById("authCard").style.display = "none";
  document.getElementById("appView").style.display = "grid";
  document.getElementById("userBox").style.display = "flex";
  document.getElementById("whoami").textContent = `@${me.username}`;

  await loadNotes();
}

// ---------- Notes (Docs) ----------
async function loadNotes() {
  const list = document.getElementById("docList");
  if (!list) {
    console.error("❌ Element #docList nicht gefunden. Prüfe HTML id='docList'");
    return;
  }

  const res = await fetch(`${API_BASE}/notes`, {
    headers: authHeaders(),
    cache: "no-store"
  });

  if (!res.ok) {
    const err = await readError(res);
    alert("Notes laden fehlgeschlagen: " + (err.detail || res.status));
    logout();
    return;
  }

  const notes = await res.json();
  list.innerHTML = "";

  if (!Array.isArray(notes) || notes.length === 0) {
    list.innerHTML = `<div class="empty">Noch keine Dateien. Klick “Neu”.</div>`;
    currentDocId = null;
    document.getElementById("docTitle").value = "";
    document.getElementById("docContent").value = "";
    return;
  }

  notes.forEach(n => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "docitem" + (n.id === currentDocId ? " active" : "");
    item.innerHTML = `
      <div class="docname">${escapeHtml(n.title)}</div>
      <div class="doctime">${escapeHtml(n.updated_at || "")}</div>
    `;
    item.onclick = () => openNote(n.id);
    list.appendChild(item);
  });

  if (currentDocId === null && notes[0]) {
    await openNote(notes[0].id);
  }
}

async function newDoc() {
  const title = prompt("Titel der neuen Datei?");
  if (!title) return;

  const res = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title })
  });

  if (!res.ok) {
    const err = await readError(res);
    alert("Konnte Datei nicht erstellen: " + (err.detail || res.status));
    return;
  }

  const data = await res.json();
  currentDocId = data.id;

  await loadNotes();
  await openNote(currentDocId);
}

async function openNote(id) {
  const res = await fetch(`${API_BASE}/notes/${id}`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    const err = await readError(res);
    alert("Konnte Datei nicht laden: " + (err.detail || res.status));
    return;
  }

  const doc = await res.json();
  currentDocId = doc.id;

  document.getElementById("docTitle").value = doc.title;
  document.getElementById("docContent").value = doc.content;
  document.getElementById("saveMsg").textContent = "";

  await loadNotes();
}

async function saveCurrent() {
  if (currentDocId === null) {
    alert("Erst eine Datei öffnen oder neu erstellen.");
    return;
  }

  const title = document.getElementById("docTitle").value.trim();
  const content = document.getElementById("docContent").value;

  const res = await fetch(`${API_BASE}/notes/${currentDocId}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title, content })
  });

  const msg = document.getElementById("saveMsg");
  if (!res.ok) {
    const err = await readError(res);
    msg.textContent = "❌ Speichern fehlgeschlagen: " + (err.detail || res.status);
    return;
  }

  msg.textContent = "✅ Gespeichert.";
  await loadNotes();
}

async function deleteCurrent() {
  if (currentDocId === null) return;
  if (!confirm("Datei wirklich löschen?")) return;

  const res = await fetch(`${API_BASE}/notes/${currentDocId}`, {
    method: "DELETE",
    headers: authHeaders()
  });

  if (!res.ok) {
    const err = await readError(res);
    alert("Löschen fehlgeschlagen: " + (err.detail || res.status));
    return;
  }

  currentDocId = null;
  document.getElementById("docTitle").value = "";
  document.getElementById("docContent").value = "";
  document.getElementById("saveMsg").textContent = "";

  await loadNotes();
}

// ---------- Startup ----------
showTab("login");

if (token) {
  enterApp();
}
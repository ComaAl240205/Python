// src/auth.js

import { state, setToken, setUser, setView, resetState } from "./state.js";
import { $ } from "./utils.js";
import { apiLogin, apiRegister, apiMe } from "./api.js";
import { render } from "./app.js";
import { loadFriends, loadFriendRequests } from "./friends.js";
import { connectWebSocket, disconnectWebSocket } from "./ws.js";
import { stopOnlinePolling } from "./chat.js";

export async function register() {
  if (state.authBusy) return;
  state.authBusy = true;

  const username = $("regUser")?.value.trim();
  const password = $("regPass")?.value;
  const msg = $("regMsg");

  if (msg) msg.textContent = "";

  try {
    await apiRegister(username, password);

    if (msg) msg.textContent = "✅ Account erstellt! Bitte einloggen.";

    setTimeout(() => {
      setView("login");
      render();

      const loginInput = $("loginUser");
      if (loginInput) loginInput.value = username;
    }, 600);

  } catch (err) {
    if (msg) msg.textContent = `❌ ${err.detail || "Registrierung fehlgeschlagen"}`;
  } finally {
    state.authBusy = false;
  }
}

export async function login() {
  if (state.authBusy) return;
  state.authBusy = true;

  const username = $("loginUser")?.value.trim();
  const password = $("loginPass")?.value;
  const msg = $("authMsg");

  if (msg) msg.textContent = "";

  try {
    const data = await apiLogin(username, password);
    setToken(data.access_token);

    const user = await apiMe();
    setUser(user);

    await Promise.all([
      loadFriends(false),
      loadFriendRequests(false)
    ]);

    connectWebSocket();

    setView("chat");
    render();

  } catch (err) {
    if (msg) msg.textContent = `❌ ${err.detail || "Login fehlgeschlagen"}`;
  } finally {
    state.authBusy = false;
  }
}

export function logout() {
  disconnectWebSocket();
  stopOnlinePolling();
  resetState();
  render();
}

export async function restoreSession() {
  if (!state.token) return;

  try {
    const user = await apiMe();
    setUser(user);

    await Promise.all([
      loadFriends(false),
      loadFriendRequests(false)
    ]);

    connectWebSocket();

    setView("chat");
  } catch {
    resetState();
  }
}
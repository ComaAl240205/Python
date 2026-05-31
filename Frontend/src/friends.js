// src/friends.js

import { state, setFriends, setRequests, setView } from "./state.js";
import {
  apiFriends,
  apiFriendRequests,
  apiSendFriendRequest,
  apiAcceptRequest,
  apiDeclineRequest
} from "./api.js";
import { $ } from "./utils.js";
import { render } from "./app.js";

export async function loadFriends(doRender = true) {
  try {
    const friends = await apiFriends();
    setFriends(friends);

    if (doRender) render();
  } catch (err) {
    console.error("Failed to load friends:", err);
  }
}

export async function loadFriendRequests(doRender = true) {
  try {
    const requests = await apiFriendRequests();
    setRequests(requests);

    if (doRender) render();
  } catch (err) {
    console.error("Failed to load requests:", err);
  }
}

export async function sendFriendRequest() {
  if (state.friendRequestBusy) return;
  state.friendRequestBusy = true;

  const username = $("searchUsername")?.value.trim();
  const msg = $("searchMsg");

  if (!username) {
    if (msg) msg.textContent = "❌ Bitte einen Username eingeben";
    state.friendRequestBusy = false;
    return;
  }

  try {
    await apiSendFriendRequest(username);

    if (msg) msg.textContent = "✅ Anfrage gesendet!";
    if ($("searchUsername")) $("searchUsername").value = "";

    setTimeout(() => {
      const currentMsg = $("searchMsg");
      if (currentMsg) currentMsg.textContent = "";
    }, 3000);

  } catch (err) {
    if (msg) msg.textContent = `❌ ${err.detail || "Fehler"}`;
  } finally {
    state.friendRequestBusy = false;
  }
}

export async function acceptRequest(id) {
  if (state.requestActionBusy) return;
  state.requestActionBusy = true;

  try {
    await apiAcceptRequest(id);

    await Promise.all([
      loadFriendRequests(false),
      loadFriends(false)
    ]);

    setView("chat");
    render();

  } catch (err) {
    console.error("Accept failed:", err);
  } finally {
    state.requestActionBusy = false;
  }
}

export async function declineRequest(id) {
  if (state.requestActionBusy) return;
  state.requestActionBusy = true;

  try {
    await apiDeclineRequest(id);
    await loadFriendRequests(false);
    render();

  } catch (err) {
    console.error("Decline failed:", err);
  } finally {
    state.requestActionBusy = false;
  }
}
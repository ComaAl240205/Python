// src/ws.js

import { API_BASE } from "./config.js";
import { state, addMessage, setRequests } from "./state.js";
import { render } from "./app.js";
import { loadFriends } from "./friends.js";
import { scrollChatToBottom } from "./chat.js";

export function connectWebSocket() {
  if (!state.token) return;

  if (
    state.ws &&
    (
      state.ws.readyState === WebSocket.OPEN ||
      state.ws.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }

  clearReconnect();

  const wsBase = API_BASE.replace(/^http/, "ws");
  const wsUrl = `${wsBase}/ws?token=${state.token}`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log("✅ WebSocket connected");
  };

  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "message") {
        // Wichtig: eigene WS-Messages ignorieren, sonst doppelt möglich
        if (data.from_id === state.currentUser?.id) return;

        if (
            state.currentChatFriend &&
            (
            data.from_id === state.currentChatFriend.id ||
            data.friend_id === state.currentChatFriend.id
            )
        ) {
            addMessage({
                id: crypto.randomUUID(),
                sender_id: data.from_id,
                receiver_id: state.currentUser.id,
                content: data.content,
                created_at: data.timestamp
            });

            render();
            scrollChatToBottom();
        }
    }

    else if (data.type === "typing") {
      const el = document.getElementById("typingIndicator");

      if (
        el &&
        state.currentChatFriend &&
        data.from_id === state.currentChatFriend.id
      ) {
        el.style.display = data.is_typing ? "block" : "none";
        el.textContent = data.is_typing
          ? `${state.currentChatFriend.username} schreibt...`
          : "";
      }
    }

    else if (data.type === "friend_request:new") {
      const exists = state.requests.some(r => r.id === data.request.id);
      if (!exists) {
        setRequests([data.request, ...state.requests]);
        render();
      }
    }

    else if (data.type === "friend_request:accepted") {
      loadFriends();
    }
  };

  state.ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  state.ws.onclose = () => {
    console.log("❌ WebSocket disconnected");
    state.ws = null;

    if (!state.token) return;

    state.reconnectTimer = setTimeout(connectWebSocket, 15000);
  };
}

export function disconnectWebSocket() {
  clearReconnect();

  if (state.ws) {
    state.ws.onclose = null;
    state.ws.close();
  }

  state.ws = null;
}

function clearReconnect() {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
}
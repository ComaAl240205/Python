// src/chat.js

import {
  state,
  setCurrentChatFriend,
  setMessages,
  addMessage,
  setView
} from "./state.js";
import { apiMessages, apiOnline } from "./api.js";
import { render } from "./app.js";
import { $ } from "./utils.js";

export async function openChat(friendId) {
  const friend = state.friends.find(f => String(f.id) === String(friendId));
  if (!friend) return;

  setCurrentChatFriend(friend);
  setMessages([]);
  setView("chat");
  render();

  try {
    const messages = await apiMessages(friend.id);
    setMessages(messages);
    render();
    scrollChatToBottom();
    startOnlinePolling();
  } catch (err) {
    console.error("Load messages failed:", err);
  }
}



export function sendMessage() {
  const input = $("chatInput");
  if (!input || !state.currentChatFriend) return;

  const content = input.value.trim();
  if (!content) return;

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket nicht verbunden");
    return;
  }

  const clientId = crypto.randomUUID();
  const now = new Date().toISOString();

  state.ws.send(JSON.stringify({
    type: "message",
    client_id: clientId,
    friend_id: state.currentChatFriend.id,
    content
}));




addMessage({
    id: clientId,
    client_id: clientId,
    sender_id: state.currentUser.id,
    receiver_id: state.currentChatFriend.id,
    content,
    created_at: now
  });

  input.value = "";
  input.style.height = "auto";

  sendTypingState(false);

  render();
  scrollChatToBottom();
}


export function sendTypingState(isTyping) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  if (!state.currentChatFriend) return;
  if (state.lastTypingSent === isTyping) return;

  state.lastTypingSent = isTyping;

  state.ws.send(JSON.stringify({
    type: "typing",
    friend_id: state.currentChatFriend.id,
    is_typing: isTyping
  }));
}

export function handleChatInput(event) {
  const input = event.target;
  if (!input || input.id !== "chatInput") return;

  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 100) + "px";

  const isTyping = input.value.length > 0;

  sendTypingState(isTyping);

  clearTimeout(state.typingTimer);

  if (isTyping) {
    state.typingTimer = setTimeout(() => {
      sendTypingState(false);
    }, 1500);
  }
}

export function handleChatKeydown(event) {
  if (event.target?.id !== "chatInput") return;

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

export function scrollChatToBottom() {
  requestAnimationFrame(() => {
    const box = $("chatMessages");
    if (box) box.scrollTop = box.scrollHeight;
  });
}

export async function checkChatUserOnline() {
  if (!state.currentChatFriend) return;

  try {
    const data = await apiOnline(state.currentChatFriend.id);
    const el = $("chatUserStatus");

    if (el) {
      el.style.display = data.online ? "inline-block" : "none";
    }
  } catch {
    // ignore
  }
}

export function startOnlinePolling() {
  stopOnlinePolling();

  checkChatUserOnline();
  state.onlineCheckInterval = setInterval(checkChatUserOnline, 30000);
}

export function stopOnlinePolling() {
  if (state.onlineCheckInterval) {
    clearInterval(state.onlineCheckInterval);
    state.onlineCheckInterval = null;
  }
}
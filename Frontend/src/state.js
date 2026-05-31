// src/state.js

export const state = {
  token: localStorage.getItem("token") || null,

  currentUser: null,
  currentChatFriend: null,

  view: "login",

  friends: [],
  requests: [],
  messages: [],

  ws: null,
  onlineCheckInterval: null,
  reconnectTimer: null,

  authBusy: false,
  friendRequestBusy: false,
  requestActionBusy: false,
  typingTimer: null,
  lastTypingSent: null
};

export function setView(view) {
  state.view = view;
}

export function setToken(token) {
  state.token = token;

  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

export function setUser(user) {
  state.currentUser = user;
}

export function setFriends(friends) {
  state.friends = friends || [];
}

export function setRequests(requests) {
  state.requests = requests || [];
}

export function setMessages(messages) {
  state.messages = messages || [];
}


export function addMessage(message) {
  const incomingId = message.id || message.client_id;

  // 1) Wenn Message eine ID hat, darüber deduplizieren
  if (incomingId) {
    const alreadyExists = state.messages.some(m => {
      return (
        m.id === incomingId ||
        m.client_id === incomingId ||
        m.id === message.client_id ||
        m.client_id === message.id
      );
    });

    if (alreadyExists) return;
  }

  // 2) Fallback-Dedupe ohne ID
  const fallbackExists = state.messages.some(m => {
    return (
      String(m.sender_id) === String(message.sender_id) &&
      String(m.receiver_id) === String(message.receiver_id) &&
      String(m.content) === String(message.content) &&
      String(m.created_at) === String(message.created_at)
    );
  });

  if (fallbackExists) return;

  // 3) Message speichern
  state.messages.push(message);

  // 4) Performance: nur letzte 100 Nachrichten im State behalten
  if (state.messages.length > 100) {
    state.messages = state.messages.slice(-100);
  }
}

export function setCurrentChatFriend(friend) {
  state.currentChatFriend = friend;
}

export function resetState() {
  state.token = null;
  state.currentUser = null;
  state.currentChatFriend = null;
  state.view = "login";

  state.friends = [];
  state.requests = [];
  state.messages = [];

  state.ws = null;
  state.onlineCheckInterval = null;
  state.reconnectTimer = null;

  state.authBusy = false;
  state.friendRequestBusy = false;
  state.requestActionBusy = false;
  state.typingTimer = null;
  state.lastTypingSent = null;

  localStorage.removeItem("token");
}
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

  authBusy: false
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

  localStorage.removeItem("token");
}
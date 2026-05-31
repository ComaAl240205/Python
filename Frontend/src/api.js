// src/api.js

import { API_BASE } from "./config.js";
import { state } from "./state.js";

export function authHeaders(extra = {}) {
  const headers = { ...extra };

  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  return headers;
}

export async function readError(res) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);

  if (!res.ok) {
    throw await readError(res);
  }

  return await res.json();
}

// Auth
export function apiRegister(username, password) {
  return request("/register", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ username, password })
  });
}

export function apiLogin(username, password) {
  return request("/login", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ username, password })
  });
}

export function apiMe() {
  return request("/me", {
    headers: authHeaders()
  });
}

// Friends
export function apiFriends() {
  return request("/friends", {
    headers: authHeaders()
  });
}

export function apiFriendRequests() {
  return request("/friends/requests", {
    headers: authHeaders()
  });
}

export function apiSendFriendRequest(receiver_username) {
  return request("/friends/request", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ receiver_username })
  });
}

export function apiAcceptRequest(id) {
  return request(`/friends/request/${id}/accept`, {
    method: "POST",
    headers: authHeaders()
  });
}

export function apiDeclineRequest(id) {
  return request(`/friends/request/${id}/decline`, {
    method: "POST",
    headers: authHeaders()
  });
}

// Chat
export function apiMessages(friendId) {
  return request(`/messages/${friendId}`, {
    headers: authHeaders()
  });
}

export function apiOnline(userId) {
  return request(`/users/${userId}/online`, {
    headers: authHeaders()
  });
}
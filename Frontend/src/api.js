// src/api.js
// Alle Backend-Requests an einem Ort.

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

export async function apiRegister(username, password) {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    throw await readError(res);
  }

  return await res.json();
}

export async function apiLogin(username, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    throw await readError(res);
  }

  return await res.json();
}

export async function apiMe() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: authHeaders()
  });

  if (!res.ok) {
    throw await readError(res);
  }

  return await res.json();
}

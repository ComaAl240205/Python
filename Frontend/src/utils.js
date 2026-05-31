// src/utils.js
// Kleine Hilfsfunktionen, die mehrere Dateien brauchen.

export function $(id) {
  return document.getElementById(id);
}

export function escapeHtml(value) {
  const s = String(value ?? "");

  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatTime(isoString) {
  try {
    const date = new Date(isoString);

    return date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

export function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

export function setDisplay(id, value) {
  const el = $(id);
  if (el) el.style.display = value;
}

export function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map(b => b.toString(16).padStart(2, "0"));

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
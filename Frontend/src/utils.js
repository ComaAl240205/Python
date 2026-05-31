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
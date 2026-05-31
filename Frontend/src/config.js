// src/config.js
// Zentrale Konfiguration.
// Wenn sich deine Backend-URL ändert, musst du später nur diese Datei ändern.

export const API_BASE = (() => {
  const host = window.location.hostname;

  // Lokal:
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8000";
  }

  // DevTunnel / öffentlich:
  // Wenn du wieder DevTunnel nutzt, kannst du später hier fest setzen:
  // return "https://705rmzkj-8000.euw.devtunnels.ms";

  return `http://${host}:8000`;
})();
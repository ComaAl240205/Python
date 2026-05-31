// src/app.js
// Startpunkt der Frontend-App.

import { state, setView } from "./state.js";
import { $ } from "./utils.js";
import { layoutView } from "./views/layoutView.js";
import { login, register, logout, restoreSession } from "./auth.js";

export function render() {
  const app = $("app");

  if (!app) {
    console.error("Root element #app wurde nicht gefunden.");
    return;
  }

  app.innerHTML = layoutView(state);
}

document.addEventListener("click", async (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  if (action === "show-login") {
    setView("login");
    render();
    return;
  }

  if (action === "show-register") {
    setView("register");
    render();
    return;
  }

  if (action === "login") {
    await login();
    return;
  }

  if (action === "register") {
    await register();
    return;
  }

  if (action === "logout") {
    logout();
    return;
  }
});

// Touch support behalten
document.addEventListener("touchstart", function () {}, true);

// Start
render();

// Wenn Token vorhanden ist, Session wiederherstellen
await restoreSession();
render();
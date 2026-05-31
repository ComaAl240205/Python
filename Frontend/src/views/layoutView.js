// src/views/layoutView.js
// Grundlayout der App.
// Phase 2: Auth oder eingeloggter Placeholder.

import { authView } from "./authView.js";

export function layoutView(state) {
  const loggedIn = !!state.currentUser;

  return `
    <div class="container">

      <!-- TOPBAR -->
      <header class="topbar">
        <div>
          <h1>Connected</h1>
          <p class="sub">Freunde finden, chatten, verbunden bleiben.</p>
        </div>

        <div class="userbox" id="userBox" style="display:${loggedIn ? "flex" : "none"};">
          <span id="whoami">${loggedIn ? "@" + state.currentUser.username : ""}</span>
          <button class="btn ghost" data-action="logout">Logout</button>
        </div>
      </header>

      ${
        loggedIn
          ? `
            <section class="card">
              <h2 class="panel-title">✅ Eingeloggt</h2>
              <p class="hint">
                Login funktioniert. In Phase 3 bauen wir hier Sidebar, Freunde, Requests und Chat wieder ein.
              </p>
            </section>
          `
          : authView(state.view)
      }

    </div>
  `;
}
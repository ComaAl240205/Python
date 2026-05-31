// src/views/layoutView.js

import { authView } from "./authView.js";
import { sidebarView } from "./sidebarView.js";
import { chatView } from "./chatView.js";
import { requestsView } from "./requestsView.js";
import { addFriendView } from "./addFriendView.js";

export function layoutView(state) {
  const loggedIn = !!state.currentUser;

  return `
    <div class="container">

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
        !loggedIn
          ? authView(state.view)
          : `
            <section class="app-layout" id="appView">
              ${sidebarView(state)}

              <main class="main-panel">
                ${
                  state.view === "addFriend"
                    ? addFriendView(state)
                    : state.view === "requests"
                      ? requestsView(state)
                      : chatView(state)
                }
              </main>
            </section>
          `
      }

    </div>
  `;
}
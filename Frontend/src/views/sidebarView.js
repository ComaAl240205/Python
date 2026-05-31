// src/views/sidebarView.js

import { escapeHtml } from "../utils.js";

function initials(name) {
  return String(name || "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export function sidebarView(state) {
  const friends = state.friends || [];
  const requests = state.requests || [];
  const currentId = state.currentChatFriend?.id;

  return `
    <aside class="sidebar">

      <div class="sidebar-section">
        <div class="sidebar-head">
          <h2>Freunde</h2>
          <button class="btn small" data-action="show-add-friend">
            + Hinzufügen
          </button>
        </div>

        <div id="friendsList" class="sidebar-list">
          ${
            friends.length === 0
              ? `
                <div class="sidebar-item"
                  style="background:transparent;border:none;color:var(--text-muted);font-size:12px;">
                  Keine Freunde
                </div>
              `
              : friends.map(friend => `
                <button 
                  class="sidebar-item ${currentId === friend.id ? "active" : ""}" 
                  data-action="open-chat" 
                  data-friend-id="${friend.id}"
                >
                  <div class="sidebar-item-name">
                    <span class="avatar">
                      ${escapeHtml(initials(friend.username))}
                    </span>

                    <span>
                      ${escapeHtml(friend.username)}
                    </span>
                  </div>
                </button>
              `).join("")
          }
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-head">
          <h2>Anfragen</h2>
        </div>

        <div 
          id="requestsIndicator" 
          class="sidebar-item" 
          data-action="show-requests"
          style="display:${requests.length > 0 ? "flex" : "none"};"
        >
          <div class="sidebar-item-name">
            📬 <span id="requestCount">${requests.length}</span> neue
          </div>
        </div>

        <div 
          id="noRequests" 
          class="sidebar-item" 
          style="
            background:transparent;
            border:none;
            cursor:default;
            color:var(--text-muted);
            font-size:12px;
            display:${requests.length > 0 ? "none" : "block"};
          "
        >
          Keine Anfragen
        </div>
      </div>

    </aside>
  `;
}
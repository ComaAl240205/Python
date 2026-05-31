// src/views/requestsView.js

import { escapeHtml } from "../utils.js";

export function requestsView(state) {
  const requests = state.requests || [];

  return `
    <section id="tab-requests">
      <div class="panel-head">
        <h2 class="panel-title">Freundschaftsanfragen</h2>
      </div>

      <div class="panel-content">
        <div id="requestsContainer" style="display:flex;flex-direction:column;gap:12px;">
          ${
            requests.length === 0
              ? `
                <div id="emptyRequests" class="empty-state">
                  <div class="empty-state-icon">✓</div>
                  <p>Keine neuen Anfragen</p>
                </div>
              `
              : requests.map(req => `
                <div class="request-item">
                  <div class="request-info">
                    <div class="request-username">${escapeHtml(req.sender_username)}</div>
                    <div class="request-time">
                      ${req.created_at ? new Date(req.created_at).toLocaleDateString() : ""}
                    </div>
                  </div>

                  <div class="request-actions">
                    <button class="btn primary btn-small" data-action="accept-request" data-request-id="${req.id}">✓</button>
                    <button class="btn danger btn-small" data-action="decline-request" data-request-id="${req.id}">✕</button>
                  </div>
                </div>
              `).join("")
          }
        </div>
      </div>
    </section>
  `;
}
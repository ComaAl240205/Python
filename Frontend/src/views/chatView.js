// src/views/chatView.js

import { escapeHtml, formatTime } from "../utils.js";

function groupedReactions(reactions = []) {
  const map = new Map();

  reactions.forEach(r => {
    if (!r || !r.emoji) return;
    map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
  });

  return [...map.entries()];
}

export function chatView(state) {
  const friend = state.currentChatFriend;
  const messages = state.messages || [];

  return `
    <section id="tab-chat" class="chat-container">
      <div class="panel-head" id="chatHead">
        <h2 class="panel-title">
          <span class="status-online" id="chatUserStatus" style="display:none;"></span>
          <span id="chatWithUser">
            ${friend ? escapeHtml(friend.username) : "Wähle einen Freund"}
          </span>
        </h2>
      </div>

      ${
        !friend
          ? `
            <div 
              id="noChatSelected" 
              class="empty-state"
              style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;"
            >
              <div class="empty-state-icon">👋</div>
              <p style="max-width:320px;text-align:center;">
                Wähle links einen Freund aus<br>
                oder füge einen neuen hinzu, um zu chatten
              </p>
            </div>
          `
          : `
            <div id="chatWrapper" style="display:flex;flex:1;flex-direction:column;">
              <div class="chat-messages" id="chatMessages">
                ${
                  messages.map(msg => {
                    const own = msg.sender_id === state.currentUser.id;
                    const groups = groupedReactions(msg.reactions || []);

                    return `
                      <div 
                        class="message ${own ? "own" : "other"}"
                        data-message-id="${escapeHtml(msg.id)}"
                      >
                        <div class="message-content">
                          ${escapeHtml(msg.content)}
                        </div>

                        ${
                          groups.length > 0
                            ? `
                              <div class="reaction-bar">
                                ${
                                  groups.map(([emoji, count]) => `
                                    <span class="reaction-pill">
                                      <span>${emoji}</span>
                                      <strong>${count}</strong>
                                    </span>
                                  `).join("")
                                }
                              </div>
                            `
                            : ""
                        }

                        <div class="message-time">
                          ${formatTime(msg.created_at)}
                        </div>
                      </div>
                    `;
                  }).join("")
                }
              </div>

              <div 
                id="typingIndicator" 
                class="typing-indicator" 
                style="padding:0 20px;display:none;"
              ></div>

              <div class="chat-input-area">
                <textarea 
                  id="chatInput" 
                  placeholder="Schreib eine Nachricht..." 
                  rows="1"
                ></textarea>

                <button 
                  class="btn primary chat-send-btn" 
                  data-action="send-message"
                >
                  ↑
                </button>
              </div>
            </div>
          `
      }
    </section>
  `;
}
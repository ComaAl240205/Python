// src/views/chatView.js

import { escapeHtml, formatTime } from "../utils.js";

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

                    return `
                      <div class="message ${own ? "own" : "other"}">
                        <div class="message-content">
                          ${escapeHtml(msg.content)}
                        </div>
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
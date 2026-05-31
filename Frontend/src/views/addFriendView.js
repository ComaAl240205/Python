// src/views/addFriendView.js

export function addFriendView() {
  return `
    <section id="tab-friends-search">
      <div class="panel-head">
        <h2 class="panel-title">Neue Freunde hinzufügen</h2>
      </div>

      <div class="panel-content">
        <div class="form-group">
          <label>Benutzername suchen</label>
          <input id="searchUsername" type="text" placeholder="Gib einen Username ein..." />
        </div>

        <button class="btn primary add-friend-btn" data-action="send-friend-request">
          Anfrage senden
        </button>

        <p class="hint" id="searchMsg"></p>
        <div id="searchResults" style="margin-top:20px;"></div>
      </div>
    </section>
  `;
}
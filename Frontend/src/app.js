// src/app.js

import { state, setView } from "./state.js";
import { $ } from "./utils.js";
import { layoutView } from "./views/layoutView.js";
import { login, register, logout, restoreSession } from "./auth.js";
import {
  sendFriendRequest,
  acceptRequest,
  declineRequest
} from "./friends.js";
import {
  openChat,
  sendMessage,
  handleChatInput,
  handleChatKeydown,
  sendReaction
} from "./chat.js";

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

  if (action === "show-add-friend") {
    setView("addFriend");
    render();
    return;
  }

  if (action === "show-requests") {
    setView("requests");
    render();
    return;
  }

  if (action === "send-friend-request") {
    await sendFriendRequest();
    return;
  }

  if (action === "accept-request") {
    await acceptRequest(actionEl.dataset.requestId);
    return;
  }

  if (action === "decline-request") {
    await declineRequest(actionEl.dataset.requestId);
    return;
  }

  if (action === "open-chat") {
    await openChat(actionEl.dataset.friendId);
    return;
  }

  if (action === "send-message") {
    sendMessage();
    return;
  }
});

document.addEventListener("input", handleChatInput);
document.addEventListener("keydown", handleChatKeydown);

document.addEventListener("touchstart", function () {}, true);

document.addEventListener("reaction:selected", (event) => {
  const { messageId, emoji } = event.detail || {};

  console.log("reaction:selected", messageId, emoji);

  if (!messageId || !emoji) return;

  sendReaction(messageId, emoji);
});

render();

await restoreSession();
render();
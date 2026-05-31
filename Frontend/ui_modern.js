/* ===========================
   ui_modern.js (v3)
   Compatible mit neuer modularer App
   - Smooth cursor spotlight
   - Toast system
   - Sidebar collapse
   - Reactions für Chat Messages
   - Kein Zugriff auf alte window.login/window.acceptRequest Funktionen
   =========================== */

(function () {
  "use strict";

  /* ---------------------------
     1) Cursor Spotlight smooth
  --------------------------- */
  let mx = 50;
  let my = 20;
  let raf = null;

  function updateSpotlight(x, y) {
    mx = Math.max(0, Math.min(100, (x / window.innerWidth) * 100));
    my = Math.max(0, Math.min(100, (y / window.innerHeight) * 100));

    if (raf) return;

    raf = requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--mx", `${mx}%`);
      document.documentElement.style.setProperty("--my", `${my}%`);
      raf = null;
    });
  }

  document.addEventListener("mousemove", (e) => {
    updateSpotlight(e.clientX, e.clientY);
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    updateSpotlight(t.clientX, t.clientY);
  }, { passive: true });


  /* ---------------------------
     2) Toast system
  --------------------------- */
  function safeText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function initToasts() {
    if (document.querySelector(".toast-wrap")) return;

    const wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);

    window.toast = function (type = "info", title = "", msg = "") {
      const t = document.createElement("div");
      t.className = `toast toast-${type}`;

      const icon = document.createElement("div");
      icon.className = "t-icon";
      icon.textContent =
        type === "success" ? "✓" :
        type === "danger" ? "!" :
        type === "warning" ? "⚠" : "✨";

      const body = document.createElement("div");
      body.innerHTML = `
        <p class="t-title">${safeText(title)}</p>
        <p class="t-msg">${safeText(msg)}</p>
      `;

      const close = document.createElement("button");
      close.className = "t-close";
      close.type = "button";
      close.textContent = "×";
      close.addEventListener("click", () => t.remove());

      t.appendChild(icon);
      t.appendChild(body);
      t.appendChild(close);
      wrap.appendChild(t);

      setTimeout(() => {
        t.style.opacity = "0";
        t.style.transform = "translateY(-8px) scale(.98)";
        setTimeout(() => t.remove(), 220);
      }, 2800);
    };
  }

  initToasts();


  /* ---------------------------
     3) Sidebar collapse
  --------------------------- */
  function sectionKey(section, index) {
    const title = section.querySelector(".sidebar-head h2")?.textContent?.trim();
    return `connected_sidebar_collapse_${title || index}`;
  }

  function setupSidebarCollapse() {
    document.querySelectorAll(".sidebar-section").forEach((section, index) => {
      const head = section.querySelector(".sidebar-head");
      if (!head) return;
      if (head.querySelector(".collapse-btn")) return;

      const key = sectionKey(section, index);

      const btn = document.createElement("button");
      btn.className = "collapse-btn";
      btn.type = "button";

      const restored = localStorage.getItem(key) === "1";
      if (restored) section.classList.add("collapsed");

      btn.textContent = section.classList.contains("collapsed") ? "+" : "–";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const collapsed = section.classList.toggle("collapsed");
        btn.textContent = collapsed ? "+" : "–";
        localStorage.setItem(key, collapsed ? "1" : "0");
      });

      head.appendChild(btn);
    });
  }


  /* ---------------------------
     4) Reactions
  --------------------------- */
  let pickerEl = null;
  let pressTimer = null;

  // UI-only reactions bleiben nach render() erhalten,
  // solange Inhalt + Zeit gleich bleiben.
  const reactionStore = new Map();

  function closePicker() {
    if (pickerEl) pickerEl.remove();
    pickerEl = null;
  }

  function getMessageEl(target) {
    return target.closest(".message");
  }

  function messageKey(messageEl) {
    const content = messageEl.querySelector(".message-content")?.textContent?.trim() || "";
    const time = messageEl.querySelector(".message-time")?.textContent?.trim() || "";
    const side = messageEl.classList.contains("own") ? "own" : "other";
    return `${side}|${time}|${content}`;
  }

  function renderReactionBar(messageEl) {
    const key = messageKey(messageEl);
    const reactions = reactionStore.get(key);

    let oldBar = messageEl.querySelector(".reaction-bar");
    if (oldBar) oldBar.remove();

    if (!reactions || reactions.size === 0) return;

    const bar = document.createElement("div");
    bar.className = "reaction-bar";

    reactions.forEach((count, emoji) => {
      const pill = document.createElement("span");
      pill.className = "reaction-pill";
      pill.dataset.emoji = emoji;
      pill.innerHTML = `<span>${emoji}</span><strong>${count}</strong>`;
      bar.appendChild(pill);
    });

    messageEl.appendChild(bar);
  }

  function addReaction(messageEl, emoji) {
    if (!messageEl) return;

    const key = messageKey(messageEl);

    if (!reactionStore.has(key)) {
      reactionStore.set(key, new Map());
    }

    const reactions = reactionStore.get(key);
    reactions.set(emoji, (reactions.get(emoji) || 0) + 1);

    renderReactionBar(messageEl);
  }

  function restoreAllReactions() {
    document.querySelectorAll(".message").forEach(renderReactionBar);
  }

  function openPickerAt(x, y, messageEl) {
    closePicker();

    pickerEl = document.createElement("div");
    pickerEl.className = "reaction-picker";

    ["❤️", "😂", "🔥", "👍", "😮", "🎉", "😢", "👀"].forEach((emoji) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = emoji;

      b.addEventListener("click", () => {
        addReaction(messageEl, emoji);
        closePicker();

        if (window.toast) {
          window.toast("info", "Reaction", `Reagiert mit ${emoji}`);
        }
      });

      pickerEl.appendChild(b);
    });

    document.body.appendChild(pickerEl);

    const rect = pickerEl.getBoundingClientRect();
    const px = Math.min(Math.max(12, x), window.innerWidth - rect.width - 12);
    const py = Math.min(Math.max(12, y), window.innerHeight - rect.height - 12);

    pickerEl.style.left = `${px}px`;
    pickerEl.style.top = `${py}px`;
  }

  document.addEventListener("click", (e) => {
    if (pickerEl && !pickerEl.contains(e.target)) {
      closePicker();
    }
  });

  document.addEventListener("contextmenu", (e) => {
    const msg = getMessageEl(e.target);
    if (!msg) return;

    e.preventDefault();
    openPickerAt(e.clientX, e.clientY, msg);
  });

  document.addEventListener("dblclick", (e) => {
    const msg = getMessageEl(e.target);
    if (!msg) return;

    const r = msg.getBoundingClientRect();
    openPickerAt(r.left + r.width * 0.5, r.top - 10, msg);
  });

  document.addEventListener("touchstart", (e) => {
    const msg = getMessageEl(e.target);
    if (!msg) return;

    pressTimer = setTimeout(() => {
      const t = e.touches && e.touches[0];
      if (!t) return;

      openPickerAt(t.clientX, t.clientY, msg);
    }, 480);
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }, { passive: true });

  document.addEventListener("touchmove", () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }, { passive: true });


  /* ---------------------------
     5) Mutation observer für SPA renders
  --------------------------- */
  let mutationRaf = null;

  function onDomChanged() {
    if (mutationRaf) return;

    mutationRaf = requestAnimationFrame(() => {
      setupSidebarCollapse();
      restoreAllReactions();
      mutationRaf = null;
    });
  }

  setupSidebarCollapse();
  restoreAllReactions();

  const observer = new MutationObserver(onDomChanged);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });


  /* ---------------------------
     6) Optional click feedback
  --------------------------- */
  document.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl || !window.toast) return;

    const action = actionEl.dataset.action;

    if (action === "send-friend-request") {
      window.toast("info", "Anfrage", "Wird gesendet...");
    }

    if (action === "accept-request") {
      window.toast("success", "Anfrage", "Wird angenommen...");
    }

    if (action === "decline-request") {
      window.toast("warning", "Anfrage", "Wird abgelehnt...");
    }
  });

})();
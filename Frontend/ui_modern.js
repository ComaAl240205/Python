/* ===========================
   ui_modern.js (v4)
   Server-Reactions compatible
   - Cursor spotlight
   - Toasts
   - Sidebar collapse
   - Reaction picker dispatcht nur Event
   - Keine lokalen Fake-Reactions mehr
   =========================== */

(function () {
  "use strict";

  // ---------------------------
  // Cursor Spotlight
  // ---------------------------
  let raf = null;

  function updateSpotlight(x, y) {
    if (raf) return;

    raf = requestAnimationFrame(() => {
      const mx = Math.max(0, Math.min(100, (x / window.innerWidth) * 100));
      const my = Math.max(0, Math.min(100, (y / window.innerHeight) * 100));

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


  // ---------------------------
  // Toast system
  // ---------------------------
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


  // ---------------------------
  // Sidebar collapse
  // ---------------------------
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


  // ---------------------------
  // Reaction Picker
  // ---------------------------
  let pickerEl = null;
  let pressTimer = null;

  function closePicker() {
    if (pickerEl) pickerEl.remove();
    pickerEl = null;
  }

  function getMessageEl(target) {
    return target.closest(".message");
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
        const messageId = messageEl.dataset.messageId;

        console.log("ui reaction click", messageId, emoji);

        if (!messageId || messageId === "undefined" || messageId === "null") {
          if (window.toast) {
            window.toast("warning", "Kurz warten", "Nachricht wird noch gespeichert.");
          }
          closePicker();
          return;
        }

        document.dispatchEvent(new CustomEvent("reaction:selected", {
          detail: {
            messageId,
            emoji
          }
        }));

        closePicker();
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


  // ---------------------------
  // SPA Mutation helper
  // ---------------------------
  let mutationRaf = null;

  function onDomChanged() {
    if (mutationRaf) return;

    mutationRaf = requestAnimationFrame(() => {
      setupSidebarCollapse();
      mutationRaf = null;
    });
  }

  setupSidebarCollapse();

  const observer = new MutationObserver(onDomChanged);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });


  // ---------------------------
  // Optional click feedback
  // ---------------------------
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
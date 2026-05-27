/* ===========================
   ui_modern.js (v2)
   Visible UI upgrades:
   - Cursor spotlight
   - Toast system (always noticeable)
   - Sidebar collapse buttons
   - Avatar initials (works for BOTH lists)
   - Reactions (double click / right click / long press)
   =========================== */

// 1) Cursor Spotlight (updates CSS vars)
document.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;
  document.body.style.setProperty("--mx", `${x}%`);
  document.body.style.setProperty("--my", `${y}%`);
});

// 2) Toast container + helper
(function initToasts(){
  if (document.querySelector(".toast-wrap")) return;

  const wrap = document.createElement("div");
  wrap.className = "toast-wrap";
  document.body.appendChild(wrap);

  window.toast = function(type, title, msg){
    const t = document.createElement("div");
    t.className = "toast";

    const icon = document.createElement("div");
    icon.className = "t-icon";
    icon.textContent =
      type === "success" ? "✓" :
      type === "danger"  ? "!" :
      type === "warning" ? "⚠" : "✨";

    const body = document.createElement("div");
    const safeTitle = (window.escapeHtml ? escapeHtml(title) : title);
    const safeMsg = (window.escapeHtml ? escapeHtml(msg) : msg);
    body.innerHTML = `<p class="t-title">${safeTitle}</p><p class="t-msg">${safeMsg}</p>`;

    const close = document.createElement("button");
    close.className = "t-close";
    close.innerHTML = "×";
    close.onclick = () => t.remove();

    t.appendChild(icon);
    t.appendChild(body);
    t.appendChild(close);
    wrap.appendChild(t);

    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(-8px) scale(.98)";
      setTimeout(() => t.remove(), 220);
    }, 3200);
  };

  // show one toast at start so you SEE it working
  setTimeout(() => toast("info", "UI Upgrade aktiv", "Toasts / Avatare / Reactions geladen ✨"), 600);
})();

// 3) Sidebar collapse buttons (persist per section)
(function initSidebarCollapse(){
  function setup(){
    document.querySelectorAll(".sidebar-section").forEach((section, idx) => {
      const head = section.querySelector(".sidebar-head");
      if (!head) return;
      if (head.querySelector(".collapse-btn")) return;

      const key = `collapse_${idx}`;
      const btn = document.createElement("button");
      btn.className = "collapse-btn";
      btn.type = "button";

      const restore = localStorage.getItem(key) === "1";
      if (restore) section.classList.add("collapsed");

      btn.textContent = section.classList.contains("collapsed") ? "+" : "–";

      btn.onclick = () => {
        const collapsed = section.classList.toggle("collapsed");
        btn.textContent = collapsed ? "+" : "–";
        localStorage.setItem(key, collapsed ? "1" : "0");
      };

      head.appendChild(btn);
    });
  }

  setup();
  new MutationObserver(setup).observe(document.body, { childList: true, subtree: true });
})();

// 4) Avatar initials (robust: works for items with or without .sidebar-item-name)
function initials(name){
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[1]?.[0] : (parts[0]?.[1] || "");
  return (a + b).toUpperCase();
}

function injectAvatars(){
  const friendButtons = document.querySelectorAll("#friendsList .sidebar-item, #friendsList2 .sidebar-item");

  friendButtons.forEach(btn => {
    // find label node
    let label = btn.querySelector(".sidebar-item-name");
    if (!label){
      // fallback: wrap current textContent into a label span
      const txt = btn.textContent.trim();
      btn.textContent = "";
      label = document.createElement("div");
      label.className = "sidebar-item-name";
      label.textContent = txt;
      btn.appendChild(label);
    }

    if (label.querySelector(".avatar")) return;

    const av = document.createElement("span");
    av.className = "avatar";
    av.textContent = initials(label.textContent);
    label.prepend(av);
  });

  // Requests
  document.querySelectorAll(".request-item").forEach(item => {
    const nameEl = item.querySelector(".request-username");
    if (!nameEl) return;
    if (item.querySelector(".avatar")) return;

    const av = document.createElement("span");
    av.className = "avatar";
    av.textContent = initials(nameEl.textContent.trim());
    item.prepend(av);
  });
}

injectAvatars();
new MutationObserver(injectAvatars).observe(document.body, { childList: true, subtree: true });

// 5) Message reactions (UI-only): right click / double click / long press
let pickerEl = null;

function closePicker(){
  if (pickerEl) pickerEl.remove();
  pickerEl = null;
}

function addReaction(msgDiv, emoji){
  let bar = msgDiv.querySelector(".reaction-bar");
  if (!bar){
    bar = document.createElement("div");
    bar.className = "reaction-bar";
    msgDiv.appendChild(bar);
  }

  let pill = Array.from(bar.querySelectorAll(".reaction-pill"))
    .find(p => p.dataset.emoji === emoji);

  if (!pill){
    pill = document.createElement("span");
    pill.className = "reaction-pill";
    pill.dataset.emoji = emoji;
    pill.innerHTML = `<span>${emoji}</span><strong>1</strong>`;
    bar.appendChild(pill);
  } else {
    const strong = pill.querySelector("strong");
    strong.textContent = String(Number(strong.textContent || "1") + 1);
  }
}

function openPickerAt(x, y, msgDiv){
  closePicker();

  pickerEl = document.createElement("div");
  pickerEl.className = "reaction-picker";

  ["❤️","😂","🔥","👍","😮","🎉","😢","👀"].forEach(e => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = e;
    b.onclick = () => {
      addReaction(msgDiv, e);
      closePicker();
      if (window.toast) toast("info", "Reaction", `Reagiert mit ${e}`);
    };
    pickerEl.appendChild(b);
  });

  document.body.appendChild(pickerEl);

  const rect = pickerEl.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 12);
  const py = Math.min(y, window.innerHeight - rect.height - 12);
  pickerEl.style.left = px + "px";
  pickerEl.style.top = py + "px";
}

document.addEventListener("click", (e) => {
  if (pickerEl && !pickerEl.contains(e.target)) closePicker();
});

document.addEventListener("contextmenu", (e) => {
  const msg = e.target.closest(".message-content");
  if (!msg) return;
  e.preventDefault();
  openPickerAt(e.clientX, e.clientY, msg);
});

document.addEventListener("dblclick", (e) => {
  const msg = e.target.closest(".message-content");
  if (!msg) return;
  const r = msg.getBoundingClientRect();
  openPickerAt(r.left + r.width * 0.5, r.top - 10, msg);
});

// Mobile long-press
let pressTimer = null;
document.addEventListener("touchstart", (e) => {
  const msg = e.target.closest(".message-content");
  if (!msg) return;
  pressTimer = setTimeout(() => {
    const t = e.touches[0];
    openPickerAt(t.clientX, t.clientY, msg);
  }, 420);
}, { passive: true });

document.addEventListener("touchend", () => {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
}, { passive: true });

// 6) Hook into your existing functions (optional) – more visible feedback
(function hookApp(){
  if (typeof window.addIncomingRequest === "function"){
    const old = window.addIncomingRequest;
    window.addIncomingRequest = function(req){
      old(req);
      if (window.toast) toast("info", "Neue Anfrage", `${req.sender_username} will dich adden`);
    };
  }

  if (typeof window.acceptRequest === "function"){
    const old = window.acceptRequest;
    window.acceptRequest = async function(id){
      await old(id);
      if (window.toast) toast("success", "Freund hinzugefügt", "Anfrage angenommen ✅");
    };
  }
})();
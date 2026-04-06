// ============================================================
//  FAIRWAY FRIEND — UI Utilities & Shared Constants
// ============================================================

export const VIBE_META = {
  competitive: { label:"Competitive",       icon:"🏆", cls:"vt-trophy"   },
  scramble:    { label:"Scramble",           icon:"🎯", cls:"vt-scramble" },
  unwind:      { label:"Just to unwind",     icon:"😌", cls:"vt-unwind"   },
  social:      { label:"Social",             icon:"🤝", cls:"vt-social"   },
  earlybird:   { label:"Early bird",         icon:"🌅", cls:"vt-early"    },
  allweather:  { label:"All-weather",        icon:"🌧", cls:"vt-rain"     },
  walking:     { label:"Walker",             icon:"🚶", cls:"vt-walking"  },
  drinks:      { label:"Drinks welcome",     icon:"🍺", cls:"vt-beer"     },
  "420":       { label:"420 friendly",       icon:"🍃", cls:"vt-leaf"     },
  music:       { label:"Music on cart",      icon:"🎵", cls:"vt-music"    },
  bets:        { label:"Friendly wagers",    icon:"💰", cls:"vt-trophy"   },
  "19th":      { label:"19th hole always",   icon:"🍻", cls:"vt-social"   },
  tourney:     { label:"Tournament prep",    icon:"📋", cls:"vt-trophy"   },
  improve:     { label:"Working on game",    icon:"📈", cls:"vt-unwind"   },
  newplayers:  { label:"Meet people",        icon:"👋", cls:"vt-social"   },
  regular:     { label:"Find regular group", icon:"📅", cls:"vt-scramble" },
};

// ── Render a vibe pill badge ──
export function vibePip(vibe, small) {
  const m = VIBE_META[vibe];
  if (!m) return "";
  const sz = small ? "font-size:10px;padding:2px 7px" : "font-size:11px;padding:4px 10px";
  return `<span class="vibe-pip ${m.cls} selected"
    style="${sz};border-radius:20px;font-weight:500">
    <span style="font-size:${small ? "11px" : "13px"}">${m.icon}</span> ${m.label}
  </span>`;
}

// ── Get initials from a display name ──
export function initials(name) {
  if (!name) return "?";
  return name.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Deterministic avatar color from uid ──
export function avatarColor(uid) {
  const colors = ["pa-green", "pa-amber", "pa-blue", "pa-pink"];
  let h = 0;
  for (const c of uid || "x") h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

// ── Relative time string ──
export function relativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Safe HTML escape ──
export function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

// ── Toast notification ──
let _toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// ── Hide splash screen ──
export function hideSplash() {
  const s = document.getElementById("splash-screen");
  if (!s) return;
  s.style.opacity = "0";
  setTimeout(() => s.remove(), 650);
}

// ── Screen navigation ──
export function goScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

  const screen = document.getElementById("screen-" + name);
  if (screen) {
    screen.classList.remove("hidden");   // remove hidden so active CSS takes effect
    screen.classList.add("active");
  }

  const nav = document.getElementById("nav-" + name);
  if (nav) nav.classList.add("active");

  // Hide bottom nav on auth/onboard screens
  const noNav = ["auth", "onboard", "vibes", "edit-profile"].includes(name);
  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) bottomNav.style.display = noNav ? "none" : "flex";

  // Populate vibes-grid on every navigation to the vibes screen
  if (name === "vibes") {
    const grid = document.getElementById("vibes-grid");
    if (grid) {
      // Always rebuild so selections reflect current saved state
      const saved = (window.myProfile?.vibes || window.myVibes || []);
      grid.innerHTML = Object.entries(VIBE_META)
        .map(([key, m]) => {
          const isSelected = saved.includes(key) || saved.includes(m.label);
          return `<button class="vibe-chip ${m.cls}${isSelected ? ' selected' : ''}"
            data-vibe="${key}"
            onclick="this.classList.toggle('selected')"
            style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;
                   border-radius:24px;border:1.5px solid ${isSelected ? 'var(--green)' : 'var(--border)'};
                   cursor:pointer;font-size:13px;font-weight:500;
                   color:${isSelected ? 'var(--green)' : 'var(--muted)'};
                   background:${isSelected ? 'var(--green-light,#e8f8f2)' : 'var(--card-bg)'};
                   transition:all .15s;font-family:inherit"
            onmouseover="if(!this.classList.contains('selected'))this.style.borderColor='var(--green)'"
            onmouseout="if(!this.classList.contains('selected'))this.style.borderColor='var(--border)'">
            <span style="font-size:16px">${m.icon}</span>${m.label}
          </button>`;
        })
        .join('');
    }
  }

============================================================
//  FAIRWAY FRIEND — UI Utilities & Shared Constants
// ============================================================

export const VIBE_META = {
  competitive: { label:"Competitive",       icon:"🏆", cls:"vt-trophy"   },
  scramble:    { label:"Scramble",           icon:"🎯", cls:"vt-scramble" },
  unwind:      { label:"Just to unwind",     icon:"😌", cls:"vt-unwind"   },
  social:      { label:"Social",             icon:"🤝", cls:"vt-social"   },
  earlybird:   { label:"Early bird",         icon:"🌅", cls:"vt-early"    },
  allweather:  { label:"All-weather",        icon:"🌧", cls:"vt-rain"     },
  walking:     { label:"Walker",             icon:"🚶", cls:"vt-walking"  },
  drinks:      { label:"Drinks welcome",     icon:"🍺", cls:"vt-beer"     },
  "420":       { label:"420 friendly",       icon:"🍃", cls:"vt-leaf"     },
  music:       { label:"Music on cart",      icon:"🎵", cls:"vt-music"    },
  bets:        { label:"Friendly wagers",    icon:"💰", cls:"vt-trophy"   },
  "19th":      { label:"19th hole always",   icon:"🍻", cls:"vt-social"   },
  tourney:     { label:"Tournament prep",    icon:"📋", cls:"vt-trophy"   },
  improve:     { label:"Working on game",    icon:"📈", cls:"vt-unwind"   },
  newplayers:  { label:"Meet people",        icon:"👋", cls:"vt-social"   },
  regular:     { label:"Find regular group", icon:"📅", cls:"vt-scramble" },
};

// ── Render a vibe pill badge ──
export function vibePip(vibe, small) {
  const m = VIBE_META[vibe];
  if (!m) return "";
  const sz = small ? "font-size:10px;padding:2px 7px" : "font-size:11px;padding:4px 10px";
  return `<span class="vibe-pip ${m.cls} selected"
    style="${sz};border-radius:20px;font-weight:500">
    <span style="font-size:${small ? "11px" : "13px"}">${m.icon}</span> ${m.label}
  </span>`;
}

// ── Get initials from a display name ──
export function initials(name) {
  if (!name) return "?";
  return name.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Deterministic avatar color from uid ──
export function avatarColor(uid) {
  const colors = ["pa-green", "pa-amber", "pa-blue", "pa-pink"];
  let h = 0;
  for (const c of uid || "x") h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

// ── Relative time string ──
export function relativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Safe HTML escape ──
export function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

// ── Toast notification ──
let _toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// ── Hide splash screen ──
export function hideSplash() {
  const s = document.getElementById("splash-screen");
  if (!s) return;
  s.style.opacity = "0";
  setTimeout(() => s.remove(), 650);
}

// ── Screen navigation ──
export function goScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

  const screen = document.getElementById("screen-" + name);
  if (screen) {
    screen.classList.remove("hidden");   // remove hidden so active CSS takes effect
    screen.classList.add("active");
  }

  const nav = document.getElementById("nav-" + name);
  if (nav) nav.classList.add("active");

  // Hide bottom nav on auth/onboard screens
  const noNav = ["auth", "onboard", "vibes", "edit-profile"].includes(name);
  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) bottomNav.style.display = noNav ? "none" : "flex";



  const nav = document.getElementById("nav-" + name);
  if (nav) nav.classList.add("active");

  // Hide bottom nav on auth/onboard screens
  const noNav = ["auth", "onboard", "vibes", "edit-profile"].includes(name);
  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) bottomNav.style.display = noNav ? "none" : "flex";



============================================================
//  FAIRWAY FRIEND — UI Utilities & Shared Constants
// ============================================================

export const VIBE_META = {
  competitive: { label:"Competitive",       icon:"🏆", cls:"vt-trophy"   },
  scramble:    { label:"Scramble",           icon:"🎯", cls:"vt-scramble" },
  unwind:      { label:"Just to unwind",     icon:"😌", cls:"vt-unwind"   },
  social:      { label:"Social",             icon:"🤝", cls:"vt-social"   },
  earlybird:   { label:"Early bird",         icon:"🌅", cls:"vt-early"    },
  allweather:  { label:"All-weather",        icon:"🌧", cls:"vt-rain"     },
  walking:     { label:"Walker",             icon:"🚶", cls:"vt-walking"  },
  drinks:      { label:"Drinks welcome",     icon:"🍺", cls:"vt-beer"     },
  "420":       { label:"420 friendly",       icon:"🍃", cls:"vt-leaf"     },
  music:       { label:"Music on cart",      icon:"🎵", cls:"vt-music"    },
  bets:        { label:"Friendly wagers",    icon:"💰", cls:"vt-trophy"   },
  "19th":      { label:"19th hole always",   icon:"🍻", cls:"vt-social"   },
  tourney:     { label:"Tournament prep",    icon:"📋", cls:"vt-trophy"   },
  improve:     { label:"Working on game",    icon:"📈", cls:"vt-unwind"   },
  newplayers:  { label:"Meet people",        icon:"👋", cls:"vt-social"   },
  regular:     { label:"Find regular group", icon:"📅", cls:"vt-scramble" },
};

// ── Render a vibe pill badge ──
export function vibePip(vibe, small) {
  const m = VIBE_META[vibe];
  if (!m) return "";
  const sz = small ? "font-size:10px;padding:2px 7px" : "font-size:11px;padding:4px 10px";
  return `<span class="vibe-pip ${m.cls} selected"
    style="${sz};border-radius:20px;font-weight:500">
    <span style="font-size:${small ? "11px" : "13px"}">${m.icon}</span> ${m.label}
  </span>`;
}

// ── Get initials from a display name ──
export function initials(name) {
  if (!name) return "?";
  return name.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Deterministic avatar color from uid ──
export function avatarColor(uid) {
  const colors = ["pa-green", "pa-amber", "pa-blue", "pa-pink"];
  let h = 0;
  for (const c of uid || "x") h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

// ── Relative time string ──
export function relativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Safe HTML escape ──
export function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

// ── Toast notification ──
let _toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// ── Hide splash screen ──
export function hideSplash() {
  const s = document.getElementById("splash-screen");
  if (!s) return;
  s.style.opacity = "0";
  setTimeout(() => s.remove(), 650);
}

// ── Screen navigation ──
export function goScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

  const screen = document.getElementById("screen-" + name);
  if (screen) {
    screen.classList.remove("hidden");   // remove hidden so active CSS takes effect
    screen.classList.add("active");
  }

  const nav = document.getElementById("nav-" + name);
  if (nav) nav.classList.add("active");

  // Hide bottom nav on auth/onboard screens
  const noNav = ["auth", "onboard", "vibes", "edit-profile"].includes(name);
  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) bottomNav.style.display = noNav ? "none" : "flex";


}

// ── Toggle chip filter ──
export function toggleChip(el) {
  el.classList.toggle("on");
}

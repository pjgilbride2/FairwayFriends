// ============================================================
//  FAIRWAY FRIEND — Notifications
//  Tracks: new messages (blue dot), likes, replies, follows
// ============================================================

import { db } from "./firebase-config.js?v=120";
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, updateDoc, writeBatch,
  serverTimestamp, addDoc, getDocs, getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { esc, initials, avatarColor } from "./ui.js?v=120";

let _unsubMessages = null;
let _unsubNotifs   = null;

// ─── Start all notification listeners ─────────────────────
export function initNotifications(uid) {
  if (!uid) return;
  _listenUnreadMessages(uid);
  _listenNotifications(uid);
}

export function teardownNotifications() {
  if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }
  if (_unsubNotifs)   { _unsubNotifs();   _unsubNotifs   = null; }
}

// ─── MESSAGES: blue dot listener ──────────────────────────
function _listenUnreadMessages(uid) {
  // Listen to conversations where this user has unread messages
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid)
  );
  _unsubMessages = onSnapshot(q, (snap) => {
    let unread = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      const lastMsg = data.lastMessage || "";
      const lastSender = data.lastSenderId || "";
      const readBy = data.readBy || {};
      // Unread if last message was NOT by this user AND this user hasn't read it
      if (lastMsg && lastSender !== uid && !readBy[uid]) {
        unread++;
      }
    });
    _setMsgDot(unread > 0);
  });
}

function _setMsgDot(show) {
  const dot = document.getElementById("msg-unread-dot");
  if (dot) dot.style.display = show ? "block" : "none";
}

// ─── Mark conversation as read ─────────────────────────────
export async function markConversationRead(convId, uid) {
  if (!convId || !uid) return;
  try {
    await updateDoc(doc(db, "conversations", convId), {
      [`readBy.${uid}`]: true
    });
  } catch(_) {}
}

// ─── NOTIFICATIONS: likes, replies, follows ───────────────
function _listenNotifications(uid) {
  const q = query(
    collection(db, "notifications"),
    where("toUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  _unsubNotifs = onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unread = notifs.filter(n => !n.read).length;
    _setNotifBadge(unread);
    window._notifications = notifs;
    if (document.getElementById("screen-notifications")?.classList.contains("active")) {
      renderNotifications(notifs);
    }
  }, (err) => {
    // Index still building or other Firestore error — fail silently, don't crash app
    if (err.code === "failed-precondition") {
      console.warn("Notifications index still building — will retry in 30s");
      window._notifications = [];
      // Show friendly message if screen is open
      const el = document.getElementById("notif-list");
      if (el && document.getElementById("screen-notifications")?.classList.contains("active")) {
        el.innerHTML = '<div class="empty-state" style="margin-top:60px">' +
          '<div style="font-size:36px;margin-bottom:12px">\uD83D\uDD14</div>' +
          '<div>Setting up notifications\u2026</div>' +
          '<div style="font-size:13px;color:var(--muted);margin-top:6px">Ready in about 1 minute</div></div>';
      }
      // Retry after 30s once index finishes building
      setTimeout(() => {
        if (_unsubNotifs) { try { _unsubNotifs(); } catch(_){} _unsubNotifs = null; }
        _listenNotifications(uid);
      }, 30000);
    } else {
      console.warn("Notifications listener error:", err.code);
    }
  });
}

function _setNotifBadge(count) {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  if (count > 0) {
    badge.style.display = "block";
    badge.textContent = count > 9 ? "9+" : count > 1 ? count : "";
    badge.style.minWidth = count > 9 ? "16px" : "9px";
    badge.style.fontSize = "9px";
    badge.style.display = "flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.color = "#fff";
    badge.style.fontWeight = "700";
  } else {
    badge.style.display = "none";
  }
}

// ─── Render notifications list ─────────────────────────────
export function renderNotifications(notifs) {
  const el = document.getElementById("notif-list");
  if (!el) return;

  if (!notifs || !notifs.length) {
    el.innerHTML = `
      <div class="empty-state" style="margin-top:60px">
        <div style="font-size:36px;margin-bottom:12px">🔔</div>
        <div>No notifications yet</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px">You'll see likes, replies, and new followers here</div>
      </div>`;
    return;
  }

  el.innerHTML = notifs.map(n => {
    const ini    = initials(n.fromName || "?");
    const color  = avatarColor(n.fromUid || "");
    const ts     = n.createdAt?.toDate ? _relTime(n.createdAt.toDate()) : "just now";
    const unread = !n.read;
    const icon   = _notifIcon(n.type);
    const text   = _notifText(n);
    const photo  = n.fromPhoto;

    const avatarHTML = photo
      ? `<div style="width:40px;height:40px;border-radius:50%;background:url(${esc(photo)}) center/cover;flex-shrink:0"></div>`
      : `<div class="avatar-sm ${color}" style="width:40px;height:40px;font-size:15px;flex-shrink:0">${esc(ini)}</div>`;

    const canViewSender = !!n.fromUid && n.fromUid !== window._currentUser?.uid;
    return `
      <div class="notif-item${unread ? " notif-unread" : ""}" data-id="${esc(n.id)}" data-type="${esc(n.type)}"
        onclick="safeUI('openNotif','${esc(n.id)}','${esc(n.type)}','${esc(n.refId||'')}')">
        <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)">
          <div style="position:relative;flex-shrink:0;cursor:${canViewSender?'pointer':'default'}"
            ${canViewSender ? `onclick="event.stopPropagation();safeUI('openPlayerProfile','${n.fromUid}')"` : ''}>
            ${avatarHTML}
            <div style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;border:1.5px solid var(--border)">${icon}</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;line-height:1.4;color:var(--text)">${text}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(ts)}</div>
          </div>
          ${unread ? '<div style="width:8px;height:8px;border-radius:50%;background:#2563eb;flex-shrink:0"></div>' : ""}
        </div>
      </div>`;
  }).join("");
}

function _notifIcon(type) {
  if (type === "like")   return "❤️";
  if (type === "reply")  return "💬";
  if (type === "follow") return "👋";
  if (type === "message") return "💬";
  return "🔔";
}

function _notifText(n) {
  const name = `<strong>${esc(n.fromName || "Someone")}</strong>`;
  if (n.type === "like")   return `${name} liked your post`;
  if (n.type === "reply")  return `${name} replied: <em>${esc((n.preview||"").slice(0,60))}</em>`;
  if (n.type === "follow") return `${name} started following you`;
  if (n.type === "message") {
    const prev = (n.preview||"").slice(0,60);
    return prev ? `${name}: <em>${esc(prev)}</em>` : `${name} sent you a message`;
  }
  return `${name} did something`;
}

function _relTime(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)  return "just now";
  if (s < 3600) return Math.floor(s/60)+"m ago";
  if (s < 86400) return Math.floor(s/3600)+"h ago";
  return Math.floor(s/86400)+"d ago";
}

// ─── Mark all read ─────────────────────────────────────────
export async function markAllNotifsRead(uid) {
  if (!uid) return;
  const unread = (window._notifications || []).filter(n => !n.read);
  if (!unread.length) { _setNotifBadge(0); return; }
  const batch = writeBatch(db);
  unread.forEach(n => {
    batch.update(doc(db, "notifications", n.id), { read: true });
    n.read = true; // optimistic update
  });
  await batch.commit();
  // Optimistically update badge and re-render
  _setNotifBadge(0);
  renderNotifications(window._notifications || []);
}

// ─── Mark single notif read + navigate ────────────────────
export async function openNotif(id, type, refId) {
  // Mark read
  try { await updateDoc(doc(db, "notifications", id), { read: true }); } catch(_) {}

  if (type === "follow") { safeUI("goScreen", "players"); return; }

  if (type === "message" && refId) {
    // Look up the conversation to get the other participant name
    try {
      const convSnap = await getDoc(doc(db, "conversations", refId));
      if (convSnap.exists()) {
        const data = convSnap.data();
        const myUid = window._currentUser?.uid;
        const isGroup = data.isGroup;
        const otherUid = (data.participants || []).find(p => p !== myUid) || "";
        const otherName = isGroup
          ? (data.groupName || "Group Chat")
          : ((data.participantNames || {})[otherUid] || "Golfer");
        safeUI("openConversation", refId, otherUid, otherName, isGroup || false);
        return;
      }
    } catch(e) {
      console.warn("openNotif conversation lookup failed:", e.message);
    }
    // Fallback — just go to messages
    safeUI("goScreen", "messages");
    return;
  }

  // Likes/replies → feed
  safeUI("goScreen", "feed");
}

// ─── Write a notification (called by feed/follow actions) ──
export async function createNotification({ toUid, fromUid, fromName, fromPhoto, type, refId, preview }) {
  if (!toUid || toUid === fromUid) return; // never notify yourself
  try {
    await addDoc(collection(db, "notifications"), {
      toUid, fromUid, fromName: fromName||"", fromPhoto: fromPhoto||null,
      type, refId: refId||null, preview: preview||null,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch(e) {
    console.warn("createNotification error:", e.message);
  }
}

// ─── Load notifications screen ─────────────────────────────
export function loadNotificationsScreen() {
  renderNotifications(window._notifications || []);
}

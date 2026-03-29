// FAIRWAY FRIEND — Notifications
import { db } from "./firebase-config.js?v=14";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { esc, initials, avatarColor } from "./ui.js?v=14";

let _unsubMessages = null, _unsubNotifs = null;

export function initNotifications(uid) {
  if (!uid) return;
  _listenUnreadMessages(uid);
  _listenNotifications(uid);
}

export function teardownNotifications() {
  if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }
  if (_unsubNotifs)   { _unsubNotifs();   _unsubNotifs   = null; }
}

function _listenUnreadMessages(uid) {
  const q = query(collection(db,"conversations"), where("participants","array-contains",uid));
  _unsubMessages = onSnapshot(q, (snap) => {
    let unread = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.lastMessage && data.lastSenderId !== uid && !(data.readBy||{})[uid]) unread++;
    });
    const dot = document.getElementById("msg-unread-dot");
    if (dot) dot.style.display = unread > 0 ? "block" : "none";
  });
}

export async function markConversationRead(convId, uid) {
  if (!convId || !uid) return;
  try { await updateDoc(doc(db,"conversations",convId), { [`readBy.${uid}`]: true }); } catch(_) {}
}

function _listenNotifications(uid) {
  const q = query(collection(db,"notifications"), where("toUid","==",uid), orderBy("createdAt","desc"), limit(50));
  _unsubNotifs = onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById("notif-badge");
    if (badge) {
      if (unread > 0) {
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.color = "#fff";
        badge.style.fontWeight = "700";
        badge.style.fontSize = "9px";
        badge.style.minWidth = unread > 9 ? "16px" : "9px";
        badge.style.padding = "0 2px";
        badge.textContent = unread > 9 ? "9+" : unread > 1 ? String(unread) : "";
      } else {
        badge.style.display = "none";
      }
    }
    window._notifications = notifs;
    if (!document.getElementById("screen-notifications")?.classList.contains("hidden")) {
      renderNotifications(notifs);
    }
  });
}

export function renderNotifications(notifs) {
  const el = document.getElementById("notif-list");
  if (!el) return;
  if (!notifs || !notifs.length) {
    el.innerHTML = `<div class="empty-state" style="margin-top:60px"><div style="font-size:36px;margin-bottom:12px">🔔</div><div>No notifications yet</div><div style="font-size:13px;color:var(--muted);margin-top:6px">Likes, replies, and new followers appear here</div></div>`;
    return;
  }
  el.innerHTML = notifs.map(n => {
    const ini = initials(n.fromName||"?"), color = avatarColor(n.fromUid||"");
    const ts = n.createdAt?.toDate ? _relTime(n.createdAt.toDate()) : "just now";
    const unread = !n.read;
    const icon = n.type==="like"?"❤️":n.type==="reply"?"💬":n.type==="follow"?"👋":"🔔";
    const name = `<strong>${esc(n.fromName||"Someone")}</strong>`;
    const text = n.type==="like"?`${name} liked your post`:n.type==="reply"?`${name} replied: <em>${esc((n.preview||"").slice(0,60))}</em>`:n.type==="follow"?`${name} started following you`:`${name} sent you a message`;
    const avatarHTML = n.fromPhoto
      ? `<div style="width:40px;height:40px;border-radius:50%;background:url(${esc(n.fromPhoto)}) center/cover;flex-shrink:0"></div>`
      : `<div class="avatar-sm ${color}" style="width:40px;height:40px;font-size:15px;flex-shrink:0">${esc(ini)}</div>`;
    return `<div class="notif-item${unread?" notif-unread":""}" onclick="safeUI('openNotif','${esc(n.id)}','${esc(n.type)}','${esc(n.refId||"")}')">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)">
        <div style="position:relative;flex-shrink:0">${avatarHTML}
          <div style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;border:1.5px solid var(--border)">${icon}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;line-height:1.4">${text}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(ts)}</div>
        </div>
        ${unread?'<div style="width:8px;height:8px;border-radius:50%;background:#2563eb;flex-shrink:0"></div>':""}
      </div></div>`;
  }).join("");
}

function _relTime(date) {
  const s = Math.floor((Date.now()-date)/1000);
  if (s<60) return "just now";
  if (s<3600) return Math.floor(s/60)+"m ago";
  if (s<86400) return Math.floor(s/3600)+"h ago";
  return Math.floor(s/86400)+"d ago";
}

export async function markAllNotifsRead(uid) {
  if (!uid) return;
  const unread = (window._notifications||[]).filter(n=>!n.read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach(n => batch.update(doc(db,"notifications",n.id),{read:true}));
  await batch.commit();
}

export async function openNotif(id, type, refId) {
  try { await updateDoc(doc(db,"notifications",id),{read:true}); } catch(_){}
  if (type==="follow") { safeUI("goScreen","profile"); return; }
  if (type==="message"&&refId) { window._pendingConvId=refId; safeUI("goScreen","conversation"); return; }
  safeUI("goScreen","feed");
}

export async function createNotification({ toUid, fromUid, fromName, fromPhoto, type, refId, preview }) {
  if (!toUid || toUid===fromUid) return;
  try {
    await addDoc(collection(db,"notifications"), {
      toUid, fromUid, fromName:fromName||"", fromPhoto:fromPhoto||null,
      type, refId:refId||null, preview:preview||null, read:false, createdAt:serverTimestamp()
    });
  } catch(e) { console.warn("createNotification:",e.message); }
}

export function loadNotificationsScreen() {
  renderNotifications(window._notifications||[]);
}

// ============================================================
//  FAIRWAY FRIEND — Messaging
// ============================================================

import { db } from "./firebase-config.js?v=15";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initials, avatarColor, esc, relativeTime, showToast } from "./ui.js?v=15";

let _unsubMessages = null;
let _unsubConvList = null;

// ── Stable conversation ID from two UIDs ──
function makeConvId(uid1, uid2) {
  return [uid1, uid2].sort().join("__");
}

// ── Get or create a conversation ──
export async function getOrCreateConversation(otherUid, otherName) {
  const me = window._currentUser;
  if (!me) return null;
  const cid = makeConvId(me.uid, otherUid);
  const ref  = doc(db, "conversations", cid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants:     [me.uid, otherUid],
      participantNames: { [me.uid]: me.displayName || "Golfer", [otherUid]: otherName },
      lastMessage:      "",
      lastMessageAt:    serverTimestamp(),
      createdAt:        serverTimestamp(),
    });
  }
  return cid;
}

// ── Send a message ──
export async function sendMessage(cid, text) {
  const me = window._currentUser;
  if (!me || !text.trim()) return;
  await addDoc(collection(db, "conversations", cid, "messages"), {
    text:       text.trim(),
    senderId:   me.uid,
    senderName: me.displayName || "Golfer",
    createdAt:  serverTimestamp(),
  });
  // Use setDoc merge to update metadata (safer than updateDoc)
  await setDoc(doc(db, "conversations", cid), {
    lastMessage:   text.trim().slice(0, 80),
    lastMessageAt: serverTimestamp(),
  }, { merge: true });
}

// ── Listen to messages in a conversation ──
export function listenToMessages(cid, onUpdate) {
  if (_unsubMessages) _unsubMessages();
  const q = query(
    collection(db, "conversations", cid, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  _unsubMessages = onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error("Messages listener error:", err.message);
  });
}

export function stopListeningMessages() {
  if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }
}

// ── Listen to conversations list ──
export function listenToConversations(onUpdate) {
  const me = window._currentUser;
  if (!me) return;
  if (_unsubConvList) _unsubConvList();
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", me.uid),
    orderBy("lastMessageAt", "desc"),
    limit(30)
  );
  _unsubConvList = onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error("Conversations listener error:", err.message);
    // If permissions fail, show empty state gracefully
    onUpdate([]);
  });
}

export function teardownMessaging() {
  if (_unsubMessages) _unsubMessages();
  if (_unsubConvList) _unsubConvList();
  _unsubMessages = null;
  _unsubConvList = null;
}

// ── Render conversations list ──
export function renderConversationsList(convs, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const me = window._currentUser;
  if (!convs.length) {
    el.innerHTML = `<div class="empty-state">No conversations yet.<br>Search for someone you follow above to start messaging!</div>`;
    return;
  }
  el.innerHTML = convs.map(c => {
    const otherUid  = c.participants.find(p => p !== me?.uid) || "";
    const otherName = (c.participantNames || {})[otherUid] || "Golfer";
    const ini       = initials(otherName);
    const aColor    = avatarColor(otherUid);
    const timeStr   = c.lastMessageAt?.toDate ? relativeTime(c.lastMessageAt.toDate()) : "";
    return `<div class="conv-row" onclick="safeUI('openConversation','${c.id}','${otherUid}','${esc(otherName)}')">
      <div class="player-avatar ${aColor}" style="width:44px;height:44px;font-size:15px;flex-shrink:0">${ini}</div>
      <div class="conv-info">
        <div class="conv-name">${esc(otherName)}</div>
        <div class="conv-last">${esc(c.lastMessage || "Tap to start chatting")}</div>
      </div>
      <div class="conv-time">${timeStr}</div>
    </div>`;
  }).join("");
}

// ── Render messages thread ──
export function renderMessages(msgs, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const me = window._currentUser;
  if (!msgs.length) {
    el.innerHTML = `<div class="empty-state" style="padding:30px 20px">Say hello! 👋</div>`;
    return;
  }
  el.innerHTML = msgs.map(m => {
    const isMine  = m.senderId === me?.uid;
    const timeStr = m.createdAt?.toDate ? relativeTime(m.createdAt.toDate()) : "";
    return `<div class="msg-row ${isMine ? "msg-mine" : "msg-theirs"}">
      <div class="msg-bubble">${esc(m.text)}</div>
      <div class="msg-time">${timeStr}</div>
    </div>`;
  }).join("");
  el.scrollTop = el.scrollHeight;
}

// ── Load users the current user follows ──
export async function loadFollowing() {
  const me = window._currentUser;
  if (!me) return [];
  const snap = await getDoc(doc(db, "users", me.uid));
  const friends = snap.exists() ? (snap.data().friends || []) : [];
  if (!friends.length) return [];
  // Load profiles of followed users
  const profiles = await Promise.all(
    friends.slice(0, 20).map(async uid => {
      try {
        const s = await getDoc(doc(db, "users", uid));
        return s.exists() ? { uid, ...s.data() } : null;
      } catch { return null; }
    })
  );
  return profiles.filter(Boolean);
}

// ── Render following list for search ──
export function renderFollowingForSearch(people, query, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const filtered = query
    ? people.filter(p => (p.displayName||"").toLowerCase().includes(query.toLowerCase()))
    : people;
  if (!filtered.length) {
    el.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:4px 0">No matches</div>`;
    return;
  }
  el.innerHTML = filtered.map(p => {
    const ini    = initials(p.displayName || "Golfer");
    const aColor = avatarColor(p.uid);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;border-bottom:0.5px solid var(--border)"
      onclick="safeUI('startConversation','${p.uid}','${esc(p.displayName||'Golfer')}')">
      <div class="player-avatar ${aColor}" style="width:36px;height:36px;font-size:13px;flex-shrink:0">${ini}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(p.displayName||"Golfer")}</div>
        <div style="font-size:12px;color:var(--muted)">${esc(p.city||"")}${p.handicap!=null?" · HCP "+p.handicap:""}</div>
      </div>
      <div style="font-size:12px;color:var(--green);font-weight:500">Message</div>
    </div>`;
  }).join("");
}

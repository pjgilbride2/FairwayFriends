// ============================================================
//  FAIRWAY FRIEND — Messaging
//  Firestore structure:
//    conversations/{convId}   — metadata, participants, last message
//    conversations/{convId}/messages/{msgId}  — individual messages
// ============================================================

import { db } from "./firebase-config.js?v=2";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, updateDoc, arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initials, avatarColor, esc, relativeTime, showToast } from "./ui.js?v=2";

// Active conversation listener unsubscribe fn
let _unsubMessages = null;
let _currentConvId = null;

// ── Generate a stable conversation ID from two user UIDs ──
function convId(uid1, uid2) {
  return [uid1, uid2].sort().join("__");
}

// ── Get or create a conversation between two users ──
export async function getOrCreateConversation(otherUid, otherName) {
  const me = window._currentUser;
  if (!me) return null;
  const cid = convId(me.uid, otherUid);
  const ref  = doc(db, "conversations", cid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants:      [me.uid, otherUid],
      participantNames:  { [me.uid]: me.displayName || "Golfer", [otherUid]: otherName },
      lastMessage:       "",
      lastMessageAt:     serverTimestamp(),
      unread:            { [me.uid]: 0, [otherUid]: 0 },
      createdAt:         serverTimestamp(),
    });
  }
  return cid;
}

// ── Send a message ──
export async function sendMessage(convId, text) {
  const me = window._currentUser;
  if (!me || !text.trim()) return;

  const msgRef = collection(db, "conversations", convId, "messages");
  await addDoc(msgRef, {
    text:       text.trim(),
    senderId:   me.uid,
    senderName: me.displayName || "Golfer",
    createdAt:  serverTimestamp(),
    read:       false,
  });

  // Update conversation metadata
  await updateDoc(doc(db, "conversations", convId), {
    lastMessage:   text.trim().slice(0, 80),
    lastMessageAt: serverTimestamp(),
  });
}

// ── Listen to messages in a conversation ──
export function listenToMessages(cid, onUpdate) {
  if (_unsubMessages) _unsubMessages();
  _currentConvId = cid;
  const q = query(
    collection(db, "conversations", cid, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  _unsubMessages = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(msgs);
  });
}

// ── Stop listening ──
export function stopListeningMessages() {
  if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }
  _currentConvId = null;
}

// ── Load all conversations for current user ──
export async function loadConversations() {
  const me = window._currentUser;
  if (!me) return [];
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", me.uid),
    orderBy("lastMessageAt", "desc"),
    limit(30)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Listen to conversations list (real-time) ──
let _unsubConvList = null;
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
    const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(convs);
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
    el.innerHTML = `<div class="empty-state">No conversations yet.<br>Connect with a golfer and send them a message!</div>`;
    return;
  }
  el.innerHTML = convs.map(c => {
    const otherUid  = c.participants.find(p => p !== me.uid) || "";
    const otherName = (c.participantNames || {})[otherUid] || "Golfer";
    const ini       = initials(otherName);
    const aColor    = avatarColor(otherUid);
    const timeStr   = c.lastMessageAt?.toDate ? relativeTime(c.lastMessageAt.toDate()) : "";
    return `<div class="conv-row" onclick="if(window.UI) UI.openConversation('${c.id}','${otherUid}','${esc(otherName)}')">
      <div class="player-avatar ${aColor}" style="width:44px;height:44px;font-size:15px;flex-shrink:0">${ini}</div>
      <div class="conv-info">
        <div class="conv-name">${esc(otherName)}</div>
        <div class="conv-last">${esc(c.lastMessage || "Start a conversation")}</div>
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
    const isMine  = m.senderId === me.uid;
    const timeStr = m.createdAt?.toDate ? relativeTime(m.createdAt.toDate()) : "";
    return `<div class="msg-row ${isMine ? "msg-mine" : "msg-theirs"}">
      <div class="msg-bubble">${esc(m.text)}</div>
      <div class="msg-time">${timeStr}</div>
    </div>`;
  }).join("");
  // Scroll to bottom
  el.scrollTop = el.scrollHeight;
}

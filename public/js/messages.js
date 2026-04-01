// ============================================================
//  FAIRWAY FRIEND — Messaging (DM + Group Chats)
// ============================================================

import { db } from "./firebase-config.js?v=86";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initials, avatarColor, esc, relativeTime, showToast } from "./ui.js?v=86";

let _unsubMessages = null;
let _unsubConvList = null;

// ── Stable DM conversation ID ──
function makeConvId(uid1, uid2) { return [uid1, uid2].sort().join("__"); }

// ── Get or create a 1-on-1 conversation ──
export async function getOrCreateConversation(otherUid, otherName) {
  const me = window._currentUser;
  if (!me) return null;
  const cid = makeConvId(me.uid, otherUid);
  const ref = doc(db, "conversations", cid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants:     [me.uid, otherUid],
      participantNames: { [me.uid]: me.displayName || "Golfer", [otherUid]: otherName },
      isGroup:          false,
      lastMessage:      "",
      lastMessageAt:    serverTimestamp(),
      createdAt:        serverTimestamp(),
    });
  }
  return cid;
}

// ── Create a group conversation ──
export async function createGroupConversation(memberUids, memberNames, groupName) {
  const me = window._currentUser;
  if (!me) return null;
  const allUids  = [me.uid, ...memberUids.filter(u => u !== me.uid)];
  const allNames = { [me.uid]: me.displayName || "Golfer", ...memberNames };
  const ref = await addDoc(collection(db, "conversations"), {
    participants:     allUids,
    participantNames: allNames,
    isGroup:          true,
    groupName:        groupName || "Group Chat",
    createdBy:        me.uid,
    lastMessage:      "",
    lastMessageAt:    serverTimestamp(),
    createdAt:        serverTimestamp(),
  });
  return ref.id;
}

// ── Send a message (works for DM and group) ──
export async function sendMessage(cid, text) {
  const me = window._currentUser;
  if (!me || !text.trim()) return;
  await addDoc(collection(db, "conversations", cid, "messages"), {
    text:       text.trim(),
    senderId:   me.uid,
    senderName: me.displayName || "Golfer",
    createdAt:  serverTimestamp(),
  });
  // Fetch conv to get participants for readBy reset
  const convData = (await getDoc(doc(db, "conversations", cid))).data() || {};
  const participants = convData.participants || [];
  // Mark all others as unread, me as read
  const readBy = {};
  participants.forEach(uid => { readBy[uid] = uid === me.uid; });
  await setDoc(doc(db, "conversations", cid), {
    lastMessage:   text.trim().slice(0, 80),
    lastSenderId:  me.uid,
    lastMessageAt: serverTimestamp(),
    readBy,
  }, { merge: true });
  // Return other participants for notifications
  return participants.filter(uid => uid !== me.uid);
}

// ── Listen to messages ──
export function listenToMessages(cid, onUpdate) {
  if (_unsubMessages) _unsubMessages();
  const q = query(
    collection(db, "conversations", cid, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  _unsubMessages = onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => { console.error("Messages listener:", err.message); });
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
  _unsubConvList = onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => {
    console.error("Conversations listener:", err.message);
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
    el.innerHTML = '<div class="empty-state">No conversations yet.<br>Search for someone you follow to start messaging!</div>';
    return;
  }
  el.innerHTML = convs.map(c => {
    const isGroup  = c.isGroup;
    const isUnread = c.lastSenderId && c.lastSenderId !== me?.uid && !(c.readBy||{})[me?.uid];

    // Group: show group icon + name; DM: show other person
    let displayName, ini, aColor, onclickArgs;
    if (isGroup) {
      displayName = esc(c.groupName || "Group Chat");
      ini = "👥";
      aColor = "av-indigo";
      onclickArgs = `'${c.id}','','${displayName}',true`;
    } else {
      const otherUid  = (c.participants||[]).find(p => p !== me?.uid) || "";
      const otherName = (c.participantNames||{})[otherUid] || "Golfer";
      displayName = esc(otherName);
      ini    = initials(otherName);
      aColor = avatarColor(otherUid);
      onclickArgs = `'${c.id}','${otherUid}','${displayName}'`;
    }

    const timeStr = c.lastMessageAt?.toDate ? relativeTime(c.lastMessageAt.toDate()) : "";
    const dmUid = !isGroup ? (c.participants||[]).find(p => p !== me?.uid) : null;
    const avatarClick = dmUid ? `onclick="event.stopPropagation();safeUI('openPlayerProfile','${dmUid}')" style="cursor:pointer"` : '';
    return `<div class="conv-row${isUnread?' conv-unread':''}" onclick="safeUI('openConversation',${onclickArgs})">
      <div class="player-avatar ${aColor}" ${avatarClick} style="width:44px;height:44px;font-size:${isGroup?'20':'15'}px;flex-shrink:0">${ini}</div>
      <div class="conv-info">
        <div class="conv-name" ${dmUid?`onclick="event.stopPropagation();safeUI('openPlayerProfile','${dmUid}')" style="cursor:pointer"`:''}>
          ${displayName}${isGroup ? (() => {
              const others = Object.entries(c.participantNames||{}).filter(([u,n])=>u!==window._currentUser?.uid&&n).map(([,n])=>n);
              const shown = others.slice(0,3);
              const extra = others.length - shown.length;
              const line = shown.join(', ')+(extra>0?' +'+extra+' more':'');
              return line ? `<span style="font-size:11px;color:var(--muted);font-weight:400;display:block;margin-top:1px">👤 ${line}</span>` : `<span style="font-size:11px;color:var(--muted)">(${(c.participants||[]).length} members)</span>`;
            })() : ''}
        </div>
        <div class="conv-last">${esc(c.lastMessage || "Tap to chat")}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="conv-time">${timeStr}</div>
        ${isUnread?'<div style="width:8px;height:8px;border-radius:50%;background:var(--green)"></div>':''}
      </div>
    </div>`;
  }).join("");
}

// ── Render messages thread (shows sender name in group chats) ──
export function renderMessages(msgs, containerId, isGroup) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const me = window._currentUser;
  if (!msgs.length) {
    el.innerHTML = '<div class="empty-state" style="padding:30px 20px">Say hello! 👋</div>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const isMine  = m.senderId === me?.uid;
    const timeStr = m.createdAt?.toDate ? relativeTime(m.createdAt.toDate()) : "";
    return `<div class="msg-row ${isMine?"msg-mine":"msg-theirs"}">
      ${isGroup && !isMine ? `<div style="font-size:11px;color:var(--muted);margin-bottom:2px;padding-left:2px">${esc(m.senderName||"Golfer")}</div>` : ""}
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
  const profiles = await Promise.all(
    friends.slice(0, 30).map(async uid => {
      try {
        const s = await getDoc(doc(db, "users", uid));
        return s.exists() ? { uid, ...s.data() } : null;
      } catch { return null; }
    })
  );
  return profiles.filter(Boolean);
}

// ── Render following list for DM / group member search ──
export function renderFollowingForSearch(people, searchQuery, containerId, multiSelect) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const q = (searchQuery||"").toLowerCase();
  const filtered = q
    ? people.filter(p => (p.displayName||"").toLowerCase().includes(q))
    : people;
  if (!filtered.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:4px 0">No matches</div>';
    return;
  }
  el.innerHTML = filtered.map(p => {
    const ini    = initials(p.displayName || "Golfer");
    const aColor = avatarColor(p.uid);
    const selected = (window._groupMembers||[]).some(m=>m.uid===p.uid);
    if (multiSelect) {
      return `<div class="following-row${selected?' following-selected':''}"
        onclick="safeUI('toggleGroupMember','${p.uid}','${esc(p.displayName||'Golfer')}')"
        style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;border-bottom:0.5px solid var(--border)">
        <div class="player-avatar ${aColor}" style="width:36px;height:36px;font-size:13px;flex-shrink:0">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(p.displayName||"Golfer")}</div>
          <div style="font-size:12px;color:var(--muted)">${esc(p.city||"")}${p.handicap!=null?" · HCP "+p.handicap:""}</div>
        </div>
        <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${selected?'var(--green)':'var(--border)'};
          background:${selected?'var(--green)':'transparent'};display:flex;align-items:center;justify-content:center;
          font-size:13px;color:#fff;flex-shrink:0">${selected?'✓':''}</div>
      </div>`;
    }
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

// ── Block / Unblock a user ───────────────────────────────────
export async function blockUser(targetUid, targetName) {
  const me = window._currentUser;
  if (!me || !targetUid) return;
  try {
    const mySnap = await getDoc(doc(db, 'users', me.uid));
    const blocked = mySnap.data()?.blockedUsers || [];
    const isBlocked = blocked.includes(targetUid);
    if (isBlocked) {
      await updateDoc(doc(db, 'users', me.uid), { blockedUsers: arrayRemove(targetUid) });
      if (window.myProfile) window.myProfile.blockedUsers = (window.myProfile.blockedUsers||[]).filter(u=>u!==targetUid);
      showToast(targetName + ' unblocked');
    } else {
      await updateDoc(doc(db, 'users', me.uid), { blockedUsers: arrayUnion(targetUid) });
      if (window.myProfile) window.myProfile.blockedUsers = [...(window.myProfile.blockedUsers||[]), targetUid];
      showToast(targetName + ' blocked');
    }
    return !isBlocked; // returns new blocked state
  } catch(e) {
    showToast('Could not block user');
    console.error('blockUser:', e);
  }
}

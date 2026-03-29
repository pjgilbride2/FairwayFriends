// ============================================================
//  FAIRWAY FRIEND — Feed, Players & Tee Times
//  Real-time Firestore listeners for all social data
// ============================================================

import { db, storage } from "./firebase-config.js?v=10";
import {
  ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  collection, query, orderBy, limit, where,
  onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove,
  doc, getDoc, getDocs, deleteDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { myProfile, myVibes } from "./profile.js?v=10";
import { loadRoundDayForecast } from "./weather.js?v=10";
import {
  vibePip, initials, avatarColor, relativeTime, esc, showToast, VIBE_META
} from "./ui.js?v=10";

export let allPlayers = [];
let _unsubFeed     = null;
let _unsubTeeTimes = null;
let _unsubPlayers  = null;

// ── Start all real-time listeners ──
export function initFeed() {
  try { const c=sessionStorage.getItem("feed_posts"); if(c){ const posts=JSON.parse(c); if(posts?.length) renderFeed(posts); } } catch(_){}
  _startTeeTimesListener();
  _startFeedListener();
}

export function initNearbyPlayers() {
  _startPlayersListener();
}

// ── Clean up listeners (call on sign-out) ──
export function teardownListeners() {
  if (_unsubFeed)     _unsubFeed();
  if (_unsubTeeTimes) _unsubTeeTimes();
  if (_unsubPlayers)  _unsubPlayers();
}

// ─────────────────────────────────────────
//  TEE TIMES
// ─────────────────────────────────────────
function _startTeeTimesListener() {
  const q = query(
    collection(db, "teeTimes"),
    orderBy("createdAt", "desc"),
    limit(15)
  );
  _unsubTeeTimes = onSnapshot(q, (snap) => {
    const times = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTeeTimesRow(times);
    renderAllTeeTimes(times);
  });
}

export function renderTeeTimesRow(times) {
  const row = document.getElementById("tee-times-row");
  if (!row) return;
  if (!times.length) {
    row.innerHTML = `<div style="padding:20px;color:var(--muted);font-size:13px">
      No open tee times yet — post one below!
    </div>`;
    return;
  }
  row.innerHTML = times
    .map((t) => {
      const vibeHtml = (t.vibes || []).slice(0, 2).map((v) => vibePip(v, true)).join("");
      return `<div class="tee-card" onclick="window._openTeeSheet('${t.id}')">
        <div class="tee-course">${esc(t.course || "Course TBD")}</div>
        <div class="tee-time-line">
          <div class="tee-dot"></div>
          <div class="tee-time-val">${esc(t.time || "—")}</div>
        </div>
        <div class="tee-date">${esc(t.date || "TBD")}</div>
        <div class="tee-vibes">${vibeHtml}</div>
        <div class="tee-footer">
          <span class="spots-left">${t.spots || 1} spot${(t.spots || 1) !== 1 ? "s" : ""} left</span>
          <span class="skill-badge">${esc(t.skillLevel || "Any level")}</span>
        </div>
      </div>`;
    })
    .join("");
}

export function renderAllTeeTimes(times) {
  const el = document.getElementById("all-tee-times");
  if (!el) return;
  if (!times.length) {
    el.innerHTML = `<div class="empty-state">No tee times posted yet.</div>`;
    return;
  }
  el.innerHTML = times
    .map(
      (t) => `
    <div class="player-card" onclick="window._openTeeSheet('${t.id}')">
      <div class="player-card-top">
        <div class="player-avatar pa-green" style="border-radius:10px;font-size:11px">
          ${initials(t.course || "GC")}
        </div>
        <div class="player-info">
          <div class="player-name">${esc(t.course || "Course TBD")}</div>
          <div class="player-meta">${esc(t.date || "TBD")} · ${esc(t.time || "—")}</div>
        </div>
        <span class="spots-left">${t.spots || 1} open</span>
      </div>
      <div class="player-vibes" style="margin-top:8px;padding-top:8px;border-top:0.5px solid var(--border)">
        ${(t.vibes || []).map((v) => vibePip(v, true)).join("")}
      </div>
    </div>`
    )
    .join("");
}

export async function openTeeSheet(id) {
  const snap = await getDoc(doc(db, "teeTimes", id));
  if (!snap.exists()) return;
  const t = snap.data();
  document.getElementById("sheet-title").textContent = t.course || "Tee time";
  document.getElementById("sheet-sub").textContent   = `${t.date || "Date TBD"} · ${t.time || "Time TBD"}`;
  document.getElementById("sheet-vibe-row").innerHTML = (t.vibes || []).map((v) => vibePip(v, false)).join("");
  document.getElementById("sheet-details").innerHTML = [
    ["Spots available", `${t.spots || 1} of ${t.totalSpots || 4}`],
    ["Format",          t.format    || "18-hole stroke play"],
    ["Skill level",     t.skillLevel || "Any level"],
    ["Host",            t.hostName  || "Unknown"],
    ["Notes",           t.notes     || "—"],
  ]
    .map(([l, v]) => `<div class="detail-row"><span class="detail-label">${l}</span><span class="detail-val">${esc(String(v))}</span></div>`)
    .join("");

  const btn = document.getElementById("sheet-cta");
  if (btn) {
    const isHost = t.hostId === window._currentUser?.uid;
    btn.textContent = isHost ? "Edit tee time" : "Request to join";
    btn.onclick = isHost ? null : () => requestToJoin(id, t);
  }
  // Inject weather container into the sheet
  const sheetEl = document.querySelector(".sheet");
  let wxEl = document.getElementById("sheet-weather");
  if (!wxEl) {
    wxEl = document.createElement("div");
    wxEl.id = "sheet-weather";
    wxEl.style.cssText = "margin:0 0 4px";
    // Insert before the CTA button
    const btn = document.getElementById("sheet-cta");
    if (btn && sheetEl) sheetEl.insertBefore(wxEl, btn);
  }
  wxEl.innerHTML = "";

  document.getElementById("sheet-overlay").classList.add("open");

  // Load the round-day forecast for this tee time
  const courseCity = window._weatherCity || t.city || "";
  loadRoundDayForecast(t.date, t.time, courseCity);
}

export async function postTeeTime({ course, date, time, spots, skillLevel, format, notes, vibes }) {
  const user = window._currentUser;
  if (!user) return;
  await addDoc(collection(db, "teeTimes"), {
    course, date, time,
    spots:      parseInt(spots),
    totalSpots: parseInt(spots),
    skillLevel, format, notes,
    vibes:    vibes || [],
    hostId:   user.uid,
    hostName: myProfile.displayName || "Golfer",
    createdAt: serverTimestamp(),
  });
  showToast("Tee time posted! ⛳");
}

async function requestToJoin(teeId, teeData) {
  const user = window._currentUser;
  if (!user) return;
  await addDoc(collection(db, "teeRequests"), {
    teeTimeId:     teeId,
    course:        teeData.course,
    hostId:        teeData.hostId,
    requesterId:   user.uid,
    requesterName: myProfile.displayName || "Golfer",
    status:        "pending",
    createdAt:     serverTimestamp(),
  });
  showToast("Request sent! 🏌️");
  document.getElementById("sheet-overlay").classList.remove("open");
}

// ─────────────────────────────────────────
//  COMMUNITY FEED POSTS
// ─────────────────────────────────────────
function _startFeedListener() {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(25)
  );
  _unsubFeed = onSnapshot(q, (snap) => {
    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    try{const s=posts.map(p=>({...p,createdAt:p.createdAt?.toDate?.()?.toISOString()||p.createdAt}));sessionStorage.setItem("feed_posts",JSON.stringify(s));}catch(_){}
    renderFeed(posts);
  });
}

export function renderFeed(posts) {
  const el = document.getElementById("community-feed");
  if (!el) return;
  if (!posts.length) {
    el.innerHTML = `<div class="empty-state">No posts yet — be the first to say hi! 👋</div>`;
    return;
  }
  el.innerHTML = posts
    .map((p) => {
      const ini     = initials(p.authorName || "?");
      const aColor  = avatarColor(p.authorId || "");
      const vibeHtml = (p.vibes || []).map((v) => vibePip(v, true)).join("");
      const timeAgo = p.createdAt?.toDate ? relativeTime(p.createdAt.toDate()) : "just now";
      const isOwn   = p.authorId === window._currentUser?.uid;
      const avatarHTML = p.photoURL
        ? `<div style="width:38px;height:38px;border-radius:50%;background:url(${p.photoURL}) center/cover;flex-shrink:0"></div>`
        : `<div class="player-avatar ${aColor}" style="width:38px;height:38px;font-size:13px">${ini}</div>`;
      return `<div class="post-card">
        <div class="post-header">
          ${avatarHTML}
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500;color:var(--text)">${esc(p.authorName || "Golfer")}</div>
            <div style="font-size:11px;color:var(--muted)">${timeAgo}</div>
          </div>
          ${isOwn ? `<button onclick="deletePost('${p.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0">×</button>` : ""}
        </div>
        ${p.course ? `<div class="post-course-tag">📍 ${esc(p.course)}</div>` : ""}
        ${p.text ? `<div class="post-body">${esc(p.text)}</div>` : ""}
        ${p.imageURL ? `<img src="${p.imageURL}" alt="Post photo"
          style="width:100%;border-radius:var(--radius-md);margin:8px 0;object-fit:cover;max-height:360px;display:block">` : ""}
        ${vibeHtml ? `<div class="player-vibes" style="margin-bottom:10px">${vibeHtml}</div>` : ""}
        <div class="post-footer">
          <div class="post-action" onclick="safeUI('toggleReply','${p.id}')" id="reply-btn-${p.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Reply <span class="post-action-count" id="reply-count-${p.id}">${(p.replyCount||0)>0?p.replyCount:""}</span>
          </div>
          <div class="post-action ${(p.helpfuls||[]).includes(window._currentUser?.uid)?"post-action-active":""}" onclick="safeUI('toggleLike','${p.id}')" id="helpful-btn-${p.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
            Like <span class="post-action-count" id="helpful-count-${p.id}">${(p.helpfuls||[]).length>0?(p.helpfuls||[]).length:""}</span>
          </div>
        </div>
        <div id="reply-box-${p.id}" style="display:none;padding:8px 12px 12px">
          <div style="display:flex;gap:8px;align-items:flex-end">
            <textarea id="reply-input-${p.id}" rows="1" placeholder="Write a reply..." style="flex:1;border:0.5px solid var(--border);border-radius:var(--radius-md);padding:8px 10px;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);background:var(--surface);outline:none;resize:none"></textarea>
            <button onclick="safeUI('submitReply','${p.id}')" style="background:var(--green);color:white;border:none;border-radius:var(--radius-md);padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer">Send</button>
          </div>
        </div>
        <div id="replies-list-${p.id}" style="padding:0 12px"></div>
      </div>`;
    })
    .join("");
}

export async function submitPost(text, imageFile) {
  const user = window._currentUser;
  if (!user || (!text.trim() && !imageFile)) { showToast("Add some text or a photo first!"); return; }

  let imageURL = null;
  if (imageFile) {
    try {
      // Resize before upload
      const resized   = await _resizeImage(imageFile, 800);
      const storageRef = ref(storage, `posts/${user.uid}/${Date.now()}`);
      await uploadBytes(storageRef, resized, { contentType: "image/jpeg" });
      imageURL = await getDownloadURL(storageRef);
    } catch (e) {
      console.error("Post image upload error:", e);
      showToast("Image upload failed — posting without photo");
    }
  }

  const postData = {
    text:       text.trim(),
    authorId:   user.uid,
    authorName: myProfile.displayName || "Golfer",
    photoURL:   myProfile.photoURL    || null,
    vibes:      myVibes,
    createdAt:  serverTimestamp(),
  };
  if (imageURL) postData.imageURL = imageURL;
  await addDoc(collection(db, "posts"), postData);
  showToast("Posted! ✅");
}


export async function toggleLike(postId) {
  const me = window._currentUser;
  if (!me) return;
  const r = doc(db,"posts",postId);
  const snap = await getDoc(r);
  if (!snap.exists()) return;
  const h = snap.data().helpfuls||[];
  const has = h.includes(me.uid);
  await updateDoc(r,{helpfuls: has?arrayRemove(me.uid):arrayUnion(me.uid)});
  const btn=document.getElementById("helpful-btn-"+postId);
  const cnt=document.getElementById("helpful-count-"+postId);
  if(btn) btn.classList.toggle("post-action-active",!has);
  if(cnt) cnt.textContent=String(has?Math.max(0,h.length-1):h.length+1)||"";
}
export async function submitReply(postId,text) {
  const me=window._currentUser;
  if(!me||!text.trim()) return;
  await addDoc(collection(db,"posts",postId,"replies"),{
    text:text.trim(),authorId:me.uid,authorName:myProfile.displayName||"Golfer",
    photoURL:myProfile.photoURL||null,createdAt:serverTimestamp()
  });
  const r=doc(db,"posts",postId);
  const cur=(await getDoc(r)).data()?.replyCount||0;
  await updateDoc(r,{replyCount:cur+1});
  const el=document.getElementById("reply-count-"+postId);
  if(el) el.textContent=String(cur+1);
}
export async function loadReplies(postId) {
  const c=document.getElementById("replies-list-"+postId);
  if(!c) return;
  const q=query(collection(db,"posts",postId,"replies"),orderBy("createdAt","asc"),limit(20));
  const snap=await getDocs(q);
  if(!snap.docs.length){c.innerHTML="";return;}
  c.innerHTML=snap.docs.map(d=>{
    const r=d.data(),ini=initials(r.authorName||"Golfer"),col=avatarColor(r.authorId||"");
    const t=r.createdAt?.toDate?relativeTime(r.createdAt.toDate()):"";
    return `<div style="display:flex;gap:8px;padding:8px 0;border-top:0.5px solid var(--border)"><div class="avatar-sm ${col}" style="width:28px;height:28px;font-size:10px;flex-shrink:0">${ini}</div><div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--text)">${esc(r.authorName||"Golfer")} <span style="color:var(--muted);font-weight:400">${t}</span></div><div style="font-size:13px;color:var(--text);margin-top:2px">${esc(r.text)}</div></div></div>`;
  }).join("");
}
// ── Resize image via canvas before upload ──
async function _resizeImage(file, maxPx) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.82);
    };
    img.src = url;
  });
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, "posts", postId));
  showToast("Post deleted");
}

// ─────────────────────────────────────────
//  PLAYERS
// ─────────────────────────────────────────
function _startPlayersListener() {
  const q = query(collection(db, "users"), limit(50));
  _unsubPlayers = onSnapshot(q, (snap) => {
    allPlayers = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.uid !== window._currentUser?.uid);

    renderNearbyPlayers(allPlayers.slice(0, 3), "nearby-players-feed");
    renderNearbyPlayers(allPlayers, "players-list-main");

    const nc = document.getElementById("feed-nearby-count");
    if (nc) nc.textContent = `${allPlayers.length} golfer${allPlayers.length !== 1 ? "s" : ""} in the community`;
  });
}

export function renderNearbyPlayers(players, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!players.length) {
    el.innerHTML = `<div class="empty-state">No other golfers yet — invite some friends! 🏌️</div>`;
    return;
  }
  el.innerHTML = players
    .map((p) => {
      const overlap  = (p.vibes || []).filter((v) => myVibes.includes(v)).length;
      const maxLen   = Math.max(myVibes.length, (p.vibes || []).length, 1);
      const pct      = Math.round((overlap / maxLen) * 100);
      const cls      = pct >= 60 ? "match-high" : pct >= 30 ? "match-mid" : "match-low";
      const vibeHtml = (p.vibes || []).slice(0, 3).map((v) => vibePip(v, true)).join("");
      const isFriend = (myProfile.friends || []).includes(p.uid);
      return `<div class="player-card">
        <div class="player-card-top">
          <div class="player-avatar ${avatarColor(p.uid)}">${initials(p.displayName)}</div>
          <div class="player-info">
            <div class="player-name">${esc(p.displayName || "Golfer")}</div>
            <div class="player-meta">${p.newToArea ? "🆕 New to area · " : ""}HCP ${p.handicap || "?"}</div>
          </div>
          ${myVibes.length ? `<span class="match-pct ${cls}">${pct}%</span>` : `<span class="player-hdcp">HCP ${p.handicap || "?"}</span>`}
          <div style="display:flex;gap:6px;align-items:center">
            <button class="connect-btn${isFriend ? " connected" : ""}"
              data-uid="${p.uid}"
              onclick="window._toggleFollow(this,'${p.uid}')">
              ${isFriend ? "Following" : "Connect"}
            </button>
            <button onclick="if(window.UI) UI.startConversation('${p.uid}','${esc(p.displayName||'Golfer')}')"
              style="background:var(--surface);color:var(--green-dark);border:0.5px solid var(--green);
                     border-radius:20px;font-size:11px;font-weight:500;padding:5px 10px;
                     cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">
              💬
            </button>
          </div>
        </div>
        ${vibeHtml ? `<div class="player-vibes">${vibeHtml}</div>` : ""}
      </div>`;
    })
    .join("");
}

export function filterPlayers(q) {
  const lower = q.toLowerCase();
  const filtered = lower
    ? allPlayers.filter(
        (p) =>
          (p.displayName || "").toLowerCase().includes(lower) ||
          (p.city || "").toLowerCase().includes(lower) ||
          (p.vibes || []).some((v) => (VIBE_META[v]?.label || "").toLowerCase().includes(lower))
      )
    : allPlayers;
  renderNearbyPlayers(filtered, "players-list-main");
}

export async function toggleFollow(btn, targetUid) {
  const user = window._currentUser;
  if (!user) return;
  const isFriend = btn.classList.contains("connected");
  await updateDoc(doc(db, "users", user.uid), {
    friends: isFriend ? arrayRemove(targetUid) : arrayUnion(targetUid),
  });
  if (isFriend) {
    myProfile.friends = (myProfile.friends || []).filter((f) => f !== targetUid);
    btn.classList.remove("connected");
    btn.textContent = "Connect";
  } else {
    myProfile.friends = [...(myProfile.friends || []), targetUid];
    btn.classList.add("connected");
    btn.textContent = "Following";
    showToast("Connected! 🤝");
  }
  const elFriends = document.getElementById("profile-friends");
  if (elFriends) elFriends.textContent = (myProfile.friends || []).length;
}

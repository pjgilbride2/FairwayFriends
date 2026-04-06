// ============================================================
//  FAIRWAY FRIEND — Activity Feed
//  Loads posts + rounds for a given user.
//  Owner can hide or delete each item.
// ============================================================

import { db } from "./firebase-config.js?v=108";
import {
  collection, query, where, orderBy, limit,
  getDocs, deleteDoc, updateDoc, doc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { esc, relativeTime, showToast, vibePip } from "./ui.js?v=108";

// ── Load all activity for a uid (posts + rounds) ──
export async function loadUserActivity(uid) {
  const [postSnap, roundSnap] = await Promise.all([
    getDocs(query(
      collection(db, "posts"),
      where("authorId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(30)
    )),
    getDocs(query(
      collection(db, "rounds"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(20)
    )),
  ]);

  const posts  = postSnap.docs.map(d  => ({ id: d.id,  type: "post",  ...d.data() }));
  const rounds = roundSnap.docs.map(d => ({ id: d.id,  type: "round", ...d.data() }));

  // Merge and sort by date descending
  return [...posts, ...rounds].sort((a, b) => {
    const at = a.createdAt?.toDate?.() || new Date(0);
    const bt = b.createdAt?.toDate?.() || new Date(0);
    return bt - at;
  });
}

// ── Delete a post ──
export async function deleteActivityItem(item) {
  const col = item.type === "post" ? "posts" : "rounds";
  await deleteDoc(doc(db, col, item.id));
  showToast("Deleted ✓");
}

// ── Hide/unhide a post (soft hide — sets hidden:true, only filtered client-side) ──
export async function toggleHideItem(item, hidden) {
  const col = item.type === "post" ? "posts" : "rounds";
  await updateDoc(doc(db, col, item.id), { hidden });
  showToast(hidden ? "Hidden from your profile" : "Shown on your profile");
}

// ── Render activity list ──
export function renderActivity(items, containerId, isOwner) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">No activity yet — post a round or say hi in the community feed!</div>`;
    return;
  }

  el.innerHTML = items.map(item => {
    const timeStr  = item.createdAt?.toDate ? relativeTime(item.createdAt.toDate()) : "";
    const isHidden = item.hidden === true;

    if (item.type === "post") {
      const vibeHtml = (item.vibes || []).slice(0, 3).map(v => vibePip(v, true)).join("");
      return `<div class="activity-card ${isHidden ? "activity-hidden" : ""}">
        <div class="activity-card-header">
          <div class="activity-type-badge post">Post</div>
          <div class="activity-time">${timeStr}</div>
          ${isOwner ? `<div class="activity-actions">
            <button class="act-btn" onclick="if(window.UI) UI.toggleHideActivity('${item.id}','post',${!isHidden})"
              title="${isHidden ? "Show" : "Hide"}">${isHidden ? "👁️" : "🙈"}</button>
            <button class="act-btn act-delete" onclick="if(window.UI) UI.deleteActivity('${item.id}','post')"
              title="Delete">🗑️</button>
          </div>` : ""}
        </div>
        ${item.course ? `<div class="post-course-tag" style="margin-bottom:8px">📍 ${esc(item.course)}</div>` : ""}
        <div class="activity-text">${esc(item.text || "")}</div>
        ${vibeHtml ? `<div class="player-vibes" style="margin-top:8px">${vibeHtml}</div>` : ""}
        ${isHidden ? `<div class="hidden-label">Hidden from your profile</div>` : ""}
      </div>`;
    }

    if (item.type === "round") {
      const vsPar = item.total ? item.total - 72 : null;
      const vsStr = vsPar === null ? "—" : vsPar > 0 ? `+${vsPar}` : vsPar === 0 ? "E" : String(vsPar);
      return `<div class="activity-card ${isHidden ? "activity-hidden" : ""}">
        <div class="activity-card-header">
          <div class="activity-type-badge round">Round</div>
          <div class="activity-time">${timeStr}</div>
          ${isOwner ? `<div class="activity-actions">
            <button class="act-btn" onclick="if(window.UI) UI.toggleHideActivity('${item.id}','round',${!isHidden})"
              title="${isHidden ? "Show" : "Hide"}">${isHidden ? "👁️" : "🙈"}</button>
            <button class="act-btn act-delete" onclick="if(window.UI) UI.deleteActivity('${item.id}','round')"
              title="Delete">🗑️</button>
          </div>` : ""}
        </div>
        <div class="activity-round-row">
          <div class="activity-score">${item.total || "—"}</div>
          <div class="activity-round-meta">
            <div class="activity-course">${esc(item.course || "Unknown course")}</div>
            <div class="activity-round-detail">${vsStr} vs par · Diff: ${item.differential ?? "—"} · ${item.date || ""}</div>
          </div>
        </div>
        ${isHidden ? `<div class="hidden-label">Hidden from your profile</div>` : ""}
      </div>`;
    }
    return "";
  }).join("");
}

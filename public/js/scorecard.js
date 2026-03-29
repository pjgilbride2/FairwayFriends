// ============================================================
//  FAIRWAY FRIEND — Scorecard & Round History
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, doc, setDoc, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { myProfile, myVibes } from "./profile.js";
import { showToast } from "./ui.js";

// FIX: exported so app.js can reset scores between rounds
export let myScores = new Array(18).fill("");

export const HOLES = [
  {h:1,  par:4, hcp:7 }, {h:2,  par:3, hcp:15}, {h:3,  par:5, hcp:1 },
  {h:4,  par:4, hcp:11}, {h:5,  par:4, hcp:5 }, {h:6,  par:3, hcp:17},
  {h:7,  par:5, hcp:3 }, {h:8,  par:4, hcp:9 }, {h:9,  par:4, hcp:13},
  {h:10, par:4, hcp:8 }, {h:11, par:5, hcp:2 }, {h:12, par:3, hcp:16},
  {h:13, par:4, hcp:6 }, {h:14, par:4, hcp:10}, {h:15, par:5, hcp:4 },
  {h:16, par:3, hcp:18}, {h:17, par:4, hcp:12}, {h:18, par:4, hcp:14},
];

const COURSE_RATING = 71.5;
const SLOPE_RATING  = 113;

function vsPar(total) {
  const d = total - 72;
  return d > 0 ? "+" + d : d === 0 ? "E" : String(d);
}

function scoreClass(score, par) {
  if (!score || isNaN(score)) return "";
  const d = score - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d ===  1) return "bogey";
  if (d >=  2)  return "double";
  return "";
}

// FIX: reset scores array so a second round starts clean
export function resetScores() {
  myScores = new Array(18).fill("");
}

export function buildScoreTable() {
  ["front", "back"].forEach((nine) => {
    const tbody = document.getElementById("sc-" + nine);
    if (!tbody) return;
    tbody.innerHTML = "";
    const range = nine === "front" ? HOLES.slice(0, 9) : HOLES.slice(9);
    range.forEach((hole, i) => {
      const gi = nine === "front" ? i : i + 9;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${hole.h}</td>
        <td style="color:var(--muted);font-size:11px">${hole.par}</td>
        <td style="color:var(--muted);font-size:10px">${hole.hcp}</td>
        <td>
          <input class="score-input ${scoreClass(parseInt(myScores[gi]), hole.par)}"
            type="number" min="1" max="15"
            value="${myScores[gi] || ""}"
            data-hole="${gi}"
            oninput="window._onScoreChange(this)">
        </td>`;
      tbody.appendChild(tr);
    });
  });
  updateTotals();
}

export function onScoreChange(input) {
  const gi  = parseInt(input.dataset.hole);
  const val = input.value ? parseInt(input.value) : "";
  myScores[gi] = val;
  input.className = "score-input " + scoreClass(parseInt(val), HOLES[gi].par);
  updateTotals();
}

function sumArr(arr, a, b) {
  return arr.slice(a, b).reduce((s, v) => s + (isNaN(v) || v === "" ? 0 : parseInt(v)), 0);
}

export function updateTotals() {
  const hasAny   = myScores.some((s) => s !== "");
  const fY       = sumArr(myScores, 0, 9);
  const bY       = sumArr(myScores, 9, 18);
  const total    = hasAny ? fY + bY : null;
  const vsParNum = total !== null ? total - 72 : null;
  const diff     = total !== null
    ? ((total - COURSE_RATING) * 113 / SLOPE_RATING).toFixed(1)
    : null;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("ft-you",    hasAny ? fY : "—");
  set("bt-you",    hasAny ? bY : "—");
  set("tt-you",    total  ?? "—");
  set("sc-total",  total  ?? "—");
  set("sc-diff",   diff   ?? "—");
  set("sc-vs-par",
    vsParNum === null ? "—"
    : vsParNum > 0   ? "+" + vsParNum
    : vsParNum === 0 ? "E"
    : String(vsParNum)
  );
}

export async function saveRound(courseName) {
  const user = window._currentUser;
  if (!user) return;

  if (!myScores.some((s) => s !== "")) {
    showToast("Enter some scores first!");
    return;
  }

  const total = sumArr(myScores, 0, 18);
  const diff  = parseFloat(((total - COURSE_RATING) * 113 / SLOPE_RATING).toFixed(1));

  await addDoc(collection(db, "rounds"), {
    uid:          user.uid,
    authorName:   myProfile.displayName || "Golfer",
    scores:       [...myScores],
    total,
    differential: diff,
    course:       courseName || "Unknown course",
    date:         new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    createdAt:    serverTimestamp(),
  });

  await setDoc(doc(db, "users", user.uid), {
    roundCount: increment(1),
  }, { merge: true });

  await addDoc(collection(db, "posts"), {
    text:       `Just finished a round — shot ${total} (${vsPar(total)} vs par). Differential: ${diff} ⛳`,
    authorId:   user.uid,
    authorName: myProfile.displayName || "Golfer",
    vibes:      myVibes,
    type:       "round",
    createdAt:  serverTimestamp(),
  });

  myProfile.roundCount = (myProfile.roundCount || 0) + 1;
  const elRounds = document.getElementById("profile-rounds");
  if (elRounds) elRounds.textContent = myProfile.roundCount;

  await loadRoundHistory();
  showToast("Round saved & posted to feed! ⛳");
}

export async function loadRoundHistory() {
  const user = window._currentUser;
  if (!user) return;

  const q = query(
    collection(db, "rounds"),
    where("uid", "==", user.uid),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  const snap   = await getDocs(q);
  const rounds = snap.docs.map((d) => d.data());

  const el = document.getElementById("round-history");
  if (!el) return;

  if (!rounds.length) {
    el.innerHTML = `<div class="empty-state">No rounds saved yet</div>`;
    return;
  }

  el.innerHTML = rounds.map((r) => `
    <div class="rh-card">
      <div>
        <div class="rh-course">${r.course || "Unknown course"}</div>
        <div class="rh-date">${r.date || "—"}</div>
      </div>
      <div>
        <div class="rh-score">${r.total || "—"}</div>
        <div class="rh-diff">Diff: ${r.differential ?? "—"}</div>
      </div>
    </div>`
  ).join("");

  // Update handicap trend dots
  if (rounds.length >= 2) {
    const dots  = document.querySelectorAll(".hcp-dot");
    const diffs = rounds.slice(0, 5).map((r) => r.differential || 0).reverse();
    const max   = Math.max(...diffs, 1);
    dots.forEach((dot, i) => {
      if (diffs[i] !== undefined) {
        dot.style.height = Math.round((diffs[i] / max) * 22) + "px";
        dot.classList.toggle("current", i === diffs.length - 1);
      }
    });
  }
}

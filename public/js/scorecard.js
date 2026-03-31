// ============================================================
//  FAIRWAY FRIEND — Scorecard (up to 4 players, game-aware)
//  Players can be linked app users OR typed names
// ============================================================

import { db } from "./firebase-config.js?v=43";
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, doc, getDoc, setDoc, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { myProfile, myVibes } from "./profile.js?v=43";
import { showToast, initials, avatarColor, esc } from "./ui.js?v=43";

// ── State ────────────────────────────────────────────────────
export let myScores = new Array(18).fill("");
let currentMode     = "stroke";

// Players array: index 0 = "you", indices 1-3 = up to 3 others
// { name, uid|null, scores[], color }
let players = [];

function _initPlayers() {
  players = [
    { name: myProfile.displayName || "You", uid: window._currentUser?.uid || null, scores: new Array(18).fill(""), color: "var(--green)" },
  ];
}

export const PLAYER_COLORS = ["var(--green)", "#3b82f6", "#f59e0b", "#ef4444"];
export const PLAYER_COLOR_NAMES = ["green", "blue", "amber", "red"];

export const HOLES = [
  {h:1, par:4,hcp:7 },{h:2, par:3,hcp:15},{h:3, par:5,hcp:1 },
  {h:4, par:4,hcp:11},{h:5, par:4,hcp:5 },{h:6, par:3,hcp:17},
  {h:7, par:5,hcp:3 },{h:8, par:4,hcp:9 },{h:9, par:4,hcp:13},
  {h:10,par:4,hcp:8 },{h:11,par:5,hcp:2 },{h:12,par:3,hcp:16},
  {h:13,par:4,hcp:6 },{h:14,par:4,hcp:10},{h:15,par:5,hcp:4 },
  {h:16,par:3,hcp:18},{h:17,par:4,hcp:12},{h:18,par:4,hcp:14},
];
const COURSE_RATING = 71.5;
const SLOPE_RATING  = 113;

export function resetScores() {
  _initPlayers();
  myScores = players[0].scores;
}

// ── Game modes ───────────────────────────────────────────────
export const MODES = {
  stroke:     {label:"Stroke Play",  icon:"🏌️", desc:"Count every shot — lowest total wins"},
  match:      {label:"Match Play",   icon:"⚔️",  desc:"Win holes vs par — most holes won wins"},
  stableford: {label:"Stableford",   icon:"🎯",  desc:"Points per hole: Eagle=4 Birdie=3 Par=2 Bogey=1"},
  scramble:   {label:"Scramble",     icon:"🤝",  desc:"Team picks best shot each time"},
  skins:      {label:"Skins",        icon:"💰",  desc:"Beat other players hole-by-hole to win the skin"},
  bestball:   {label:"Best Ball",    icon:"⭐",  desc:"Each plays own ball — best score per hole counts"},
};

// ── Set game mode ─────────────────────────────────────────────
export function setGameMode(mode) {
  const _valid = ['stroke','match','stableford','scramble','skins','bestball'];
  currentMode = _valid.includes(mode) ? mode : 'stroke';
  document.querySelectorAll(".game-mode-btn").forEach(b => {
    const active = b.dataset.mode === currentMode;
    b.classList.toggle("game-mode-active", active);
    b.style.border     = "1.5px solid " + (active ? "var(--green)" : "var(--border)");
    b.style.background = active ? "var(--green-light)" : "var(--bg)";
    b.style.color      = active ? "var(--green-dark)"  : "var(--text)";
    b.style.fontWeight = active ? "600" : "400";
  });
  const descEl = document.getElementById("game-mode-desc");
  if (descEl) descEl.textContent = MODES[currentMode].desc;
  buildScoreTable();
  updateTotals();
}

// ── Build game panel ──────────────────────────────────────────
export function buildGamePanel() {
  const panel = document.getElementById("game-panel");
  if (!panel) return;

  // Ensure players initialized
  if (!players.length) _initPlayers();

  panel.innerHTML =
    // Game format selector
    '<div style="margin-bottom:16px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase">Game Format</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
    Object.entries(MODES).map(([key,m]) =>
      '<button class="game-mode-btn' + (currentMode===key?' game-mode-active':'') + '" data-mode="'+key+'"' +
      ' onclick="safeUI(\'setGameMode\',\''+key+'\')"' +
      ' style="display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:20px;' +
      'border:1.5px solid '+(currentMode===key?'var(--green)':'var(--border)')+';' +
      'background:'+(currentMode===key?'var(--green-light)':'var(--bg)')+';' +
      'color:'+(currentMode===key?'var(--green-dark)':'var(--text)')+';' +
      'font-size:13px;font-weight:'+(currentMode===key?'600':'400')+';' +
      'cursor:pointer;font-family:inherit;transition:all .15s">' +
      '<span>'+m.icon+'</span><span>'+m.label+'</span></button>'
    ).join('') +
    '</div>' +
    '<div id="game-mode-desc" style="font-size:12px;color:var(--muted);margin-top:8px;padding:7px 10px;' +
    'background:var(--surface);border-radius:8px;border-left:3px solid var(--green)">' +
    MODES[currentMode].desc + '</div></div>' +

    // Players panel
    '<div style="margin-bottom:4px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;margin-bottom:10px;text-transform:uppercase">Players (' + players.length + '/4)</div>' +
    '<div id="sc-players-list">' + _renderPlayersList() + '</div>' +
    (players.length < 4 ?
      '<button onclick="safeUI(\'addPlayerPrompt\')" style="display:flex;align-items:center;gap:6px;width:100%;padding:10px 12px;margin-top:8px;' +
      'background:var(--surface);border:1.5px dashed var(--border);border-radius:12px;' +
      'color:var(--muted);font-size:13px;font-weight:500;cursor:pointer;font-family:inherit">' +
      '<span style="font-size:18px">+</span> Add Player ('+players.length+'/4)' +
      '</button>' : '') +
    '</div>';
}

function _renderPlayersList() {
  return players.map((p, i) => {
    const isYou = i === 0;
    const ini   = initials(p.name || "?");
    const total = _playerTotal(i);
    const vspar = total !== null ? (total - 72 > 0 ? "+" + (total-72) : total-72===0 ? "E" : String(total-72)) : "";
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
      <div style="width:34px;height:34px;border-radius:50%;background:${p.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">
        ${p.uid && p.photoURL ? `<img src="${p.photoURL}" style="width:34px;height:34px;border-radius:50%;object-fit:cover">` : ini}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc(p.name)}${isYou ? ' <span style="font-size:10px;color:var(--muted)">(you)</span>' : ''}
          ${p.uid && !isYou ? ' <span style="font-size:10px;color:var(--green)">●</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--muted)">${total !== null ? total + ' · ' + vspar : 'No scores yet'}</div>
      </div>
      ${!isYou ? `<button onclick="safeUI('removePlayer',${i})" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:4px;flex-shrink:0">×</button>` : ''}
    </div>`;
  }).join('');
}

function _playerTotal(playerIdx) {
  const p = players[playerIdx];
  if (!p) return null;
  const scores = p.scores;
  if (!scores.some(s => s !== "")) return null;
  return scores.reduce((s,v)=>s+(isNaN(v)||v===""?0:parseInt(v)),0);
}

// ── Add player UI ─────────────────────────────────────────────
export function addPlayerPrompt() {
  if (players.length >= 4) { showToast("Maximum 4 players"); return; }

  // Build overlay panel
  const overlay = document.createElement("div");
  overlay.id = "sc-add-player-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-end;justify-content:center";

  const sheet = document.createElement("div");
  sheet.style.cssText = "background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto";
  sheet.innerHTML = `
    <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
      Add Player
      <button onclick="document.getElementById('sc-add-player-overlay').remove()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer">×</button>
    </div>

    <!-- Type a name -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;margin-bottom:6px;text-transform:uppercase">Enter Name</div>
      <div style="display:flex;gap:8px">
        <input id="sc-player-name-input" type="text" maxlength="30" placeholder="e.g. Mike, Sarah..."
          style="flex:1;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;outline:none"
          oninput="document.getElementById('sc-add-name-btn').disabled=!this.value.trim()">
        <button id="sc-add-name-btn" disabled onclick="safeUI('addPlayerByName')"
          style="padding:10px 16px;border-radius:10px;background:var(--green);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;opacity:.5"
          onmouseover="if(!this.disabled)this.style.opacity=1" onmouseout="this.style.opacity=this.disabled?.5:1">
          Add
        </button>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin:12px 0">
      <div style="flex:1;height:1px;background:var(--border)"></div>
      <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">or link app user</span>
      <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>

    <!-- Search app users -->
    <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase">Search Followers</div>
    <input id="sc-player-search" type="text" maxlength="40" placeholder="Search by name..."
      style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;outline:none;margin-bottom:10px"
      oninput="safeUI('searchPlayersForCard',this.value)">
    <div id="sc-player-search-results" style="max-height:250px;overflow-y:auto">
      <div style="font-size:13px;color:var(--muted);padding:8px 0">Type to search your followers…</div>
    </div>`;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // Enable add button reactively
  document.getElementById('sc-add-name-btn')?.addEventListener('click', () => {});
}

export async function searchPlayersForCard(query) {
  const el = document.getElementById("sc-player-search-results");
  if (!el || !query || query.trim().length < 2) {
    if (el) el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">Type to search your followers…</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">Searching…</div>';
  try {
    const me = window._currentUser;
    const snap = await getDoc(doc(db, "users", me.uid));
    const friends = snap.data()?.friends || [];
    if (!friends.length) { el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">No followers yet</div>'; return; }
    const profiles = (await Promise.all(friends.slice(0,30).map(async uid => {
      try { const s = await getDoc(doc(db,"users",uid)); return s.exists() ? {uid,...s.data()} : null; } catch { return null; }
    }))).filter(Boolean);
    const q = query.toLowerCase();
    const filtered = profiles.filter(p => (p.displayName||"").toLowerCase().includes(q));
    if (!filtered.length) { el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">No matches</div>'; return; }
    el.innerHTML = filtered.map(p => {
      const ini    = initials(p.displayName||"?");
      const aColor = avatarColor(p.uid);
      const already = players.some(pl => pl.uid === p.uid);
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:0.5px solid var(--border)">
        <div class="player-avatar ${aColor}" style="width:36px;height:36px;font-size:13px;flex-shrink:0">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(p.displayName||"Golfer")}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(p.city||"")}${p.handicap!=null?" · HCP "+p.handicap:""}</div>
        </div>
        ${already
          ? '<span style="font-size:12px;color:var(--muted)">Already added</span>'
          : `<button onclick="safeUI('addPlayerByUid','${p.uid}','${esc(p.displayName||"Golfer")}','${p.photoURL||""}')"
              style="padding:7px 14px;border-radius:14px;background:var(--green-light);color:var(--green-dark);border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
              Add
            </button>`
        }
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">Could not load</div>';
  }
}

export function addPlayerByName() {
  const input = document.getElementById("sc-player-name-input");
  const name  = input?.value.trim();
  if (!name || players.length >= 4) return;
  const color = PLAYER_COLORS[players.length];
  players.push({ name, uid: null, scores: new Array(18).fill(""), color });
  document.getElementById("sc-add-player-overlay")?.remove();
  _refreshPlayersUI();
  buildScoreTable();
  showToast(name + " added to scorecard");
}

export function addPlayerByUid(uid, name, photoURL) {
  if (players.length >= 4) { showToast("Maximum 4 players"); return; }
  if (players.some(p => p.uid === uid)) { showToast(name + " is already on the card"); return; }
  const color = PLAYER_COLORS[players.length];
  players.push({ name, uid, photoURL: photoURL||null, scores: new Array(18).fill(""), color });
  document.getElementById("sc-add-player-overlay")?.remove();
  _refreshPlayersUI();
  buildScoreTable();
  showToast(name + " added to scorecard ⛳");
}

export function removePlayer(idx) {
  if (idx <= 0 || idx >= players.length) return;
  const name = players[idx].name;
  players.splice(idx, 1);
  // Reassign colors
  players.forEach((p,i) => { p.color = PLAYER_COLORS[i]; });
  _refreshPlayersUI();
  buildScoreTable();
  showToast(name + " removed");
}

function _refreshPlayersUI() {
  const list = document.getElementById("sc-players-list");
  if (list) list.innerHTML = _renderPlayersList();
  // Refresh add button
  const addBtn = document.querySelector('[onclick*="addPlayerPrompt"]');
  if (addBtn) {
    if (players.length >= 4) {
      addBtn.style.display = "none";
    } else {
      addBtn.style.display = "";
      addBtn.innerHTML = '<span style="font-size:18px">+</span> Add Player (' + players.length + '/4)';
    }
  }
  // Update panel label
  const lbl = document.querySelector('[style*="Players ("]');
  if (lbl) lbl.textContent = "Players (" + players.length + "/4)";
}

// ── Score helpers ─────────────────────────────────────────────
function scoreClass(score, par) {
  if (!score || isNaN(score)) return "";
  const d = score - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d ===  1) return "bogey";
  if (d >=  2)  return "double";
  return "";
}
function stablefordPts(score, par) {
  if (!score || isNaN(score)) return null;
  const d = score - par;
  if (d <= -2) return 4;
  if (d === -1) return 3;
  if (d ===  0) return 2;
  if (d ===  1) return 1;
  return 0;
}

// ── Build score table ─────────────────────────────────────────
export function buildScoreTable() {
  if (!players.length) _initPlayers();

  ["front","back"].forEach(nine => {
    const tbody = document.getElementById("sc-"+nine);
    if (!tbody) return;
    tbody.innerHTML = "";
    const range = nine === "front" ? HOLES.slice(0,9) : HOLES.slice(9);

    range.forEach((hole, i) => {
      const gi  = nine === "front" ? i : i+9;
      const tr  = document.createElement("tr");

      // Build player score cells
      let playerCells = players.map((p, pi) => {
        const sc = p.scores[gi];
        const cls = scoreClass(parseInt(sc), hole.par);
        const border = pi === 0 ? "" : `border-left:1px solid var(--border)`;
        return `<td style="${border}">
          <input class="score-input ${cls}"
            type="number" min="1" max="20"
            value="${sc||""}"
            data-hole="${gi}"
            data-player="${pi}"
            placeholder="-"
            oninput="window._onScoreChange(this)"
            style="color:${p.color}">
        </td>`;
      }).join('');

      // Result cell for certain modes
      let resultCell = "";
      if (currentMode === "stableford") {
        const pts = stablefordPts(parseInt(players[0].scores[gi]), hole.par);
        const col = pts===null?"var(--muted)":pts>=3?"var(--green)":pts===0?"#e53e3e":"var(--text)";
        resultCell = `<td class="sc-result-cell" style="font-size:11px;font-weight:700;color:${col}">${pts===null?"—":pts+"pt"}</td>`;
      } else if (currentMode === "match") {
        const sc = players[0].scores[gi];
        if (sc) {
          const d = parseInt(sc) - hole.par;
          const r = d<0?"W":d===0?"H":"L";
          const col = r==="W"?"var(--green)":r==="L"?"#e53e3e":"var(--muted)";
          resultCell = `<td class="sc-result-cell" style="font-size:11px;font-weight:700;color:${col}">${r}</td>`;
        } else resultCell = `<td class="sc-result-cell" style="color:var(--muted)">—</td>`;
      } else if (currentMode === "skins" && players.length > 1) {
        // Find hole winner among all players
        const scores = players.map(p => p.scores[gi]).filter(s => s !== "");
        if (scores.length === players.length) {
          const mins = Math.min(...players.map(p=>parseInt(p.scores[gi])||99));
          const winners = players.filter(p=>parseInt(p.scores[gi])===mins);
          const winText = winners.length === 1 ? winners[0].name.split(" ")[0] : "TIE";
          const col = winners.length===1?"var(--green)":"var(--muted)";
          resultCell = `<td class="sc-result-cell" style="font-size:10px;font-weight:700;color:${col}">${winText}</td>`;
        } else resultCell = `<td class="sc-result-cell" style="color:var(--muted)">—</td>`;
      } else if (currentMode === "bestball" && players.length > 1) {
        const best = players.reduce((b,p) => { const s=parseInt(p.scores[gi]); return (!isNaN(s)&&(b===null||s<b))?s:b; }, null);
        resultCell = best!==null
          ? `<td class="sc-result-cell"><span class="score-input ${scoreClass(best,hole.par)}" style="font-size:12px;font-weight:600">${best}</span></td>`
          : `<td class="sc-result-cell" style="color:var(--muted)">—</td>`;
      }

      tr.innerHTML =
        `<td>${hole.h}</td>` +
        `<td style="color:var(--muted);font-size:11px">${hole.par}</td>` +
        `<td style="color:var(--muted);font-size:10px">${hole.hcp}</td>` +
        playerCells + resultCell;
      tbody.appendChild(tr);
    });
  });

  // Update headers
  const needsResult = ["stableford","match","skins","bestball"].includes(currentMode);
  document.querySelectorAll(".sc-table-head").forEach(thead => {
    const playerHeaders = players.map((p,i) =>
      `<th style="color:${p.color};max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.name}">
        ${i===0?"You":p.name.split(" ")[0]}
      </th>`
    ).join('');
    thead.innerHTML = `<tr>
      <th>Hole</th><th>Par</th><th>HCP</th>
      ${playerHeaders}
      ${needsResult ? `<th>${_resultHdr()}</th>` : ""}
    </tr>`;
  });

  // Sync myScores to player[0].scores for backwards compat
  myScores = players[0].scores;
  updateTotals();
}

function _resultHdr() {
  if (currentMode==="stableford") return "Pts";
  if (currentMode==="match")      return "Hole";
  if (currentMode==="skins")      return "Skin";
  if (currentMode==="bestball")   return "Best";
  return "";
}

// ── Score change handler ──────────────────────────────────────
export function onScoreChange(input) {
  const gi       = parseInt(input.dataset.hole);
  const playerIdx = parseInt(input.dataset.player) || 0;
  const val      = input.value ? parseInt(input.value) : "";
  if (players[playerIdx]) players[playerIdx].scores[gi] = val;
  if (playerIdx === 0) myScores[gi] = val;
  input.className = "score-input " + scoreClass(parseInt(val), HOLES[gi].par);
  input.style.color = players[playerIdx]?.color || "var(--text)";
  buildScoreTable();
}

function sumArr(arr,a,b) {
  return arr.slice(a,b).reduce((s,v)=>s+(isNaN(v)||v===""?0:parseInt(v)),0);
}

// ── Totals (shows per-player totals) ─────────────────────────
export function updateTotals() {
  const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };

  // Always show player[0] (you) in the main totals
  const p0 = players[0];
  const scores = p0?.scores || myScores;
  const hasAny = scores.some(s=>s!=="");

  if (currentMode === "stableford") {
    const fPts = HOLES.slice(0,9).reduce((s,h,i)=>s+(stablefordPts(parseInt(scores[i]),h.par)||0),0);
    const bPts = HOLES.slice(9).reduce((s,h,i)=>s+(stablefordPts(parseInt(scores[i+9]),h.par)||0),0);
    set("ft-you", hasAny?fPts+"pts":"—");
    set("bt-you", hasAny?bPts+"pts":"—");
    set("tt-you", hasAny?(fPts+bPts)+"pts":"—");
    set("sc-total",hasAny?(fPts+bPts)+" pts":"—");
    set("sc-vs-par",""); set("sc-diff","");
    set("sc-summary-label","Stableford Points");
  } else if (currentMode === "match") {
    const w=scores.filter((s,i)=>s!==""&&parseInt(s)<HOLES[i].par).length;
    const l=scores.filter((s,i)=>s!==""&&parseInt(s)>HOLES[i].par).length;
    const h=scores.filter((s,i)=>s!==""&&parseInt(s)===HOLES[i].par).length;
    const net=w-l;
    set("ft-you","—"); set("bt-you","—");
    set("tt-you",(w+l+h)?`${w}W / ${l}L / ${h}H`:"—");
    set("sc-total",(w+l+h)?`${w}W / ${l}L / ${h}H`:"—");
    set("sc-vs-par",net>0?"+"+net+" up":net<0?Math.abs(net)+" dn":"AS");
    set("sc-diff","");
    set("sc-summary-label","Match Play (vs Par)");
  } else if (currentMode === "skins") {
    const skinsWon = players.length>1 ? HOLES.reduce((total,_,gi)=>{
      const allFilled = players.every(p=>p.scores[gi]!=="");
      if(!allFilled)return total;
      const mins=Math.min(...players.map(p=>parseInt(p.scores[gi])||99));
      const winners=players.filter(p=>parseInt(p.scores[gi])===mins);
      return total+(winners.length===1&&winners[0]===p0?1:0);
    },0) : 0;
    set("ft-you",""); set("bt-you","");
    set("tt-you",skinsWon+" skins won"); set("sc-total",skinsWon+" skins won");
    set("sc-vs-par",""); set("sc-diff","");
    set("sc-summary-label","Skins Won");
  } else {
    const fY=sumArr(scores,0,9), bY=sumArr(scores,9,18);
    const total=hasAny?fY+bY:null;
    const diff=total!==null?((total-COURSE_RATING)*113/SLOPE_RATING).toFixed(1):null;
    set("ft-you",hasAny?fY:"—"); set("bt-you",hasAny?bY:"—");
    set("tt-you",total??"—"); set("sc-total",total??"—");
    set("sc-diff",diff??"—");
    set("sc-vs-par",total===null?"—":total-72>0?"+"+(total-72):total-72===0?"E":String(total-72));
    set("sc-summary-label",currentMode==="scramble"?"Scramble Team Score":"Gross Score");
  }

  // Update player totals in the players list
  _refreshPlayersUI();
}

// ── Save round ────────────────────────────────────────────────
export async function saveRound(courseName) {
  const user = window._currentUser;
  if (!user) return;
  if (!players[0]?.scores.some(s=>s!=="")) { showToast("Enter some scores first!"); return; }

  const p0     = players[0];
  const total  = sumArr(p0.scores,0,18);
  const diff   = parseFloat(((total-COURSE_RATING)*113/SLOPE_RATING).toFixed(1));
  const modeName = MODES[currentMode]?.label||"Stroke Play";

  // Save all players' scores
  const playersData = players.map(p => ({
    name: p.name, uid: p.uid||null,
    scores: [...p.scores],
    total: sumArr(p.scores,0,18),
  }));

  await addDoc(collection(db,"rounds"),{
    uid: user.uid,
    authorName: myProfile.displayName||"Golfer",
    scores: [...p0.scores],
    players: playersData,
    total, differential: diff,
    course: courseName||"Unknown",
    gameMode: currentMode,
    date: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db,"users",user.uid),{roundCount:increment(1)},{merge:true});

  const modeEmoji = MODES[currentMode]?.icon||"⛳";
  const modeText  = currentMode==="stableford"
    ? HOLES.reduce((s,h,i)=>s+(stablefordPts(parseInt(p0.scores[i]),h.par)||0),0)+" Stableford pts"
    : currentMode==="match"
      ? p0.scores.filter((s,i)=>s&&parseInt(s)<HOLES[i].par).length+" holes won"
      : `shot ${total} (${total-72>0?"+"+(total-72):total-72===0?"E":String(total-72)} vs par)`;

  const playerNames = players.length > 1 ? " with " + players.slice(1).map(p=>p.name.split(" ")[0]).join(", ") : "";

  await addDoc(collection(db,"posts"),{
    text: `Played a ${modeName} round${playerNames} — ${modeText} ${modeEmoji}. Differential: ${diff}`,
    authorId: user.uid, authorName: myProfile.displayName||"Golfer",
    vibes: myVibes, type: "round", createdAt: serverTimestamp(),
  });

  myProfile.roundCount=(myProfile.roundCount||0)+1;
  const elR=document.getElementById("profile-rounds"); if(elR) elR.textContent=myProfile.roundCount;

  await loadRoundHistory();
  await _recalcHandicap(user.uid);
  showToast(`${modeName} round saved! ${modeEmoji}`);
}

// ── Auto-recalculate handicap from last 8 rounds ──────────────
async function _recalcHandicap(uid) {
  try {
    const q8 = query(
      collection(db,'rounds'),
      where('uid','==',uid),
      orderBy('createdAt','desc'),
      limit(8)
    );
    const snap = await getDocs(q8);
    const diffs = snap.docs
      .map(d => d.data().differential)
      .filter(d => d != null && !isNaN(d));
    if (diffs.length < 3) return; // need at least 3 rounds
    // USGA simplified: average of best differentials
    // <8 rounds: best 1; 8 rounds: avg best 2
    const sorted = [...diffs].sort((a,b)=>a-b);
    const useCount = diffs.length >= 8 ? 2 : 1;
    const avg = sorted.slice(0,useCount).reduce((s,v)=>s+v,0)/useCount;
    const newHcp = Math.max(0, Math.min(54, parseFloat((avg*0.96).toFixed(1))));
    await setDoc(doc(db,'users',uid),{handicap:newHcp},{merge:true});
    // Update local profile
    if (window.myProfile) window.myProfile.handicap = newHcp;
    // Update scorecard display
    const profileHcpEl = document.getElementById('profile-hcp');
    if (profileHcpEl) profileHcpEl.textContent = newHcp;
    showToast(`Handicap updated to ${newHcp} based on last ${diffs.length} rounds ⛳`);
  } catch(e) {
    console.warn('Handicap recalc error:', e.message);
  }
}

// ── Round history ─────────────────────────────────────────────
export async function loadRoundHistory() {
  const user = window._currentUser;
  if (!user) return;
  const q = query(collection(db,"rounds"),where("uid","==",user.uid),orderBy("createdAt","desc"),limit(10));
  const snap = await getDocs(q);
  const rounds = snap.docs.map(d=>d.data());
  const el = document.getElementById("round-history");
  if (!el) return;
  if (!rounds.length) { el.innerHTML='<div class="empty-state">No rounds saved yet</div>'; return; }
  el.innerHTML = rounds.map(r => {
    const pNames = r.players?.length>1 ? r.players.slice(1).map(p=>p.name.split(" ")[0]).join(", ") : "";
    return `<div class="rh-card">
      <div>
        <div class="rh-course">${r.course||"Unknown"}</div>
        <div class="rh-date">${r.date||"—"} · <span style="font-size:11px;color:var(--muted)">${MODES[r.gameMode]?.label||"Stroke Play"}</span></div>
        ${pNames ? `<div style="font-size:11px;color:var(--muted)">with ${pNames}</div>` : ""}
      </div>
      <div>
        <div class="rh-score">${r.total||"—"}</div>
        <div class="rh-diff">Diff: ${r.differential??"—"}</div>
      </div>
    </div>`;
  }).join("");

  if (rounds.length>=2) {
    const dots=document.querySelectorAll(".hcp-dot");
    const diffs=rounds.slice(0,5).map(r=>r.differential||0).reverse();
    const max=Math.max(...diffs,1);
    dots.forEach((dot,i)=>{if(diffs[i]!==undefined){dot.style.height=Math.round((diffs[i]/max)*22)+"px";dot.classList.toggle("current",i===diffs.length-1);}});
  }
}

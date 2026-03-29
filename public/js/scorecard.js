// ============================================================
//  FAIRWAY FRIEND — Scorecard (Game-Aware)
//  Modes: Stroke | Match | Stableford | Scramble | Skins | Best Ball
// ============================================================

import { db } from "./firebase-config.js?v=28";
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, doc, setDoc, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { myProfile, myVibes } from "./profile.js?v=28";
import { showToast } from "./ui.js?v=28";

// ── State ────────────────────────────────────────────────────
export let myScores  = new Array(18).fill("");
let myScores2        = new Array(18).fill("");
let currentMode      = "stroke";

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
  myScores  = new Array(18).fill("");
  myScores2 = new Array(18).fill("");
}

// ── Game modes ───────────────────────────────────────────────
export const MODES = {
  stroke:     {label:"Stroke Play",icon:"🏌️", desc:"Count every shot — lowest total wins"},
  match:      {label:"Match Play", icon:"⚔️",  desc:"Win holes vs par — most holes won wins"},
  stableford: {label:"Stableford", icon:"🎯",  desc:"Points per hole: Eagle=4 Birdie=3 Par=2 Bogey=1"},
  scramble:   {label:"Scramble",   icon:"🤝",  desc:"Team picks best shot each time — enter team score"},
  skins:      {label:"Skins",      icon:"💰",  desc:"Beat your partner on a hole to win the skin"},
  bestball:   {label:"Best Ball",  icon:"⭐",  desc:"Each plays own ball — best score per hole counts"},
};

// ── Set mode ─────────────────────────────────────────────────
export function setGameMode(mode) {
  const _valid=['stroke','match','stableford','scramble','skins','bestball'];
  currentMode = _valid.includes(mode) ? mode : 'stroke';
  document.querySelectorAll(".game-mode-btn").forEach(b => {
    const active = b.dataset.mode === currentMode;
    b.classList.toggle("game-mode-active", active);
    b.style.border    = "1.5px solid " + (active ? "var(--green)" : "var(--border)");
    b.style.background = active ? "var(--green-light)" : "var(--bg)";
    b.style.color      = active ? "var(--green-dark)"  : "var(--text)";
    b.style.fontWeight = active ? "600" : "400";
  });
  const descEl = document.getElementById("game-mode-desc");
  if (descEl) descEl.textContent = MODES[currentMode].desc;
  buildScoreTable();
  updateTotals();
}

// ── Build game selector ──────────────────────────────────────
export function buildGamePanel() {
  const panel = document.getElementById("game-panel");
  if (!panel) return;
  panel.innerHTML =
    '<div style="margin-bottom:14px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase">Game Format</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
    Object.entries(MODES).map(([key,m]) =>
      '<button class="game-mode-btn' + (currentMode===key?' game-mode-active':'') + '" data-mode="'+key+'"' +
      ' onclick="safeUI(\'setGameMode\',\''+key+'\')"' +
      ' title="'+m.desc+'"' +
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
    MODES[currentMode].desc + '</div></div>';
}

// ── Scoring helpers ──────────────────────────────────────────
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
function matchRes(score, par) {
  if (!score || isNaN(score)) return "";
  const d = score - par;
  return d < 0 ? "W" : d === 0 ? "H" : "L";
}

// ── Build score table ────────────────────────────────────────
export function buildScoreTable() {
  const needsPartner  = ["bestball","skins"].includes(currentMode);
  const showResultCol = ["stableford","match","skins","bestball"].includes(currentMode);

  ["front","back"].forEach(nine => {
    const tbody = document.getElementById("sc-"+nine);
    if (!tbody) return;
    tbody.innerHTML = "";
    const range = nine === "front" ? HOLES.slice(0,9) : HOLES.slice(9);
    range.forEach((hole, i) => {
      const gi  = nine === "front" ? i : i+9;
      const sc  = myScores[gi];
      const sc2 = myScores2[gi];
      const tr  = document.createElement("tr");

      // Result cell
      let resultHTML = "";
      if (showResultCol) {
        let resText = "—", resColor = "var(--muted)";
        if (currentMode === "stableford") {
          const pts = stablefordPts(parseInt(sc), hole.par);
          resText  = pts === null ? "—" : pts + "pt";
          resColor = pts === null ? "var(--muted)" : pts >= 3 ? "var(--green)" : pts === 0 ? "#e53e3e" : "var(--text)";
        } else if (currentMode === "match") {
          const r = matchRes(parseInt(sc), hole.par);
          resText  = r || "—";
          resColor = r==="W"?"var(--green)":r==="L"?"#e53e3e":"var(--muted)";
        } else if (currentMode === "skins") {
          const s1=parseInt(sc), s2=parseInt(sc2);
          if (sc && sc2) {
            resText  = s1<s2?"WIN":s1>s2?"LOSE":"TIE";
            resColor = s1<s2?"var(--green)":s1>s2?"#e53e3e":"var(--muted)";
          }
        } else if (currentMode === "bestball") {
          const best = !sc&&!sc2 ? null : !sc ? parseInt(sc2) : !sc2 ? parseInt(sc) : Math.min(parseInt(sc),parseInt(sc2));
          resText  = best===null?"—":best;
          resColor = best===null?"var(--muted)":"var(--text)";
        }
        resultHTML = '<td class="sc-result-cell" style="font-size:11px;font-weight:700;color:'+resColor+'">'+resText+'</td>';
      }

      tr.innerHTML =
        '<td>'+hole.h+'</td>' +
        '<td style="color:var(--muted);font-size:11px">'+hole.par+'</td>' +
        '<td style="color:var(--muted);font-size:10px">'+hole.hcp+'</td>' +
        '<td><input class="score-input '+scoreClass(parseInt(sc),hole.par)+'"' +
          ' type="number" min="1" max="20" value="'+(sc||"")+'"' +
          ' data-hole="'+gi+'" data-player="1" oninput="window._onScoreChange(this)"></td>' +
        (needsPartner ?
          '<td><input class="score-input '+scoreClass(parseInt(sc2),hole.par)+'"' +
          ' type="number" min="1" max="20" value="'+(sc2||"")+'"' +
          ' data-hole="'+gi+'" data-player="2" oninput="window._onScoreChange(this)"></td>' : '') +
        resultHTML;
      tbody.appendChild(tr);
    });
  });

  // Update table headers
  document.querySelectorAll(".sc-table-head").forEach(thead => {
    thead.innerHTML =
      '<tr><th>Hole</th><th>Par</th><th>HCP</th>' +
      '<th>'+(currentMode==="scramble"?"Team":"You")+'</th>' +
      (needsPartner?"<th>Partner</th>":"") +
      (showResultCol?'<th>'+_resultHdr()+'</th>':"") +
      '</tr>';
  });

  updateTotals();
}

function _resultHdr() {
  if (currentMode==="stableford") return "Pts";
  if (currentMode==="match")      return "Hole";
  if (currentMode==="skins")      return "Skin";
  if (currentMode==="bestball")   return "Best";
  return "";
}

// ── Score change ─────────────────────────────────────────────
export function onScoreChange(input) {
  const gi     = parseInt(input.dataset.hole);
  const player = input.dataset.player || "1";
  const val    = input.value ? parseInt(input.value) : "";
  if (player === "2") { myScores2[gi] = val; }
  else                { myScores[gi]  = val; }
  input.className = "score-input " + scoreClass(parseInt(val), HOLES[gi].par);
  // Rebuild result cells
  const nine  = gi < 9 ? "front" : "back";
  const tbody = document.getElementById("sc-"+nine);
  if (tbody) buildScoreTable();
  else updateTotals();
}

function sumArr(arr,a,b) {
  return arr.slice(a,b).reduce((s,v)=>s+(isNaN(v)||v===""?0:parseInt(v)),0);
}

// ── Totals ───────────────────────────────────────────────────
export function updateTotals() {
  const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  const hasAny = myScores.some(s=>s!=="");

  if (currentMode === "stableford") {
    const fPts = HOLES.slice(0,9).reduce((s,h,i)=>s+(stablefordPts(parseInt(myScores[i]),h.par)||0),0);
    const bPts = HOLES.slice(9).reduce((s,h,i)=>s+(stablefordPts(parseInt(myScores[i+9]),h.par)||0),0);
    set("ft-you",  hasAny ? fPts+"pts" : "—");
    set("bt-you",  hasAny ? bPts+"pts" : "—");
    set("tt-you",  hasAny ? (fPts+bPts)+"pts" : "—");
    set("sc-total",hasAny ? (fPts+bPts)+" pts" : "—");
    set("sc-vs-par",""); set("sc-diff","");
    set("sc-summary-label","Stableford Points");

  } else if (currentMode === "match") {
    const w = myScores.filter((s,i)=>s!==""&&parseInt(s)<HOLES[i].par).length;
    const l = myScores.filter((s,i)=>s!==""&&parseInt(s)>HOLES[i].par).length;
    const h = myScores.filter((s,i)=>s!==""&&parseInt(s)===HOLES[i].par).length;
    const net = w-l;
    set("ft-you","—"); set("bt-you","—");
    set("tt-you",   (w+l+h)?`${w}W / ${l}L / ${h}H`:"—");
    set("sc-total", (w+l+h)?`${w}W / ${l}L / ${h}H`:"—");
    set("sc-vs-par",net>0?"+"+net+" up":net<0?Math.abs(net)+" dn":"AS");
    set("sc-diff","");
    set("sc-summary-label","Match Play (vs Par)");

  } else if (currentMode === "skins") {
    const sw = myScores.filter((s,i)=>s&&myScores2[i]&&parseInt(s)<parseInt(myScores2[i])).length;
    const sl = myScores.filter((s,i)=>s&&myScores2[i]&&parseInt(s)>parseInt(myScores2[i])).length;
    set("ft-you",""); set("bt-you","");
    set("tt-you",   sw+" skins won"); set("sc-total",sw+" skins won");
    set("sc-vs-par",sl+" lost"); set("sc-diff","");
    set("sc-summary-label","Skins Won vs Partner");

  } else if (currentMode === "bestball") {
    const best = myScores.map((s,i)=>{
      const s2=myScores2[i];
      if(!s&&!s2)return "";
      if(!s)return parseInt(s2);
      if(!s2)return parseInt(s);
      return Math.min(parseInt(s),parseInt(s2));
    });
    const hasB = best.some(s=>s!=="");
    const fB=sumArr(best,0,9), bB=sumArr(best,9,18), tot=hasB?fB+bB:null;
    const diff=tot!==null?((tot-COURSE_RATING)*113/SLOPE_RATING).toFixed(1):null;
    set("ft-you",hasB?fB:"—"); set("bt-you",hasB?bB:"—");
    set("tt-you",tot??"—"); set("sc-total",tot??"—");
    set("sc-vs-par",tot!==null?(tot-72>0?"+"+(tot-72):tot-72===0?"E":String(tot-72)):"—");
    set("sc-diff",diff??"—");
    set("sc-summary-label","Best Ball Total");

  } else {
    // Stroke / Scramble
    const fY=sumArr(myScores,0,9), bY=sumArr(myScores,9,18);
    const total=hasAny?fY+bY:null;
    const diff=total!==null?((total-COURSE_RATING)*113/SLOPE_RATING).toFixed(1):null;
    set("ft-you",hasAny?fY:"—"); set("bt-you",hasAny?bY:"—");
    set("tt-you",total??"—"); set("sc-total",total??"—");
    set("sc-diff",diff??"—");
    set("sc-vs-par",total===null?"—":total-72>0?"+"+(total-72):total-72===0?"E":String(total-72));
    set("sc-summary-label",currentMode==="scramble"?"Scramble Team Score":"Gross Score");
  }
}

// ── Save round ───────────────────────────────────────────────
export async function saveRound(courseName) {
  const user = window._currentUser;
  if (!user) return;
  if (!myScores.some(s=>s!=="")) { showToast("Enter some scores first!"); return; }
  const total = sumArr(myScores,0,18);
  const diff  = parseFloat(((total-COURSE_RATING)*113/SLOPE_RATING).toFixed(1));
  const modeName = MODES[currentMode]?.label||"Stroke Play";
  await addDoc(collection(db,"rounds"),{
    uid:user.uid, authorName:myProfile.displayName||"Golfer",
    scores:[...myScores], scores2:[...myScores2],
    total, differential:diff, course:courseName||"Unknown",
    gameMode:currentMode,
    date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    createdAt:serverTimestamp(),
  });
  await setDoc(doc(db,"users",user.uid),{roundCount:increment(1)},{merge:true});
  const modeEmoji = MODES[currentMode]?.icon||"⛳";
  const modeText  = currentMode==="stableford"
    ? HOLES.reduce((s,h,i)=>s+(stablefordPts(parseInt(myScores[i]),h.par)||0),0)+" Stableford pts"
    : currentMode==="match"
      ? myScores.filter((s,i)=>s&&parseInt(s)<HOLES[i].par).length+" holes won"
      : `shot ${total} (${total-72>0?"+"+(total-72):total-72===0?"E":String(total-72)} vs par)`;
  await addDoc(collection(db,"posts"),{
    text:`Played a ${modeName} round — ${modeText} ${modeEmoji}. Differential: ${diff}`,
    authorId:user.uid, authorName:myProfile.displayName||"Golfer",
    vibes:myVibes, type:"round", createdAt:serverTimestamp(),
  });
  myProfile.roundCount=(myProfile.roundCount||0)+1;
  const elR=document.getElementById("profile-rounds"); if(elR)elR.textContent=myProfile.roundCount;
  await loadRoundHistory();
  showToast(`${modeName} round saved! ${modeEmoji}`);
}

// ── Round history ────────────────────────────────────────────
export async function loadRoundHistory() {
  const user = window._currentUser;
  if (!user) return;
  const q = query(collection(db,"rounds"),where("uid","==",user.uid),orderBy("createdAt","desc"),limit(10));
  const snap = await getDocs(q);
  const rounds = snap.docs.map(d=>d.data());
  const el = document.getElementById("round-history");
  if (!el) return;
  if (!rounds.length) { el.innerHTML='<div class="empty-state">No rounds saved yet</div>'; return; }
  el.innerHTML = rounds.map(r=>
    '<div class="rh-card"><div><div class="rh-course">'+(r.course||"Unknown")+'</div>' +
    '<div class="rh-date">'+(r.date||"—")+' · <span style="font-size:11px;color:var(--muted)">'+(MODES[r.gameMode]?.label||"Stroke Play")+'</span></div></div>' +
    '<div><div class="rh-score">'+(r.total||"—")+'</div><div class="rh-diff">Diff: '+(r.differential??"—")+'</div></div></div>'
  ).join("");
  if (rounds.length>=2) {
    const dots=document.querySelectorAll(".hcp-dot");
    const diffs=rounds.slice(0,5).map(r=>r.differential||0).reverse();
    const max=Math.max(...diffs,1);
    dots.forEach((dot,i)=>{if(diffs[i]!==undefined){dot.style.height=Math.round((diffs[i]/max)*22)+"px";dot.classList.toggle("current",i===diffs.length-1);}});
  }
}

// ============================================================
//  FAIRWAY FRIEND — Course Layout Page
//  Renders an SVG overhead map of all 18 holes.
//  Powered by GolfAPI.io via fetchCourseHoles().
//  Shows live GPS dot, shot history, and hole stats.
// ============================================================

import { showToast, esc } from './ui.js?v=93';
import { fetchCourseHoles, gpsIsActive, getCurrentHole, getShots } from './gps.js?v=93';

// ── State ─────────────────────────────────────────────────────
let _courseName   = '';
let _holes        = [];   // [{h, lat, lon, teeLat, teeLon, par, yards, handicap}]
let _watchId      = null;
let _userLat      = null;
let _userLon      = null;
let _selectedHole = null;
let _mapBounds    = null; // {minLat,maxLat,minLon,maxLon}

// ── Entry point ───────────────────────────────────────────────
export async function openCourseLayout(courseName, courseLat, courseLon) {
  _courseName   = courseName || 'Golf Course';
  _holes        = [];
  _mapBounds    = null;
  _selectedHole = null;

  _buildScreen();
  window.safeUI('goScreen', 'course-layout');
  _renderSkeleton();

  // Fetch hole data via GolfAPI.io (uses cache if available)
  const holeData = await fetchCourseHoles(courseName, courseLat, courseLon);
  _holes = holeData || [];

  // Compute map bounds from hole coordinates
  const lats = _holes.filter(h => h.lat).map(h => [h.lat, h.teeLat]).flat().filter(Boolean);
  const lons = _holes.filter(h => h.lon).map(h => [h.lon, h.teeLon]).flat().filter(Boolean);
  if (lats.length) {
    const pad = 0.003;
    _mapBounds = {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad,
    };
  } else if (courseLat) {
    _mapBounds = {
      minLat: courseLat - 0.012,
      maxLat: courseLat + 0.012,
      minLon: courseLon - 0.015,
      maxLon: courseLon + 0.015,
    };
  }

  _renderMap();
  _startPositionWatch();
}

export function closeCourseLayout() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
}

// ── Build screen DOM ──────────────────────────────────────────
function _buildScreen() {
  let screen = document.getElementById('screen-course-layout');
  if (screen) { screen.innerHTML = ''; return; }
  screen = document.createElement('div');
  screen.id = 'screen-course-layout';
  screen.className = 'screen hidden';
  screen.style.cssText = 'background:#1a2e1a;min-height:100vh;overflow-y:auto;-webkit-overflow-scrolling:touch';
  const last = Array.from(document.querySelectorAll('.screen')).pop();
  if (last?.parentNode) last.parentNode.insertBefore(screen, last.nextSibling);
  else document.body.appendChild(screen);
  if (window._addValidScreen) window._addValidScreen('course-layout');
}

// ── Loading skeleton ──────────────────────────────────────────
function _renderSkeleton() {
  const screen = document.getElementById('screen-course-layout');
  if (!screen) return;
  screen.innerHTML = `
    <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid rgba(255,255,255,.1)">
      <button onclick="safeUI('closeCourseLayout')"
        style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 8px 4px 0;font-size:22px;line-height:1">‹</button>
      <div>
        <div style="font-size:17px;font-weight:700;color:#fff">${esc(_courseName)}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:1px">Loading course via GolfAPI.io…</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;height:50vh">
      <div style="text-align:center;color:rgba(255,255,255,.6)">
        <div style="font-size:40px;margin-bottom:12px">⛳</div>
        <div style="font-size:14px">Fetching hole coordinates…</div>
        <div style="font-size:12px;margin-top:6px;color:rgba(255,255,255,.4)">Powered by GolfAPI.io</div>
      </div>
    </div>`;
}

// ── Render full map ───────────────────────────────────────────
function _renderMap() {
  const screen = document.getElementById('screen-course-layout');
  if (!screen) return;

  const mappedCount  = _holes.filter(h => h.lat).length;
  const mappedText   = mappedCount > 0 ? `${mappedCount}/18 holes mapped · GolfAPI.io` : 'Overview mode';
  const currentHole  = gpsIsActive ? getCurrentHole() : (_selectedHole || 1);

  screen.innerHTML = `
    <!-- Header -->
    <div style="position:sticky;top:0;z-index:20;background:#1a2e1a;border-bottom:1px solid rgba(255,255,255,.12);padding:14px 16px">
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="safeUI('closeCourseLayout')"
          style="background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;
                 width:34px;height:34px;border-radius:50%;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0">‹</button>
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(_courseName)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:1px">⛳ ${mappedText}</div>
        </div>
        <button onclick="safeUI('toggleCourseLayoutGPS')" id="layout-gps-btn"
          style="background:${gpsIsActive?'#22c55e':'rgba(255,255,255,.12)'};border:none;color:#fff;
                 cursor:pointer;padding:7px 12px;border-radius:20px;font-size:12px;font-weight:600;font-family:inherit;white-space:nowrap">
          ${gpsIsActive ? '📡 Live' : '📡 GPS Off'}
        </button>
      </div>
      <!-- Hole selector strip -->
      <div style="display:flex;gap:6px;overflow-x:auto;padding:10px 0 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch" id="hole-strip">
        ${Array.from({length:18},(_,i)=>i+1).map(h=>`
          <button onclick="safeUI('selectLayoutHole',${h})"
            class="layout-hole-chip" data-hole="${h}"
            style="flex-shrink:0;min-width:34px;height:34px;border-radius:50%;
              border:1.5px solid ${h===currentHole?'#4ade80':'rgba(255,255,255,.2)'};
              background:${h===currentHole?'#4ade80':'transparent'};
              color:${h===currentHole?'#1a2e1a':'rgba(255,255,255,.8)'};
              font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">
            ${h}
          </button>`).join('')}
      </div>
    </div>

    <!-- SVG Map -->
    <div style="padding:12px 12px 0;position:relative">
      <div style="border-radius:16px;overflow:hidden;background:#2d4a2d;position:relative" id="course-map-wrap">
        ${_buildSVGMap(currentHole)}
      </div>
    </div>

    <!-- Hole detail card -->
    <div id="hole-detail-card" style="margin:12px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);padding:16px">
      ${_buildHoleCard(currentHole)}
    </div>

    <!-- Scorecard table -->
    <div style="margin:0 12px 24px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);overflow:hidden">
      <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.1)">
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.8)">Scorecard</div>
      </div>
      ${_buildScorecardTable()}
    </div>`;

  setTimeout(() => {
    const chip = document.querySelector(`.layout-hole-chip[data-hole="${currentHole}"]`);
    chip?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  }, 200);
}

// ── SVG map builder ───────────────────────────────────────────
function _buildSVGMap(activeHole) {
  if (!_mapBounds) {
    return '<div style="height:300px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:14px">Map data not available</div>';
  }

  const W = 360, H = 480;
  const { minLat, maxLat, minLon, maxLon } = _mapBounds;
  const latRange = maxLat - minLat || 0.01;
  const lonRange = maxLon - minLon || 0.01;
  const pad = 24;

  const toX = lon => pad + ((lon - minLon) / lonRange) * (W - pad*2);
  const toY = lat => pad + ((maxLat - lat) / latRange) * (H - pad*2);

  let paths = '';

  // Draw tee→green lines for all holes
  for (const h of _holes) {
    if (!h.lat || !h.teeLat) continue;
    const x = toX(h.lon), y = toY(h.lat);
    const tx = toX(h.teeLon), ty = toY(h.teeLat);
    const isActive = h.h === activeHole;
    paths += `<line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
      stroke="${isActive?'rgba(74,222,128,.7)':'rgba(255,255,255,.12)'}"
      stroke-width="${isActive?2:1}" stroke-dasharray="5,3"/>`;
  }

  // Draw tee markers
  for (const h of _holes) {
    if (!h.teeLat) continue;
    const tx = toX(h.teeLon), ty = toY(h.teeLat);
    const isActive = h.h === activeHole;
    paths += `<rect x="${(tx-3).toFixed(1)}" y="${(ty-3).toFixed(1)}" width="6" height="6" rx="1"
      fill="${isActive?'rgba(255,255,255,.9)':'rgba(255,255,255,.35)'}"
      stroke="${isActive?'rgba(255,255,255,.4)':'none'}" stroke-width="1"/>`;
  }

  // Draw green circles + hole numbers
  for (const h of _holes) {
    if (!h.lat) continue;
    const x = toX(h.lon), y = toY(h.lat);
    const isActive = h.h === activeHole;
    const r = isActive ? 9 : 6;
    paths += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"
      fill="${isActive?'#4ade80':'rgba(255,255,255,.45)'}"
      stroke="${isActive?'#1a2e1a':'rgba(0,0,0,.3)'}" stroke-width="${isActive?1.5:1}"/>`;
    paths += `<text x="${x.toFixed(1)}" y="${(y+0.5).toFixed(1)}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${isActive?7:5.5}" font-weight="700"
      fill="${isActive?'#1a2e1a':'#1a2e1a'}"
      font-family="DM Sans,sans-serif">${h.h}</text>`;
  }

  // GPS user dot
  if (_userLat && _userLon && _mapBounds) {
    const ux = toX(_userLon), uy = toY(_userLat);
    if (ux > 0 && ux < W && uy > 0 && uy < H) {
      paths += `<circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="9" fill="rgba(59,130,246,.25)" stroke="none"/>`;
      paths += `<circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>`;
    }
  }

  // Shot dots for active hole
  const shots = gpsIsActive ? getShots().filter(s => s.hole === activeHole) : [];
  shots.forEach((s, i) => {
    if (!s.lat || !s.lon) return;
    const sx = toX(s.lon), sy = toY(s.lat);
    paths += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1"/>`;
    paths += `<text x="${sx.toFixed(1)}" y="${(sy+0.5).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="5" font-weight="700" fill="#1a1a1a" font-family="sans-serif">${i+1}</text>`;
  });

  const noData = _holes.every(h => !h.lat);
  const overlay = noData
    ? `<text x="${W/2}" y="${H/2-10}" text-anchor="middle" font-size="13" fill="rgba(255,255,255,.5)" font-family="DM Sans,sans-serif">No GPS data from GolfAPI.io</text>
       <text x="${W/2}" y="${H/2+12}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.35)" font-family="DM Sans,sans-serif">Showing synthetic layout</text>` : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
    <rect width="${W}" height="${H}" fill="#2d4a2d"/>
    ${paths}
    ${overlay}
    <rect x="10" y="${H-38}" width="148" height="30" rx="6" fill="rgba(0,0,0,.45)"/>
    <circle cx="22" cy="${H-23}" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>
    <text x="31" y="${H-19}" font-size="8" fill="rgba(255,255,255,.7)" font-family="DM Sans,sans-serif">You</text>
    <rect x="50" y="${H-26}" width="6" height="6" rx="1" fill="rgba(255,255,255,.7)"/>
    <text x="60" y="${H-19}" font-size="8" fill="rgba(255,255,255,.7)" font-family="DM Sans,sans-serif">Tee</text>
    <circle cx="88" cy="${H-23}" r="5" fill="#4ade80" stroke="#1a2e1a" stroke-width="1"/>
    <text x="97" y="${H-19}" font-size="8" fill="rgba(255,255,255,.7)" font-family="DM Sans,sans-serif">Green</text>
    <circle cx="134" cy="${H-23}" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1"/>
    <text x="143" y="${H-19}" font-size="8" fill="rgba(255,255,255,.7)" font-family="DM Sans,sans-serif">Shot</text>
  </svg>`;
}

// ── Hole detail card ──────────────────────────────────────────
function _buildHoleCard(h) {
  const hd   = _holes.find(x => x.h === h) || { h, par: 4 };
  const par  = hd.par || 4;
  const yards = hd.yards ? `${hd.yards}y` : '';
  const handicap = hd.handicap ? `HCP ${hd.handicap}` : '';
  const dist = gpsIsActive && _userLat && hd.lat ? _feetToPin(hd.lat, hd.lon) : null;
  const shots = gpsIsActive ? getShots().filter(s => s.hole === h) : [];

  const meta = [yards, handicap].filter(Boolean).join(' · ');

  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#fff">Hole ${h}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.6);margin-top:2px">Par ${par}${meta?' · '+meta:''}</div>
    </div>
    ${dist !== null
      ? `<div style="text-align:right">
          <div style="font-size:28px;font-weight:700;color:#4ade80">${dist}<span style="font-size:14px;font-weight:400"> ft</span></div>
          <div style="font-size:11px;color:rgba(255,255,255,.5)">to pin</div>
        </div>`
      : `<div style="text-align:right">
          <div style="font-size:22px;font-weight:700;color:rgba(255,255,255,.3)">${hd.lat ? '📍' : '—'}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.4)">${hd.lat ? 'GPS ready' : 'No GPS data'}</div>
        </div>`}
  </div>
  ${shots.length
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        ${shots.map((s,i)=>`<div style="padding:5px 10px;border-radius:20px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);font-size:12px;font-weight:500;color:#fbbf24">
          Shot ${i+1}${s.distToPin?' · '+s.distToPin+'ft':''}
        </div>`).join('')}
      </div>`
    : `<div style="font-size:12px;color:rgba(255,255,255,.3)">
        ${gpsIsActive ? 'Tap 🏌️ Shot on the scorecard to log shots' : 'Start GPS tracking to log shots'}
      </div>`}`;
}

// ── Scorecard table ───────────────────────────────────────────
function _buildScorecardTable() {
  const rows = _holes.map(h => {
    const par = h.par || 4;
    const gpsIcon = h.lat ? '📍' : '—';
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.07)">
      <td style="padding:9px 14px;font-size:13px;font-weight:600;color:rgba(255,255,255,.9);cursor:pointer"
        onclick="safeUI('selectLayoutHole',${h.h})">${h.h}</td>
      <td style="padding:9px 8px;text-align:center;font-size:13px;color:rgba(255,255,255,.6)">${par}</td>
      <td style="padding:9px 8px;text-align:center;font-size:12px;color:rgba(255,255,255,.5)">${h.yards || '—'}</td>
      <td style="padding:9px 8px;text-align:center;font-size:11px;color:rgba(255,255,255,.4)">${gpsIcon}</td>
      <td style="padding:9px 14px;text-align:right;font-size:12px;color:rgba(255,255,255,.4)">
        ${h.h % 9 === 0
          ? `<span style="color:rgba(255,255,255,.6);font-weight:500">Par ${_holes.slice(h.h-9,h.h).reduce((s,x)=>s+(x.par||4),0)}</span>`
          : ''}
      </td>
    </tr>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="border-bottom:1px solid rgba(255,255,255,.12)">
        <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">Hole</th>
        <th style="padding:9px 8px;text-align:center;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">Par</th>
        <th style="padding:9px 8px;text-align:center;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">Yards</th>
        <th style="padding:9px 8px;text-align:center;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">GPS</th>
        <th style="padding:9px 14px;font-size:10px;color:rgba(255,255,255,.4)"></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Live GPS position watch ───────────────────────────────────
function _startPositionWatch() {
  if (!navigator.geolocation) return;
  if (_watchId) navigator.geolocation.clearWatch(_watchId);
  _watchId = navigator.geolocation.watchPosition(pos => {
    _userLat = pos.coords.latitude;
    _userLon = pos.coords.longitude;
    _updateLiveDot();
  }, null, { enableHighAccuracy: true, maximumAge: 5000 });
}

function _updateLiveDot() {
  const wrap = document.getElementById('course-map-wrap');
  if (!wrap || !_mapBounds || !_userLat) return;
  const { minLat, maxLat, minLon, maxLon } = _mapBounds;
  const W=360, H=480, pad=24;
  const x = (pad + ((_userLon - minLon) / (maxLon - minLon || 0.01)) * (W-pad*2)).toFixed(1);
  const y = (pad + ((maxLat - _userLat) / (maxLat - minLat || 0.01)) * (H-pad*2)).toFixed(1);
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  svg.querySelectorAll('.user-dot').forEach(e=>e.remove());
  const outer = document.createElementNS('http://www.w3.org/2000/svg','circle');
  outer.setAttribute('cx',x); outer.setAttribute('cy',y); outer.setAttribute('r','9');
  outer.setAttribute('fill','rgba(59,130,246,.25)'); outer.classList.add('user-dot');
  const inner = document.createElementNS('http://www.w3.org/2000/svg','circle');
  inner.setAttribute('cx',x); inner.setAttribute('cy',y); inner.setAttribute('r','5');
  inner.setAttribute('fill','#3b82f6'); inner.setAttribute('stroke','#fff'); inner.setAttribute('stroke-width','1.5');
  inner.classList.add('user-dot');
  svg.appendChild(outer); svg.appendChild(inner);
  const h = _selectedHole || (gpsIsActive ? getCurrentHole() : 1);
  const detail = document.getElementById('hole-detail-card');
  if (detail) detail.innerHTML = _buildHoleCard(h);
}

// ── Helpers ───────────────────────────────────────────────────
function _feetToPin(pinLat, pinLon) {
  if (!_userLat || !_userLon || !pinLat || !pinLon) return null;
  const R=3958.8, d2r=Math.PI/180;
  const dLat=(_userLat-pinLat)*d2r, dLon=(_userLon-pinLon)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(pinLat*d2r)*Math.cos(_userLat*d2r)*Math.sin(dLon/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*5280);
}

// ── Select hole ───────────────────────────────────────────────
export function selectLayoutHole(h) {
  _selectedHole = h;
  document.querySelectorAll('.layout-hole-chip').forEach(el => {
    const active = parseInt(el.dataset.hole) === h;
    el.style.background   = active ? '#4ade80' : 'transparent';
    el.style.color        = active ? '#1a2e1a' : 'rgba(255,255,255,.8)';
    el.style.borderColor  = active ? '#4ade80' : 'rgba(255,255,255,.2)';
  });
  const wrap = document.getElementById('course-map-wrap');
  if (wrap) wrap.innerHTML = _buildSVGMap(h);
  const detail = document.getElementById('hole-detail-card');
  if (detail) detail.innerHTML = _buildHoleCard(h);
  const chip = document.querySelector(`.layout-hole-chip[data-hole="${h}"]`);
  chip?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
}

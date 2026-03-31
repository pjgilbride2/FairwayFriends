// ============================================================
//  FAIRWAY FRIEND — Course Layout Page
//  Renders an SVG overhead map of all 18 holes using OSM data.
//  Shows live GPS dot, shot history, and hole stats.
// ============================================================

import { showToast, esc } from './ui.js?v=42';
import { fetchCourseHoles, isActive as gpsIsActive, getCurrentHole, getShots } from './gps.js?v=42';

// ── Overpass fetch with retry + mirror fallback ───────────────
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
async function _overpassFetch(query, timeoutMs=18000) {
  const cacheKey = 'op_' + btoa(unescape(encodeURIComponent(query.trim().slice(0,100)))).replace(/[^a-z0-9]/gi,'').slice(0,40);
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { const p=JSON.parse(cached); if(Date.now()-p.ts<3600000) return p.data; }
  } catch(_) {}

  let lastErr;
  for (const mirror of OVERPASS_MIRRORS) {
    for (let attempt=0; attempt<2; attempt++) {
      try {
        if (attempt>0) await new Promise(r=>setTimeout(r,1500*attempt));
        const resp = await fetch(mirror+'?data='+encodeURIComponent(query),{
          signal: AbortSignal.timeout(timeoutMs),
          headers:{'Accept':'application/json'}
        });
        if (resp.status===429){ await new Promise(r=>setTimeout(r,3000+attempt*2000)); continue; }
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type')||'';
        if (!ct.includes('json')) continue;
        const data = await resp.json();
        try{sessionStorage.setItem(cacheKey,JSON.stringify({data,ts:Date.now()}));}catch(_){}
        return data;
      } catch(e){lastErr=e;}
    }
  }
  throw lastErr||new Error('All Overpass mirrors failed');
}

// ── State ─────────────────────────────────────────────────────
let _courseName = '';
let _holes      = [];   // [{h, lat, lon, teeLat, teeLon, fairwayPoly:[]}]
let _osm        = null; // raw OSM elements for polygon drawing
let _watchId    = null;
let _userLat    = null;
let _userLon    = null;
let _selectedHole = null;
let _mapBounds  = null; // {minLat,maxLat,minLon,maxLon}

// ── Entry point ───────────────────────────────────────────────
export async function openCourseLayout(courseName, courseLat, courseLon) {
  _courseName = courseName || 'Golf Course';
  _holes = [];
  _osm   = null;

  // Build or show the screen
  _buildScreen();
  window.safeUI('goScreen', 'course-layout');

  // Show skeleton while loading
  _renderSkeleton();

  // Fetch full OSM data for the course
  await _loadOSMData(courseLat, courseLon);

  // Render the map
  _renderMap();

  // Start GPS tracking user position on the map
  _startPositionWatch();
}

export function closeCourseLayout() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
}

// ── Build the screen DOM ──────────────────────────────────────
function _buildScreen() {
  let screen = document.getElementById('screen-course-layout');
  if (screen) { screen.innerHTML = ''; return; }

  screen = document.createElement('div');
  screen.id = 'screen-course-layout';
  screen.className = 'screen hidden';
  screen.style.cssText = 'background:#1a2e1a;min-height:100vh;overflow-y:auto;-webkit-overflow-scrolling:touch';

  // Add to app root
  const last = Array.from(document.querySelectorAll('.screen')).pop();
  if (last?.parentNode) last.parentNode.insertBefore(screen, last.nextSibling);
  else document.body.appendChild(screen);

  // Register in valid screens (goScreen check)
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
        <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:1px">Loading course map…</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;height:50vh">
      <div style="text-align:center;color:rgba(255,255,255,.6)">
        <div style="font-size:40px;margin-bottom:12px">⛳</div>
        <div style="font-size:14px">Fetching course layout…</div>
        <div style="font-size:12px;margin-top:6px;color:rgba(255,255,255,.4)">Querying OpenStreetMap</div>
      </div>
    </div>`;
}

// ── Fetch full OSM geometry ───────────────────────────────────
async function _loadOSMData(lat, lon) {
  if (!lat || !lon) return;
  const radius = 700;

  const query = `
    [out:json][timeout:20];
    (
      way["golf"](around:${radius},${lat},${lon});
      way["leisure"="golf_course"](around:${radius},${lat},${lon});
      relation["golf"](around:${radius},${lat},${lon});
      node["golf"](around:${radius},${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const data = await _overpassFetch(query, 18000);
    _osm = data.elements || [];

    // Build node lookup for polygon rendering
    const nodeMap = {};
    for (const el of _osm) {
      if (el.type === 'node') nodeMap[el.id] = { lat: el.lat, lon: el.lon };
    }

    // Extract hole features
    const holes = {};
    for (const el of _osm) {
      if (el.type !== 'way') continue;
      const tags = el.tags || {};
      const golf = tags.golf || '';
      const ref  = parseInt(tags.ref || tags.hole || '0');

      if (!golf && !tags.leisure) continue;

      const coords = (el.nodes || []).map(nid => nodeMap[nid]).filter(Boolean);
      if (!coords.length) continue;

      const centerLat = coords.reduce((s,c) => s + c.lat, 0) / coords.length;
      const centerLon = coords.reduce((s,c) => s + c.lon, 0) / coords.length;

      if (ref >= 1 && ref <= 18) {
        if (!holes[ref]) holes[ref] = { h: ref, polygons: [] };
        holes[ref].polygons.push({ type: golf || 'course', coords });
        if (golf === 'green' || golf === 'hole') {
          holes[ref].lat = centerLat;
          holes[ref].lon = centerLon;
        }
        if (golf === 'tee') {
          holes[ref].teeLat = centerLat;
          holes[ref].teeLon = centerLon;
        }
        if (golf === 'fairway') {
          holes[ref].fairwayCoords = coords;
        }
      }
    }

    // Merge with HOLES par data
    _holes = [];
    for (let h = 1; h <= 18; h++) {
      const hd  = holes[h] || { h, polygons: [] };
      const par = [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4][h-1];
      _holes.push({ ...hd, h, par });
    }

    // Compute map bounds across all coords
    const allLats = [], allLons = [];
    for (const h of _holes) {
      for (const poly of h.polygons || []) {
        for (const c of poly.coords) {
          allLats.push(c.lat); allLons.push(c.lon);
        }
      }
      if (h.lat) { allLats.push(h.lat); allLons.push(h.lon); }
    }
    if (allLats.length) {
      _mapBounds = {
        minLat: Math.min(...allLats), maxLat: Math.max(...allLats),
        minLon: Math.min(...allLons), maxLon: Math.max(...allLons),
      };
    } else {
      // No OSM data — create synthetic bounds around course center
      _mapBounds = { minLat: lat-0.01, maxLat: lat+0.01, minLon: lon-0.015, maxLon: lon+0.015 };
    }

  } catch(e) {
    console.warn('CourseLayout: OSM fetch failed', e.message);
    showToast('Course map not fully available — showing overview');
  }
}

// ── Render the full map ───────────────────────────────────────
function _renderMap() {
  const screen = document.getElementById('screen-course-layout');
  if (!screen) return;

  const holeCount = _holes.filter(h => h.lat || h.polygons?.length).length;
  const mappedText = holeCount > 0 ? `${holeCount}/18 holes mapped` : 'Overview mode';
  const currentHole = gpsIsActive() ? getCurrentHole() : 1;

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
          style="background:${gpsIsActive()?'#22c55e':'rgba(255,255,255,.12)'};border:none;color:#fff;
                 cursor:pointer;padding:7px 12px;border-radius:20px;font-size:12px;font-weight:600;font-family:inherit;white-space:nowrap">
          ${gpsIsActive() ? '📡 Live' : '📡 GPS Off'}
        </button>
      </div>
      <!-- Hole selector strip -->
      <div style="display:flex;gap:6px;overflow-x:auto;padding:10px 0 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch" id="hole-strip">
        ${Array.from({length:18},(_,i)=>i+1).map(h=>`
          <button onclick="safeUI('selectLayoutHole',${h})"
            class="layout-hole-chip" data-hole="${h}"
            style="flex-shrink:0;min-width:34px;height:34px;border-radius:50%;border:1.5px solid ${h===currentHole?'#4ade80':'rgba(255,255,255,.2)'};
              background:${h===currentHole?'#4ade80':'transparent'};color:${h===currentHole?'#1a2e1a':'rgba(255,255,255,.8)'};
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

    <!-- All holes table -->
    <div style="margin:0 12px 24px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);overflow:hidden">
      <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.1)">
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.8)">Scorecard</div>
      </div>
      ${_buildScorecardTable()}
    </div>`;

  // Auto-scroll hole strip to current hole
  setTimeout(() => {
    const chip = document.querySelector(`.layout-hole-chip[data-hole="${currentHole}"]`);
    chip?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  }, 200);
}

// ── Build SVG overhead map ────────────────────────────────────
function _buildSVGMap(activeHole) {
  if (!_mapBounds) return '<div style="height:300px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:14px">Map data not available</div>';

  const W = 360, H = 480;
  const { minLat, maxLat, minLon, maxLon } = _mapBounds;
  const latRange = maxLat - minLat || 0.01;
  const lonRange = maxLon - minLon || 0.01;
  const pad = 20;

  const toX = lon => pad + ((lon - minLon) / lonRange) * (W - pad*2);
  const toY = lat => pad + ((maxLat - lat) / latRange) * (H - pad*2);

  const COLORS = {
    fairway:   '#4a7c4a',
    green:     '#2d6e2d',
    tee:       '#3a5f3a',
    bunker:    '#c8a96e',
    water:     '#4a7fa8',
    rough:     '#3d6b3d',
    hole:      '#2d6e2d',
    course:    '#3d6b3d',
  };

  let paths = '';

  // Draw all polygons
  for (const h of _holes) {
    const isActive = h.h === activeHole;
    for (const poly of h.polygons || []) {
      if (!poly.coords?.length) continue;
      const pts = poly.coords.map(c => `${toX(c.lon).toFixed(1)},${toY(c.lat).toFixed(1)}`).join(' ');
      const fill = COLORS[poly.type] || COLORS.rough;
      const opacity = isActive ? '1' : '0.55';
      paths += `<polygon points="${pts}" fill="${fill}" fill-opacity="${opacity}" stroke="rgba(255,255,255,${isActive?'.25':'.08'})" stroke-width="${isActive?'1.5':'0.8'}"/>`;
    }
  }

  // Draw hole numbers + pin markers
  for (const h of _holes) {
    if (!h.lat) continue;
    const x = toX(h.lon), y = toY(h.lat);
    const isActive = h.h === activeHole;
    // Pin circle
    paths += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isActive?7:4.5}" fill="${isActive?'#4ade80':'rgba(255,255,255,.5)'}" stroke="${isActive?'#1a2e1a':'transparent'}" stroke-width="1.5"/>`;
    // Hole number
    paths += `<text x="${x.toFixed(1)}" y="${(y+1.5).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${isActive?7:5.5}" font-weight="700" fill="${isActive?'#1a2e1a':'#1a2e1a'}" font-family="DM Sans,sans-serif">${h.h}</text>`;
    // Tee box marker
    if (h.teeLat) {
      const tx=toX(h.teeLon),ty=toY(h.teeLat);
      paths += `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="3" fill="rgba(255,255,255,.7)" stroke="rgba(255,255,255,.3)" stroke-width="1"/>`;
    }
    // Line tee→green
    if (h.teeLat) {
      const tx=toX(h.teeLon),ty=toY(h.teeLat);
      paths += `<line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${isActive?'rgba(74,222,128,.6)':'rgba(255,255,255,.15)'}" stroke-width="${isActive?1.5:0.8}" stroke-dasharray="4,3"/>`;
    }
  }

  // GPS user dot
  if (_userLat && _userLon) {
    const ux = toX(_userLon), uy = toY(_userLat);
    paths += `<circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="7" fill="rgba(59,130,246,.3)" stroke="none"/>`;
    paths += `<circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="4" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>`;
  }

  // Shot dots for current hole
  const shots = gpsIsActive() ? getShots().filter(s => s.hole === activeHole) : [];
  shots.forEach((s, i) => {
    if (!s.lat || !s.lon) return;
    const sx = toX(s.lon), sy = toY(s.lat);
    paths += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" fill="#f59e0b" stroke="#fff" stroke-width="1"/>`;
    paths += `<text x="${sx.toFixed(1)}" y="${(sy+1).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="5" font-weight="700" fill="#1a1a1a" font-family="sans-serif">${i+1}</text>`;
  });

  const noData = _holes.every(h => !h.lat && !h.polygons?.length);
  const overlay = noData ? `<text x="${W/2}" y="${H/2-10}" text-anchor="middle" font-size="13" fill="rgba(255,255,255,.5)" font-family="DM Sans,sans-serif">Detailed layout not</text>
    <text x="${W/2}" y="${H/2+12}" text-anchor="middle" font-size="13" fill="rgba(255,255,255,.5)" font-family="DM Sans,sans-serif">available in OpenStreetMap</text>` : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
    <rect width="${W}" height="${H}" fill="#2d4a2d"/>
    ${paths}
    ${overlay}
    <!-- Legend -->
    <rect x="10" y="${H-36}" width="120" height="28" rx="6" fill="rgba(0,0,0,.4)"/>
    <circle cx="22" cy="${H-22}" r="4" fill="#3b82f6" stroke="#fff" stroke-width="1"/>
    <text x="30" y="${H-18}" font-size="8" fill="rgba(255,255,255,.7)" font-family="DM Sans,sans-serif">You</text>
    <circle cx="55" cy="${H-22}" r="3" fill="rgba(255,255,255,.6)"/>
    <text x="62" y="${H-18}" font-size="8" fill="rgba(255,255,255,.7)" font-family="DM Sans,sans-serif">Tee</text>
    <circle cx="88" cy="${H-22}" r="4" fill="#4ade80" stroke="#1a2e1a" stroke-width="1"/>
    <text x="96" y="${H-18}" font-size="8" fill="rgba(255,255,255,.7)" font-family="DM Sans,sans-serif">Pin</text>
  </svg>`;
}

// ── Hole detail card ──────────────────────────────────────────
function _buildHoleCard(h) {
  const hd   = _holes.find(x => x.h === h) || { h, par: 4 };
  const par  = hd.par || 4;
  const dist = gpsIsActive() && _userLat && hd.lat
    ? _feetToPin(hd.lat, hd.lon) : null;
  const shots = gpsIsActive() ? getShots().filter(s => s.hole === h) : [];

  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#fff">Hole ${h}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.6);margin-top:2px">Par ${par}</div>
    </div>
    ${dist !== null ? `<div style="text-align:right">
      <div style="font-size:28px;font-weight:700;color:#4ade80">${dist}<span style="font-size:14px;font-weight:400"> ft</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,.5)">to pin</div>
    </div>` : `<div style="text-align:right">
      <div style="font-size:22px;font-weight:700;color:rgba(255,255,255,.3)">—</div>
      <div style="font-size:11px;color:rgba(255,255,255,.4)">GPS off</div>
    </div>`}
  </div>
  ${shots.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
    ${shots.map((s,i)=>`<div style="padding:5px 10px;border-radius:20px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);font-size:12px;font-weight:500;color:#fbbf24">
      Shot ${i+1}${s.distToPin?` · ${s.distToPin}ft`:''}
    </div>`).join('')}
  </div>` : `<div style="font-size:12px;color:rgba(255,255,255,.3)">
    ${gpsIsActive() ? 'Tap 🏌️ Shot on the scorecard to log shots' : 'Start GPS tracking to log shots'}
  </div>`}`;
}

// ── Scorecard table ───────────────────────────────────────────
function _buildScorecardTable() {
  const rows = _holes.map(h => {
    const par = h.par || 4;
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.07)">
      <td style="padding:9px 14px;font-size:13px;font-weight:600;color:rgba(255,255,255,.9);cursor:pointer"
        onclick="safeUI('selectLayoutHole',${h.h})">${h.h}</td>
      <td style="padding:9px 8px;text-align:center;font-size:13px;color:rgba(255,255,255,.6)">${par}</td>
      <td style="padding:9px 8px;text-align:center;font-size:12px;color:rgba(255,255,255,.4)">${h.lat?'📍':'—'}</td>
      <td style="padding:9px 14px;text-align:right;font-size:12px;color:rgba(255,255,255,.4)">
        ${h.h % 9 === 0 ? `<span style="color:rgba(255,255,255,.6);font-weight:500">Par ${_holes.slice(h.h-9,h.h).reduce((s,x)=>s+(x.par||4),0)}</span>` : ''}
      </td>
    </tr>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="border-bottom:1px solid rgba(255,255,255,.12)">
        <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">Hole</th>
        <th style="padding:9px 8px;text-align:center;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">Par</th>
        <th style="padding:9px 8px;text-align:center;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">GPS</th>
        <th style="padding:9px 14px;text-align:right;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px"></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── GPS watch for live dot ────────────────────────────────────
function _startPositionWatch() {
  if (!navigator.geolocation) return;
  if (_watchId) navigator.geolocation.clearWatch(_watchId);
  _watchId = navigator.geolocation.watchPosition(pos => {
    _userLat = pos.coords.latitude;
    _userLon = pos.coords.longitude;
    // Just update the SVG dot without full re-render
    _updateLiveDot();
  }, null, { enableHighAccuracy: true, maximumAge: 5000 });
}

function _updateLiveDot() {
  const wrap = document.getElementById('course-map-wrap');
  if (!wrap || !_mapBounds || !_userLat) return;
  const { minLat, maxLat, minLon, maxLon } = _mapBounds;
  const W=360,H=480,pad=20;
  const x = (pad + ((_userLon - minLon) / (maxLon - minLon || 0.01)) * (W-pad*2)).toFixed(1);
  const y = (pad + ((maxLat - _userLat) / (maxLat - minLat || 0.01)) * (H-pad*2)).toFixed(1);
  // Update existing dot circles
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  // Remove old user dot and re-add
  svg.querySelectorAll('.user-dot').forEach(e=>e.remove());
  const outer = document.createElementNS('http://www.w3.org/2000/svg','circle');
  outer.setAttribute('cx',x); outer.setAttribute('cy',y); outer.setAttribute('r','7');
  outer.setAttribute('fill','rgba(59,130,246,.3)'); outer.classList.add('user-dot');
  const inner = document.createElementNS('http://www.w3.org/2000/svg','circle');
  inner.setAttribute('cx',x); inner.setAttribute('cy',y); inner.setAttribute('r','4');
  inner.setAttribute('fill','#3b82f6'); inner.setAttribute('stroke','#fff'); inner.setAttribute('stroke-width','1.5');
  inner.classList.add('user-dot');
  svg.appendChild(outer); svg.appendChild(inner);
  // Update distance card
  const h = _selectedHole || (gpsIsActive() ? getCurrentHole() : 1);
  const detail = document.getElementById('hole-detail-card');
  if (detail) detail.innerHTML = _buildHoleCard(h);
}

// ── Helpers ───────────────────────────────────────────────────
function _feetToPin(pinLat, pinLon) {
  if (!_userLat || !_userLon || !pinLat || !pinLon) return null;
  const R=3958.8,d2r=Math.PI/180;
  const dLat=(_userLat-pinLat)*d2r, dLon=(_userLon-pinLon)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(pinLat*d2r)*Math.cos(_userLat*d2r)*Math.sin(dLon/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*5280);
}

// ── Select hole ───────────────────────────────────────────────
export function selectLayoutHole(h) {
  _selectedHole = h;
  // Update chip strip
  document.querySelectorAll('.layout-hole-chip').forEach(el => {
    const active = parseInt(el.dataset.hole) === h;
    el.style.background = active ? '#4ade80' : 'transparent';
    el.style.color = active ? '#1a2e1a' : 'rgba(255,255,255,.8)';
    el.style.borderColor = active ? '#4ade80' : 'rgba(255,255,255,.2)';
  });
  // Update SVG map (redraw with new active hole)
  const wrap = document.getElementById('course-map-wrap');
  if (wrap) wrap.innerHTML = _buildSVGMap(h);
  // Update detail card
  const detail = document.getElementById('hole-detail-card');
  if (detail) detail.innerHTML = _buildHoleCard(h);
  // Scroll chip into view
  const chip = document.querySelector(`.layout-hole-chip[data-hole="${h}"]`);
  chip?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
}

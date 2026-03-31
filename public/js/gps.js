// ============================================================
//  FAIRWAY FRIEND — GPS Round Tracker
//  - Live distance to pin per hole
//  - Auto hole detection via geofencing
//  - OSM hole coordinate lookup per course
//  - Shot tracking overlay
// ============================================================

import { db } from './firebase-config.js?v=50';
import {
  collection, addDoc, doc, updateDoc,
  serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast } from './ui.js?v=50';

// ── Overpass fetch with retry + mirror fallback ───────────────
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
async function _overpassFetch(query, timeoutMs=15000) {
  // Check cache first
  const cacheKey = 'op_' + btoa(unescape(encodeURIComponent(query.trim().slice(0,100)))).replace(/[^a-z0-9]/gi,'').slice(0,40);
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (Date.now() - p.ts < 3600000) return p.data; // 1h cache
    }
  } catch(_) {}

  let lastErr;
  for (const mirror of OVERPASS_MIRRORS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
        const resp = await fetch(mirror + '?data=' + encodeURIComponent(query), {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'Accept': 'application/json' }
        });
        if (resp.status === 429) {
          await new Promise(r => setTimeout(r, 2000 + attempt * 1500));
          break; // try next mirror
        }
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('json')) continue; // Got HTML error page
        const data = await resp.json();
        try { sessionStorage.setItem(cacheKey, JSON.stringify({data, ts: Date.now()})); } catch(_) {}
        return data;
      } catch(e) { lastErr = e; }
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

// ── State ─────────────────────────────────────────────────────
let _watchId       = null;     // geolocation watchPosition ID
let _roundDocId    = null;     // Firestore round tracking doc
let _currentHole   = 1;        // 1-18
let _holes         = [];       // [{h, par, lat, lon, teeLat, teeLon, dist}]
let _shots         = [];       // [{hole, lat, lon, dist, ts}]
let _lastPos       = null;     // {lat, lon, accuracy, ts}
let _active        = false;
let _courseName    = '';
let _onUpdateCb    = null;     // called with (hole, distToPin, accuracy) on every fix

// ── Haversine ─────────────────────────────────────────────────
function _dist(lat1,lon1,lat2,lon2) {
  const R=3958.8,d2r=Math.PI/180;
  const dLat=(lat2-lat1)*d2r, dLon=(lon2-lon1)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*5280; // feet
}

// ── Fetch hole coordinates from OpenStreetMap ──────────────────
export async function fetchCourseHoles(courseName, courseLat, courseLon) {
  const cacheKey = 'holes_' + courseName.toLowerCase().replace(/[^a-z0-9]/g,'_');
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (Date.now() - p.ts < 86400000) {
        console.log('GPS: cache hit ' + courseName + ' (' + (p.source||'?') + ')');
        return p.holes;
      }
    }
  } catch(_) {}

  const lat = courseLat, lon = courseLon;
  if (!lat || !lon) return _syntheticHoles(0, 0);

  // ── API 1: golf-db.com free public API ─────────────────────────
  try {
    const gdUrl = 'https://golf-db.com/api/v1/courses?lat=' + lat + '&lon=' + lon +
      '&radius=5000&name=' + encodeURIComponent(courseName);
    const gdResp = await fetch(gdUrl, { signal: AbortSignal.timeout(5000) });
    if (gdResp.ok) {
      const gdData = await gdResp.json();
      const nameQ = courseName.toLowerCase().split(' ')[0];
      const course = (gdData.courses||[]).find(c =>
        (c.name||'').toLowerCase().includes(nameQ)
      ) || gdData.courses?.[0];
      if (course && course.holes && course.holes.length >= 9) {
        const holes = course.holes.map(function(h) { return {
          h: h.number || h.hole,
          par: h.par || 4,
          lat: (h.green && h.green.lat) || h.lat || null,
          lon: (h.green && (h.green.lng || h.green.lon)) || h.lon || null,
          teeLat: (h.tee && h.tee.lat) || null,
          teeLon: (h.tee && (h.tee.lng || h.tee.lon)) || null,
          yards: h.yards || h.distance || null,
        }; });
        const mapped = holes.filter(function(h){return h.lat;}).length;
        if (mapped >= 3) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify({holes:holes, ts:Date.now(), source:'golf-db'})); } catch(e){}
          console.log('GPS: golf-db.com OK ' + mapped + '/18 holes for ' + courseName);
          return holes;
        }
      }
    }
  } catch(e) { console.warn('GPS: golf-db.com failed:', e.message); }

  // ── API 2: OSM Overpass ─────────────────────────────────────────
  const radius = 800;
  const osmQ = '[out:json][timeout:15];(' +
    'way["golf"="hole"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'node["golf"="hole"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["golf"="green"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'node["golf"="pin"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["golf"="tee"](around:' + radius + ',' + lat + ',' + lon + ');' +
    ');out center;';

  try {
    const osmData = await _overpassFetch(osmQ, 12000);
    const elements = osmData.elements || [];
    const holeMap = {};
    for (let i=0; i < elements.length; i++) {
      const el = elements[i];
      const tags = el.tags || {};
      const ref = parseInt(tags.ref || tags['golf:hole'] || tags.hole || '0');
      if (ref < 1 || ref > 18) continue;
      const eLat = el.lat || (el.center && el.center.lat);
      const eLon = el.lon || (el.center && el.center.lon);
      if (!eLat || !eLon) continue;
      if (!holeMap[ref]) holeMap[ref] = {};
      const golf = tags.golf || '';
      if (golf === 'green' || golf === 'pin' || golf === 'hole') {
        holeMap[ref].green = { lat: eLat, lon: eLon };
      } else if (golf === 'tee') {
        holeMap[ref].tee = { lat: eLat, lon: eLon };
      }
    }
    const pars = [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4];
    const holes = [];
    for (let h=1; h<=18; h++) {
      const hd = holeMap[h];
      holes.push({
        h: h, par: pars[h-1],
        lat: hd && hd.green ? hd.green.lat : null,
        lon: hd && hd.green ? hd.green.lon : null,
        teeLat: hd && hd.tee ? hd.tee.lat : null,
        teeLon: hd && hd.tee ? hd.tee.lon : null,
      });
    }
    const mappedOsm = holes.filter(function(h){return h.lat;}).length;
    if (mappedOsm >= 3) {
      try { sessionStorage.setItem(cacheKey, JSON.stringify({holes:holes, ts:Date.now(), source:'osm'})); } catch(e){}
      console.log('GPS: OSM OK ' + mappedOsm + '/18 holes for ' + courseName);
      return holes;
    }
    console.warn('GPS: OSM only ' + mappedOsm + ' holes — synthetic');
  } catch(e) { console.warn('GPS: OSM failed:', e.message); }

  // ── API 3: Synthetic (always works) ────────────────────────────
  console.log('GPS: synthetic for ' + courseName);
  return _syntheticHoles(lat, lon);
}


export async function startGpsRound(courseName, courseLat, courseLon, onUpdate) {
  if (_active) stopGpsRound();
  _active      = true;
  _courseName  = courseName;
  _currentHole = 1;
  _shots       = [];
  _onUpdateCb  = onUpdate || null;

  showToast('📡 GPS tracking started');

  // Fetch hole coordinates
  _holes = await fetchCourseHoles(courseName, courseLat, courseLon) || [];
  const holesFound = _holes.filter(h => h.lat).length;
  if (holesFound > 0) {
    showToast(`⛳ Found ${holesFound}/18 holes mapped`);
  } else {
    showToast('⚠️ Course layout not mapped — distance shown from center');
    // Fall back: all holes point to course center
    for (let h = 1; h <= 18; h++) {
      _holes.push({ h, lat: courseLat, lon: courseLon, teeLat: null, teeLon: null });
    }
  }

  // Save tracking session to Firestore
  const user = window._currentUser;
  if (user) {
    try {
      const ref = await addDoc(collection(db, 'gpsRounds'), {
        uid:        user.uid,
        course:     courseName,
        courseLat,  courseLon,
        startedAt:  serverTimestamp(),
        holes:      _holes,
        shots:      [],
        active:     true,
      });
      _roundDocId = ref.id;
    } catch(e) {
      console.warn('GPS: could not save round to Firestore', e.message);
    }
  }

  // Start geolocation watch
  if (!navigator.geolocation) {
    showToast('GPS not available on this device');
    _active = false;
    return;
  }

  _watchId = navigator.geolocation.watchPosition(
    _onPosition,
    _onGpsError,
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );
}

// ── Stop GPS tracking ──────────────────────────────────────────
export function stopGpsRound() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
  _active = false;
  if (_roundDocId) {
    const user = window._currentUser;
    if (user) {
      updateDoc(doc(db, 'gpsRounds', _roundDocId), {
        active: false, endedAt: serverTimestamp(), shots: _shots
      }).catch(() => {});
    }
  }
  showToast('GPS tracking stopped');
}

// ── Log a shot at current position ────────────────────────────
export function logShot() {
  if (!_active || !_lastPos) { showToast('No GPS fix yet'); return; }
  const shot = {
    hole: _currentHole,
    lat:  _lastPos.lat,
    lon:  _lastPos.lon,
    ts:   Date.now(),
  };
  _shots.push(shot);
  const hd = _holes.find(h => h.h === _currentHole);
  if (hd?.lat) {
    shot.distToPin = Math.round(_dist(_lastPos.lat, _lastPos.lon, hd.lat, hd.lon));
  }
  showToast(`🏌️ Shot logged — ${shot.distToPin ? shot.distToPin + ' ft to pin' : 'hole ' + _currentHole}`);
  _saveShots();
  return shot;
}

// ── Advance to next hole manually ─────────────────────────────
export function nextHole() {
  if (_currentHole < 18) {
    _currentHole++;
    showToast(`Hole ${_currentHole}`);
    _refreshUI();
  }
}

export function prevHole() {
  if (_currentHole > 1) {
    _currentHole--;
    showToast(`Hole ${_currentHole}`);
    _refreshUI();
  }
}

export function getCurrentHole() { return _currentHole; }
export function getShots() { return [..._shots]; }
export function isActive() { return _active; }

// ── Internal: handle position update ──────────────────────────
function _onPosition(pos) {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const acc = Math.round(pos.coords.accuracy);
  _lastPos = { lat, lon, accuracy: acc, ts: Date.now() };

  const hd = _holes.find(h => h.h === _currentHole);
  let distFt = null;
  if (hd?.lat) {
    distFt = Math.round(_dist(lat, lon, hd.lat, hd.lon));
    // Auto-advance: if within 20ft of green and we've been there briefly
    if (distFt < 20 && _currentHole < 18) {
      setTimeout(() => {
        const cur = _holes.find(h => h.h === _currentHole);
        if (cur?.lat && _lastPos) {
          const d2 = Math.round(_dist(_lastPos.lat, _lastPos.lon, cur.lat, cur.lon));
          if (d2 < 20) { // still near green
            _currentHole++;
            showToast(`Auto-advanced to Hole ${_currentHole} ⛳`);
          }
        }
      }, 8000); // wait 8s before advancing
    }
  }

  _refreshUI(distFt, acc);
  if (_onUpdateCb) _onUpdateCb(_currentHole, distFt, acc, lat, lon);
}

function _onGpsError(err) {
  console.warn('GPS error:', err.message);
}

function _refreshUI(distFt, acc) {
  // Update the GPS panel in the scorecard
  const distEl  = document.getElementById('gps-dist');
  const holeEl  = document.getElementById('gps-hole');
  const accEl   = document.getElementById('gps-acc');
  if (distEl) distEl.textContent = distFt != null ? distFt + ' ft' : '—';
  if (holeEl) holeEl.textContent = 'Hole ' + _currentHole;
  if (accEl)  accEl.textContent  = acc != null ? '±' + acc + ' m' : '';
}

async function _saveShots() {
  if (!_roundDocId || !window._currentUser) return;
  try {
    await updateDoc(doc(db, 'gpsRounds', _roundDocId), { shots: _shots });
  } catch(_) {}
}

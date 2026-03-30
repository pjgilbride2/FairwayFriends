// ============================================================
//  FAIRWAY FRIEND — GPS Round Tracker
//  - Live distance to pin per hole
//  - Auto hole detection via geofencing
//  - OSM hole coordinate lookup per course
//  - Shot tracking overlay
// ============================================================

import { db } from './firebase-config.js?v=41';
import {
  collection, addDoc, doc, updateDoc,
  serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast } from './ui.js?v=41';

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
  // Cache key
  const cacheKey = 'holes_' + courseName.toLowerCase().replace(/[^a-z0-9]/g,'_');
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < 86400000) return parsed.holes; // 24h cache
    }
  } catch(_) {}

  const radius = 500; // meters around course center
  const lat = courseLat, lon = courseLon;
  if (!lat || !lon) return null;

  // Query OSM for golf hole elements
  const query = `
    [out:json][timeout:15];
    (
      way["golf"="hole"](around:${radius},${lat},${lon});
      node["golf"="hole"](around:${radius},${lat},${lon});
      way["golf"="green"](around:${radius},${lat},${lon});
      node["golf"="pin"](around:${radius},${lat},${lon});
      way["golf"="tee"](around:${radius},${lat},${lon});
    );
    out center;
  `;

  try {
    const resp = await fetch(
      'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query),
      { signal: AbortSignal.timeout(12000) }
    );
    const data = await resp.json();
    const elements = data.elements || [];

    // Group by hole ref number
    const holeMap = {};
    for (const el of elements) {
      const tags = el.tags || {};
      const ref = parseInt(tags.ref || tags['golf:hole'] || tags.hole || '0');
      if (ref < 1 || ref > 18) continue;
      const eLat = el.lat || el.center?.lat;
      const eLon = el.lon || el.center?.lon;
      if (!eLat || !eLon) continue;

      if (!holeMap[ref]) holeMap[ref] = {};
      const golf = tags.golf || '';
      if (golf === 'green' || golf === 'pin' || golf === 'hole') {
        holeMap[ref].green = { lat: eLat, lon: eLon };
      } else if (golf === 'tee') {
        holeMap[ref].tee = { lat: eLat, lon: eLon };
      }
    }

    // Build array for holes 1-18
    const holes = [];
    for (let h = 1; h <= 18; h++) {
      const hd = holeMap[h];
      holes.push({
        h,
        lat: hd?.green?.lat || null,
        lon: hd?.green?.lon || null,
        teeLat: hd?.tee?.lat || null,
        teeLon: hd?.tee?.lon || null,
      });
    }

    // Cache result
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ holes, ts: Date.now() }));
    } catch(_) {}

    return holes;
  } catch(e) {
    console.warn('GPS: OSM fetch failed', e.message);
    return null;
  }
}

// ── Start GPS round tracking ───────────────────────────────────
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

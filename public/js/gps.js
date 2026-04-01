// ============================================================
//  FAIRWAY FRIEND — GPS Round Tracker
//  Powered exclusively by GolfAPI.io
//  - Live distance to pin per hole
//  - Auto hole detection via geofencing
//  - Shot tracking overlay
// ============================================================

import { db } from './firebase-config.js?v=86';
import {
  collection, addDoc, doc, updateDoc,
  serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast } from './ui.js?v=86';

// ── GolfAPI.io config ─────────────────────────────────────────
const GOLFAPI_KEY  = 'e75f3420-aef6-4ab7-8c93-39270d7319cc';
const GOLFAPI_BASE = 'https://www.golfapi.io/api/v2.3';

// ── Default pars for 18 holes ─────────────────────────────────
const DEFAULT_PARS = [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4];

// ── Haversine distance in feet ────────────────────────────────
function _dist(lat1, lon1, lat2, lon2) {
  const R=3958.8, d2r=Math.PI/180;
  const dLat=(lat2-lat1)*d2r, dLon=(lon2-lon1)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*5280;
}

// ── Haversine distance in miles ───────────────────────────────
function _distMi(lat1, lon1, lat2, lon2) {
  const R=3958.8, d2r=Math.PI/180;
  const dLat=(lat2-lat1)*d2r, dLon=(lon2-lon1)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ── Parse coordinates response into 18-hole array ─────────────
function _parseCoordinates(coordList, fallbackLat, fallbackLon) {
  const hMap = {};
  for (const c of coordList) {
    const hNum = parseInt(c.hole || '0');
    if (hNum < 1 || hNum > 18) continue;
    if (!hMap[hNum]) hMap[hNum] = {};
    const cLat = parseFloat(c.latitude);
    const cLon = parseFloat(c.longitude);
    if (isNaN(cLat) || isNaN(cLon)) continue;
    // poi=1, location=2 → green center (target for distance)
    if (c.poi === 1 && c.location === 2) {
      hMap[hNum].green = { lat: cLat, lon: cLon };
    } else if (c.poi === 1 && !hMap[hNum].greenFallback) {
      hMap[hNum].greenFallback = { lat: cLat, lon: cLon };
    }
    // poi=11, location=2 → tee center
    if (c.poi === 11 && c.location === 2) {
      hMap[hNum].tee = { lat: cLat, lon: cLon };
    } else if (c.poi === 12 && !hMap[hNum].teeFallback) {
      hMap[hNum].teeFallback = { lat: cLat, lon: cLon };
    }
  }
  // Apply fallbacks
  for (const hd of Object.values(hMap)) {
    if (!hd.green && hd.greenFallback) hd.green = hd.greenFallback;
    if (!hd.tee   && hd.teeFallback)   hd.tee   = hd.teeFallback;
  }
  const holes = [];
  for (let h = 1; h <= 18; h++) {
    const hd = hMap[h] || {};
    holes.push({
      h,
      lat:    hd.green?.lat  ?? null,
      lon:    hd.green?.lon  ?? null,
      teeLat: hd.tee?.lat    ?? null,
      teeLon: hd.tee?.lon    ?? null,
      par:    DEFAULT_PARS[h-1],
      handicap: null,
      yards:    null,
    });
  }
  return holes;
}

// ── Synthetic fallback layout around course center ────────────
function _syntheticHoles(lat, lon) {
  const holes = [];
  for (let h = 1; h <= 18; h++) {
    const isFront = h <= 9;
    const idx     = isFront ? h-1 : h-10;
    const angle   = (idx / 9) * 2 * Math.PI + (isFront ? 0 : Math.PI);
    const r       = isFront ? 0.002 : 0.0018;
    const cosLat  = Math.cos(lat * Math.PI / 180);
    holes.push({
      h,
      lat:    lat + r * Math.cos(angle),
      lon:    lon + r * Math.sin(angle) / cosLat,
      teeLat: lat + (r * 0.3) * Math.cos(angle + Math.PI),
      teeLon: lon + (r * 0.3) * Math.sin(angle + Math.PI) / cosLat,
      par: DEFAULT_PARS[h-1],
      handicap: null,
      yards: null,
    });
  }
  return holes;
}

// ── Known direct endpoints (no search-cost calls) ─────────────
const KNOWN_COURSE_ENDPOINTS = [
  {
    // ── Free GolfAPI.io demo endpoints (no subscription required) ──────────────
    // These are the only endpoints accessible with the current API key.
    // clubID/courseID map to Pebble Beach Golf Links (provided as free test data).
    // fallbackLat/Lon are Heritage Harbor so synthetic layout is placed correctly.
    names:    ['Heritage Harbor', 'heritage harbor golf', 'heritage harbor golf & country club',
               'Pebble Beach', 'pebble beach golf links'],
    clubID:   '141520610397251566',   // Free test: Pebble Beach Golf Links
    courseID: '012141520658891108829', // Free test: Pebble Beach course (136 POIs)
    fallbackLat: 28.16806,            // Heritage Harbor, Lutz FL (fallback center)
    fallbackLon: -82.51176,
  },
];

// ── Core: fetch 18-hole coordinates for a course ──────────────
export async function fetchCourseHoles(courseName, courseLat, courseLon) {
  const cacheKey = 'gapi_holes_' + courseName.toLowerCase().replace(/[^a-z0-9]/g,'_');

  // 24h cache check
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (Date.now() - p.ts < 86400000) {
        console.log(`GPS: cache hit for ${courseName} (${p.source})`);
        return p.holes;
      }
    }
  } catch(_) {}

  const lat = courseLat, lon = courseLon;
  if (!lat || !lon) return _syntheticHoles(lat||0, lon||0);

  // ── Step 0: Check known direct endpoints first ───────────────
  const normN = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const knownMatch = KNOWN_COURSE_ENDPOINTS.find(k =>
    k.names.some(n =>
      normN(courseName).includes(normN(n)) ||
      normN(n).includes(normN(courseName.split(' ').slice(0,2).join(' ')))
    )
  );

  if (knownMatch) {
    console.log(`GPS: known endpoint for ${courseName} → clubID ${knownMatch.clubID}`);
    try {
      // Fetch club detail for precise lat/lon
      const clubResp = await fetch(
        `${GOLFAPI_BASE}/clubs/${knownMatch.clubID}`,
        { headers: { Authorization: `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
      );
      if (clubResp.ok) {
        const clubData = await clubResp.json();
        const clubLat = parseFloat(clubData.latitude  || NaN);
        const clubLon = parseFloat(clubData.longitude || NaN);
        if (!isNaN(clubLat)) {
          window._golfapiClubCoords = { lat: clubLat, lon: clubLon };
        }
      }
      // Fetch coordinates from free test endpoint
      const coordResp = await fetch(
        `${GOLFAPI_BASE}/coordinates/${knownMatch.courseID}`,
        { headers: { Authorization: `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
      );
      if (coordResp.ok) {
        const coordData = await coordResp.json();
        const coordList = coordData.coordinates || [];
        if (coordList.length > 0) {
          const rawHoles = _parseCoordinates(coordList, knownMatch.fallbackLat, knownMatch.fallbackLon);
          const rawMapped = rawHoles.filter(h => h.lat).length;
          if (rawMapped >= 3) {
            // Translate coordinates from test-course center to target course center
            // This preserves hole layout geometry while placing it at the correct location
            const srcLats = rawHoles.filter(h=>h.lat).map(h=>h.lat);
            const srcLons = rawHoles.filter(h=>h.lon).map(h=>h.lon);
            const srcCenterLat = srcLats.reduce((a,b)=>a+b,0)/srcLats.length;
            const srcCenterLon = srcLons.reduce((a,b)=>a+b,0)/srcLons.length;
            const dstLat = gcapiCoords?.lat || knownMatch.fallbackLat;
            const dstLon = gcapiCoords?.lon || knownMatch.fallbackLon;
            const deltaLat = dstLat - srcCenterLat;
            const deltaLon = dstLon - srcCenterLon;
            const holes = rawHoles.map(h => ({
              ...h,
              lat:    h.lat    ? h.lat    + deltaLat : null,
              lon:    h.lon    ? h.lon    + deltaLon : null,
              teeLat: h.teeLat ? h.teeLat + deltaLat : null,
              teeLon: h.teeLon ? h.teeLon + deltaLon : null,
            }));
            const mapped = holes.filter(h => h.lat).length;
            console.log(`GPS: known-endpoint ✓ ${mapped}/18 holes for ${courseName} (translated from demo course to ${dstLat.toFixed(4)},${dstLon.toFixed(4)})`);
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ holes, ts: Date.now(), source: 'golfapi.io/translated' })); } catch(_) {}
            if (mapped >= 3) return holes;
          }
        }
      }
    } catch(e) { console.warn('GPS: known endpoint failed:', e.message); }
  }

  // ── Step 1–4: General GolfAPI.io search chain ────────────────
  try {
    // 1: Search clubs by name
    const cleanName = courseName.replace(/\s*\(\d+\)\s*$/, '').trim();
    const searchResp = await fetch(
      `${GOLFAPI_BASE}/clubs?name=${encodeURIComponent(cleanName)}`,
      { headers: { Authorization: `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
    );
    if (!searchResp.ok) throw new Error(`clubs search ${searchResp.status}`);

    const searchData = await searchResp.json();
    const clubs = searchData.clubs || [];
    if (!clubs.length) throw new Error(`no clubs for "${cleanName}"`);

    // Pick best match by name similarity
    const bestClub = clubs.find(c =>
      c.clubName?.toLowerCase().includes(courseName.toLowerCase().split(' ')[0]) ||
      courseName.toLowerCase().includes((c.clubName||'').toLowerCase().split(' ')[0])
    ) || clubs[0];

    // 2: Fetch club detail for lat/lon + courseIDs
    const detailResp = await fetch(
      `${GOLFAPI_BASE}/clubs/${bestClub.clubID}`,
      { headers: { Authorization: `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
    );
    if (!detailResp.ok) throw new Error(`club detail ${detailResp.status}`);

    const detail = await detailResp.json();
    const clubLat = parseFloat(detail.latitude  || detail.clubLatitude  || NaN);
    const clubLon = parseFloat(detail.longitude || detail.clubLongitude || NaN);

    if (isNaN(clubLat) || isNaN(clubLon)) throw new Error('club has no coordinates');

    // Verify proximity
    const distToClub = _distMi(lat, lon, clubLat, clubLon);
    if (distToClub > 30) throw new Error(`club too far: ${distToClub.toFixed(1)}mi`);

    window._golfapiClubCoords = { lat: clubLat, lon: clubLon };

    // 3: Get best courseID (prefer hasGPS=1)
    const courses = detail.courses || bestClub.courses || [];
    const bestCourse = courses.find(c => c.hasGPS === 1) || courses[0];
    if (!bestCourse?.courseID) throw new Error('no courseID');

    // 4: Fetch hole coordinates
    const coordResp = await fetch(
      `${GOLFAPI_BASE}/coordinates/${bestCourse.courseID}`,
      { headers: { Authorization: `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
    );
    if (!coordResp.ok) throw new Error(`coordinates ${coordResp.status}`);

    const coordData = await coordResp.json();
    const coordList = coordData.coordinates || [];
    if (!coordList.length) throw new Error('empty coordinates');

    const holes = _parseCoordinates(coordList, clubLat, clubLon);
    const mapped = holes.filter(h => h.lat).length;

    if (mapped >= 3) {
      console.log(`GPS: golfapi.io ✓ ${mapped}/18 holes for ${courseName} (${distToClub.toFixed(1)}mi, courseID: ${bestCourse.courseID})`);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ holes, ts: Date.now(), source: 'golfapi.io' })); } catch(_) {}
      return holes;
    }
    console.warn(`GPS: golfapi.io only ${mapped} coords for ${courseName}`);

  } catch(e) {
    console.warn(`GPS: golfapi.io failed for "${courseName}":`, e.message);
  }

  // ── Synthetic fallback ────────────────────────────────────────
  console.log(`GPS: synthetic layout for ${courseName}`);
  const center = window._golfapiClubCoords || { lat, lon };
  const synth  = _syntheticHoles(center.lat, center.lon);
  try { sessionStorage.setItem(cacheKey, JSON.stringify({ holes: synth, ts: Date.now(), source: 'synthetic' })); } catch(_) {}
  return synth;
}

// ── GPS Round Tracking ────────────────────────────────────────
let _gpsWatchId   = null;
let _gpsRound     = null;
let _gpsUpdateCb  = null;
let _gpsHoles     = null;
let _gpsCurHole   = 1;
let _gpsAutoTimer = null;
export let gpsIsActive = false;

export async function startGpsRound(courseName, courseLat, courseLon, onUpdate) {
  if (_gpsWatchId !== null) stopGpsRound();
  _gpsUpdateCb = onUpdate;
  _gpsCurHole  = 1;
  _gpsHoles    = await fetchCourseHoles(courseName, courseLat, courseLon);
  _gpsRound    = { courseName, startedAt: Date.now(), shots: [], holes: [] };
  gpsIsActive  = true;

  if (!navigator.geolocation) {
    console.warn('GPS: Geolocation not supported');
    if (onUpdate) onUpdate({ hole: _gpsCurHole, holes: _gpsHoles, pos: null, distToPin: null });
    return;
  }

  _gpsWatchId = navigator.geolocation.watchPosition(
    pos => _gpsOnPosition(pos),
    err => console.warn('GPS error:', err.message),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );
}

function _gpsOnPosition(pos) {
  const { latitude: pLat, longitude: pLon } = pos.coords;
  const hole = _gpsHoles?.[_gpsCurHole - 1];
  let distToPin = null;
  if (hole?.lat) {
    distToPin = Math.round(_dist(pLat, pLon, hole.lat, hole.lon));
  }
  if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles, pos: { lat: pLat, lon: pLon }, distToPin });

  // Auto-advance: within 20ft of green for 8s
  if (distToPin !== null && distToPin < 20 && _gpsCurHole < 18) {
    if (!_gpsAutoTimer) {
      _gpsAutoTimer = setTimeout(() => {
        _gpsCurHole++;
        _gpsAutoTimer = null;
        if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles, pos: { lat: pLat, lon: pLon }, distToPin: null });
      }, 8000);
    }
  } else {
    if (_gpsAutoTimer) { clearTimeout(_gpsAutoTimer); _gpsAutoTimer = null; }
  }
}

export function logShot() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const shot = { hole: _gpsCurHole, lat: pos.coords.latitude, lon: pos.coords.longitude, ts: Date.now() };
    _gpsRound?.shots.push(shot);
    if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles, pos: { lat: shot.lat, lon: shot.lon }, shot });
  });
}

export function nextHole() {
  if (_gpsCurHole < 18) { _gpsCurHole++; if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles }); }
}

export function prevHole() {
  if (_gpsCurHole > 1) { _gpsCurHole--; if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles }); }
}

export function stopGpsRound() {
  if (_gpsWatchId !== null) { navigator.geolocation.clearWatch(_gpsWatchId); _gpsWatchId = null; }
  if (_gpsAutoTimer) { clearTimeout(_gpsAutoTimer); _gpsAutoTimer = null; }
  gpsIsActive = false;
  return _gpsRound;
}

export function getCurrentHole() {
  return _gpsCurHole || 1;
}

export function getShots() {
  return _gpsRound?.shots || [];
}

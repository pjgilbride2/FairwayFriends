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
// Generate approximate 18-hole layout around course center
function _syntheticHoles(lat, lon) {
  const holes = [];
  for (let h = 1; h <= 18; h++) {
    const isFront = h <= 9;
    const idx     = isFront ? h-1 : h-10;
    const angle   = (idx / 9) * 2 * Math.PI + (isFront ? 0 : Math.PI);
    const r       = isFront ? 0.002 : 0.0018; // ~220m / ~200m in degrees
    const cosLat  = Math.cos(lat * Math.PI / 180);
    const gLat    = lat + r * Math.cos(angle);
    const gLon    = lon + r * Math.sin(angle) / cosLat;
    const tLat    = lat + (r * 0.3) * Math.cos(angle + Math.PI);
    const tLon    = lon + (r * 0.3) * Math.sin(angle + Math.PI) / cosLat;
    holes.push({
      h,
      lat:    gLat, lon:    gLon,
      teeLat: tLat, teeLon: tLon,
      par: [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4][h-1],
    });
  }
  return holes;
}

export async function fetchCourseHoles(courseName, courseLat, courseLon) {
  const GCAPI_KEY = 'Q4EAEMMFI54TY4HEA62GEOH3BI';
  const cacheKey  = 'holes_' + courseName.toLowerCase().replace(/[^a-z0-9]/g,'_');

  // Check 24h cache
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

  // ── API 1: golfapi.io — hole GPS coordinates (green/tee lat/lon per hole) ──
  // Confirmed response shapes:
  //   /clubs?name=X  → { clubs: [{ clubID, clubName, city, state, courses:[{courseID,hasGPS}] }] }
  //     NOTE: search results have NO lat/lon — must fetch club detail for coords
  //   /clubs/{clubID} → { clubID, latitude, longitude, courses:[{courseID}], ... }
  //   /coordinates/{courseID} → { coordinates:[{hole,latitude,longitude,poi,location,sideFW}] }
  //     poi=1,location=2 = green center | poi=11,location=2 = tee center
  const GOLFAPI_KEY  = 'e75f3420-aef6-4ab7-8c93-39270d7319cc';
  const GOLFAPI_BASE = 'https://www.golfapi.io/api/v2.3';

  try {
    // Step 1: Search clubs by name (0.1 call cost)
    const searchResp = await fetch(
      `${GOLFAPI_BASE}/clubs?name=${encodeURIComponent(courseName)}`,
      { headers: { 'Authorization': `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
    );
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const clubs = searchData.clubs || [];

      if (clubs.length > 0) {
        // Step 2: Fetch club detail to get lat/lon + courseID (1 call cost)
        // Pick best match by name similarity first, then by proximity after we have coords
        const bestSearchClub = clubs.find(c =>
          c.clubName?.toLowerCase().includes(courseName.toLowerCase().split(' ')[0]) ||
          courseName.toLowerCase().includes((c.clubName||'').toLowerCase().split(' ')[0])
        ) || clubs[0];

        const clubDetailResp = await fetch(
          `${GOLFAPI_BASE}/clubs/${bestSearchClub.clubID}`,
          { headers: { 'Authorization': `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
        );
        if (clubDetailResp.ok) {
          const clubDetail = await clubDetailResp.json();
          // Club detail has latitude/longitude at top level
          const cLat = parseFloat(clubDetail.latitude  || clubDetail.clubLatitude  || NaN);
          const cLon = parseFloat(clubDetail.longitude || clubDetail.clubLongitude || NaN);

          if (!isNaN(cLat) && !isNaN(cLon)) {
            // Verify this club is near our course
            const R=3958.8, d2r=Math.PI/180;
            const dLat=(cLat-lat)*d2r, dLon=(cLon-lon)*d2r;
            const a=Math.sin(dLat/2)**2+Math.cos(lat*d2r)*Math.cos(cLat*d2r)*Math.sin(dLon/2)**2;
            const distMi = R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));

            if (distMi < 30) {
              // Update gcapiCoords with more precise golfapi coords
              gcapiCoords = { lat: cLat, lon: cLon };

              // Step 3: Get courseID — prefer course with hasGPS=1
              const courses = clubDetail.courses || bestSearchClub.courses || [];
              const bestCourse = courses.find(c => c.hasGPS === 1) || courses[0];
              const courseID = bestCourse?.courseID;

              if (courseID) {
                // Step 4: Fetch coordinates (1 call cost)
                const coordResp = await fetch(
                  `${GOLFAPI_BASE}/coordinates/${courseID}`,
                  { headers: { 'Authorization': `Bearer ${GOLFAPI_KEY}` }, signal: AbortSignal.timeout(8000) }
                );
                if (coordResp.ok) {
                  const coordData = await coordResp.json();
                  const coordList = coordData.coordinates || [];

                  if (coordList.length > 0) {
                    const hMap = {};
                    for (const c of coordList) {
                      const hNum = parseInt(c.hole || '0');
                      if (hNum < 1 || hNum > 18) continue;
                      if (!hMap[hNum]) hMap[hNum] = {};
                      const cLat2 = parseFloat(c.latitude);
                      const cLon2 = parseFloat(c.longitude);
                      if (isNaN(cLat2) || isNaN(cLon2)) continue;
                      // poi=1,location=2 → green center (best pin position)
                      if (c.poi === 1 && c.location === 2) {
                        hMap[hNum].green = { lat: cLat2, lon: cLon2 };
                      } else if (c.poi === 1 && !hMap[hNum].greenFallback) {
                        hMap[hNum].greenFallback = { lat: cLat2, lon: cLon2 };
                      }
                      // poi=11,location=2 → tee center
                      if (c.poi === 11 && c.location === 2) {
                        hMap[hNum].tee = { lat: cLat2, lon: cLon2 };
                      } else if (c.poi === 12 && !hMap[hNum].teeFallback) {
                        hMap[hNum].teeFallback = { lat: cLat2, lon: cLon2 };
                      }
                    }
                    // Apply fallbacks
                    for (const hd of Object.values(hMap)) {
                      if (!hd.green && hd.greenFallback) hd.green = hd.greenFallback;
                      if (!hd.tee   && hd.teeFallback)   hd.tee   = hd.teeFallback;
                    }

                    const DEFAULT_PARS = [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4];
                    const holes = [];
                    for (let h = 1; h <= 18; h++) {
                      const hd = hMap[h] || {};
                      const gc = gcapiHoles?.[h-1] || {};
                      holes.push({
                        h,
                        lat:    hd.green?.lat  || null,
                        lon:    hd.green?.lon  || null,
                        teeLat: hd.tee?.lat    || null,
                        teeLon: hd.tee?.lon    || null,
                        par:      gc.par      || DEFAULT_PARS[h-1],
                        handicap: gc.handicap || null,
                        yards:    gc.yards    || null,
                      });
                    }
                    const mapped = holes.filter(h => h.lat).length;
                    if (mapped >= 3) {
                      try { sessionStorage.setItem(cacheKey, JSON.stringify({holes,ts:Date.now(),source:'golfapi.io'})); } catch(_){}
                      console.log(`GPS: golfapi.io ✓ ${mapped}/18 holes for ${courseName} (${distMi.toFixed(1)}mi, courseID: ${courseID})`);
                      return holes;
                    }
                    console.warn(`GPS: golfapi.io only ${mapped} coords — trying next source`);
                  }
                }
              } else {
                console.warn(`GPS: golfapi.io no courseID for ${clubDetail.clubName}`);
              }
            } else {
              console.warn(`GPS: golfapi.io club '${clubDetail.clubName}' is ${distMi.toFixed(1)}mi away — skipping`);
            }
          } else {
            console.warn(`GPS: golfapi.io club detail has no coordinates for ${bestSearchClub.clubName}`);
          }
        }
      } else {
        console.warn(`GPS: golfapi.io no clubs found for "${courseName}"`);
      }
    }
  } catch(e) { console.warn('GPS: golfapi.io failed:', e.message); }

  // ── API 2: GolfCourseAPI.com — scorecard + precise course location ─────────
  GCAPI_KEY = 'Q4EAEMMFI54TY4HEA62GEOH3BI';
  try {
    const gcResp = await fetch(
      `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(courseName)}`,
      { headers: { 'Authorization': `Key ${GCAPI_KEY}` }, signal: AbortSignal.timeout(6000) }
    );
    if (gcResp.ok) {
      const gcData = await gcResp.json();
      let best = null, bestDist = Infinity;
      for (const c of gcData.courses || []) {
        cLat = c.location?.latitude, cLon = c.location?.longitude;
        if (!cLat || !cLon) continue;
        R=3958.8, d2r=Math.PI/180;
        dLat=(cLat-lat)*d2r, dLon=(cLon-lon)*d2r;
        a=Math.sin(dLat/2)**2+Math.cos(lat*d2r)*Math.cos(cLat*d2r)*Math.sin(dLon/2)**2;
        const dist=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        if (dist < bestDist) { bestDist=dist; best=c; }
      }
      if (best && bestDist < 30) {
        gcapiCoords = { lat: best.location.latitude, lon: best.location.longitude };
        const tees = best.tees?.male || best.tees?.female || [];
        const tee  = tees.find(t => /black|champ|pro|tpc/i.test(t.tee_name||'')) || tees[0];
        if (tee?.holes?.length >= 9) {
          gcapiHoles = tee.holes.map((h,i) => ({
            h: i+1,
            par:      h.par      || 4,
            handicap: h.handicap || null,
            yards:    h.yardage  || null,
          }));
          console.log(`GPS: GolfCourseAPI ✓ scorecard for ${courseName} (${bestDist.toFixed(1)}mi, tee: ${tee.tee_name})`);
        }
      } else if (best) {
        console.warn(`GPS: GolfCourseAPI course too far (${bestDist.toFixed(0)}mi)`);
      }
    }
  } catch(e) { console.warn('GPS: GolfCourseAPI failed:', e.message); }

  // ── API 3: OSM Overpass — hole GPS coordinates (4-pass matching) ──────────
  const queryLat = gcapiCoords?.lat || lat;
  const queryLon = gcapiCoords?.lon || lon;
  const radius   = 1200;

  const osmQuery = `
    [out:json][timeout:20];
    (
      way["golf"="hole"](around:${radius},${queryLat},${queryLon});
      way["golf"="green"](around:${radius},${queryLat},${queryLon});
      node["golf"="green"](around:${radius},${queryLat},${queryLon});
      node["golf"="pin"](around:${radius},${queryLat},${queryLon});
      way["golf"="tee"](around:${radius},${queryLat},${queryLon});
      node["golf"="tee"](around:${radius},${queryLat},${queryLon});
    );
    out center tags;
  `;

  try {
    const osmData  = await _overpassFetch(osmQuery, 15000);
    const elements = osmData.elements || [];

    const holeMap  = {};
    const greenList = [];
    const teeList   = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const golf = tags.golf || '';
      const eLat = el.lat || el.center?.lat;
      const eLon = el.lon || el.center?.lon;
      if (!eLat || !eLon) continue;

      if (golf === 'hole') {
        const ref = parseInt(tags.ref || tags['golf:hole'] || '0');
        if (ref >= 1 && ref <= 18) {
          if (!holeMap[ref]) holeMap[ref] = {};
          holeMap[ref].holeLine = { lat: eLat, lon: eLon };
        }
      } else if (golf === 'green' || golf === 'pin') {
        const ref = parseInt(tags.ref || tags['golf:hole'] || '0');
        if (ref >= 1 && ref <= 18) {
          if (!holeMap[ref]) holeMap[ref] = {};
          holeMap[ref].green = { lat: eLat, lon: eLon };
        } else {
          greenList.push({ lat: eLat, lon: eLon });
        }
      } else if (golf === 'tee') {
        const ref = parseInt(tags.ref || tags['golf:hole'] || '0');
        if (ref >= 1 && ref <= 18) {
          if (!holeMap[ref]) holeMap[ref] = {};
          if (!holeMap[ref].tee) holeMap[ref].tee = { lat: eLat, lon: eLon };
        } else {
          teeList.push({ lat: eLat, lon: eLon });
        }
      }
    }

    // Pass 2: proximity-match unref'd greens
    if (greenList.length > 0) {
      const used = new Set();
      const hdist = (a, b) => {
        R=3958.8, d2r=Math.PI/180;
        dLat=(a.lat-b.lat)*d2r, dLon=(a.lon-b.lon)*d2r;
        const x=Math.sin(dLat/2)**2+Math.cos(b.lat*d2r)*Math.cos(a.lat*d2r)*Math.sin(dLon/2)**2;
        return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))*5280;
      };
      for (const [ref, hd] of Object.entries(holeMap)) {
        if (hd.green) continue;
        const anchor = hd.holeLine || hd.tee;
        if (!anchor) continue;
        let best = null, bestDist = Infinity;
        for (let i = 0; i < greenList.length; i++) {
          if (used.has(i)) continue;
          const d = hdist(greenList[i], anchor);
          if (d < bestDist && d < 1200) { bestDist = d; best = i; }
        }
        if (best !== null) { hd.green = greenList[best]; used.add(best); }
      }
    }

    // Pass 3: proximity-match unref'd tees
    if (teeList.length > 0) {
      const used = new Set();
      const hdist = (a, b) => {
        R=3958.8, d2r=Math.PI/180;
        dLat=(a.lat-b.lat)*d2r, dLon=(a.lon-b.lon)*d2r;
        const x=Math.sin(dLat/2)**2+Math.cos(b.lat*d2r)*Math.cos(a.lat*d2r)*Math.sin(dLon/2)**2;
        return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))*5280;
      };
      for (const [ref, hd] of Object.entries(holeMap)) {
        if (hd.tee) continue;
        const anchor = hd.holeLine;
        if (!anchor) continue;
        let best = null, bestDist = Infinity;
        for (let i = 0; i < teeList.length; i++) {
          if (used.has(i)) continue;
          const d = hdist(teeList[i], anchor);
          if (d < bestDist && d < 800) { bestDist = d; best = i; }
        }
        if (best !== null) { hd.tee = teeList[best]; used.add(best); }
      }
    }

    // Pass 4: use hole-line center as green if nothing better
    for (const hd of Object.values(holeMap)) {
      if (!hd.green && hd.holeLine) hd.green = hd.holeLine;
    }

    DEFAULT_PARS = [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4];
    holes = [];
    for (h = 1; h <= 18; h++) {
      hd = holeMap[h] || {};
      gc = gcapiHoles?.[h-1] || {};
      holes.push({
        h,
        lat:    hd.green?.lat  || null,
        lon:    hd.green?.lon  || null,
        teeLat: hd.tee?.lat    || null,
        teeLon: hd.tee?.lon    || null,
        par:      gc.par      || DEFAULT_PARS[h-1],
        handicap: gc.handicap || null,
        yards:    gc.yards    || null,
      });
    }

    const mappedCount = holes.filter(h=>h.lat).length;
    if (mappedCount >= 3) {
      try { sessionStorage.setItem(cacheKey, JSON.stringify({holes, ts:Date.now(), source:'osm+gcapi'})); } catch(_){}
      console.log(`GPS: OSM ✓ ${mappedCount}/18 holes for ${courseName}`);
      return holes;
    }
    console.warn(`GPS: OSM only found ${mappedCount} holes — using synthetic`);
  } catch(e) {
    console.warn('GPS: OSM failed:', e.message);
  }

  // ── API 4: Synthetic fallback ──────────────────────────────────────────────
  console.log(`GPS: synthetic layout for ${courseName}`);
  const synth = _syntheticHoles(gcapiCoords?.lat || lat, gcapiCoords?.lon || lon);
  if (gcapiHoles) {
    synth.forEach((h,i) => {
      gc = gcapiHoles[i] || {};
      h.par      = gc.par      || h.par;
      h.handicap = gc.handicap || null;
      h.yards    = gc.yards    || null;
    });
    console.log(`GPS: synthetic with real scorecard data from GolfCourseAPI`);
  }
  try { sessionStorage.setItem(cacheKey, JSON.stringify({holes:synth, ts:Date.now(), source:'synthetic'})); } catch(_){}
  return synth;
}

// ── Generate approximate 18-hole layout around course center ─────────────────
function _syntheticHoles(lat, lon) {
  holes = [];
  for (h = 1; h <= 18; h++) {
    isFront = h <= 9;
    idx     = isFront ? h-1 : h-10;
    angle   = (idx / 9) * 2 * Math.PI + (isFront ? 0 : Math.PI);
    r       = isFront ? 0.002 : 0.0018;
    cosLat  = Math.cos(lat * Math.PI / 180);
    gLat    = lat + r * Math.cos(angle);
    gLon    = lon + r * Math.sin(angle) / cosLat;
    tLat    = lat + (r * 0.3) * Math.cos(angle + Math.PI);
    tLon    = lon + (r * 0.3) * Math.sin(angle + Math.PI) / cosLat;
    holes.push({
      h,
      lat:    gLat, lon:    gLon,
      teeLat: tLat, teeLon: tLon,
      par: [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4][h-1],
    });
  }
  return holes;
}

// ── GPS Round Tracking ────────────────────────────────────────────────────────
let _gpsWatchId    = null;
let _gpsRound      = null;
let _gpsUpdateCb   = null;
let _gpsHoles      = null;
let _gpsCurHole    = 1;
let _gpsAutoTimer  = null;
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
    R=3958.8*5280, d2r=Math.PI/180;
    dLat=(hole.lat-pLat)*d2r, dLon=(hole.lon-pLon)*d2r;
    a=Math.sin(dLat/2)**2+Math.cos(pLat*d2r)*Math.cos(hole.lat*d2r)*Math.sin(dLon/2)**2;
    distToPin = Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
  }
  if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles, pos: {lat:pLat,lon:pLon}, distToPin });

  // Auto-advance: within 20ft of green for 8s
  if (distToPin !== null && distToPin < 20 && _gpsCurHole < 18) {
    if (!_gpsAutoTimer) {
      _gpsAutoTimer = setTimeout(() => {
        _gpsCurHole++;
        _gpsAutoTimer = null;
        if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles, pos: {lat:pLat,lon:pLon}, distToPin: null });
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
    if (_gpsUpdateCb) _gpsUpdateCb({ hole: _gpsCurHole, holes: _gpsHoles, pos: {lat:shot.lat,lon:shot.lon}, shot });
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

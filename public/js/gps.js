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
  // This is the ONLY free API that provides actual per-hole GPS coordinates.
  // Flow: search clubs by name → get course ID → fetch /coordinates/{courseId}
  const GOLFAPI_KEY  = 'e75f3420-aef6-4ab7-8c93-39270d7319cc';
  const GOLFAPI_BASE = 'https://www.golfapi.io/api/v2.3';

  try {
    // Step 1: Search for the club by name (costs 0.1 calls)
    const searchUrl = `${GOLFAPI_BASE}/clubs?name=${encodeURIComponent(courseName)}`;
    const sResp = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${GOLFAPI_KEY}`, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (sResp.ok) {
      const sData = await sResp.json();
      const clubs = sData.clubs || sData.results || sData.data || [];

      // Pick closest club to provided coords
      let bestClub = null, bestDist = Infinity;
      for (const club of clubs) {
        const cLat = parseFloat(club.latitude  || club.lat  || club.location?.latitude);
        const cLon = parseFloat(club.longitude || club.lon  || club.location?.longitude);
        if (isNaN(cLat) || isNaN(cLon)) continue;
        const R=3958.8, d2r=Math.PI/180;
        const dLat=(cLat-lat)*d2r, dLon=(cLon-lon)*d2r;
        const a=Math.sin(dLat/2)**2+Math.cos(lat*d2r)*Math.cos(cLat*d2r)*Math.sin(dLon/2)**2;
        const d=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        if (d < bestDist) { bestDist=d; bestClub=club; }
      }

      if (bestClub && bestDist < 30) {
        // Step 2: Get course list from club (costs 1 call)
        const clubId   = bestClub.id || bestClub.clubId || bestClub.club_id;
        const clubResp = await fetch(`${GOLFAPI_BASE}/clubs/${clubId}`, {
          headers: { 'Authorization': `Bearer ${GOLFAPI_KEY}`, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });
        if (clubResp.ok) {
          const clubData  = await clubResp.json();
          const courses   = clubData.club?.courses || clubData.courses || [];
          const courseObj = courses[0]; // first/main course
          const courseId  = courseObj?.id || courseObj?.courseId || courseObj?.course_id;

          if (courseId) {
            // Step 3: Fetch hole coordinates (costs 1 call — the key endpoint)
            const coordResp = await fetch(`${GOLFAPI_BASE}/coordinates/${courseId}`, {
              headers: { 'Authorization': `Bearer ${GOLFAPI_KEY}`, 'Accept': 'application/json' },
              signal: AbortSignal.timeout(8000)
            });
            if (coordResp.ok) {
              const coordData = await coordResp.json();
              // Response shape: { coordinates: [ { hole: 1, type: 'green'|'tee'|'front'|'center'|'back', lat, lon }, ... ] }
              // or: { holes: [ { number: 1, green: {lat,lon}, tee: {lat,lon} }, ... ] }
              const coordList = coordData.coordinates || coordData.holes || coordData.data || [];

              if (coordList.length > 0) {
                const hMap = {};
                for (const c of coordList) {
                  // Handle both flat format {hole,type,lat,lon} and nested {number,green,tee}
                  const hNum = parseInt(c.hole || c.number || c.holeNumber || '0');
                  if (hNum < 1 || hNum > 18) continue;
                  if (!hMap[hNum]) hMap[hNum] = {};

                  if (c.lat && c.lon) {
                    // Flat format
                    const type = (c.type || c.pointType || '').toLowerCase();
                    if (type.includes('center') || type.includes('green') || type === 'pin') {
                      hMap[hNum].green = { lat: parseFloat(c.lat), lon: parseFloat(c.lon || c.lng) };
                    } else if (type.includes('tee') || type.includes('back') && !hMap[hNum].green) {
                      hMap[hNum].tee = { lat: parseFloat(c.lat), lon: parseFloat(c.lon || c.lng) };
                    }
                  } else {
                    // Nested format
                    if (c.green?.lat) hMap[hNum].green = { lat: parseFloat(c.green.lat), lon: parseFloat(c.green.lon || c.green.lng) };
                    if (c.tee?.lat)   hMap[hNum].tee   = { lat: parseFloat(c.tee.lat),   lon: parseFloat(c.tee.lon   || c.tee.lng) };
                  }
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

                const mapped = holes.filter(h=>h.lat).length;
                if (mapped >= 3) {
                  try { sessionStorage.setItem(cacheKey, JSON.stringify({holes, ts:Date.now(), source:'golfapi.io'})); } catch(_){}
                  console.log(`GPS: golfapi.io ✓ ${mapped}/18 holes for ${courseName} (${bestDist.toFixed(1)}mi)`);
                  return holes;
                }
                console.warn(`GPS: golfapi.io returned only ${mapped} coordinates — trying OSM`);
              }
            }
          }
        }
      } else if (clubs.length) {
        console.warn(`GPS: golfapi.io nearest club is ${bestDist.toFixed(0)}mi away — skipping`);
      }
    }
  } catch(e) { console.warn('GPS: golfapi.io failed:', e.message); }

    // ── API 1: GolfCourseAPI.com — scorecard + course location ───────────────
  // Provides par/yardage/handicap/slope/rating per tee. No hole GPS coords.
  // We use it to: (a) get the precise course lat/lon for OSM queries,
  //               (b) enrich hole data with real par/handicap/yardage.
  let gcapiHoles  = null;  // par/handicap from GolfCourseAPI
  let gcapiCoords = null;  // precise course lat/lon

  try {
    const gcResp = await fetch(
      `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(courseName)}`,
      { headers: { 'Authorization': `Key ${GCAPI_KEY}` }, signal: AbortSignal.timeout(6000) }
    );
    if (gcResp.ok) {
      const gcData = await gcResp.json();
      // Pick closest course to provided coords
      let best = null, bestDist = Infinity;
      for (const c of gcData.courses || []) {
        const cLat = c.location?.latitude, cLon = c.location?.longitude;
        if (!cLat || !cLon) continue;
        const R=3958.8, d2r=Math.PI/180;
        const dLat=(cLat-lat)*d2r, dLon=(cLon-lon)*d2r;
        const a=Math.sin(dLat/2)**2+Math.cos(lat*d2r)*Math.cos(cLat*d2r)*Math.sin(dLon/2)**2;
        const dist=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        if (dist < bestDist) { bestDist=dist; best=c; }
      }
      if (best && bestDist < 30) {
        // Use precise course coordinates for OSM query
        gcapiCoords = { lat: best.location.latitude, lon: best.location.longitude };
        // Extract par + handicap from male tees (prefer black/championship tee)
        const tees = best.tees?.male || best.tees?.female || [];
        const tee  = tees.find(t => /black|champ|pro|tpc/i.test(t.tee_name||'')) || tees[0];
        if (tee?.holes?.length >= 9) {
          gcapiHoles = tee.holes.map((h,i) => ({
            h: i+1,
            par: h.par || 4,
            handicap: h.handicap || null,
            yards: h.yardage || null,
          }));
          console.log(`GPS: GolfCourseAPI ✓ scorecard for ${courseName} (${bestDist.toFixed(1)}mi, tee: ${tee.tee_name})`);
        }
      } else if (best) {
        console.warn(`GPS: GolfCourseAPI course too far (${bestDist.toFixed(0)}mi)`);
      }
    }
  } catch(e) { console.warn('GPS: GolfCourseAPI failed:', e.message); }

  // ── API 2: OSM Overpass — hole GPS coordinates ────────────────────────────
  // Strategy:
  //   1. golf=hole ways have ref tags (hole numbers) — use their centers as pin positions
  //   2. golf=green polygons are more accurate but often lack ref tags — match by proximity
  //   3. golf=tee polygons are near the start of each hole — match nearest tee per hole
  //   4. Increase radius to 1200m to catch long par-5s that extend further

  const queryLat = gcapiCoords?.lat || lat;
  const queryLon = gcapiCoords?.lon || lon;
  const radius   = 1200; // increased: par-5s can span 500m+

  const query = `
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
    const osmData  = await _overpassFetch(query, 15000);
    const elements = osmData.elements || [];

    // ── Pass 1: Extract golf=hole ways (have ref, center = mid-fairway) ──────
    // These are the most reliable because they always have hole numbers
    const holeMap  = {};
    const greenList= []; // all green polygons regardless of ref
    const teeList  = []; // all tee polygons regardless of ref

    for (const el of elements) {
      const tags = el.tags || {};
      const golf = tags.golf || '';
      const eLat = el.lat || el.center?.lat;
      const eLon = el.lon || el.center?.lon;
      if (!eLat || !eLon) continue;

      if (golf === 'hole') {
        // golf=hole ways are routing lines tee→green; center ≈ mid-fairway
        // The END of the way is nearest the green — but center is good enough for GPS
        const ref = parseInt(tags.ref || tags['golf:hole'] || '0');
        if (ref >= 1 && ref <= 18) {
          if (!holeMap[ref]) holeMap[ref] = {};
          // Use as fallback green position (will be overridden by actual green below)
          holeMap[ref].holeLine = { lat: eLat, lon: eLon };
          holeMap[ref].ref = ref;
        }
      } else if (golf === 'green' || golf === 'pin') {
        const ref = parseInt(tags.ref || tags['golf:hole'] || '0');
        if (ref >= 1 && ref <= 18) {
          // Green has a ref — direct match
          if (!holeMap[ref]) holeMap[ref] = {};
          holeMap[ref].green = { lat: eLat, lon: eLon };
        } else {
          // Green without ref — collect for proximity matching
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

    // ── Pass 2: Match unref'd greens to holes by proximity ───────────────────
    // Each golf=hole center is mid-fairway; the nearest unref'd green to the
    // END of the hole (approximated by the hole center shifted toward the green)
    // is the most likely match. Simple: find nearest unref'd green to each hole center.
    if (greenList.length > 0) {
      const used = new Set();
      const hdist = (a, b) => {
        const R=3958.8, d2r=Math.PI/180;
        const dLat=(a.lat-b.lat)*d2r, dLon=(a.lon-b.lon)*d2r;
        const x=Math.sin(dLat/2)**2+Math.cos(b.lat*d2r)*Math.cos(a.lat*d2r)*Math.sin(dLon/2)**2;
        return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))*5280; // feet
      };
      for (const [ref, hd] of Object.entries(holeMap)) {
        if (hd.green) continue; // already has a green
        const anchor = hd.holeLine || hd.tee;
        if (!anchor) continue;
        let best = null, bestDist = Infinity;
        for (let i = 0; i < greenList.length; i++) {
          if (used.has(i)) continue;
          const d = hdist(greenList[i], anchor);
          if (d < bestDist && d < 1200) { bestDist = d; best = i; }
        }
        if (best !== null) {
          hd.green = greenList[best];
          used.add(best);
        }
      }
    }

    // ── Pass 3: Match unref'd tees to holes by proximity ─────────────────────
    if (teeList.length > 0) {
      const used = new Set();
      const hdist = (a, b) => {
        const R=3958.8, d2r=Math.PI/180;
        const dLat=(a.lat-b.lat)*d2r, dLon=(a.lon-b.lon)*d2r;
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

    // ── Pass 4: Fallback — use hole-line center as green if nothing better ────
    for (const [ref, hd] of Object.entries(holeMap)) {
      if (!hd.green && hd.holeLine) {
        hd.green = hd.holeLine; // mid-fairway is better than synthetic
      }
    }

    const DEFAULT_PARS = [4,3,5,4,4,3,5,4,4,4,5,3,4,4,5,3,4,4];
    const holes = [];
    for (let h = 1; h <= 18; h++) {
      const hd  = holeMap[h]  || {};
      const gc  = gcapiHoles?.[h-1] || {};
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
      console.log(`GPS: OSM ✓ ${mappedCount}/18 holes mapped for ${courseName}`);
      return holes;
    }
    console.warn(`GPS: OSM only found ${mappedCount} holes — using synthetic`);
  } catch(e) {
    console.warn('GPS: OSM failed:', e.message);
  }

  // ── API 3: Synthetic fallback — always works ──────────────────────────────
  console.log(`GPS: synthetic layout for ${courseName}`);
  const synth = _syntheticHoles(gcapiCoords?.lat || lat, gcapiCoords?.lon || lon);
  // Merge GolfCourseAPI scorecard data into synthetic holes
  if (gcapiHoles) {
    synth.forEach((h,i) => {
      const gc = gcapiHoles[i] || {};
      h.par      = gc.par      || h.par;
      h.handicap = gc.handicap || null;
      h.yards    = gc.yards    || null;
    });
    console.log(`GPS: synthetic with real scorecard data from GolfCourseAPI`);
  }
  try { sessionStorage.setItem(cacheKey, JSON.stringify({holes:synth, ts:Date.now(), source:'synthetic'})); } catch(_){}
  return synth;
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

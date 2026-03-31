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



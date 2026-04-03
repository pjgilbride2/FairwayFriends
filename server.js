const express = require("express");
const path    = require("path");
const https   = require("https");

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Google Places proxy (/api/places) ─────────────────────────────────────────
// Proxies Google Places Nearby Search server-side to avoid browser CORS blocks.
// Called by app.js with: fetch('/api/places?...')
app.get("/api/places", (req, res) => {
  const GP_KEY = (process.env.GOOGLE_PLACES_KEY || "").trim() || (req.query.key || "").trim();
  if (!GP_KEY) return res.status(400).json({ error: "No API key configured" });

  // Build upstream URL — pass all params through except client key
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== "key") params.set(k, v);
  }
  params.set("key", GP_KEY);

  const upstreamUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
  console.log(`[Places proxy] ${req.query.type||"?"} r=${req.query.radius||"?"} → ${upstreamUrl.split("key=")[0]}key=***`);

  const gpReq = https.get(upstreamUrl, (gpRes) => {
    let raw = "";
    gpRes.on("data", chunk => raw += chunk);
    gpRes.on("end", () => {
      try {
        const data = JSON.parse(raw);
        // Hard-filter: only return places typed as golf_course or country_club
        // This prevents non-golf businesses from leaking through when quota is hit
        if (data.results && Array.isArray(data.results)) {
          const reqType = (req.query.type || "").toLowerCase();
          data.results = data.results.filter(place => {
            const types = place.types || [];
            const name  = (place.name || "").toLowerCase();
            // Always keep if Google tagged it as golf
            if (types.includes("golf_course") || types.includes("country_club")) return true;
            // Keep if name is clearly a golf venue
            if (name.includes("golf") || name.includes("country club")) return true;
            // Reject everything else (hotels, banks, restaurants etc)
            return false;
          });
          console.log(`[Places proxy] filtered to ${data.results.length} golf venues`);
        }
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "no-cache");
        res.json(data);
      } catch(e) {
        console.error("[Places proxy] parse error:", e.message);
        res.status(502).json({ error: "parse error" });
      }
    });
  });

  gpReq.on("error", e => {
    console.error("[Places proxy] error:", e.message);
    res.status(502).json({ error: e.message });
  });
  gpReq.setTimeout(12000, () => {
    gpReq.destroy();
    res.status(504).json({ error: "timeout" });
  });
});

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    // Never cache HTML or JS/CSS — always serve fresh
    if (filePath.match(/\.(html|js|css)$/)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else if (filePath.match(/\.(svg|png|ico|woff2?)$/)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
    res.setHeader("Content-Security-Policy",
      "default-src 'self' https://*.gstatic.com https://*.googleapis.com " +
      "https://*.firebaseapp.com https://*.firebaseio.com " +
      "https://api.open-meteo.com https://geocoding-api.open-meteo.com " +
      "https://nominatim.openstreetmap.org https://overpass-api.de; " +
      "script-src 'self' 'unsafe-inline' https://*.gstatic.com https://apis.google.com https://*.googleapis.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https: ; " +
      "connect-src 'self' https: wss: ;"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  }
}));


// ── foretee.com scorecard scraper proxy ──────────────────────────────
// Fetches scorecard for any US golf course by name
// Searches foretee.com, finds the course page, scrapes the scorecard table
app.get('/api/foretee-scorecard', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    // Step 1: Search foretee for the course
    const searchUrl = `https://foretee.com/search?q=${encodeURIComponent(name)}&type=course`;
    const searchResp = await new Promise((resolve, reject) => {
      const mod = require('https');
      mod.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FairwayFriend/1.0)' } }, resolve).on('error', reject);
    });
    let searchHtml = '';
    await new Promise((resolve, reject) => {
      searchResp.on('data', d => searchHtml += d);
      searchResp.on('end', resolve);
      searchResp.on('error', reject);
    });

    // Extract first scorecard URL from search results
    const urlMatch = searchHtml.match(/href="(\/golf-course-scorecard\/[^"]+\/(\d+))"/);
    if (!urlMatch) return res.json({ holes: null, error: 'course not found on foretee' });

    const scorecardPath = urlMatch[1];
    const courseId = urlMatch[2];

    // Step 2: Fetch the scorecard page
    const scUrl = `https://foretee.com${scorecardPath}`;
    const scResp = await new Promise((resolve, reject) => {
      const mod = require('https');
      mod.get(scUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FairwayFriend/1.0)' } }, resolve).on('error', reject);
    });
    let scHtml = '';
    await new Promise((resolve, reject) => {
      scResp.on('data', d => scHtml += d);
      scResp.on('end', resolve);
      scResp.on('error', reject);
    });

    // Step 3: Parse scorecard table using regex
    // Extract all table rows
    const tableMatch = scHtml.match(/<table[\s\S]*?<\/table>/i);
    if (!tableMatch) return res.json({ holes: null, error: 'no table found' });

    const rows = [];
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableMatch[0])) !== null) {
      const cells = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[0])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      if (cells.length > 10) rows.push(cells);
    }

    if (!rows.length) return res.json({ holes: null, error: 'no rows parsed' });

    // Find par, hcp, tee rows
    const parRow  = rows.find(r => r[0] === 'PAR');
    const hcpRow  = rows.find(r => r[0] === 'HDCP' || r[0] === 'Handicap');
    const holeRow = rows.find(r => r[0] === 'HOME' || r[0] === 'Hole');
    const teeRows = rows.filter(r => r[0] && !['HOME','PAR','HDCP','LADIES PAR','Hole','Handicap','LADIES HDCP','LADIES HCP'].includes(r[0]) && parseInt(r[1]) > 80);

    if (!parRow) return res.json({ holes: null, error: 'PAR row not found' });

    const holes = [];
    let hi = 0;
    for (let ci = 1; ci < parRow.length && hi < 18; ci++) {
      const label = holeRow?.[ci] || '';
      if (['OUT','IN','Total'].includes(label)) continue;
      const par = parseInt(parRow[ci]);
      if (isNaN(par) || par < 3 || par > 5) continue;
      const hcp = parseInt(hcpRow?.[ci]) || null;
      const yards = {};
      teeRows.forEach(tr => { const y = parseInt(tr[ci]); if (!isNaN(y) && y > 80 && y < 700) yards[tr[0]] = y; });
      holes.push({ h: hi + 1, par, hcp, yards });
      hi++;
    }

    if (holes.length < 9) return res.json({ holes: null, error: `only ${holes.length} holes parsed` });

    res.json({ holes, courseId, scorecardUrl: scUrl, source: 'foretee' });
  } catch (err) {
    console.error('[foretee proxy] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Fairway Friend running on port ${PORT}`);
});

module.exports = app;

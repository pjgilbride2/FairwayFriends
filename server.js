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
      "script-src 'self' 'unsafe-inline' https://*.gstatic.com; " +
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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Fairway Friend running on port ${PORT}`);
});

module.exports = app;

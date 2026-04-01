const express = require("express");
const path    = require("path");
const https   = require("https");

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Google Places proxy (/api/places) ─────────────────────────────────────────
// Proxies Google Places Nearby Search server-side to avoid browser CORS blocks.
// Called by app.js with: fetch('/api/places?...')
app.get("/api/places", (req, res) => {
  const GP_KEY = process.env.GOOGLE_PLACES_KEY || req.query.key || "";
  if (!GP_KEY) return res.status(400).json({ error: "No API key" });

  // Build the upstream URL — strip 'key' from query, inject server key
  const params = new URLSearchParams(req.query);
  params.set("key", GP_KEY);
  params.delete("key"); // remove client-supplied key
  params.set("key", GP_KEY); // re-add server key

  const upstreamUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;

  https.get(upstreamUrl, (gpRes) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache");
    gpRes.pipe(res);
  }).on("error", (e) => {
    res.status(502).json({ error: e.message });
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

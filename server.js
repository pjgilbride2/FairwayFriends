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

  const { location, radius, type, pagetoken, key: _k, ...rest } = req.query;

  // ── New Places API v1 (POST) — reliable includedTypes filtering ──
  // Falls back to legacy nearbysearch only for pagetoken pagination
  if (pagetoken) {
    // Pagination: legacy API supports pagetoken, new API does not
    const params = new URLSearchParams({ pagetoken, key: GP_KEY });
    const legacyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
    console.log(`[Places proxy] pagetoken pagination → legacy`);
    const gpReq = https.get(legacyUrl, (gpRes) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache");
      res.status(gpRes.statusCode || 200);
      gpRes.pipe(res);
    });
    gpReq.on("error", e => res.status(502).json({ error: e.message }));
    gpReq.setTimeout(10000, () => { gpReq.destroy(); res.status(504).json({ error: "timeout" }); });
    return;
  }

  // Primary search: new Places API v1 with strict includedTypes
  if (!location) return res.status(400).json({ error: "location required" });
  const [lat, lng] = location.split(",").map(Number);
  const radiusM = Math.min(50000, parseInt(radius || "40000", 10));

  // Map legacy type param to new API includedTypes
  const typeMap = { golf_course: "golf_course", country_club: "golf_course" };
  const includedTypes = type === "country_club"
    ? ["golf_course", "country_club"]
    : ["golf_course"];

  const body = JSON.stringify({
    includedTypes,
    maxResultCount: 20,
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius: radiusM }
    }
  });

  const options = {
    hostname: "places.googleapis.com",
    path: "/v1/places:searchNearby",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "X-Goog-Api-Key": GP_KEY,
      "X-Goog-FieldMask": "places.displayName,places.id,places.location,places.types,places.rating,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,nextPageToken"
    }
  };

  console.log(`[Places proxy v2] includedTypes=${includedTypes.join(",")} radius=${radiusM}m`);

  const gpReq = https.request(options, (gpRes) => {
    let data = "";
    gpRes.on("data", chunk => data += chunk);
    gpRes.on("end", () => {
      try {
        const v2 = JSON.parse(data);
        // Translate new API response to legacy format expected by app.js
        const results = (v2.places || []).map(p => ({
          name:         p.displayName?.text || "",
          place_id:     p.id || "",
          geometry:     { location: { lat: p.location?.latitude, lng: p.location?.longitude } },
          types:        p.types || [],
          rating:       p.rating || null,
          vicinity:     p.formattedAddress || "",
          // Extra fields
          formatted_phone_number: p.nationalPhoneNumber || null,
          website:      p.websiteUri || null,
        }));
        const resp = {
          status: "OK",
          results,
          next_page_token: v2.nextPageToken || undefined,
        };
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "no-cache");
        res.json(resp);
      } catch (e) {
        console.error("[Places proxy v2] parse error:", e.message, data.slice(0,200));
        res.status(502).json({ error: "parse error", raw: data.slice(0,200) });
      }
    });
  });

  gpReq.on("error", e => {
    console.error("[Places proxy v2] error:", e.message);
    res.status(502).json({ error: e.message });
  });
  gpReq.setTimeout(12000, () => {
    gpReq.destroy();
    res.status(504).json({ error: "Upstream timeout" });
  });

  gpReq.write(body);
  gpReq.end();
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

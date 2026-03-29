const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    // Never cache HTML or JS/CSS — always serve fresh
    if (filePath.match(/\.html$/)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else if (filePath.match(/\.(js|css)$/) && filePath.includes("?v=")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (filePath.match(/\.(js|css)$/)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else if (filePath.match(/\.(svg|png|ico|woff2?)$/)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
  res.setHeader("Content-Security-Policy",
    "default-src 'self' https://*.gstatic.com https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org https://overpass-api.de; " +
    "script-src 'self' 'unsafe-inline' https://*.gstatic.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://storage.googleapis.com; " +
    "connect-src 'self' https: wss:;"
  );
      res.setHeader("Content-Security-Policy",
    "default-src 'self' https://*.gstatic.com https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org https://overpass-api.de; " +
    "script-src 'self' 'unsafe-inline' https://*.gstatic.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://storage.googleapis.com; " +
    "connect-src 'self' https: wss:;"
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

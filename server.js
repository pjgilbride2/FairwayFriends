// ============================================================
//  FAIRWAY FRIEND — Express Server
//  Required by Firebase App Hosting.
//  All it does is serve the static public/ folder and
//  return index.html for every route (SPA behaviour).
// ============================================================

const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Serve all static files from /public ──
app.use(express.static(path.join(__dirname, "public"), {
  // Cache JS/CSS for 1 year; HTML never cached so updates deploy instantly
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (filePath.match(/\.(js|css|svg|png|ico|woff2?)$/)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  }
}));

// ── SPA fallback — every unmatched route returns index.html ──
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`Fairway Friend running on port ${PORT}`);
});

module.exports = app;

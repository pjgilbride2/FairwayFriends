const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    // Never cache HTML or JS/CSS — always serve fresh
    if (filePath.match(/\.(html|js|css)$/)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else if (filePath.match(/\.(svg|png|ico|woff2?)$/)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
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

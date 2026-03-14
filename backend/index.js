// ─────────────────────────────────────────────────────────────
// Wine Aging Assistant — Backend (v2)
// Refactored with Router/Controllers, SQLite database,
// edit/history endpoints, and search support.
// ─────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ── One-time migration from JSON to SQLite ──────────────────
const CELLAR_FILE = path.join(__dirname, "cellar-data.json");
if (fs.existsSync(CELLAR_FILE)) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(CELLAR_FILE, "utf-8"));
    if (Object.keys(jsonData).length > 0) {
      const db = require("./db/database");
      db.migrateFromJSON(jsonData);
      console.log("✅ Migrated cellar data from JSON to SQLite");
      // Rename old file so migration doesn't run again
      fs.renameSync(CELLAR_FILE, CELLAR_FILE + ".migrated");
    }
  } catch (err) {
    console.error("Migration warning:", err.message);
  }
}

// ── Routes ──────────────────────────────────────────────────
const scanRoutes = require("./routes/scan");
const cellarRoutes = require("./routes/cellar");
const telegramRoutes = require("./routes/telegram");

app.use("/api", scanRoutes);
app.use("/api/cellar", cellarRoutes);
app.use("/telegram", telegramRoutes);

// ── Health check ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "wine-aging-assistant-backend",
    version: "2.0.0",
  });
});

// ── Start server ────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🍷 Wine Aging Assistant backend v2 running on 0.0.0.0:${PORT}`);
});

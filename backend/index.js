// ─────────────────────────────────────────────────────────────
// Wine Aging Assistant — Backend (v3)
// Refactored with Router/Controllers, Supabase PostgreSQL,
// edit/history endpoints, and search support.
// ─────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "20mb" }));

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
    version: "3.0.0",
    database: "supabase",
  });
});

// ── Start server ────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🍷 Wine Aging Assistant backend v3 running on 0.0.0.0:${PORT}`);
  console.log(`📦 Database: Supabase PostgreSQL`);
});

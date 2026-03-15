// ─────────────────────────────────────────────────────────────
// Routes: /api/scan and /api/lookup
// ─────────────────────────────────────────────────────────────

const { Router } = require("express");
const { analyzeImage, lookupWine } = require("../lib/openai-helper");

const router = Router();

// ── POST /api/scan — analyze a wine label image ─────────────
router.post("/scan", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res
        .status(400)
        .json({ error: "Missing 'image' field. Send a base64-encoded image." });
    }

    const wineData = await analyzeImage(
      image.replace(/^data:image\/\w+;base64,/, "")
    );

    res.json(wineData);
  } catch (err) {
    console.error("Scan error:", err.message);
    res.status(500).json({
      error: "Failed to analyze the wine label. Please try again.",
      details: err.message,
    });
  }
});

// ── POST /api/lookup — manual wine name lookup ──────────────
router.post("/lookup", async (req, res) => {
  try {
    const { wineName, vintage } = req.body;
    if (!wineName) {
      return res.status(400).json({ error: "Missing 'wineName' field." });
    }

    const wineData = await lookupWine(wineName, vintage);
    res.json(wineData);
  } catch (err) {
    console.error("Lookup error:", err.message);
    res.status(500).json({
      error: "Failed to look up the wine. Please try again.",
      details: err.message,
    });
  }
});

module.exports = router;

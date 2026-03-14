// ─────────────────────────────────────────────────────────────
// Routes: /api/cellar — full CRUD, search, edit, history
// ─────────────────────────────────────────────────────────────

const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// ── POST /api/cellar — save a wine ─────────────────────────
router.post("/", (req, res) => {
  try {
    const { userId, wine } = req.body;
    if (!userId || !wine) {
      return res.status(400).json({ error: "Missing userId or wine data." });
    }

    const entry = db.addWine(userId, wine);
    res.json({ success: true, entry: { ...wine, ...entry } });
  } catch (err) {
    console.error("Cellar save error:", err.message);
    res.status(500).json({ error: "Failed to save wine." });
  }
});

// ── GET /api/cellar/:userId — get user's cellar ─────────────
router.get("/:userId", (req, res) => {
  try {
    const wines = db.getCellar(req.params.userId);
    res.json({ wines });
  } catch (err) {
    console.error("Cellar fetch error:", err.message);
    res.json({ wines: [] });
  }
});

// ── GET /api/cellar/:userId/search?q=... — search cellar ────
router.get("/:userId/search", (req, res) => {
  try {
    const query = req.query.q || "";
    if (!query.trim()) {
      const wines = db.getCellar(req.params.userId);
      return res.json({ wines });
    }
    const wines = db.searchCellar(req.params.userId, query.trim());
    res.json({ wines });
  } catch (err) {
    console.error("Cellar search error:", err.message);
    res.json({ wines: [] });
  }
});

// ── GET /api/cellar/:userId/history — consumption history ───
router.get("/:userId/history", (req, res) => {
  try {
    const wines = db.getHistory(req.params.userId);
    res.json({ wines });
  } catch (err) {
    console.error("History fetch error:", err.message);
    res.json({ wines: [] });
  }
});

// ── PUT /api/cellar/:userId/:wineId — edit a wine ──────────
router.put("/:userId/:wineId", (req, res) => {
  try {
    const { userId, wineId } = req.params;
    const updates = req.body;

    const updated = db.updateWine(userId, wineId, updates);
    if (!updated) {
      return res.status(404).json({ error: "Wine not found." });
    }
    res.json({ success: true, wine: updated });
  } catch (err) {
    console.error("Cellar update error:", err.message);
    res.status(500).json({ error: "Failed to update wine." });
  }
});

// ── POST /api/cellar/:userId/:wineId/consume — mark consumed
router.post("/:userId/:wineId/consume", (req, res) => {
  try {
    const { userId, wineId } = req.params;
    const consumed = db.consumeWine(userId, wineId);
    if (!consumed) {
      return res.status(404).json({ error: "Wine not found." });
    }
    res.json({ success: true, wine: consumed });
  } catch (err) {
    console.error("Consume error:", err.message);
    res.status(500).json({ error: "Failed to mark wine as consumed." });
  }
});

// ── DELETE /api/cellar/:userId/:wineId — delete permanently ─
router.delete("/:userId/:wineId", (req, res) => {
  try {
    const { userId, wineId } = req.params;
    const deleted = db.deleteWine(userId, wineId);
    if (!deleted) {
      return res.status(404).json({ error: "Wine not found." });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ error: "Failed to delete wine." });
  }
});

module.exports = router;

// ─────────────────────────────────────────────────────────────
// SQLite Database — persistent cellar storage
// ─────────────────────────────────────────────────────────────

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "cellar.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// ── Create tables ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS wines (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    wine        TEXT NOT NULL,
    vintage     INTEGER,
    region      TEXT,
    grape       TEXT,
    type        TEXT,
    drink_from  INTEGER,
    drink_to    INTEGER,
    recommendation TEXT,
    confidence  TEXT,
    notes       TEXT DEFAULT '',
    status      TEXT DEFAULT 'cellar',
    saved_at    TEXT NOT NULL,
    consumed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_wines_user ON wines(user_id);
  CREATE INDEX IF NOT EXISTS idx_wines_status ON wines(user_id, status);
`);

// ── Prepared statements ─────────────────────────────────────

const insertWine = db.prepare(`
  INSERT INTO wines (id, user_id, wine, vintage, region, grape, type,
                     drink_from, drink_to, recommendation, confidence,
                     notes, status, saved_at)
  VALUES (@id, @user_id, @wine, @vintage, @region, @grape, @type,
          @drink_from, @drink_to, @recommendation, @confidence,
          @notes, @status, @saved_at)
`);

const getWinesByUser = db.prepare(`
  SELECT * FROM wines WHERE user_id = ? AND status = 'cellar'
  ORDER BY saved_at DESC
`);

const getHistoryByUser = db.prepare(`
  SELECT * FROM wines WHERE user_id = ? AND status = 'consumed'
  ORDER BY consumed_at DESC
`);

const getWineById = db.prepare(`
  SELECT * FROM wines WHERE id = ? AND user_id = ?
`);

const updateWine = db.prepare(`
  UPDATE wines
  SET wine = @wine, vintage = @vintage, region = @region,
      grape = @grape, type = @type, drink_from = @drink_from,
      drink_to = @drink_to, recommendation = @recommendation,
      notes = @notes
  WHERE id = @id AND user_id = @user_id
`);

const markConsumed = db.prepare(`
  UPDATE wines SET status = 'consumed', consumed_at = ? WHERE id = ? AND user_id = ?
`);

const deleteWine = db.prepare(`
  DELETE FROM wines WHERE id = ? AND user_id = ?
`);

const searchWines = db.prepare(`
  SELECT * FROM wines
  WHERE user_id = ? AND status = 'cellar'
    AND (wine LIKE ? OR region LIKE ? OR grape LIKE ?)
  ORDER BY saved_at DESC
`);

// ── Export helper functions ──────────────────────────────────

function rowToWine(row) {
  return {
    id: row.id,
    wine: row.wine,
    vintage: row.vintage,
    region: row.region,
    grape: row.grape,
    type: row.type,
    drinkWindow: { from: row.drink_from, to: row.drink_to },
    recommendation: row.recommendation,
    confidence: row.confidence,
    notes: row.notes || "",
    status: row.status,
    savedAt: row.saved_at,
    consumedAt: row.consumed_at,
  };
}

module.exports = {
  // Save a wine to a user's cellar
  addWine(userId, wine) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    insertWine.run({
      id,
      user_id: userId,
      wine: wine.wine || "",
      vintage: wine.vintage || 0,
      region: wine.region || "",
      grape: wine.grape || "",
      type: wine.type || "",
      drink_from: wine.drinkWindow?.from || 0,
      drink_to: wine.drinkWindow?.to || 0,
      recommendation: wine.recommendation || "",
      confidence: wine.confidence || "low",
      notes: wine.notes || "",
      status: "cellar",
      saved_at: now,
    });
    return { id, savedAt: now };
  },

  // Get all wines in a user's cellar
  getCellar(userId) {
    return getWinesByUser.all(userId).map(rowToWine);
  },

  // Get consumption history
  getHistory(userId) {
    return getHistoryByUser.all(userId).map(rowToWine);
  },

  // Get a single wine
  getWine(userId, wineId) {
    const row = getWineById.get(wineId, userId);
    return row ? rowToWine(row) : null;
  },

  // Update a wine's details
  updateWine(userId, wineId, updates) {
    const existing = getWineById.get(wineId, userId);
    if (!existing) return null;

    updateWine.run({
      id: wineId,
      user_id: userId,
      wine: updates.wine ?? existing.wine,
      vintage: updates.vintage ?? existing.vintage,
      region: updates.region ?? existing.region,
      grape: updates.grape ?? existing.grape,
      type: updates.type ?? existing.type,
      drink_from: updates.drinkWindow?.from ?? existing.drink_from,
      drink_to: updates.drinkWindow?.to ?? existing.drink_to,
      recommendation: updates.recommendation ?? existing.recommendation,
      notes: updates.notes ?? existing.notes ?? "",
    });

    const updated = getWineById.get(wineId, userId);
    return updated ? rowToWine(updated) : null;
  },

  // Mark a wine as consumed (move to history)
  consumeWine(userId, wineId) {
    const existing = getWineById.get(wineId, userId);
    if (!existing) return null;
    markConsumed.run(new Date().toISOString(), wineId, userId);
    const updated = getWineById.get(wineId, userId);
    return updated ? rowToWine(updated) : null;
  },

  // Delete a wine permanently
  deleteWine(userId, wineId) {
    const result = deleteWine.run(wineId, userId);
    return result.changes > 0;
  },

  // Search wines by name, region, or grape
  searchCellar(userId, query) {
    const pattern = `%${query}%`;
    return searchWines.all(userId, pattern, pattern, pattern).map(rowToWine);
  },

  // Migrate from JSON file (one-time)
  migrateFromJSON(jsonData) {
    const insert = db.transaction((data) => {
      for (const [userId, wines] of Object.entries(data)) {
        for (const wine of wines) {
          try {
            insertWine.run({
              id: wine.id || Date.now().toString(),
              user_id: userId,
              wine: wine.wine || "",
              vintage: wine.vintage || 0,
              region: wine.region || "",
              grape: wine.grape || "",
              type: wine.type || "",
              drink_from: wine.drinkWindow?.from || 0,
              drink_to: wine.drinkWindow?.to || 0,
              recommendation: wine.recommendation || "",
              confidence: wine.confidence || "low",
              notes: "",
              status: "cellar",
              saved_at: wine.savedAt || new Date().toISOString(),
            });
          } catch {
            // skip duplicates
          }
        }
      }
    });
    insert(jsonData);
  },
};

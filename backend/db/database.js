// ─────────────────────────────────────────────────────────────
// Database layer — Supabase PostgreSQL
// ─────────────────────────────────────────────────────────────

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "⚠️  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
  );
}

// Use the service_role key (not anon) so we bypass RLS from the backend
const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_KEY || "", {
  auth: { persistSession: false },
});

// ── Helper: map DB row → API response format ────────────────
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

// ── Get all active wines for a user ─────────────────────────
async function getCellar(userId) {
  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("saved_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToWine);
}

// ── Search wines by name, region, or grape ──────────────────
async function searchCellar(userId, query) {
  const q = `%${query}%`;
  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`wine.ilike.${q},region.ilike.${q},grape.ilike.${q}`)
    .order("saved_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToWine);
}

// ── Add a wine to the cellar ────────────────────────────────
async function addWine(userId, wine) {
  const { data, error } = await supabase
    .from("wines")
    .insert({
      user_id: userId,
      wine: wine.wine || "",
      vintage: wine.vintage || null,
      region: wine.region || null,
      grape: wine.grape || null,
      type: wine.type || null,
      drink_from: wine.drinkWindow?.from || null,
      drink_to: wine.drinkWindow?.to || null,
      recommendation: wine.recommendation || null,
      confidence: wine.confidence || "low",
      notes: wine.notes || "",
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToWine(data);
}

// ── Get a single wine ───────────────────────────────────────
async function getWine(userId, wineId) {
  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .eq("id", wineId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data ? rowToWine(data) : null;
}

// ── Update a wine ───────────────────────────────────────────
async function updateWine(userId, wineId, updates) {
  const updateData = {
    updated_at: new Date().toISOString(),
  };

  if (updates.wine !== undefined) updateData.wine = updates.wine;
  if (updates.vintage !== undefined) updateData.vintage = updates.vintage;
  if (updates.region !== undefined) updateData.region = updates.region;
  if (updates.grape !== undefined) updateData.grape = updates.grape;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.recommendation !== undefined)
    updateData.recommendation = updates.recommendation;
  if (updates.drinkWindow) {
    if (updates.drinkWindow.from !== undefined)
      updateData.drink_from = updates.drinkWindow.from;
    if (updates.drinkWindow.to !== undefined)
      updateData.drink_to = updates.drinkWindow.to;
  }

  const { data, error } = await supabase
    .from("wines")
    .update(updateData)
    .eq("id", wineId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data ? rowToWine(data) : null;
}

// ── Delete a wine ───────────────────────────────────────────
async function deleteWine(userId, wineId) {
  const { error } = await supabase
    .from("wines")
    .delete()
    .eq("id", wineId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

// ── Mark a wine as consumed ─────────────────────────────────
async function consumeWine(userId, wineId) {
  const { data, error } = await supabase
    .from("wines")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", wineId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data ? rowToWine(data) : null;
}

// ── Get consumption history ─────────────────────────────────
async function getHistory(userId) {
  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "consumed")
    .order("consumed_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToWine);
}

module.exports = {
  getCellar,
  searchCellar,
  addWine,
  getWine,
  updateWine,
  deleteWine,
  consumeWine,
  getHistory,
};

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CellarEntry,
  s,
  API_BASE,
  getDrinkStatus,
  haptic,
  hapticNotification,
} from "./shared";
import { useAuth } from "./AuthProvider";

interface CellarViewProps {
  onBack: () => void;
}

type SortBy = "saved" | "name" | "vintage" | "drink";
type SubView = "list" | "detail" | "edit" | "history";

export default function CellarView({ onBack }: CellarViewProps) {
  const { userId } = useAuth();
  const [cellar, setCellar] = useState<CellarEntry[]>([]);
  const [history, setHistory] = useState<CellarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [subView, setSubView] = useState<SubView>("list");
  const [selectedWine, setSelectedWine] = useState<CellarEntry | null>(null);

  // Search & sort & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("saved");
  const [wineryFilter, setWineryFilter] = useState<string | null>(null);
  const [showWineryPicker, setShowWineryPicker] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit form
  const [editForm, setEditForm] = useState({
    wine: "",
    winery: "",
    vintage: "",
    region: "",
    grape: "",
    type: "",
    drinkFrom: "",
    drinkTo: "",
    notes: "",
  });

  // ── Fetch cellar ──────────────────────────────────────────
  const fetchCellar = useCallback(
    async (query?: string) => {
      setLoading(true);
      try {
        const q = (query !== undefined ? query : searchQuery).trim();
        const url = q
          ? `${API_BASE}/api/cellar/${userId}/search?q=${encodeURIComponent(q)}`
          : `${API_BASE}/api/cellar/${userId}`;
        const res = await fetch(url);
        const data = await res.json();
        setCellar(data.wines || []);
      } catch {
        setCellar([]);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cellar/${userId}/history`);
      const data = await res.json();
      setHistory(data.wines || []);
    } catch {
      setHistory([]);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchCellar("");
  }, [fetchCellar]);

  // Debounced search: triggers 400ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCellar(searchQuery);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchCellar]);

  // ── Unique wineries for the filter picker ─────────────────
  const uniqueWineries = Array.from(
    new Set(cellar.map((w) => w.winery).filter((w) => w && w.trim() !== ""))
  ).sort((a, b) => a.localeCompare(b));

  // ── Filter by winery, then sort ───────────────────────────
  const filteredCellar = wineryFilter
    ? cellar.filter(
        (w) => w.winery && w.winery.toLowerCase() === wineryFilter.toLowerCase()
      )
    : cellar;

  const sortedCellar = [...filteredCellar].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return (a.wine || "").localeCompare(b.wine || "");
      case "vintage": {
        const aV = a.vintage || 0;
        const bV = b.vintage || 0;
        if (aV === 0 && bV === 0) return 0;
        if (aV === 0) return 1;
        if (bV === 0) return -1;
        return bV - aV;
      }
      case "drink": {
        const aD = a.drinkWindow?.from || 0;
        const bD = b.drinkWindow?.from || 0;
        if (aD === 0 && bD === 0) return 0;
        if (aD === 0) return 1;
        if (bD === 0) return -1;
        return aD - bD;
      }
      default:
        return (
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
    }
  });

  // ── Delete wine ───────────────────────────────────────────
  const deleteWine = async (wineId: string) => {
    haptic("medium");
    try {
      await fetch(`${API_BASE}/api/cellar/${userId}/${wineId}`, {
        method: "DELETE",
      });
      setCellar((prev) => prev.filter((w) => w.id !== wineId));
      hapticNotification("success");
    } catch {
      // silently fail
    }
  };

  // ── Consume wine ──────────────────────────────────────────
  const consumeWine = async (wineId: string) => {
    haptic("medium");
    try {
      const res = await fetch(
        `${API_BASE}/api/cellar/${userId}/${wineId}/consume`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.success) {
        setCellar((prev) => prev.filter((w) => w.id !== wineId));
        hapticNotification("success");
        setSubView("list");
        setSelectedWine(null);
      }
    } catch {
      // silently fail
    }
  };

  // ── Save edit ─────────────────────────────────────────────
  const saveEdit = async () => {
    if (!selectedWine) return;
    haptic("light");
    try {
      const updates = {
        wine: editForm.wine,
        winery: editForm.winery,
        vintage: parseInt(editForm.vintage) || selectedWine.vintage,
        region: editForm.region,
        grape: editForm.grape,
        type: editForm.type,
        drinkWindow: {
          from: parseInt(editForm.drinkFrom) || selectedWine.drinkWindow.from,
          to: parseInt(editForm.drinkTo) || selectedWine.drinkWindow.to,
        },
        notes: editForm.notes,
      };

      const res = await fetch(
        `${API_BASE}/api/cellar/${userId}/${selectedWine.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      const data = await res.json();
      if (data.success && data.wine) {
        setSelectedWine(data.wine);
        setCellar((prev) =>
          prev.map((w) => (w.id === data.wine.id ? data.wine : w))
        );
        setSubView("detail");
        hapticNotification("success");
      }
    } catch {
      // silently fail
    }
  };

  // ── Open edit form ────────────────────────────────────────
  const openEdit = (wine: CellarEntry) => {
    setEditForm({
      wine: wine.wine,
      winery: wine.winery || "",
      vintage: String(wine.vintage || ""),
      region: wine.region || "",
      grape: wine.grape || "",
      type: wine.type || "",
      drinkFrom: String(wine.drinkWindow?.from || ""),
      drinkTo: String(wine.drinkWindow?.to || ""),
      notes: wine.notes || "",
    });
    setSubView("edit");
  };

  // ── Button styles ─────────────────────────────────────────
  const sortBtnStyle = (active: boolean) => ({
    padding: "6px 12px",
    borderRadius: 8,
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "#7c3aed" : "rgba(255,255,255,0.1)",
    color: active ? "#fff" : "rgba(255,255,255,0.6)",
  });

  const filterBtnStyle = (active: boolean) => ({
    padding: "6px 12px",
    borderRadius: 8,
    border: active ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.15)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.05)",
    color: active ? "#c4b5fd" : "rgba(255,255,255,0.6)",
  });

  // ── EDIT VIEW ─────────────────────────────────────────────
  if (subView === "edit" && selectedWine) {
    return (
      <div style={s.container}>
        <button
          style={s.back}
          onClick={() => {
            haptic("light");
            setSubView("detail");
          }}
        >
          &larr; Back to Details
        </button>
        <h2>Edit Wine</h2>

        <div style={s.card}>
          <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Wine Name</label>
          <input
            style={s.input}
            value={editForm.wine}
            onChange={(e) => setEditForm({ ...editForm, wine: e.target.value })}
          />

          <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Winery / Producer</label>
          <input
            style={s.input}
            value={editForm.winery}
            onChange={(e) => setEditForm({ ...editForm, winery: e.target.value })}
          />

          <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Vintage</label>
          <input
            style={s.input}
            type="number"
            inputMode="numeric"
            value={editForm.vintage}
            onChange={(e) =>
              setEditForm({ ...editForm, vintage: e.target.value })
            }
          />

          <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Region</label>
          <input
            style={s.input}
            value={editForm.region}
            onChange={(e) =>
              setEditForm({ ...editForm, region: e.target.value })
            }
          />

          <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Grape</label>
          <input
            style={s.input}
            value={editForm.grape}
            onChange={(e) =>
              setEditForm({ ...editForm, grape: e.target.value })
            }
          />

          <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Type</label>
          <input
            style={s.input}
            value={editForm.type}
            onChange={(e) =>
              setEditForm({ ...editForm, type: e.target.value })
            }
          />

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Drink From</label>
              <input
                style={s.input}
                type="number"
                inputMode="numeric"
                value={editForm.drinkFrom}
                onChange={(e) =>
                  setEditForm({ ...editForm, drinkFrom: e.target.value })
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Drink To</label>
              <input
                style={s.input}
                type="number"
                inputMode="numeric"
                value={editForm.drinkTo}
                onChange={(e) =>
                  setEditForm({ ...editForm, drinkTo: e.target.value })
                }
              />
            </div>
          </div>

          <label style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, display: "block" }}>Personal Notes</label>
          <textarea
            style={{
              ...s.input,
              minHeight: 80,
              resize: "vertical",
            }}
            value={editForm.notes}
            onChange={(e) =>
              setEditForm({ ...editForm, notes: e.target.value })
            }
            placeholder="Add your personal tasting notes..."
          />

          <button style={s.actionBtn("#7c3aed")} onClick={saveEdit}>
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────
  if (subView === "detail" && selectedWine) {
    const hasDrinkWindow =
      selectedWine.drinkWindow?.from && selectedWine.drinkWindow?.to;
    const status = hasDrinkWindow
      ? getDrinkStatus(selectedWine.drinkWindow.from, selectedWine.drinkWindow.to)
      : null;

    return (
      <div style={s.container}>
        <button
          style={s.back}
          onClick={() => {
            haptic("light");
            setSelectedWine(null);
            setSubView("list");
          }}
        >
          &larr; Back to Cellar
        </button>

        {/* Basic info */}
        <div style={s.card}>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
          >
            <h3 style={{ margin: 0, flex: 1 }}>{selectedWine.wine}</h3>
            <span style={s.badge(selectedWine.confidence)}>
              {selectedWine.confidence}
            </span>
          </div>
          <p style={{ margin: "4px 0", opacity: 0.8 }}>
            {selectedWine.type}
            {selectedWine.vintage ? ` \u00B7 ${selectedWine.vintage}` : ""}
          </p>
          {selectedWine.winery && (
            <p style={{ margin: "4px 0" }}>
              <strong>Winery:</strong> {selectedWine.winery}
            </p>
          )}
          <p style={{ margin: "4px 0" }}>
            <strong>Region:</strong> {selectedWine.region}
          </p>
          <p style={{ margin: "4px 0" }}>
            <strong>Grape:</strong> {selectedWine.grape}
          </p>
        </div>

        {/* Drink window */}
        {hasDrinkWindow ? (
          <div style={s.drinkWindow}>
            <p style={{ margin: "0 0 4px", fontSize: 13, opacity: 0.7 }}>
              OPTIMAL DRINKING WINDOW
            </p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
              {selectedWine.drinkWindow.from} &ndash;{" "}
              {selectedWine.drinkWindow.to}
            </p>
            {status && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: status.color,
                }}
              >
                {status.label}
              </p>
            )}
          </div>
        ) : (
          <div style={s.drinkWindow}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
              No drinking window set. Tap &quot;Edit Details&quot; to add one.
            </p>
          </div>
        )}

        {/* Tasting notes */}
        {selectedWine.tasting && (
          <div style={s.card}>
            <p style={s.sectionTitle}>Tasting Notes</p>
            {selectedWine.tasting.aroma && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                  Aroma / Nose
                </p>
                <p style={s.sectionContent}>{selectedWine.tasting.aroma}</p>
              </div>
            )}
            {selectedWine.tasting.palate && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                  Palate
                </p>
                <p style={s.sectionContent}>{selectedWine.tasting.palate}</p>
              </div>
            )}
            {selectedWine.tasting.finish && (
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                  Finish
                </p>
                <p style={s.sectionContent}>{selectedWine.tasting.finish}</p>
              </div>
            )}
          </div>
        )}

        {/* Food pairings */}
        {selectedWine.pairing && (
          <div style={s.card}>
            <p style={s.sectionTitle}>Food Pairings</p>
            <p style={s.sectionContent}>{selectedWine.pairing}</p>
          </div>
        )}

        {/* Serving recommendations */}
        {selectedWine.serving && (
          <div style={s.card}>
            <p style={s.sectionTitle}>Serving</p>
            <div style={{ display: "grid", gap: 10 }}>
              {selectedWine.serving.temperature && (
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                    Temperature
                  </p>
                  <p style={s.sectionContent}>{selectedWine.serving.temperature}</p>
                </div>
              )}
              {selectedWine.serving.decanting && (
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                    Decanting
                  </p>
                  <p style={s.sectionContent}>{selectedWine.serving.decanting}</p>
                </div>
              )}
              {selectedWine.serving.glassware && (
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                    Glassware
                  </p>
                  <p style={s.sectionContent}>{selectedWine.serving.glassware}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aging potential */}
        {selectedWine.agingPotential && (
          <div style={s.card}>
            <p style={s.sectionTitle}>Aging Potential</p>
            <p style={s.sectionContent}>{selectedWine.agingPotential}</p>
          </div>
        )}

        {/* Sommelier recommendation */}
        {selectedWine.recommendation && (
          <div style={s.card}>
            <p style={s.sectionTitle}>Sommelier Recommendation</p>
            <p style={s.sectionContent}>{selectedWine.recommendation}</p>
          </div>
        )}

        {/* Personal notes */}
        {selectedWine.notes && (
          <div style={s.card}>
            <p style={s.sectionTitle}>Your Notes</p>
            <p style={{ ...s.sectionContent, fontStyle: "italic" }}>
              {selectedWine.notes}
            </p>
          </div>
        )}

        <p
          style={{
            fontSize: 12,
            opacity: 0.4,
            textAlign: "center",
            marginTop: 16,
          }}
        >
          Saved on {new Date(selectedWine.savedAt).toLocaleDateString()}
        </p>

        <button
          style={s.actionBtn("#6d28d9")}
          onClick={() => {
            haptic("light");
            openEdit(selectedWine);
          }}
        >
          Edit Details
        </button>

        <button
          style={s.actionBtn("#16a34a")}
          onClick={() => consumeWine(selectedWine.id)}
        >
          Drinking Now
        </button>

        <button
          style={s.actionBtn("#dc2626")}
          onClick={() => {
            deleteWine(selectedWine.id);
            setSelectedWine(null);
            setSubView("list");
          }}
        >
          Remove from Cellar
        </button>
      </div>
    );
  }

  // ── HISTORY VIEW ──────────────────────────────────────────
  if (subView === "history") {
    return (
      <div style={s.container}>
        <button
          style={s.back}
          onClick={() => {
            haptic("light");
            setSubView("list");
          }}
        >
          &larr; Back to Cellar
        </button>
        <h2>Drinking History</h2>

        {history.length === 0 && (
          <div style={s.card}>
            <p style={{ margin: 0, opacity: 0.7, textAlign: "center" }}>
              No wines consumed yet. Tap &quot;Drinking Now&quot; on a wine in
              your cellar to move it here.
            </p>
          </div>
        )}

        {history.map((entry) => (
          <div key={entry.id} style={s.cellarItem}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{entry.wine}</h3>
            <p style={{ margin: "2px 0", opacity: 0.7, fontSize: 13 }}>
              {entry.winery ? `${entry.winery} \u00B7 ` : ""}
              {entry.type}
              {entry.vintage ? ` \u00B7 ${entry.vintage}` : ""}
              {entry.region ? ` \u00B7 ${entry.region}` : ""}
            </p>
            {entry.consumedAt && (
              <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.5 }}>
                Consumed on{" "}
                {new Date(entry.consumedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── LIST VIEW (default) ───────────────────────────────────
  return (
    <div style={s.container}>
      <button
        style={s.back}
        onClick={() => {
          haptic("light");
          onBack();
        }}
      >
        &larr; Back
      </button>
      <h2>My Cellar</h2>

      {/* Search bar */}
      <div style={{ marginBottom: 12 }}>
        <input
          style={s.input}
          placeholder="Search by name, winery, region, or grape..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            style={{
              ...s.back,
              padding: "6px 14px",
              fontSize: 12,
              marginBottom: 0,
            }}
            onClick={() => {
              setSearchQuery("");
            }}
          >
            Clear search
          </button>
        )}
      </div>

      {/* Sort buttons row */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>
          Sort by
        </p>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <button
            style={sortBtnStyle(sortBy === "saved")}
            onClick={() => { haptic("light"); setSortBy("saved"); }}
          >
            Recent
          </button>
          <button
            style={sortBtnStyle(sortBy === "name")}
            onClick={() => { haptic("light"); setSortBy("name"); }}
          >
            Name
          </button>
          <button
            style={sortBtnStyle(sortBy === "vintage")}
            onClick={() => { haptic("light"); setSortBy("vintage"); }}
          >
            Vintage
          </button>
          <button
            style={sortBtnStyle(sortBy === "drink")}
            onClick={() => { haptic("light"); setSortBy("drink"); }}
          >
            Drink Window
          </button>
        </div>
      </div>

      {/* Winery filter row */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>
          Filter by winery
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            style={filterBtnStyle(!wineryFilter)}
            onClick={() => {
              haptic("light");
              setWineryFilter(null);
              setShowWineryPicker(false);
            }}
          >
            All Wineries
          </button>
          {uniqueWineries.map((winery) => (
            <button
              key={winery}
              style={filterBtnStyle(wineryFilter === winery)}
              onClick={() => {
                haptic("light");
                setWineryFilter(wineryFilter === winery ? null : winery);
              }}
            >
              {winery}
            </button>
          ))}
        </div>
        {wineryFilter && (
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
            Showing {sortedCellar.length} wine{sortedCellar.length !== 1 ? "s" : ""} from <strong>{wineryFilter}</strong>
            {" \u00B7 "}
            <span
              style={{ color: "#c4b5fd", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => { haptic("light"); setWineryFilter(null); }}
            >
              Clear filter
            </span>
          </p>
        )}
      </div>

      {/* History button */}
      <button
        style={{
          ...s.back,
          display: "block",
          width: "100%",
          textAlign: "center",
          marginBottom: 16,
          borderColor: "rgba(124,58,237,0.4)",
          color: "rgba(124,58,237,0.9)",
        }}
        onClick={() => {
          haptic("light");
          fetchHistory();
          setSubView("history");
        }}
      >
        View Drinking History
      </button>

      {/* Loading */}
      {loading && (
        <p style={{ textAlign: "center", opacity: 0.6 }}>
          Loading your cellar...
        </p>
      )}

      {/* Empty state */}
      {!loading && sortedCellar.length === 0 && (
        <div style={s.card}>
          <p style={{ margin: 0, opacity: 0.7, textAlign: "center" }}>
            {searchQuery || wineryFilter
              ? "No wines match your search or filter."
              : "Your cellar is empty. Scan a bottle or type a wine name to add your first bottle!"}
          </p>
        </div>
      )}

      {/* Wine list */}
      {sortedCellar.map((entry) => {
        const hasDrinkWindow = entry.drinkWindow?.from && entry.drinkWindow?.to;
        const status = hasDrinkWindow
          ? getDrinkStatus(entry.drinkWindow.from, entry.drinkWindow.to)
          : null;

        return (
          <div
            key={entry.id}
            style={{ ...s.cellarItem, cursor: "pointer" }}
            onClick={() => {
              haptic("light");
              setSelectedWine(entry);
              setSubView("detail");
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>
                  {entry.wine}
                </h3>
                <p style={{ margin: "2px 0", opacity: 0.7, fontSize: 13 }}>
                  {entry.winery ? `${entry.winery} \u00B7 ` : ""}
                  {entry.type}
                  {entry.vintage ? ` \u00B7 ${entry.vintage}` : ""}
                  {entry.region ? ` \u00B7 ${entry.region}` : ""}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteWine(entry.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f87171",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
                title="Remove"
              >
                &times;
              </button>
            </div>
            {hasDrinkWindow ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 13 }}>
                  Drink: {entry.drinkWindow.from}&ndash;{entry.drinkWindow.to}
                </span>
                {status && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: status.color,
                    }}
                  >
                    {status.label}
                  </span>
                )}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  fontSize: 13,
                  opacity: 0.5,
                }}
              >
                No drinking window set
              </div>
            )}
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                opacity: 0.4,
                textAlign: "right",
              }}
            >
              Tap for details &rarr;
            </p>
          </div>
        );
      })}
    </div>
  );
}

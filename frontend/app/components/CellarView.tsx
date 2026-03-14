"use client";

import { useCallback, useEffect, useState } from "react";
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

type SortBy = "saved" | "name" | "winery" | "vintage" | "drink";
type SubView = "list" | "detail" | "edit" | "history";

export default function CellarView({ onBack }: CellarViewProps) {
  const { userId } = useAuth();
  const [cellar, setCellar] = useState<CellarEntry[]>([]);
  const [history, setHistory] = useState<CellarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [subView, setSubView] = useState<SubView>("list");
  const [selectedWine, setSelectedWine] = useState<CellarEntry | null>(null);

  // Search & sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("saved");

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
  const fetchCellar = useCallback(async () => {
    setLoading(true);
    try {
      const url = searchQuery.trim()
        ? `${API_BASE}/api/cellar/${userId}/search?q=${encodeURIComponent(searchQuery.trim())}`
        : `${API_BASE}/api/cellar/${userId}`;
      const res = await fetch(url);
      const data = await res.json();
      setCellar(data.wines || []);
    } catch {
      setCellar([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cellar/${userId}/history`);
      const data = await res.json();
      setHistory(data.wines || []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    fetchCellar();
  }, [fetchCellar]);

  // ── Sort logic ────────────────────────────────────────────
  const sortedCellar = [...cellar].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.wine.localeCompare(b.wine);
      case "winery":
        return (a.winery || "").localeCompare(b.winery || "");
      case "vintage":
        return (b.vintage || 0) - (a.vintage || 0);
      case "drink":
        return (a.drinkWindow?.from || 0) - (b.drinkWindow?.from || 0);
      default:
        return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
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

  // ── Sort button style ────────────────────────────────────
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
    const status = getDrinkStatus(
      selectedWine.drinkWindow.from,
      selectedWine.drinkWindow.to
    );

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
            {selectedWine.type} &middot; {selectedWine.vintage}
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

        <div style={s.drinkWindow}>
          <p style={{ margin: "0 0 4px", fontSize: 13, opacity: 0.7 }}>
            OPTIMAL DRINKING WINDOW
          </p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            {selectedWine.drinkWindow.from} &ndash;{" "}
            {selectedWine.drinkWindow.to}
          </p>
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
        </div>

        <div style={s.card}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 13,
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            SOMMELIER NOTES
          </p>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            {selectedWine.recommendation}
          </p>
        </div>

        {/* Personal notes */}
        {selectedWine.notes && (
          <div style={s.card}>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 13,
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              YOUR NOTES
            </p>
            <p style={{ margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
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

        {/* Action buttons */}
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
              {entry.type} &middot; {entry.vintage} &middot; {entry.region}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") fetchCellar();
          }}
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

      {/* Sort buttons */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          style={sortBtnStyle(sortBy === "saved")}
          onClick={() => setSortBy("saved")}
        >
          Recent
        </button>
        <button
          style={sortBtnStyle(sortBy === "name")}
          onClick={() => setSortBy("name")}
        >
          Name
        </button>
        <button
          style={sortBtnStyle(sortBy === "winery")}
          onClick={() => setSortBy("winery")}
        >
          Winery
        </button>
        <button
          style={sortBtnStyle(sortBy === "vintage")}
          onClick={() => setSortBy("vintage")}
        >
          Vintage
        </button>
        <button
          style={sortBtnStyle(sortBy === "drink")}
          onClick={() => setSortBy("drink")}
        >
          Drink Window
        </button>
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
            {searchQuery
              ? "No wines match your search."
              : "Your cellar is empty. Scan a bottle or type a wine name to add your first bottle!"}
          </p>
        </div>
      )}

      {/* Wine list */}
      {sortedCellar.map((entry) => {
        const status = getDrinkStatus(
          entry.drinkWindow.from,
          entry.drinkWindow.to
        );

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
                  {entry.winery ? `${entry.winery} \u00B7 ` : ""}{entry.type} &middot; {entry.vintage} &middot; {entry.region}
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
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: status.color,
                }}
              >
                {status.label}
              </span>
            </div>
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

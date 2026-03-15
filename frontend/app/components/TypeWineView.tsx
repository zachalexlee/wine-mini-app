"use client";

import { useState } from "react";
import {
  WineData,
  s,
  API_BASE,
  haptic,
  hapticNotification,
} from "./shared";
import { useAuth } from "./AuthProvider";
import WineCard from "./WineCard";

interface TypeWineViewProps {
  onBack: () => void;
}

export default function TypeWineView({ onBack }: TypeWineViewProps) {
  const { userId } = useAuth();
  const [wineName, setWineName] = useState("");
  const [vintageInput, setVintageInput] = useState("");
  const [lookupResult, setLookupResult] = useState<WineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleLookup = async () => {
    if (!wineName.trim()) return;
    haptic("light");
    setLoading(true);
    setErrorMsg(null);
    setLookupResult(null);
    setSaved(false);

    try {
      const res = await fetch(`${API_BASE}/api/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wineName: wineName.trim(),
          vintage: vintageInput.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: WineData = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
        hapticNotification("error");
      } else {
        setLookupResult(data);
        hapticNotification("success");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Lookup failed: ${message}`);
      hapticNotification("error");
    } finally {
      setLoading(false);
    }
  };

  const saveWine = async () => {
    if (!lookupResult) return;
    try {
      const uid = userId;
      const res = await fetch(`${API_BASE}/api/cellar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, wine: lookupResult }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        hapticNotification("success");
      }
    } catch {
      // silently fail
    }
  };

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
      <h2>Type Wine</h2>

      <div style={s.card}>
        <p style={{ margin: "0 0 12px", opacity: 0.7, fontSize: 14 }}>
          Enter a wine name, winery, or producer and an optional vintage to look
          up details and drinking window.
        </p>
        <input
          style={s.input}
          placeholder="Wine or winery (e.g. Opus One, Rickety Bridge)"
          value={wineName}
          onChange={(e) => setWineName(e.target.value)}
        />
        <input
          style={s.input}
          placeholder="Vintage year (optional, e.g. 2018)"
          value={vintageInput}
          onChange={(e) => setVintageInput(e.target.value)}
          type="number"
          inputMode="numeric"
        />
        <button
          style={s.actionBtn("#7c3aed")}
          onClick={handleLookup}
          disabled={loading || !wineName.trim()}
        >
          {loading ? "Looking up..." : "Look Up Wine"}
        </button>
      </div>

      {errorMsg && (
        <div style={s.card}>
          <p style={{ margin: 0, color: "#f87171" }}>{errorMsg}</p>
        </div>
      )}

      {lookupResult && (
        <WineCard wine={lookupResult} isSaved={saved} onSave={saveWine} />
      )}
    </div>
  );
}

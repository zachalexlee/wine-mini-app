"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────
interface WineData {
  wine: string;
  vintage: number;
  region: string;
  grape: string;
  type: string;
  drinkWindow: { from: number; to: number };
  recommendation: string;
  confidence: string;
  error?: string;
}

interface CellarEntry extends WineData {
  id: string;
  savedAt: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe: { user?: { id: number } } & Record<string, unknown>;
        themeParams: Record<string, string>;
      };
    };
  }
}

// ── API base URL ─────────────────────────────────────────────
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://wine-mini-app.vercel.app";

// ── Helpers ──────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getUserId(): string {
  if (
    typeof window !== "undefined" &&
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  ) {
    return String(window.Telegram.WebApp.initDataUnsafe.user.id);
  }
  // Fallback for testing outside Telegram
  let id = localStorage.getItem("wine_user_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("wine_user_id", id);
  }
  return id;
}

// ── Component ────────────────────────────────────────────────
export default function Home() {
  type View = "home" | "scan" | "type" | "cellar";

  const [view, setView] = useState<View>("home");
  const [scanResult, setScanResult] = useState<WineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Manual entry state
  const [wineName, setWineName] = useState("");
  const [vintageInput, setVintageInput] = useState("");
  const [lookupResult, setLookupResult] = useState<WineData | null>(null);
  const [lookupSaved, setLookupSaved] = useState(false);

  // Cellar state
  const [cellar, setCellar] = useState<CellarEntry[]>([]);
  const [cellarLoading, setCellarLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify Telegram that the Mini App is ready
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  // ── Cellar fetch ─────────────────────────────────────────
  const fetchCellar = useCallback(async () => {
    setCellarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cellar/${getUserId()}`);
      const data = await res.json();
      setCellar(data.wines || []);
    } catch {
      setCellar([]);
    } finally {
      setCellarLoading(false);
    }
  }, []);

  // ── Save to cellar ──────────────────────────────────────
  const saveWine = async (wine: WineData): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/cellar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getUserId(), wine }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  };

  // ── Delete from cellar ──────────────────────────────────
  const deleteWine = async (wineId: string) => {
    try {
      await fetch(`${API_BASE}/api/cellar/${getUserId()}/${wineId}`, {
        method: "DELETE",
      });
      setCellar((prev) => prev.filter((w) => w.id !== wineId));
    } catch {
      // silently fail
    }
  };

  // ── Scan handler ─────────────────────────────────────────
  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setView("scan");
    setLoading(true);
    setErrorMsg(null);
    setScanResult(null);
    setSaved(false);

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: WineData = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setScanResult(data);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Failed to analyze: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Manual lookup handler ────────────────────────────────
  const handleLookup = async () => {
    if (!wineName.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setLookupResult(null);
    setLookupSaved(false);

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
      } else {
        setLookupResult(data);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Lookup failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.setAttribute("accept", "image/*");
      fileInputRef.current.click();
    }
  };

  const openGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.setAttribute("accept", "image/*");
      fileInputRef.current.click();
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setErrorMsg(null);
    setPreviewUrl(null);
    setLoading(false);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Styles ───────────────────────────────────────────────
  const s = {
    container: {
      maxWidth: 420,
      margin: "0 auto",
      padding: "24px 16px",
      minHeight: "100vh",
      background:
        "linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 50%, #4a1942 100%)",
      color: "#f5f0eb",
    } as React.CSSProperties,
    header: { textAlign: "center" as const, marginBottom: 32 },
    title: { fontSize: 26, fontWeight: 700, margin: "0 0 4px" },
    subtitle: { fontSize: 14, opacity: 0.7, margin: 0 },
    btn: {
      display: "block",
      width: "100%",
      padding: "16px 20px",
      marginBottom: 12,
      border: "none",
      borderRadius: 14,
      fontSize: 16,
      fontWeight: 600,
      cursor: "pointer",
      color: "#fff",
      textAlign: "left" as const,
    },
    card: {
      background: "rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: 20,
      marginTop: 16,
    },
    back: {
      background: "none",
      border: "1px solid rgba(255,255,255,0.25)",
      color: "#f5f0eb",
      padding: "10px 20px",
      borderRadius: 10,
      cursor: "pointer",
      fontSize: 14,
      marginBottom: 16,
    },
    preview: {
      width: "100%",
      maxHeight: 250,
      objectFit: "cover" as const,
      borderRadius: 12,
      marginBottom: 16,
    },
    badge: (level: string) => ({
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background:
        level === "high" ? "#16a34a" : level === "medium" ? "#ca8a04" : "#dc2626",
      color: "#fff",
      marginLeft: 8,
    }),
    drinkWindow: {
      background: "rgba(124,58,237,0.2)",
      border: "1px solid rgba(124,58,237,0.4)",
      borderRadius: 12,
      padding: "12px 16px",
      margin: "12px 0",
      textAlign: "center" as const,
    },
    actionBtn: (bg: string) => ({
      display: "block",
      width: "100%",
      padding: "14px 12px",
      border: "none",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      color: "#fff",
      textAlign: "center" as const,
      background: bg,
      marginTop: 10,
    }),
    input: {
      width: "100%",
      padding: "14px 16px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(255,255,255,0.08)",
      color: "#f5f0eb",
      fontSize: 15,
      outline: "none",
      marginBottom: 10,
      boxSizing: "border-box" as const,
    },
    cellarItem: {
      background: "rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      border: "1px solid rgba(255,255,255,0.08)",
    },
  };

  // ── Hidden file input ────────────────────────────────────
  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={handleFileSelected}
    />
  );

  // ── Wine Result Card (reused in scan + lookup) ───────────
  const WineCard = ({
    wine,
    onSave,
    isSaved,
  }: {
    wine: WineData;
    onSave: () => void;
    isSaved: boolean;
  }) => (
    <>
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{wine.wine}</h3>
          <span style={s.badge(wine.confidence)}>{wine.confidence}</span>
        </div>
        <p style={{ margin: "4px 0", opacity: 0.8 }}>
          {wine.type} · {wine.vintage}
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Region:</strong> {wine.region}
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Grape:</strong> {wine.grape}
        </p>
      </div>

      <div style={s.drinkWindow}>
        <p style={{ margin: "0 0 4px", fontSize: 13, opacity: 0.7 }}>
          OPTIMAL DRINKING WINDOW
        </p>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
          {wine.drinkWindow.from} – {wine.drinkWindow.to}
        </p>
      </div>

      <div style={s.card}>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, opacity: 0.7 }}>
          SOMMELIER NOTES
        </p>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{wine.recommendation}</p>
      </div>

      <button
        style={s.actionBtn(isSaved ? "#16a34a" : "#b45309")}
        onClick={onSave}
        disabled={isSaved}
      >
        {isSaved ? "✓ Saved to Cellar" : "🍷 Save to My Cellar"}
      </button>
    </>
  );

  // ── SCAN VIEW ────────────────────────────────────────────
  if (view === "scan") {
    return (
      <div style={s.container}>
        {hiddenInput}
        <button
          style={s.back}
          onClick={() => { resetScan(); setView("home"); }}
        >
          ← Back
        </button>
        <h2>📸 Scan Bottle</h2>

        {previewUrl && (
          <img src={previewUrl} alt="Wine label" style={s.preview} />
        )}

        {loading && (
          <div style={s.card}>
            <p style={{ margin: 0, textAlign: "center" }}>
              🔍 Analyzing wine label...
            </p>
            <p style={{ margin: "8px 0 0", textAlign: "center", opacity: 0.6, fontSize: 13 }}>
              Our AI sommelier is studying the label
            </p>
          </div>
        )}

        {errorMsg && (
          <div style={s.card}>
            <p style={{ margin: 0, color: "#f87171" }}>{errorMsg}</p>
            <button
              style={s.actionBtn("#7c3aed")}
              onClick={() => { resetScan(); openCamera(); }}
            >
              Try Again
            </button>
          </div>
        )}

        {scanResult && (
          <>
            <WineCard
              wine={scanResult}
              isSaved={saved}
              onSave={async () => {
                const ok = await saveWine(scanResult);
                if (ok) setSaved(true);
              }}
            />
            <button
              style={s.actionBtn("#7c3aed")}
              onClick={() => { resetScan(); openCamera(); }}
            >
              Scan Another Bottle
            </button>
          </>
        )}

        {!loading && !scanResult && !errorMsg && (
          <div style={s.card}>
            <p style={{ margin: "0 0 16px", textAlign: "center", opacity: 0.7 }}>
              Take a photo of a wine label or choose from your gallery
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={s.actionBtn("#7c3aed")} onClick={openCamera}>
                📷 Camera
              </button>
              <button style={s.actionBtn("#6d28d9")} onClick={openGallery}>
                🖼️ Gallery
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── TYPE WINE VIEW ───────────────────────────────────────
  if (view === "type") {
    return (
      <div style={s.container}>
        {hiddenInput}
        <button
          style={s.back}
          onClick={() => {
            setView("home");
            setLookupResult(null);
            setErrorMsg(null);
            setLookupSaved(false);
          }}
        >
          ← Back
        </button>
        <h2>✏️ Type Wine</h2>

        <div style={s.card}>
          <p style={{ margin: "0 0 12px", opacity: 0.7, fontSize: 14 }}>
            Enter a wine name and optional vintage to look up its details and
            drinking window.
          </p>
          <input
            style={s.input}
            placeholder="Wine name (e.g. Opus One)"
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
            {loading ? "🔍 Looking up..." : "Look Up Wine"}
          </button>
        </div>

        {errorMsg && (
          <div style={s.card}>
            <p style={{ margin: 0, color: "#f87171" }}>{errorMsg}</p>
          </div>
        )}

        {lookupResult && (
          <WineCard
            wine={lookupResult}
            isSaved={lookupSaved}
            onSave={async () => {
              const ok = await saveWine(lookupResult);
              if (ok) setLookupSaved(true);
            }}
          />
        )}
      </div>
    );
  }

  // ── CELLAR VIEW ──────────────────────────────────────────
  if (view === "cellar") {
    return (
      <div style={s.container}>
        {hiddenInput}
        <button style={s.back} onClick={() => setView("home")}>
          ← Back
        </button>
        <h2>🍷 My Cellar</h2>

        {cellarLoading && (
          <p style={{ textAlign: "center", opacity: 0.6 }}>Loading your cellar...</p>
        )}

        {!cellarLoading && cellar.length === 0 && (
          <div style={s.card}>
            <p style={{ margin: 0, opacity: 0.7, textAlign: "center" }}>
              Your cellar is empty. Scan a bottle or type a wine name to add
              your first bottle!
            </p>
          </div>
        )}

        {cellar.map((entry) => {
          const now = new Date().getFullYear();
          const status =
            now < entry.drinkWindow.from
              ? "🕐 Too early"
              : now > entry.drinkWindow.to
              ? "⚠️ Past peak"
              : "✅ Ready to drink";
          const statusColor =
            now < entry.drinkWindow.from
              ? "#ca8a04"
              : now > entry.drinkWindow.to
              ? "#dc2626"
              : "#16a34a";

          return (
            <div key={entry.id} style={s.cellarItem}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>
                    {entry.wine}
                  </h3>
                  <p style={{ margin: "2px 0", opacity: 0.7, fontSize: 13 }}>
                    {entry.type} · {entry.vintage} · {entry.region}
                  </p>
                </div>
                <button
                  onClick={() => deleteWine(entry.id)}
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
                  ✕
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
                  Drink: {entry.drinkWindow.from}–{entry.drinkWindow.to}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: statusColor,
                  }}
                >
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── HOME VIEW ────────────────────────────────────────────
  return (
    <div style={s.container}>
      {hiddenInput}
      <div style={s.header}>
        <p style={{ fontSize: 48, margin: "0 0 8px" }}>🍷</p>
        <h1 style={s.title}>Wine Aging Assistant</h1>
        <p style={s.subtitle}>
          Scan a label · Look up a vintage · Track your cellar
        </p>
      </div>

      <button
        style={{ ...s.btn, background: "#7c3aed" }}
        onClick={() => setView("scan")}
      >
        📸&nbsp; Scan Bottle
      </button>

      <button
        style={{ ...s.btn, background: "#be185d" }}
        onClick={() => {
          setWineName("");
          setVintageInput("");
          setLookupResult(null);
          setErrorMsg(null);
          setLookupSaved(false);
          setView("type");
        }}
      >
        ✏️&nbsp; Type Wine
      </button>

      <button
        style={{ ...s.btn, background: "#b45309" }}
        onClick={() => {
          fetchCellar();
          setView("cellar");
        }}
      >
        🏠&nbsp; My Cellar
      </button>

      <p
        style={{
          textAlign: "center",
          fontSize: 12,
          opacity: 0.4,
          marginTop: 32,
        }}
      >
        Powered by Telegram Mini Apps
      </p>
    </div>
  );
}

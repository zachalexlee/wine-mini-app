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

// ── Safely access Telegram WebApp ────────────────────────────
function getTelegramWebApp() {
  try {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      return window.Telegram.WebApp;
    }
  } catch {
    // ignore
  }
  return null;
}

// ── Safe localStorage wrapper ────────────────────────────────
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage not available (e.g. Telegram WebView)
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
  // Try Telegram user ID first
  const tg = getTelegramWebApp();
  try {
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser && tgUser.id) {
      return String(tgUser.id);
    }
  } catch {
    // ignore
  }
  // Fallback for testing outside Telegram
  let id = safeGetItem("wine_user_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).slice(2, 10);
    safeSetItem("wine_user_id", id);
  }
  return id || "anonymous";
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

  // Three separate refs for different capture modes
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const plainInputRef = useRef<HTMLInputElement>(null);

  // Notify Telegram that the Mini App is ready
  useEffect(() => {
    try {
      const tg = getTelegramWebApp();
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch {
      // not inside Telegram, that's fine
    }
  }, []);

  // ── Cellar fetch ─────────────────────────────────────────
  const fetchCellar = useCallback(async () => {
    setCellarLoading(true);
    try {
      const uid = getUserId();
      const res = await fetch(`${API_BASE}/api/cellar/${uid}`);
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
      const uid = getUserId();
      const res = await fetch(`${API_BASE}/api/cellar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, wine }),
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
      const uid = getUserId();
      await fetch(`${API_BASE}/api/cellar/${uid}/${wineId}`, {
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

    let preview = "";
    try {
      preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    } catch {
      setPreviewUrl(null);
    }

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

  // ── Camera / Gallery openers ─────────────────────────────
  // Camera: uses capture="environment" (works on iOS + older Android)
  // If that fails (Android 14/15 + Telegram WebView), falls back to
  // a plain <input type="file"> which shows camera in the chooser.
  const openCamera = () => {
    // Try the capture input first; on Android 14/15 in Telegram
    // WebView this may still open photos, so we also have the
    // plain input as a fallback the user can try.
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
      cameraInputRef.current.click();
    }
  };

  // "Choose Photo" — uses the android/allowCamera trick to show
  // both Camera and Gallery options on Android 14/15 Chrome.
  const openGallery = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
      galleryInputRef.current.click();
    }
  };

  // Plain file input — no accept filter, guaranteed to show camera
  // option on all Android versions as a last resort.
  const openPlainPicker = () => {
    if (plainInputRef.current) {
      plainInputRef.current.value = "";
      plainInputRef.current.click();
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setErrorMsg(null);
    setPreviewUrl(null);
    setLoading(false);
    setSaved(false);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (plainInputRef.current) plainInputRef.current.value = "";
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
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
        level === "high"
          ? "#16a34a"
          : level === "medium"
          ? "#ca8a04"
          : "#dc2626",
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

  // ── Hidden file inputs ───────────────────────────────────
  // 1. Camera input: capture="environment" — opens camera on iOS
  //    and older Android. On Android 14/15 Telegram WebView it may
  //    still open the photo picker (known platform bug).
  // 2. Gallery input: uses "image/*,android/allowCamera" trick —
  //    on Android 14/15 Chrome this restores the Camera option in
  //    the chooser dialog alongside the gallery.
  // 3. Plain input: no accept filter at all — guaranteed to show
  //    camera option on every Android version as a last resort.
  const hiddenInputs = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,android/allowCamera"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
      <input
        ref={plainInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
    </>
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
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
        >
          <h3 style={{ margin: 0, flex: 1 }}>{wine.wine}</h3>
          <span style={s.badge(wine.confidence)}>{wine.confidence}</span>
        </div>
        <p style={{ margin: "4px 0", opacity: 0.8 }}>
          {wine.type} &middot; {wine.vintage}
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
          {wine.drinkWindow.from} &ndash; {wine.drinkWindow.to}
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
        <p style={{ margin: 0, lineHeight: 1.6 }}>{wine.recommendation}</p>
      </div>

      <button
        style={s.actionBtn(isSaved ? "#16a34a" : "#b45309")}
        onClick={onSave}
        disabled={isSaved}
      >
        {isSaved ? "\u2713 Saved to Cellar" : "\uD83C\uDF77 Save to My Cellar"}
      </button>
    </>
  );

  // ── SCAN VIEW ────────────────────────────────────────────
  if (view === "scan") {
    return (
      <div style={s.container}>
        {hiddenInputs}
        <button
          style={s.back}
          onClick={() => {
            resetScan();
            setView("home");
          }}
        >
          &larr; Back
        </button>
        <h2>Scan Bottle</h2>

        {previewUrl && (
          <img src={previewUrl} alt="Wine label" style={s.preview} />
        )}

        {loading && (
          <div style={s.card}>
            <p style={{ margin: 0, textAlign: "center" }}>
              Analyzing wine label...
            </p>
            <p
              style={{
                margin: "8px 0 0",
                textAlign: "center",
                opacity: 0.6,
                fontSize: 13,
              }}
            >
              Our AI sommelier is studying the label
            </p>
          </div>
        )}

        {errorMsg && (
          <div style={s.card}>
            <p style={{ margin: 0, color: "#f87171" }}>{errorMsg}</p>
            <button
              style={s.actionBtn("#7c3aed")}
              onClick={() => {
                resetScan();
              }}
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
              onClick={() => {
                resetScan();
              }}
            >
              Scan Another Bottle
            </button>
          </>
        )}

        {!loading && !scanResult && !errorMsg && (
          <div style={s.card}>
            <p
              style={{
                margin: "0 0 16px",
                textAlign: "center",
                opacity: 0.7,
              }}
            >
              Take a photo of a wine label or choose from your gallery
            </p>
            <button
              style={{
                ...s.actionBtn("#7c3aed"),
                marginBottom: 8,
              }}
              onClick={openCamera}
            >
              Take Photo (iOS)
            </button>
            <button
              style={{
                ...s.actionBtn("#6d28d9"),
                marginBottom: 8,
              }}
              onClick={openGallery}
            >
              Take Photo or Choose from Gallery
            </button>
            <button style={s.actionBtn("#581c87")} onClick={openPlainPicker}>
              Open File Picker (Camera Fallback)
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── TYPE WINE VIEW ───────────────────────────────────────
  if (view === "type") {
    return (
      <div style={s.container}>
        {hiddenInputs}
        <button
          style={s.back}
          onClick={() => {
            setView("home");
            setLookupResult(null);
            setErrorMsg(null);
            setLookupSaved(false);
          }}
        >
          &larr; Back
        </button>
        <h2>Type Wine</h2>

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
            {loading ? "Looking up..." : "Look Up Wine"}
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
        {hiddenInputs}
        <button style={s.back} onClick={() => setView("home")}>
          &larr; Back
        </button>
        <h2>My Cellar</h2>

        {cellarLoading && (
          <p style={{ textAlign: "center", opacity: 0.6 }}>
            Loading your cellar...
          </p>
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
              ? "Too early"
              : now > entry.drinkWindow.to
              ? "Past peak"
              : "Ready to drink";
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
                    {entry.type} &middot; {entry.vintage} &middot;{" "}
                    {entry.region}
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
                  Drink: {entry.drinkWindow.from}&ndash;
                  {entry.drinkWindow.to}
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
      {hiddenInputs}
      <div style={s.header}>
        <p style={{ fontSize: 48, margin: "0 0 8px" }}>&#127863;</p>
        <h1 style={s.title}>Wine Aging Assistant</h1>
        <p style={s.subtitle}>
          Scan a label &middot; Look up a vintage &middot; Track your cellar
        </p>
      </div>

      <button
        style={{ ...s.btn, background: "#7c3aed" }}
        onClick={() => setView("scan")}
      >
        Scan Bottle
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
        Type Wine
      </button>

      <button
        style={{ ...s.btn, background: "#b45309" }}
        onClick={() => {
          fetchCellar();
          setView("cellar");
        }}
      >
        My Cellar
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

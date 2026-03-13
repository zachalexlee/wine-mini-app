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
    // localStorage not available
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
  const tg = getTelegramWebApp();
  try {
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser && tgUser.id) return String(tgUser.id);
  } catch {
    // ignore
  }
  let id = safeGetItem("wine_user_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).slice(2, 10);
    safeSetItem("wine_user_id", id);
  }
  return id || "anonymous";
}

// ── Component ────────────────────────────────────────────────
export default function Home() {
  type View = "home" | "scan" | "type" | "cellar" | "cellar-detail";

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
  const [selectedWine, setSelectedWine] = useState<CellarEntry | null>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Gallery file input ref
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Notify Telegram that the Mini App is ready
  useEffect(() => {
    try {
      const tg = getTelegramWebApp();
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch {
      // not inside Telegram
    }
  }, []);

  // Clean up camera stream when leaving scan view
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ── Camera functions ────────────────────────────────────────
  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setCameraError(
          "Camera permission denied. Please allow camera access in your browser/Telegram settings and try again."
        );
      } else if (msg.includes("NotFoundError")) {
        setCameraError(
          "No camera found on this device."
        );
      } else {
        setCameraError(
          `Could not access camera: ${msg}. Try using "Upload from Gallery" instead.`
        );
      }
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Stop camera immediately after capture
    stopCamera();

    // Get base64 image
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewUrl(dataUrl);

    // Send to scan API
    sendImageToScan(dataUrl);
  };

  // ── Scan from base64 ───────────────────────────────────────
  const sendImageToScan = async (base64: string) => {
    setLoading(true);
    setErrorMsg(null);
    setScanResult(null);
    setSaved(false);

    try {
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

  // ── File upload handler (gallery) ──────────────────────────
  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    setLoading(true);
    setErrorMsg(null);
    setScanResult(null);
    setSaved(false);

    try {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    } catch {
      setPreviewUrl(null);
    }

    try {
      const base64 = await fileToBase64(file);
      await sendImageToScan(base64);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Failed to read file: ${message}`);
      setLoading(false);
    }
  };

  // ── Gallery opener ─────────────────────────────────────────
  const openGallery = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
      galleryInputRef.current.click();
    }
  };

  // ── Cellar fetch ────────────────────────────────────────────
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

  // ── Save to cellar ─────────────────────────────────────────
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

  // ── Delete from cellar ─────────────────────────────────────
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

  // ── Manual lookup handler ──────────────────────────────────
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

  const resetScan = () => {
    stopCamera();
    setScanResult(null);
    setErrorMsg(null);
    setPreviewUrl(null);
    setLoading(false);
    setSaved(false);
    setCameraError(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  // ── Styles ──────────────────────────────────────────────────
  const s = {
    container: {
      maxWidth: 420,
      margin: "0 auto",
      padding: "24px 16px",
      minHeight: "100vh",
      background:
        "linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 50%, #4a1942 100%)",
      color: "#f5f0eb",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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

  // ── Hidden gallery input ────────────────────────────────────
  const hiddenInputs = (
    <input
      ref={galleryInputRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={handleFileSelected}
    />
  );

  // ── Wine Result Card (reused in scan + lookup) ──────────────
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
        {isSaved ? "Saved to Cellar" : "Save to My Cellar"}
      </button>
    </>
  );

  // ── SCAN VIEW ───────────────────────────────────────────────
  if (view === "scan") {
    return (
      <div style={s.container}>
        {hiddenInputs}
        {/* Hidden canvas for capturing snapshots */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

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

        {/* Live camera viewfinder */}
        {cameraActive && (
          <div style={{ position: "relative", marginBottom: 16 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                borderRadius: 12,
                background: "#000",
                maxHeight: 350,
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                padding: "16px 0",
                background:
                  "linear-gradient(transparent, rgba(0,0,0,0.7))",
                borderRadius: "0 0 12px 12px",
              }}
            >
              <button
                onClick={snapPhoto}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: "4px solid #fff",
                  background: "rgba(124,58,237,0.8)",
                  cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                }}
                title="Capture"
              />
            </div>
            <button
              onClick={stopCamera}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Camera error message */}
        {cameraError && (
          <div
            style={{
              ...s.card,
              borderColor: "rgba(248,113,113,0.3)",
              border: "1px solid rgba(248,113,113,0.3)",
            }}
          >
            <p style={{ margin: 0, color: "#f87171", fontSize: 14 }}>
              {cameraError}
            </p>
            <p
              style={{
                margin: "8px 0 0",
                opacity: 0.7,
                fontSize: 13,
              }}
            >
              You can still use &quot;Upload from Gallery&quot; below to
              select a photo of the wine label.
            </p>
          </div>
        )}

        {/* Preview of captured/uploaded image */}
        {previewUrl && !cameraActive && (
          <img src={previewUrl} alt="Wine label" style={s.preview} />
        )}

        {/* Loading state */}
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

        {/* Error state */}
        {errorMsg && (
          <div style={s.card}>
            <p style={{ margin: 0, color: "#f87171" }}>{errorMsg}</p>
            <button style={s.actionBtn("#7c3aed")} onClick={resetScan}>
              Try Again
            </button>
          </div>
        )}

        {/* Scan result */}
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
            <button style={s.actionBtn("#7c3aed")} onClick={resetScan}>
              Scan Another Bottle
            </button>
          </>
        )}

        {/* Initial state — show camera + gallery buttons */}
        {!loading && !scanResult && !errorMsg && !cameraActive && (
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
              onClick={startCamera}
            >
              Open Camera
            </button>
            <button style={s.actionBtn("#6d28d9")} onClick={openGallery}>
              Upload from Gallery
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── TYPE WINE VIEW ──────────────────────────────────────────
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

  // ── CELLAR DETAIL VIEW ──────────────────────────────────────
  if (view === "cellar-detail" && selectedWine) {
    const now = new Date().getFullYear();
    const status =
      now < selectedWine.drinkWindow.from
        ? "Too early"
        : now > selectedWine.drinkWindow.to
        ? "Past peak"
        : "Ready to drink";
    const statusColor =
      now < selectedWine.drinkWindow.from
        ? "#ca8a04"
        : now > selectedWine.drinkWindow.to
        ? "#dc2626"
        : "#16a34a";

    return (
      <div style={s.container}>
        {hiddenInputs}
        <button
          style={s.back}
          onClick={() => {
            setSelectedWine(null);
            setView("cellar");
          }}
        >
          &larr; Back to Cellar
        </button>

        {/* Full wine detail card */}
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
              color: statusColor,
            }}
          >
            {status}
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

        <p
          style={{
            fontSize: 12,
            opacity: 0.4,
            textAlign: "center",
            marginTop: 16,
          }}
        >
          Saved on{" "}
          {new Date(selectedWine.savedAt).toLocaleDateString()}
        </p>

        <button
          style={s.actionBtn("#dc2626")}
          onClick={async () => {
            await deleteWine(selectedWine.id);
            setSelectedWine(null);
            fetchCellar();
            setView("cellar");
          }}
        >
          Remove from Cellar
        </button>
      </div>
    );
  }

  // ── CELLAR VIEW ─────────────────────────────────────────────
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
            <div
              key={entry.id}
              style={{ ...s.cellarItem, cursor: "pointer" }}
              onClick={() => {
                setSelectedWine(entry);
                setView("cellar-detail");
              }}
            >
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

  // ── HOME VIEW ───────────────────────────────────────────────
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

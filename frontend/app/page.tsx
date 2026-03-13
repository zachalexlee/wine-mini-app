"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────
interface ScanResult {
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

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe: Record<string, unknown>;
        themeParams: Record<string, string>;
      };
    };
  }
}

// ── API base URL ─────────────────────────────────────────────
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://wine-mini-app.vercel.app";

// ── Helper: convert File to base64 ──────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Component ────────────────────────────────────────────────
export default function Home() {
  const [view, setView] = useState<"home" | "scan" | "type" | "cellar">(
    "home"
  );
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify Telegram that the Mini App is ready
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

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

    // Show preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const base64 = await fileToBase64(file);

      const res = await fetch(`${API_BASE}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data: ScanResult = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setScanResult(data);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Failed to analyze: ${message}`);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Styles ───────────────────────────────────────────────
  const styles = {
    container: {
      maxWidth: 420,
      margin: "0 auto",
      padding: "24px 16px",
      minHeight: "100vh",
      background:
        "linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 50%, #4a1942 100%)",
      color: "#f5f0eb",
    } as React.CSSProperties,
    header: {
      textAlign: "center" as const,
      marginBottom: 32,
    },
    title: {
      fontSize: 26,
      fontWeight: 700,
      margin: "0 0 4px",
    },
    subtitle: {
      fontSize: 14,
      opacity: 0.7,
      margin: 0,
    },
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
    btnScan: { background: "#7c3aed" },
    btnType: { background: "#be185d" },
    btnCellar: { background: "#b45309" },
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
    confidenceBadge: (level: string) => ({
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
    scanBtnGroup: {
      display: "flex",
      gap: 10,
      marginTop: 8,
    },
    scanBtn: {
      flex: 1,
      padding: "14px 12px",
      border: "none",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      color: "#fff",
      textAlign: "center" as const,
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

  // ── Scan View ────────────────────────────────────────────
  if (view === "scan") {
    return (
      <div style={styles.container}>
        {hiddenInput}
        <button
          style={styles.back}
          onClick={() => {
            resetScan();
            setView("home");
          }}
        >
          ← Back
        </button>
        <h2>📸 Scan Bottle</h2>

        {previewUrl && (
          <img src={previewUrl} alt="Wine label" style={styles.preview} />
        )}

        {loading && (
          <div style={styles.card}>
            <p style={{ margin: 0, textAlign: "center" }}>
              🔍 Analyzing wine label...
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
          <div style={styles.card}>
            <p style={{ margin: 0, color: "#f87171" }}>{errorMsg}</p>
            <button
              style={{
                ...styles.scanBtn,
                background: "#7c3aed",
                marginTop: 12,
              }}
              onClick={() => {
                resetScan();
                openCamera();
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {scanResult && (
          <>
            <div style={styles.card}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0, flex: 1 }}>{scanResult.wine}</h3>
                <span
                  style={styles.confidenceBadge(scanResult.confidence)}
                >
                  {scanResult.confidence}
                </span>
              </div>
              <p style={{ margin: "4px 0", opacity: 0.8 }}>
                {scanResult.type} · {scanResult.vintage}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Region:</strong> {scanResult.region}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Grape:</strong> {scanResult.grape}
              </p>
            </div>

            <div style={styles.drinkWindow}>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 13,
                  opacity: 0.7,
                }}
              >
                OPTIMAL DRINKING WINDOW
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {scanResult.drinkWindow.from} – {scanResult.drinkWindow.to}
              </p>
            </div>

            <div style={styles.card}>
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
                {scanResult.recommendation}
              </p>
            </div>

            <button
              style={{
                ...styles.scanBtn,
                background: "#7c3aed",
                marginTop: 16,
                width: "100%",
              }}
              onClick={() => {
                resetScan();
                openCamera();
              }}
            >
              Scan Another Bottle
            </button>
          </>
        )}

        {!loading && !scanResult && !errorMsg && (
          <div style={styles.card}>
            <p
              style={{
                margin: "0 0 16px",
                textAlign: "center",
                opacity: 0.7,
              }}
            >
              Take a photo of a wine label or choose from your gallery
            </p>
            <div style={styles.scanBtnGroup}>
              <button
                style={{ ...styles.scanBtn, background: "#7c3aed" }}
                onClick={openCamera}
              >
                📷 Camera
              </button>
              <button
                style={{ ...styles.scanBtn, background: "#6d28d9" }}
                onClick={openGallery}
              >
                🖼️ Gallery
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Type Wine View ───────────────────────────────────────
  if (view === "type") {
    return (
      <div style={styles.container}>
        {hiddenInput}
        <button style={styles.back} onClick={() => setView("home")}>
          ← Back
        </button>
        <h2>✏️ Type Wine</h2>
        <div style={styles.card}>
          <p style={{ margin: 0, opacity: 0.7 }}>
            Manual wine entry coming soon. You will be able to type a wine
            name and vintage to look up its ideal drinking window.
          </p>
        </div>
      </div>
    );
  }

  // ── Cellar View ──────────────────────────────────────────
  if (view === "cellar") {
    return (
      <div style={styles.container}>
        {hiddenInput}
        <button style={styles.back} onClick={() => setView("home")}>
          ← Back
        </button>
        <h2>🍷 My Cellar</h2>
        <div style={styles.card}>
          <p style={{ margin: 0, opacity: 0.7 }}>
            Your cellar is empty for now. Scanned and saved wines will
            appear here once the feature is implemented.
          </p>
        </div>
      </div>
    );
  }

  // ── Home View ────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {hiddenInput}
      <div style={styles.header}>
        <p style={{ fontSize: 48, margin: "0 0 8px" }}>🍷</p>
        <h1 style={styles.title}>Wine Aging Assistant</h1>
        <p style={styles.subtitle}>
          Scan a label · Look up a vintage · Track your cellar
        </p>
      </div>

      <button
        style={{ ...styles.btn, ...styles.btnScan }}
        onClick={() => setView("scan")}
      >
        📸&nbsp; Scan Bottle
      </button>

      <button
        style={{ ...styles.btn, ...styles.btnType }}
        onClick={() => setView("type")}
      >
        ✏️&nbsp; Type Wine
      </button>

      <button
        style={{ ...styles.btn, ...styles.btnCellar }}
        onClick={() => setView("cellar")}
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

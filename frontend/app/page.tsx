"use client";

import { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────
interface ScanResult {
  wine: string;
  vintage: number;
  region: string;
  grape: string;
  drinkWindow: { from: number; to: number };
  recommendation: string;
}

// Extend window for Telegram WebApp SDK
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

// ── Component ────────────────────────────────────────────────
export default function Home() {
  const [view, setView] = useState<
    "home" | "scan" | "type" | "cellar"
  >("home");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Notify Telegram that the Mini App is ready
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────
  const handleScan = async () => {
    setView("scan");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "placeholder" }),
      });
      const data: ScanResult = await res.json();
      setScanResult(data);
    } catch {
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ───────────────────────────────────────────────
  const styles = {
    container: {
      maxWidth: 420,
      margin: "0 auto",
      padding: "24px 16px",
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 50%, #4a1942 100%)",
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
  };

  // ── Views ────────────────────────────────────────────────
  if (view === "scan") {
    return (
      <div style={styles.container}>
        <button style={styles.back} onClick={() => setView("home")}>
          ← Back
        </button>
        <h2>📸 Scan Bottle</h2>
        {loading && <p>Analyzing label…</p>}
        {scanResult && (
          <div style={styles.card}>
            <h3 style={{ margin: "0 0 8px" }}>{scanResult.wine}</h3>
            <p style={{ margin: "4px 0" }}>
              <strong>Vintage:</strong> {scanResult.vintage}
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>Region:</strong> {scanResult.region}
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>Grape:</strong> {scanResult.grape}
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>Drink window:</strong> {scanResult.drinkWindow.from} –{" "}
              {scanResult.drinkWindow.to}
            </p>
            <p style={{ margin: "12px 0 0", opacity: 0.85, lineHeight: 1.5 }}>
              {scanResult.recommendation}
            </p>
          </div>
        )}
        {!loading && !scanResult && (
          <p style={{ opacity: 0.6 }}>
            No result yet. The scan endpoint returned an error.
          </p>
        )}
      </div>
    );
  }

  if (view === "type") {
    return (
      <div style={styles.container}>
        <button style={styles.back} onClick={() => setView("home")}>
          ← Back
        </button>
        <h2>✏️ Type Wine</h2>
        <div style={styles.card}>
          <p style={{ margin: 0, opacity: 0.7 }}>
            Manual wine entry coming soon. You will be able to type a wine name
            and vintage to look up its ideal drinking window.
          </p>
        </div>
      </div>
    );
  }

  if (view === "cellar") {
    return (
      <div style={styles.container}>
        <button style={styles.back} onClick={() => setView("home")}>
          ← Back
        </button>
        <h2>🍷 My Cellar</h2>
        <div style={styles.card}>
          <p style={{ margin: 0, opacity: 0.7 }}>
            Your cellar is empty for now. Scanned and saved wines will appear
            here once the feature is implemented.
          </p>
        </div>
      </div>
    );
  }

  // ── Home ─────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <p style={{ fontSize: 48, margin: "0 0 8px" }}>🍷</p>
        <h1 style={styles.title}>Wine Aging Assistant</h1>
        <p style={styles.subtitle}>
          Scan a label · Look up a vintage · Track your cellar
        </p>
      </div>

      <button
        style={{ ...styles.btn, ...styles.btnScan }}
        onClick={handleScan}
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

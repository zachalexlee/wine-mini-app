// ─────────────────────────────────────────────────────────────
// Shared types, helpers, and styles
// ─────────────────────────────────────────────────────────────

import React from "react";

// ── Types ────────────────────────────────────────────────────
export interface TastingNotes {
  aroma: string;
  palate: string;
  finish: string;
}

export interface ServingInfo {
  temperature: string;
  decanting: string;
  glassware: string;
}

export interface WineData {
  wine: string;
  winery: string;
  vintage: number;
  region: string;
  grape: string;
  type: string;
  drinkWindow: { from: number; to: number };
  recommendation: string;
  confidence: string;
  notes?: string;
  error?: string;
  // Expanded detail fields
  tasting?: TastingNotes;
  pairing?: string;
  serving?: ServingInfo;
  agingPotential?: string;
}

export interface CellarEntry extends WineData {
  id: string;
  savedAt: string;
  status?: string;
  consumedAt?: string;
}

// ── Telegram WebApp ──────────────────────────────────────────
export function getTelegramWebApp(): any {
  try {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      return (window as any).Telegram.WebApp;
    }
  } catch {
    // ignore
  }
  return null;
}

export function haptic(type: "light" | "medium" | "heavy" = "light") {
  try {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(type);
    }
  } catch {
    // ignore
  }
}

export function hapticNotification(
  type: "success" | "warning" | "error" = "success"
) {
  try {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred(type);
    }
  } catch {
    // ignore
  }
}

// ── Safe localStorage ────────────────────────────────────────
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not available
  }
}

// ── API base ─────────────────────────────────────────────────
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://wine-mini-app.vercel.app";

// ── User ID (legacy fallback — prefer useAuth().userId) ─────
export function getUserId(): string {
  const tg = getTelegramWebApp();
  try {
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser?.id) return String(tgUser.id);
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

// ── File to base64 ───────────────────────────────────────────
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Drink status helper ─────────────────────────────────────
export function getDrinkStatus(from: number, to: number) {
  const now = new Date().getFullYear();
  if (now < from) return { label: "Too early", color: "#ca8a04" };
  if (now > to) return { label: "Past peak", color: "#dc2626" };
  return { label: "Ready to drink", color: "#16a34a" };
}

// ── Shared styles ────────────────────────────────────────────
export const s = {
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
  } as React.CSSProperties,
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
  actionBtn: (bg: string) =>
    ({
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
    } as React.CSSProperties),
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
  } as React.CSSProperties,
  cellarItem: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  // Styles for detail sections
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.5,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
  } as React.CSSProperties,
  sectionContent: {
    margin: 0,
    lineHeight: 1.6,
    fontSize: 14,
  } as React.CSSProperties,
};

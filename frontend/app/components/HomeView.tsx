"use client";

import { s, haptic } from "./shared";
import { useAuth } from "./AuthProvider";

interface HomeViewProps {
  onNavigate: (view: string) => void;
}

export default function HomeView({ onNavigate }: HomeViewProps) {
  const { displayName, isTelegram, signOut } = useAuth();

  return (
    <div style={s.container}>
      <div style={s.header}>
        <p style={{ fontSize: 48, margin: "0 0 8px" }}>&#127863;</p>
        <h1 style={s.title}>Wine Aging Assistant</h1>
        <p style={s.subtitle}>
          Scan a label &middot; Look up a vintage &middot; Track your cellar
        </p>
        {displayName && (
          <p
            style={{
              fontSize: 13,
              opacity: 0.6,
              margin: "8px 0 0",
            }}
          >
            Welcome, {displayName}
          </p>
        )}
      </div>

      <button
        style={{ ...s.btn, background: "#7c3aed" }}
        onClick={() => {
          haptic("light");
          onNavigate("scan");
        }}
      >
        Scan Bottle
      </button>

      <button
        style={{ ...s.btn, background: "#be185d" }}
        onClick={() => {
          haptic("light");
          onNavigate("type");
        }}
      >
        Type Wine
      </button>

      <button
        style={{ ...s.btn, background: "#b45309" }}
        onClick={() => {
          haptic("light");
          onNavigate("cellar");
        }}
      >
        My Cellar
      </button>

      {!isTelegram && (
        <button
          style={{
            display: "block",
            width: "100%",
            marginTop: 16,
            padding: "12px 20px",
            background: "none",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12,
            color: "#f5f0eb",
            opacity: 0.6,
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={() => {
            haptic("light");
            signOut();
          }}
        >
          Sign Out
        </button>
      )}

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

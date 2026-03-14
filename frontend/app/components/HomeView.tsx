"use client";

import { s, haptic } from "./shared";

interface HomeViewProps {
  onNavigate: (view: string) => void;
}

export default function HomeView({ onNavigate }: HomeViewProps) {
  return (
    <div style={s.container}>
      <div style={s.header}>
        <p style={{ fontSize: 48, margin: "0 0 8px" }}>&#127863;</p>
        <h1 style={s.title}>Wine Aging Assistant</h1>
        <p style={s.subtitle}>
          Scan a label &middot; Look up a vintage &middot; Track your cellar
        </p>
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

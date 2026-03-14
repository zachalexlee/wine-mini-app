"use client";

import { WineData, s, haptic, getDrinkStatus } from "./shared";

interface WineCardProps {
  wine: WineData;
  onSave: () => void;
  isSaved: boolean;
}

export default function WineCard({ wine, onSave, isSaved }: WineCardProps) {
  const status = getDrinkStatus(wine.drinkWindow.from, wine.drinkWindow.to);

  return (
    <>
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
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
        <p style={{ margin: 0, lineHeight: 1.6 }}>{wine.recommendation}</p>
      </div>

      <button
        style={s.actionBtn(isSaved ? "#16a34a" : "#b45309")}
        onClick={() => {
          haptic("medium");
          onSave();
        }}
        disabled={isSaved}
      >
        {isSaved ? "Saved to Cellar" : "Save to My Cellar"}
      </button>
    </>
  );
}

"use client";

import { WineData, s, haptic, getDrinkStatus } from "./shared";

interface WineCardProps {
  wine: WineData;
  onSave: () => void;
  isSaved: boolean;
}

export default function WineCard({ wine, onSave, isSaved }: WineCardProps) {
  const hasDrinkWindow = wine.drinkWindow?.from && wine.drinkWindow?.to;
  const status = hasDrinkWindow
    ? getDrinkStatus(wine.drinkWindow.from, wine.drinkWindow.to)
    : null;

  return (
    <>
      {/* Basic info */}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{wine.wine}</h3>
          <span style={s.badge(wine.confidence)}>{wine.confidence}</span>
        </div>
        <p style={{ margin: "4px 0", opacity: 0.8 }}>
          {wine.type}
          {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
        </p>
        {wine.winery && (
          <p style={{ margin: "4px 0" }}>
            <strong>Winery:</strong> {wine.winery}
          </p>
        )}
        <p style={{ margin: "4px 0" }}>
          <strong>Region:</strong> {wine.region}
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Grape:</strong> {wine.grape}
        </p>
      </div>

      {/* Drink window */}
      {hasDrinkWindow ? (
        <div style={s.drinkWindow}>
          <p style={{ margin: "0 0 4px", fontSize: 13, opacity: 0.7 }}>
            OPTIMAL DRINKING WINDOW
          </p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            {wine.drinkWindow.from} &ndash; {wine.drinkWindow.to}
          </p>
          {status && (
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
          )}
        </div>
      ) : (
        <div style={s.drinkWindow}>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
            No drinking window available
          </p>
        </div>
      )}

      {/* Tasting notes */}
      {wine.tasting && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Tasting Notes</p>

          {wine.tasting.aroma && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                Aroma / Nose
              </p>
              <p style={s.sectionContent}>{wine.tasting.aroma}</p>
            </div>
          )}

          {wine.tasting.palate && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                Palate
              </p>
              <p style={s.sectionContent}>{wine.tasting.palate}</p>
            </div>
          )}

          {wine.tasting.finish && (
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                Finish
              </p>
              <p style={s.sectionContent}>{wine.tasting.finish}</p>
            </div>
          )}
        </div>
      )}

      {/* Food pairings */}
      {wine.pairing && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Food Pairings</p>
          <p style={s.sectionContent}>{wine.pairing}</p>
        </div>
      )}

      {/* Serving recommendations */}
      {wine.serving && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Serving</p>
          <div style={{ display: "grid", gap: 10 }}>
            {wine.serving.temperature && (
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                  Temperature
                </p>
                <p style={s.sectionContent}>{wine.serving.temperature}</p>
              </div>
            )}
            {wine.serving.decanting && (
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                  Decanting
                </p>
                <p style={s.sectionContent}>{wine.serving.decanting}</p>
              </div>
            )}
            {wine.serving.glassware && (
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#c4b5fd" }}>
                  Glassware
                </p>
                <p style={s.sectionContent}>{wine.serving.glassware}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aging potential */}
      {wine.agingPotential && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Aging Potential</p>
          <p style={s.sectionContent}>{wine.agingPotential}</p>
        </div>
      )}

      {/* Overall recommendation */}
      {wine.recommendation && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Sommelier Recommendation</p>
          <p style={s.sectionContent}>{wine.recommendation}</p>
        </div>
      )}

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

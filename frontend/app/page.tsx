"use client";

import { useEffect, useState } from "react";
import { getTelegramWebApp } from "./components/shared";
import HomeView from "./components/HomeView";
import ScanView from "./components/ScanView";
import TypeWineView from "./components/TypeWineView";
import CellarView from "./components/CellarView";

export default function Home() {
  const [view, setView] = useState("home");

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

  switch (view) {
    case "scan":
      return <ScanView onBack={() => setView("home")} />;
    case "type":
      return <TypeWineView onBack={() => setView("home")} />;
    case "cellar":
      return <CellarView onBack={() => setView("home")} />;
    default:
      return <HomeView onNavigate={setView} />;
  }
}

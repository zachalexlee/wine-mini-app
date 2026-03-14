"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getTelegramWebApp, s, haptic } from "./shared";

interface AuthState {
  userId: string;
  displayName: string;
  isLoggedIn: boolean;
  isTelegram: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  userId: "",
  displayName: "",
  isLoggedIn: false,
  isTelegram: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check if inside Telegram
    const tg = getTelegramWebApp();
    try {
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser?.id) {
        setUserId(String(tgUser.id));
        setDisplayName(
          tgUser.first_name
            ? `${tgUser.first_name}${tgUser.last_name ? " " + tgUser.last_name : ""}`
            : "Telegram User"
        );
        setIsLoggedIn(true);
        setIsTelegram(true);
        setLoading(false);
        return;
      }
    } catch {
      // not in Telegram
    }

    // 2. Check Supabase session (browser)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(`google_${session.user.id}`);
        setDisplayName(
          session.user.user_metadata?.full_name ||
            session.user.email ||
            "User"
        );
        setIsLoggedIn(true);
      }
      setLoading(false);
    });

    // Listen for auth state changes (e.g., after OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(`google_${session.user.id}`);
        setDisplayName(
          session.user.user_metadata?.full_name ||
            session.user.email ||
            "User"
        );
        setIsLoggedIn(true);
      } else {
        setUserId("");
        setDisplayName("");
        setIsLoggedIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserId("");
    setDisplayName("");
    setIsLoggedIn(false);
  };

  if (loading) {
    return (
      <div style={{ ...s.container, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 18, opacity: 0.7 }}>Loading...</p>
      </div>
    );
  }

  // If not logged in and not in Telegram, show login screen
  if (!isLoggedIn && !isTelegram) {
    return <LoginScreen />;
  }

  return (
    <AuthContext.Provider
      value={{ userId, displayName, isLoggedIn, isTelegram, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Login Screen ────────────────────────────────────────────
function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    haptic("light");
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
      // If successful, the page will redirect to Google
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={{ ...s.header, marginTop: 60 }}>
        <p style={{ fontSize: 64, margin: "0 0 16px" }}>&#127863;</p>
        <h1 style={{ ...s.title, fontSize: 30 }}>Wine Aging Assistant</h1>
        <p style={{ ...s.subtitle, marginTop: 8 }}>
          Scan labels &middot; Track your cellar &middot; Know when to drink
        </p>
      </div>

      <div style={{ ...s.card, marginTop: 40, textAlign: "center" as const }}>
        <p style={{ fontSize: 15, opacity: 0.8, margin: "0 0 20px" }}>
          Sign in to save your wine collection
        </p>

        <button
          style={{
            ...s.actionBtn("#fff"),
            color: "#333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: loading ? 0.6 : 1,
          }}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

        {error && (
          <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>

      <div
        style={{
          textAlign: "center" as const,
          marginTop: 24,
          padding: "16px 20px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
        }}
      >
        <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>
          Open this app inside{" "}
          <strong style={{ color: "#7c3aed" }}>Telegram</strong> for instant
          access &mdash; no login required!
        </p>
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: 12,
          opacity: 0.3,
          marginTop: 40,
        }}
      >
        Powered by Telegram Mini Apps
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Wine Aging Assistant",
  description: "Telegram Mini App — scan bottles, track your cellar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Telegram WebApp JS SDK */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

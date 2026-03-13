// ─────────────────────────────────────────────────────────────
// Wine Aging Assistant — Backend
// Node.js + Express server
// ─────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());

// ── Telegram Bot Setup ───────────────────────────────────────
// In production, set BOT_TOKEN via environment variable.
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const WEBAPP_URL =
  process.env.WEBAPP_URL || "https://wine-mini-app.vercel.app";

// Create bot instance (webhook mode — polling disabled)
const bot = new TelegramBot(BOT_TOKEN);

// ── POST /telegram/webhook ───────────────────────────────────
// Telegram sends updates to this endpoint.
app.post("/telegram/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ── /start command handler ───────────────────────────────────
// Sends a welcome message with an inline keyboard that opens
// the Mini App inside Telegram.
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "🍷 Welcome to the *Wine Aging Assistant*!\n\n" +
      "Scan a bottle label or browse your cellar — all inside Telegram.",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Wine Assistant 🍇",
              web_app: { url: WEBAPP_URL },
            },
          ],
        ],
      },
    }
  );
});

// ── POST /api/scan ───────────────────────────────────────────
// Mock endpoint — returns a dummy wine analysis result.
// In the future this will accept an image and run label
// recognition via an ML model or third-party API.
app.post("/api/scan", (req, res) => {
  // Placeholder: ignore incoming body for now
  const mockResult = {
    wine: "Château Margaux",
    vintage: 2015,
    region: "Margaux, Bordeaux, France",
    grape: "Cabernet Sauvignon blend",
    drinkWindow: {
      from: 2025,
      to: 2045,
    },
    recommendation:
      "This wine is entering its optimal drinking window. " +
      "Decant for 1–2 hours before serving at 17 °C.",
  };

  res.json(mockResult);
});

// ── Health check ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "wine-aging-assistant-backend" });
});

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🍷 Wine Aging Assistant backend running on port ${PORT}`);
});

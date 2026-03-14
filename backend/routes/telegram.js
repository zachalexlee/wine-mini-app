// ─────────────────────────────────────────────────────────────
// Routes: /telegram/webhook — Telegram Bot webhook handler
// ─────────────────────────────────────────────────────────────

const { Router } = require("express");
const TelegramBot = require("node-telegram-bot-api");

const router = Router();

const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const WEBAPP_URL =
  process.env.WEBAPP_URL || "https://wine-mini-app.vercel.app";

const bot = new TelegramBot(BOT_TOKEN);

// ── /start command handler ──────────────────────────────────
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

// ── POST /telegram/webhook ──────────────────────────────────
router.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

module.exports = router;

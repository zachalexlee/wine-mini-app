// ─────────────────────────────────────────────────────────────
// Wine Aging Assistant — Backend
// Node.js + Express server with OpenAI Vision wine label scanner
// ─────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" })); // Allow large base64 images

// ── OpenAI Setup ─────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Telegram Bot Setup ───────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const WEBAPP_URL =
  process.env.WEBAPP_URL || "https://wine-mini-app.vercel.app";

const bot = new TelegramBot(BOT_TOKEN);

// ── POST /telegram/webhook ───────────────────────────────────
app.post("/telegram/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ── /start command handler ───────────────────────────────────
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
// Accepts a base64-encoded image of a wine label and uses
// OpenAI Vision (gpt-4.1-mini) to identify the wine and
// estimate its optimal drinking window.
app.post("/api/scan", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        error: "Missing 'image' field. Send a base64-encoded image.",
      });
    }

    // Strip the data URL prefix if present (e.g. "data:image/jpeg;base64,")
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are a world-class sommelier and wine expert. 
You will be shown a photo of a wine bottle label. 
Analyze the label and return ONLY a valid JSON object (no markdown, no code fences) with these fields:

{
  "wine": "Full wine name including producer",
  "vintage": 2020,
  "region": "Region, Sub-region, Country",
  "grape": "Primary grape variety or blend description",
  "type": "Red / White / Rosé / Sparkling / Dessert / Fortified",
  "drinkWindow": {
    "from": 2024,
    "to": 2035
  },
  "recommendation": "A 1-2 sentence recommendation about when and how to enjoy this wine, including serving temperature and decanting advice.",
  "confidence": "high / medium / low"
}

For the drink window, use your expert knowledge of the producer, region, vintage quality, and grape variety to estimate the optimal drinking period.

If you cannot identify the wine from the image, return:
{
  "error": "Could not identify the wine from this image. Please try a clearer photo of the front label.",
  "confidence": "low"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this wine bottle label and provide the wine details with an estimated drinking window.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content.trim();

    // Parse the JSON response from GPT
    let wineData;
    try {
      wineData = JSON.parse(responseText);
    } catch {
      // If GPT returned markdown-wrapped JSON, try to extract it
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        wineData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse wine data from AI response");
      }
    }

    res.json(wineData);
  } catch (err) {
    console.error("Scan error:", err.message);
    res.status(500).json({
      error: "Failed to analyze the wine label. Please try again.",
      details: err.message,
    });
  }
});

// ── Health check ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "wine-aging-assistant-backend" });
});

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🍷 Wine Aging Assistant backend running on 0.0.0.0:${PORT}`);
});

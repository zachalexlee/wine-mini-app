// ─────────────────────────────────────────────────────────────
// Wine Aging Assistant — Backend
// Node.js + Express server with OpenAI Vision wine label scanner,
// manual wine lookup, and in-memory cellar storage.
// ─────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

// ── OpenAI Setup ─────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Telegram Bot Setup ───────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const WEBAPP_URL =
  process.env.WEBAPP_URL || "https://wine-mini-app.vercel.app";

const bot = new TelegramBot(BOT_TOKEN);

// ── Cellar Storage ───────────────────────────────────────────
// Simple file-based storage. Each user (identified by a
// userId string from the frontend) has an array of saved wines.
const CELLAR_FILE = path.join(__dirname, "cellar-data.json");

function loadCellar() {
  try {
    if (fs.existsSync(CELLAR_FILE)) {
      return JSON.parse(fs.readFileSync(CELLAR_FILE, "utf-8"));
    }
  } catch {
    // ignore parse errors, start fresh
  }
  return {};
}

function saveCellar(data) {
  fs.writeFileSync(CELLAR_FILE, JSON.stringify(data, null, 2));
}

let cellarData = loadCellar();

// ── Shared prompt for wine analysis ──────────────────────────
const WINE_SYSTEM_PROMPT = `You are a world-class sommelier and wine expert.
You will analyze wine information and return ONLY a valid JSON object (no markdown, no code fences) with these fields:

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

If you cannot identify the wine, return:
{
  "error": "Could not identify this wine. Please provide more details or try a different photo.",
  "confidence": "low"
}`;

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
// Accepts a base64-encoded image of a wine label.
app.post("/api/scan", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        error: "Missing 'image' field. Send a base64-encoded image.",
      });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            WINE_SYSTEM_PROMPT.replace(
              "You will analyze wine information",
              "You will be shown a photo of a wine bottle label. Analyze the label"
            ),
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
    let wineData;
    try {
      wineData = JSON.parse(responseText);
    } catch {
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

// ── POST /api/lookup ─────────────────────────────────────────
// Manual wine entry — accepts wine name and optional vintage as text.
app.post("/api/lookup", async (req, res) => {
  try {
    const { wineName, vintage } = req.body;

    if (!wineName) {
      return res.status(400).json({
        error: "Missing 'wineName' field.",
      });
    }

    const userMessage = vintage
      ? `Wine: ${wineName}\nVintage: ${vintage}`
      : `Wine: ${wineName}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: WINE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Please provide details and an estimated drinking window for this wine:\n\n${userMessage}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content.trim();
    let wineData;
    try {
      wineData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        wineData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse wine data from AI response");
      }
    }

    res.json(wineData);
  } catch (err) {
    console.error("Lookup error:", err.message);
    res.status(500).json({
      error: "Failed to look up the wine. Please try again.",
      details: err.message,
    });
  }
});

// ── POST /api/cellar ─────────────────────────────────────────
// Save a wine to a user's cellar.
app.post("/api/cellar", (req, res) => {
  try {
    const { userId, wine } = req.body;

    if (!userId || !wine) {
      return res.status(400).json({ error: "Missing userId or wine data." });
    }

    if (!cellarData[userId]) {
      cellarData[userId] = [];
    }

    const entry = {
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
      ...wine,
    };

    cellarData[userId].push(entry);
    saveCellar(cellarData);

    res.json({ success: true, entry });
  } catch (err) {
    console.error("Cellar save error:", err.message);
    res.status(500).json({ error: "Failed to save wine." });
  }
});

// ── GET /api/cellar/:userId ──────────────────────────────────
// Retrieve a user's cellar.
app.get("/api/cellar/:userId", (req, res) => {
  const { userId } = req.params;
  const wines = cellarData[userId] || [];
  res.json({ wines });
});

// ── DELETE /api/cellar/:userId/:wineId ───────────────────────
// Remove a wine from a user's cellar.
app.delete("/api/cellar/:userId/:wineId", (req, res) => {
  const { userId, wineId } = req.params;

  if (!cellarData[userId]) {
    return res.status(404).json({ error: "User cellar not found." });
  }

  cellarData[userId] = cellarData[userId].filter((w) => w.id !== wineId);
  saveCellar(cellarData);

  res.json({ success: true });
});

// ── Health check ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "wine-aging-assistant-backend" });
});

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🍷 Wine Aging Assistant backend running on 0.0.0.0:${PORT}`);
});

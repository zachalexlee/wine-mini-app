// ─────────────────────────────────────────────────────────────
// Shared OpenAI helper — wine analysis prompts and parsing
// ─────────────────────────────────────────────────────────────

const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WINE_SYSTEM_PROMPT = `You are a world-class sommelier and wine expert.
You will analyze wine information and return ONLY a valid JSON object (no markdown, no code fences) with these fields:

{
  "wine": "Full wine name including producer",
  "winery": "Name of the winery / producer / estate (e.g. Château Margaux, Opus One, Penfolds)",
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

function parseWineResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse wine data from AI response");
  }
}

async function analyzeImage(base64Data) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: WINE_SYSTEM_PROMPT.replace(
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

  return parseWineResponse(completion.choices[0].message.content.trim());
}

async function lookupWine(wineName, vintage) {
  const userMessage = vintage
    ? `Wine: ${wineName}\nVintage: ${vintage}`
    : `Wine: ${wineName}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: WINE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Please provide details and an estimated drinking window for this wine:\n\n${userMessage}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  return parseWineResponse(completion.choices[0].message.content.trim());
}

module.exports = { analyzeImage, lookupWine };

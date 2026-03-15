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
  "tasting": {
    "aroma": "Describe the nose/aroma profile — primary, secondary, and tertiary aromas. Be specific with descriptors (e.g. blackcurrant, cedar, vanilla, wet stone).",
    "palate": "Describe the palate — body, tannin structure, acidity, flavor notes, texture.",
    "finish": "Describe the finish — length, lingering flavors, aftertaste."
  },
  "pairing": "3-5 specific food pairing suggestions that complement this wine (e.g. 'Grilled lamb chops with rosemary, aged Comté cheese, dark chocolate truffles').",
  "serving": {
    "temperature": "Ideal serving temperature (e.g. '16-18°C / 61-64°F')",
    "decanting": "Decanting recommendation (e.g. 'Decant 1-2 hours before serving' or 'No decanting needed')",
    "glassware": "Recommended glass type (e.g. 'Bordeaux glass', 'Burgundy glass', 'Flute')"
  },
  "agingPotential": "A brief assessment of how well this wine will age and its trajectory (e.g. 'Excellent aging potential. Currently in its youth, will develop complexity over the next 10-15 years. Peak drinking around 2030-2035.').",
  "recommendation": "A concise 1-2 sentence overall recommendation about when and how to enjoy this wine.",
  "confidence": "high / medium / low"
}

For the drink window, use your expert knowledge of the producer, region, vintage quality, and grape variety to estimate the optimal drinking period.
Be generous with detail in tasting notes — wine enthusiasts want rich, evocative descriptions.

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
            text: "Please analyze this wine bottle label and provide the wine details with an estimated drinking window, full tasting notes, food pairings, serving recommendations, and aging potential.",
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
    max_tokens: 1000,
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
        content: `The user has typed the following. It could be a specific wine name, a winery/producer name, a grape variety, or a region. If it appears to be just a winery or producer name (e.g. "Rickety Bridge", "Opus One", "Château Margaux"), return details for their most iconic or flagship wine. Always do your best to identify and return a result with full tasting notes, food pairings, serving recommendations, and aging potential.\n\n${userMessage}`,
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
  });

  return parseWineResponse(completion.choices[0].message.content.trim());
}

module.exports = { analyzeImage, lookupWine };

#!/usr/bin/env node
"use strict";

// Fills in the English ("en") block of a case study from its Portuguese
// ("pt") block, using the Gemini API. Lets editors write a new case in
// Portuguese only and generate a first-pass English version instead of
// typing every field twice.
//
// Usage:
//   node --env-file=.env scripts/translate-case.js <slug> [<slug> ...]
//   node --env-file=.env scripts/translate-case.js --all
//
// Requires GEMINI_API_KEY (see .env.example). Overwrites the "en" block
// in src/_data/cases/<slug>.json every time it runs for that slug — review
// the diff and adjust by hand (or in the CMS) afterward.

const fs = require("fs");
const path = require("path");
const { GoogleGenAI, Type } = require("@google/genai");

const CASES_DIR = path.join(__dirname, "..", "src", "_data", "cases");
const MODEL = "gemini-3.5-flash-lite";

const EN_CASE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    metaTitle: { type: Type.STRING },
    metaDescription: { type: Type.STRING },
    heroTitleLine1: { type: Type.STRING },
    heroTitleLine2: { type: Type.STRING },
    heroAlt: { type: Type.STRING },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    challengeTag: { type: Type.STRING },
    challengeHeading: { type: Type.STRING },
    challengeDetail: { type: Type.STRING },
    approachTag: { type: Type.STRING },
    approachHeading: { type: Type.STRING },
    approachDetail: { type: Type.STRING },
    cardTitle: { type: Type.STRING },
    cardDesc: { type: Type.STRING },
  },
  required: [
    "metaTitle",
    "metaDescription",
    "heroTitleLine1",
    "heroTitleLine2",
    "heroAlt",
    "tags",
    "challengeTag",
    "challengeHeading",
    "challengeDetail",
    "approachTag",
    "approachHeading",
    "approachDetail",
    "cardTitle",
    "cardDesc",
  ],
};

async function translateCase(ai, slug) {
  const filePath = path.join(CASES_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`no case file at ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data.pt || Object.keys(data.pt).length === 0) {
    throw new Error(`case has no "pt" block to translate from`);
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Translate every value in this JSON object from Portuguese to English. Return only the translated object with the exact same keys.\n\n" +
      JSON.stringify(data.pt, null, 2),
    config: {
      systemInstruction:
        "You translate case-study copy for Melo Creative, a brand agency for health, tech and law businesses, from Brazilian Portuguese into English. Match the source field-by-field: same structure, same meaning, same confident and concise tone. Do not add, drop or embellish content. Keep client/brand/product names unchanged.",
      responseMimeType: "application/json",
      responseSchema: EN_CASE_SCHEMA,
    },
  });

  if (!response.text) {
    throw new Error("model returned no text output");
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (err) {
    throw new Error(`model output was not valid JSON: ${err.message}`);
  }

  data.en = parsed;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`✓ ${slug}: English content written to ${path.relative(process.cwd(), filePath)}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node --env-file=.env scripts/translate-case.js <slug> [<slug> ...]");
    console.error("       node --env-file=.env scripts/translate-case.js --all");
    process.exitCode = 1;
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY. Copy .env.example to .env and add your key (see https://aistudio.google.com/apikey).");
    process.exitCode = 1;
    return;
  }

  const slugs =
    args[0] === "--all"
      ? fs
          .readdirSync(CASES_DIR)
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""))
      : args;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let failures = 0;

  for (const slug of slugs) {
    try {
      await translateCase(ai, slug);
    } catch (err) {
      failures += 1;
      console.error(`✗ ${slug}: ${err.message}`);
    }
  }

  if (failures > 0) process.exitCode = 1;
}

main();

#!/usr/bin/env node
"use strict";

// Fills in the English ("en") block of a case study from its Portuguese
// ("pt") block, using the Claude API. Lets editors write a new case in
// Portuguese only and generate a first-pass English version instead of
// typing every field twice.
//
// Usage:
//   node --env-file=.env scripts/translate-case.js <slug> [<slug> ...]
//   node --env-file=.env scripts/translate-case.js --all
//
// Requires ANTHROPIC_API_KEY (see .env.example). Overwrites the "en" block
// in src/_data/cases/<slug>.json every time it runs for that slug — review
// the diff and adjust by hand (or in the CMS) afterward.

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { z } = require("zod");
const { betaZodOutputFormat } = require("@anthropic-ai/sdk/helpers/beta/zod");

const CASES_DIR = path.join(__dirname, "..", "src", "_data", "cases");

const EnCaseSchema = z.object({
  metaTitle: z.string(),
  metaDescription: z.string(),
  heroTitleLine1: z.string(),
  heroTitleLine2: z.string(),
  heroAlt: z.string(),
  tags: z.array(z.string()),
  challengeTag: z.string(),
  challengeHeading: z.string(),
  challengeDetail: z.string(),
  approachTag: z.string(),
  approachHeading: z.string(),
  approachDetail: z.string(),
  cardTitle: z.string(),
  cardDesc: z.string(),
});

async function translateCase(client, slug) {
  const filePath = path.join(CASES_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`no case file at ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data.pt || Object.keys(data.pt).length === 0) {
    throw new Error(`case has no "pt" block to translate from`);
  }

  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    system:
      "You translate case-study copy for Melo Creative, a brand agency for health, tech and law businesses, from Brazilian Portuguese into English. Match the source field-by-field: same structure, same meaning, same confident and concise tone. Do not add, drop or embellish content. Keep client/brand/product names unchanged.",
    messages: [
      {
        role: "user",
        content:
          "Translate every value in this JSON object from Portuguese to English. Return only the translated object with the exact same keys.\n\n" +
          JSON.stringify(data.pt, null, 2),
      },
    ],
    output_format: betaZodOutputFormat(EnCaseSchema),
  });

  if (!response.parsed) {
    throw new Error("model did not return parseable output");
  }

  data.en = response.parsed;
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

  const slugs =
    args[0] === "--all"
      ? fs
          .readdirSync(CASES_DIR)
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""))
      : args;

  const client = new Anthropic();
  let failures = 0;

  for (const slug of slugs) {
    try {
      await translateCase(client, slug);
    } catch (err) {
      failures += 1;
      console.error(`✗ ${slug}: ${err.message}`);
    }
  }

  if (failures > 0) process.exitCode = 1;
}

main();

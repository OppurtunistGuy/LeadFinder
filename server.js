import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { COUNTRIES, findSeed } from "./seed.js";
import { addLeads, readLeads, updateLead, STATUSES } from "./lib/leads.js";
import { scoutMeta, META_COUNTRIES } from "./lib/meta.js";
import { scoutHiring } from "./lib/hiring.js";
import { ScoutError } from "./lib/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "reports.json");
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = "claude-sonnet-5-5";

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

const readDb = () => JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const writeDb = (rows) => fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2));

const SYSTEM = `You research niches for a freelance motion-graphics designer in India who wants paid clients abroad.
His services: short product ads, vertical social ads, SaaS explainers, animated captions.
Use web search to find CURRENT evidence. Output ONLY a JSON object, no prose, with this shape:
{
  "niche": string,
  "plan": {
    "whatTheyBuy": string,
    "adSpendSignals": string,
    "serviceFit": string,
    "openingOffer": { "name": string, "priceUSD": string, "scope": string },
    "risks": string[]
  },
  "research": {
    "adData": string,
    "market": string,
    "rules": string,
    "caveat": string
  }
}
Rules: be specific and short. Only state facts you found. Say plainly when evidence is thin.
Never suggest health, medical or results claims in ads. Mention local consent rules for cold outreach.
Opening offer must be a small paid pilot, not a big package.`;

async function liveResearch(niche, country) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [
        {
          role: "user",
          content: `Niche: ${niche}\nTarget country: ${country}\nResearch demand for short video ads in this niche and country, who buys, what they spend on, and how free ad data (Meta Ad Library, Google Ads Transparency) covers ${country}.`
        }
      ]
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude API error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("The model did not return a report. Try again.");
  const parsed = JSON.parse(text.slice(start, end + 1));

  const sources = [];
  const seen = new Set();
  for (const b of data.content || []) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) {
        if (r.url && !seen.has(r.url)) {
          seen.add(r.url);
          sources.push({ title: r.title || r.url, url: r.url });
        }
      }
    }
  }
  return { mode: "live", niche: parsed.niche || niche, country, plan: parsed.plan, research: parsed.research, sources: sources.slice(0, 12) };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DEMO = process.env.SCOUT_DEMO === "1";

app.get("/api/config", (_req, res) =>
  res.json({
    hasKey: Boolean(API_KEY),
    hasMeta: Boolean((process.env.META_ACCESS_TOKEN || "").trim()),
    demo: DEMO,
    countries: COUNTRIES,
    metaCountries: Object.keys(META_COUNTRIES),
    statuses: STATUSES
  })
);

app.get("/api/reports", (_req, res) => {
  const rows = readDb().map(({ id, niche, country, mode, createdAt }) => ({ id, niche, country, mode, createdAt }));
  res.json(rows.reverse());
});

app.get("/api/reports/:id", (req, res) => {
  const row = readDb().find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: "Report not found" });
  res.json(row);
});

app.post("/api/research", async (req, res) => {
  const niche = String(req.body?.niche || "").trim().slice(0, 120);
  const country = COUNTRIES.includes(req.body?.country) ? req.body.country : null;
  if (!niche) return res.status(400).json({ error: "Type a niche first." });
  if (!country) return res.status(400).json({ error: "Pick a country." });

  try {
    let report = API_KEY ? await liveResearch(niche, country) : findSeed(niche, country);
    if (!report) {
      return res.status(422).json({
        error: "Live research needs an API key. Add ANTHROPIC_API_KEY to the .env file and restart. Until then, try: supplements, skincare or pet."
      });
    }
    const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...report };
    const rows = readDb();
    rows.push(row);
    writeDb(rows);
    res.json(row);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

// ---- Phase 2: leads and scouts ----

// Only for screenshots and demos. Every demo lead is labelled DEMO so it can never be mistaken for a real one.
function demoLeads(kind, niche, country) {
  const base = { country, niche, source: "demo", contact: "", notes: "" };
  return [
    { ...base, company: "DEMO Glow Skincare", sourceId: `demo-1-${kind}`, sourceUrl: "https://example.com/demo-1", signal: kind === "meta" ? '6 active ads matching "' + niche + '", oldest running since 2026-08-12' : "Hiring: Freelance motion designer for product ads (posted 2026-10-10)", evidence: [{ label: "Demo link", url: "https://example.com/demo-1" }], sample: "Demo text only. Not a real company." },
    { ...base, company: "DEMO Pawfect Foods", sourceId: `demo-2-${kind}`, sourceUrl: "https://example.com/demo-2", signal: kind === "meta" ? '3 active ads matching "' + niche + '"' : "Hiring: Short-form video editor for ecommerce ads", evidence: [{ label: "Demo link", url: "https://example.com/demo-2" }], sample: "Demo text only. Not a real company." },
    { ...base, company: "DEMO Vital Greens", sourceId: `demo-3-${kind}`, sourceUrl: "https://example.com/demo-3", signal: kind === "meta" ? '1 active ad matching "' + niche + '"' : "Hiring: Ad creative designer, monthly retainer", evidence: [{ label: "Demo link", url: "https://example.com/demo-3" }], sample: "Demo text only. Not a real company." }
  ];
}

app.get("/api/leads", (_req, res) => res.json(readLeads().reverse()));

app.post("/api/scout", async (req, res) => {
  const kind = req.body?.kind;
  const niche = String(req.body?.niche || "").trim().slice(0, 120);
  const country = COUNTRIES.includes(req.body?.country) ? req.body.country : null;
  if (!["meta", "hiring"].includes(kind)) return res.status(400).json({ error: "Pick a source." });
  if (!niche) return res.status(400).json({ error: "Type a niche first." });
  if (!country) return res.status(400).json({ error: "Pick a country." });

  try {
    const found = DEMO
      ? demoLeads(kind, niche, country)
      : kind === "meta"
        ? await scoutMeta({ niche, country })
        : await scoutHiring({ niche, country, apiKey: API_KEY });
    const { added, duplicates } = addLeads(found);
    res.json({ found: found.length, added, duplicates });
  } catch (err) {
    if (err instanceof ScoutError) return res.status(err.status).json({ error: err.message });
    console.error("scout failed:", err.name, err.message);
    res.status(500).json({ error: "Something went wrong while searching. Try again." });
  }
});

app.patch("/api/leads/:id", (req, res) => {
  try {
    const row = updateLead(req.params.id, { status: req.body?.status });
    if (!row) return res.status(404).json({ error: "Lead not found" });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Client finder running on http://localhost:${PORT}  (live research: ${API_KEY ? "on" : "off, sample niches only"})`));

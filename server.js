import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { COUNTRIES, findSeed } from "./seed.js";
import { addLeads, readLeads, updateLead, STATUSES } from "./lib/leads.js";
import { brandsFor, coverage } from "./lib/brands.js";
import { checkSite, analyseHtml } from "./lib/check.js";
import { scoreSite } from "./lib/score.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "reports.json");
const PORT = process.env.PORT || 3000;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

const readDb = () => JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const writeDb = (rows) => fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DEMO = process.env.SCOUT_DEMO === "1";

app.get("/api/config", (_req, res) =>
  res.json({ demo: DEMO, countries: COUNTRIES, coverage: coverage(), statuses: STATUSES })
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
    const report = findSeed(niche, country);
    if (!report) {
      return res.status(422).json({
        error: "This niche has not been researched yet. Try supplements, skincare or pet, or ask Claude to research a new niche and add it to the repo."
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

// ---- Phase 3: check brands, score them, keep the best ----

// Only for screenshots when the sandbox cannot reach real sites. Every lead is labelled DEMO.
const DEMO_HTML = [
  `<script src="https://connect.facebook.net/en_US/fbevents.js"></script><script>fbq('init','1')</script><script src="https://analytics.tiktok.com/i18n/pixel/events.js"></script><a href="https://instagram.com/demo">ig</a><p>Free shipping on bundles</p><a href="mailto:hello@demo-glow.example">mail</a><script src="https://cdn.shopify.com/s/x.js"></script><script src="https://static.klaviyo.com/a.js"></script>`,
  `<script>fbq('track','PageView')</script><video src="a.mp4"></video><iframe src="https://www.youtube.com/embed/x"></iframe><a href="https://instagram.com/demo2">ig</a>`,
  `<h1>Welcome</h1><p>Our story</p>`
];

function toLead({ brand, niche, check, demo }) {
  const sc = scoreSite(check);
  const base = {
    company: demo ? `DEMO ${brand.name}` : brand.name,
    country: brand.country,
    niche,
    source: demo ? "demo" : "site",
    sourceId: brand.domain,
    sourceUrl: `https://${brand.domain}`,
    evidence: [{ label: "Their website", url: `https://${brand.domain}` }, { label: "Where the brand was listed", url: brand.source }],
    sample: demo ? "Demo text only. Not a real company." : "",
    notes: "",
    checkedAt: new Date().toISOString()
  };
  if (!sc) return { ...base, score: null, scoreMax: 8, reasons: [], unreachable: true, contact: "", signal: check?.reason || "Could not check this website." };
  const parts = [sc.score >= 5 ? "Strong fit" : sc.score >= 3 ? "Possible fit" : "Weak fit", `${check.pixels.length ? "runs " + check.pixels.join(" + ") + " tracking" : "no ad tracking"}`, check.videos === 0 ? "no homepage video" : `${check.videos} homepage video${check.videos > 1 ? "s" : ""}`];
  return { ...base, score: sc.score, scoreMax: sc.max, reasons: sc.reasons, unreachable: false, contact: check.emails[0] || "", signal: parts.join(", ") };
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

app.get("/api/leads", (_req, res) => res.json(readLeads().reverse()));

app.post("/api/scout", async (req, res) => {
  const niche = String(req.body?.niche || "").trim().slice(0, 120);
  const country = COUNTRIES.includes(req.body?.country) ? req.body.country : null;
  if (!niche) return res.status(400).json({ error: "Pick a niche first." });
  if (!country) return res.status(400).json({ error: "Pick a country." });

  const { key, brands } = brandsFor(niche, country);
  if (!key) return res.status(422).json({ error: "No brand list for this niche yet. Ask Claude to research it and add it to the repo." });
  if (!brands.length) return res.status(422).json({ error: `No brands researched for ${country} in this niche yet. Germany and United States are ready.` });

  try {
    const found = await pool(brands, 3, async (brand) => {
      const i = brands.indexOf(brand);
      const check = DEMO
        ? { reachable: true, ...analyseHtml(DEMO_HTML[i % DEMO_HTML.length], brand.domain) }
        : await checkSite(brand.domain);
      return toLead({ brand, niche: key, check, demo: DEMO });
    });
    const { added, updated } = addLeads(found);
    res.json({ found: found.length, added, updated, unreachable: found.filter((l) => l.unreachable).length });
  } catch (err) {
    console.error("scout failed:", err.name, err.message);
    res.status(500).json({ error: "Something went wrong while checking. Try again." });
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

app.listen(PORT, () => console.log(`Client finder running on http://localhost:${PORT}  (free mode: no paid keys)`));

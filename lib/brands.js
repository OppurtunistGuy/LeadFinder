import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "brands");

const ALIASES = {
  supplements: ["supplement", "vitamin", "wellness", "nutrition", "protein", "nahrungserg"],
  skincare: ["skin", "beauty", "cosmetic", "kosmetik", "haut", "makeup"],
  pet: ["pet", "dog", "cat", "hund", "katze", "tier"]
};

export function loadAll() {
  const out = {};
  if (!fs.existsSync(DIR)) return out;
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith(".json")) continue;
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    out[j.niche] = j;
  }
  return out;
}

export function nicheKey(text, all = loadAll()) {
  const t = String(text || "").toLowerCase();
  if (all[t]) return t;
  for (const [key, words] of Object.entries(ALIASES)) if (all[key] && words.some((w) => t.includes(w))) return key;
  return null;
}

// "Europe" uses the German list until more countries are researched.
export function brandsFor(niche, country) {
  const all = loadAll();
  const key = nicheKey(niche, all);
  if (!key) return { key: null, brands: [] };
  const want = country === "Europe" ? "Germany" : country;
  return { key, brands: all[key].brands.filter((b) => b.country === want) };
}

export function coverage() {
  const all = loadAll();
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, [...new Set(v.brands.map((b) => b.country))]]));
}

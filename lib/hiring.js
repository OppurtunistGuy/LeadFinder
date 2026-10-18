import { ScoutError } from "./errors.js";

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `You find public postings where a business or person is looking for a freelance or contract motion designer, ad creative designer, or short-form video editor for paid ads.
Use web search (at most 8 searches). Only report postings you actually found on a page in the search results. Never invent a company or a link.
Skip full-time employee roles that require relocation, and skip anything older than about 60 days. Do not log in to anything.
Output ONLY a JSON array, no prose. Each item: {"company": string, "role": string, "url": string, "postedDate": string or null, "summary": string (one short sentence about what they need), "contactHint": string or null (a public contact page or name only if shown on that page)}.
If you find nothing good, output [].`;

const normUrl = (u) => String(u || "").trim().replace(/#.*$/, "").replace(/\/$/, "");

function httpUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
  } catch {
    return null;
  }
}

// Keep only items whose link really appeared in the search results, so nothing can be made up.
export function parseHiring(content, { niche, country }) {
  const text = (content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) return [];

  let items;
  try { items = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(items)) return [];

  const found = new Set();
  for (const b of content || []) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) found.add(normUrl(r.url));
    }
  }

  const leads = [];
  for (const it of items) {
    const url = httpUrl(it?.url);
    if (!url || !found.has(normUrl(url))) continue;
    leads.push({
      company: String(it.company || "Unknown company").slice(0, 120),
      country,
      niche,
      source: "hiring",
      sourceId: normUrl(url),
      sourceUrl: url,
      signal: `Hiring: ${String(it.role || "motion or ad creative designer").slice(0, 120)}${it.postedDate ? ` (posted ${String(it.postedDate).slice(0, 40)})` : ""}`,
      evidence: [{ label: "The posting", url }],
      sample: String(it.summary || "").slice(0, 240),
      contact: it.contactHint ? String(it.contactHint).slice(0, 200) : "",
      notes: ""
    });
  }
  return leads;
}

export async function scoutHiring({ niche, country, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new ScoutError("The hiring-post finder needs a Claude API key. Add ANTHROPIC_API_KEY to the .env file and restart.", 400);

  const german = country === "Germany" ? ' Also try German terms such as "Motion Designer gesucht" and "Werbevideo erstellen lassen".' : "";
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{
        role: "user",
        content: `Niche: ${niche}\nPreferred country: ${country} (remote work for someone based in India is fine).\nFind recent postings from businesses in or selling into this niche that want a freelance motion designer, animated product ads, or short-form ad video.${german}`
      }]
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new ScoutError(`Claude API error ${res.status}: ${t.slice(0, 200)}`, 502);
  }
  const data = await res.json();
  return parseHiring(data.content, { niche, country });
}

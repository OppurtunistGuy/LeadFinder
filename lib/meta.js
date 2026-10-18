import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "./paths.js";
import { ScoutError } from "./errors.js";

const API = "https://graph.facebook.com/v26.0";
const DAY = 86_400_000;

// The free Ad Library API returns ordinary commercial ads only for the UK and EU.
export const META_COUNTRIES = {
  Germany: ["DE"],
  "United Kingdom": ["GB"],
  Europe: ["FR", "ES", "IT", "NL", "SE", "PL"]
};

const FIELDS = "id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,publisher_platforms,languages";

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const cacheFile = () => path.join(dataDir(), "meta-token.json");

export function mapMetaError(err = {}) {
  if (err.code === 10 && err.error_subcode === 2332002) {
    return new ScoutError("Meta has not approved Ad Library access for your account yet. Finish the steps at facebook.com/ads/library/api, then try again.", 403);
  }
  if (err.code === 190) {
    return new ScoutError("Your Meta token has expired. Generate a new one in the Graph API Explorer and update META_ACCESS_TOKEN in the .env file.", 401);
  }
  if ([4, 17, 32, 613].includes(err.code)) {
    return new ScoutError("Meta's rate limit was hit (the free API allows roughly 200 calls an hour). Wait a while and try again.", 429);
  }
  return new ScoutError(`Meta returned an error${err.message ? `: ${err.message}` : "."}`, 502);
}

// Short tokens last an hour or two. With the app ID and secret, swap it for a long-lived one and reuse it.
export async function getMetaToken({ env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  const short = (env.META_ACCESS_TOKEN || "").trim();
  if (!short) throw new ScoutError("No Meta token yet. Add META_ACCESS_TOKEN to the .env file (see .env.example).", 400);

  const appId = (env.META_APP_ID || "").trim();
  const secret = (env.META_APP_SECRET || "").trim();
  if (!appId || !secret) return short;

  let cached = null;
  try { cached = JSON.parse(fs.readFileSync(cacheFile(), "utf8")); } catch { /* no cache yet */ }
  if (cached && cached.from === sha(short) && cached.expiresAt > now + DAY) return cached.token;

  const qs = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: short });
  const res = await fetchImpl(`${API}/oauth/access_token?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw mapMetaError(body.error);

  const expiresAt = now + (Number(body.expires_in) || 5_184_000) * 1000;
  fs.writeFileSync(cacheFile(), JSON.stringify({ token: body.access_token, from: sha(short), expiresAt }), { mode: 0o600 });
  return body.access_token;
}

export function groupAds(ads, { niche, country, countryCode }) {
  const pages = new Map();
  for (const ad of ads) {
    const key = ad.page_id || ad.page_name;
    if (!key) continue;
    const page = pages.get(key) || { pageId: ad.page_id || null, name: ad.page_name || "Unknown page", ads: [] };
    page.ads.push(ad);
    pages.set(key, page);
  }

  return [...pages.values()]
    .sort((a, b) => b.ads.length - a.ads.length)
    .slice(0, 25)
    .map((p) => {
      const n = p.ads.length;
      const earliest = p.ads.map((a) => a.ad_delivery_start_time).filter(Boolean).sort()[0];
      const sample = p.ads.flatMap((a) => a.ad_creative_bodies || []).find(Boolean) || "";
      const pageUrl = p.pageId
        ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(countryCode)}&view_all_page_id=${encodeURIComponent(p.pageId)}`
        : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(p.name)}`;
      return {
        company: p.name,
        country,
        niche,
        source: "meta",
        sourceId: p.pageId ? `page:${p.pageId}:${countryCode}` : `name:${p.name}:${countryCode}`,
        sourceUrl: pageUrl,
        signal: `${n} active ad${n === 1 ? "" : "s"} matching "${niche}"${earliest ? `, oldest running since ${String(earliest).slice(0, 10)}` : ""}`,
        // Link to the public Ad Library page by ad id. Never use ad_snapshot_url: Meta puts the access token inside it.
        evidence: p.ads.slice(0, 3).map((a, i) => ({ label: `Ad ${i + 1} in the Ad Library`, url: `https://www.facebook.com/ads/library/?id=${encodeURIComponent(a.id)}` })),
        sample: String(sample).slice(0, 200),
        adCount: n,
        contact: "",
        notes: ""
      };
    });
}

export async function scoutMeta({ niche, country, fetchImpl = fetch, tokenGetter = getMetaToken, maxPages = 3 }) {
  const codes = META_COUNTRIES[country];
  if (!codes) {
    throw new ScoutError(`The free Meta Ad Library API only covers ads delivered in the UK and EU, so it can't see ads in ${country}. Use the hiring-post finder here; a paid scraper is planned for later.`, 422);
  }
  const token = await tokenGetter();
  const params = new URLSearchParams({
    search_terms: niche,
    ad_reached_countries: `[${codes.map((c) => `'${c}'`).join(",")}]`,
    ad_active_status: "ACTIVE",
    ad_type: "ALL",
    fields: FIELDS,
    limit: "50",
    access_token: token
  });

  let url = `${API}/ads_archive?${params}`;
  const ads = [];
  for (let page = 0; url && page < maxPages; page++) {
    const res = await fetchImpl(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw mapMetaError(body.error);
    ads.push(...(body.data || []));
    url = body.paging?.next || null;
  }
  return groupAds(ads, { niche, country, countryCode: codes[0] });
}

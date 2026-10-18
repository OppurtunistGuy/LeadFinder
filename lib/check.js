// Looks at a brand's own public homepage (and its contact/impressum page) and reports what it finds.
// No paid service, no login. It respects robots.txt and identifies itself.

const UA = "ClientFinderBot/0.1 (personal research; contact: site owner)";
const MAX_BYTES = 1_500_000;

export function robotsAllows(txt, path = "/") {
  const groups = [];
  let cur = null;
  for (const raw of String(txt || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if ((key === "disallow" || key === "allow") && cur) {
      cur.rules.push({ allow: key === "allow", path: val });
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && UA.toLowerCase().includes(a))) || groups.find((g) => g.agents.includes("*"));
  if (!mine) return true;
  let best = null;
  for (const r of mine.rules) {
    if (!r.path) continue;
    if (path.startsWith(r.path.replace(/\*$/, ""))) {
      if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
    }
  }
  return best ? best.allow : true;
}

async function getText(url, fetchImpl, timeoutMs = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: ctl.signal });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const has = (re, s) => re.test(s);

export function analyseHtml(html, domain) {
  const s = String(html || "");
  const pixels = [];
  if (has(/connect\.facebook\.net\/[^"']*fbevents|\bfbq\s*\(/i, s)) pixels.push("Meta");
  if (has(/analytics\.tiktok\.com|\bttq\.(load|page)/i, s)) pixels.push("TikTok");
  if (has(/googleadservices\.com|googleads\.g\.doubleclick|["']AW-\d{6,}/i, s)) pixels.push("Google Ads");
  if (has(/s\.pinimg\.com\/ct\/core|pintrk\s*\(/i, s)) pixels.push("Pinterest");

  const videoTags = (s.match(/<video[\s>]/gi) || []).length;
  const embeds = (s.match(/(?:youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com|youtu\.be\/)/gi) || []).length;
  const mp4 = (s.match(/\.mp4(?:["'?\s])/gi) || []).length;
  const videos = videoTags + embeds + (videoTags ? 0 : Math.min(mp4, 2));

  let platform = "";
  if (has(/cdn\.shopify\.com|Shopify\.theme/i, s)) platform = "Shopify";
  else if (has(/wp-content\/plugins\/woocommerce|woocommerce/i, s)) platform = "WooCommerce";
  else if (has(/shopware/i, s)) platform = "Shopware";
  else if (has(/cdn\.shoplazza|bigcommerce|squarespace\.com\/commerce|wixstatic\.com/i, s)) platform = "Other shop platform";

  const tools = [];
  for (const [name, re] of [["Klaviyo", /klaviyo/i], ["Mailchimp", /mailchimp|chimpstatic/i], ["Hotjar", /hotjar/i], ["Judge.me", /judge\.me/i], ["Trustpilot", /trustpilot/i], ["Gorgias", /gorgias/i], ["Yotpo", /yotpo/i], ["Trusted Shops", /trustedshops/i]]) {
    if (re.test(s)) tools.push(name);
  }

  const promo = has(/\b(sale|% ?off|free shipping|bundle|subscribe (?:&|and) save|rabatt|aktion|gratis versand|versandkostenfrei|angebot)\b/i, s);
  const social = [];
  if (has(/instagram\.com\//i, s)) social.push("Instagram");
  if (has(/tiktok\.com\/@/i, s)) social.push("TikTok");
  if (has(/youtube\.com\/(?:@|channel|c\/|user)/i, s)) social.push("YouTube");

  const emails = new Set();
  for (const m of s.matchAll(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)) emails.add(m[1].toLowerCase());
  for (const m of s.matchAll(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi)) {
    const e = m[1].toLowerCase();
    if (!/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/sentry|example\.|wixpress|shopify/.test(e)) emails.add(e);
  }

  let contactPath = "";
  const link = s.match(/href=["']([^"']*(?:impressum|kontakt|contact|about-us|ueber-uns)[^"']*)["']/i);
  if (link) {
    try { contactPath = new URL(link[1], `https://${domain}/`).pathname; } catch { /* ignore */ }
  }

  return { pixels, videos, platform, tools, promo, social, emails: [...emails].slice(0, 5), contactPath };
}

export async function checkSite(domain, { fetchImpl = fetch } = {}) {
  const base = `https://${domain}`;
  const robots = await getText(`${base}/robots.txt`, fetchImpl, 6000);
  if (robots && !robotsAllows(robots, "/")) return { reachable: false, reason: "robots.txt asks bots not to visit, so it was skipped." };

  const html = await getText(`${base}/`, fetchImpl);
  if (!html) return { reachable: false, reason: "The website did not load." };

  const result = analyseHtml(html, domain);
  if (!result.emails.length && result.contactPath && (!robots || robotsAllows(robots, result.contactPath))) {
    const page = await getText(`${base}${result.contactPath}`, fetchImpl);
    if (page) result.emails = analyseHtml(page, domain).emails;
  }
  return { reachable: true, ...result };
}

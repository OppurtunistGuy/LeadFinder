import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cf-test-"));

const { robotsAllows, analyseHtml, checkSite } = await import("../lib/check.js");
const { scoreSite } = await import("../lib/score.js");
const { brandsFor, nicheKey, coverage } = await import("../lib/brands.js");
const { addLeads, readLeads, updateLead } = await import("../lib/leads.js");

const page = (body, ok = true) => ({ ok, text: async () => body });

test("robots: blocks disallowed paths, allows the rest, allows when there is no file", () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /", "/"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /admin", "/"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nAllow: /kontakt", "/kontakt"), true);
  assert.equal(robotsAllows("", "/"), true);
});

test("analyse: finds ad pixels, videos, platform, promo, social and emails", () => {
  const html = `<script src="https://connect.facebook.net/en/fbevents.js"></script>
  <script>ttq.load('X')</script><video src=a.mp4></video><iframe src="https://www.youtube.com/embed/abc"></iframe>
  <script src="https://cdn.shopify.com/x.js"></script><script src="//static.klaviyo.com/a.js"></script>
  <p>Free shipping today</p><a href="https://instagram.com/brand">ig</a>
  <a href="mailto:Hello@Brand.com">m</a><img src="logo@2x.png"> <a href="/pages/contact">Contact</a>`;
  const r = analyseHtml(html, "brand.com");
  assert.deepEqual(r.pixels, ["Meta", "TikTok"]);
  assert.equal(r.videos, 2);
  assert.equal(r.platform, "Shopify");
  assert.deepEqual(r.tools, ["Klaviyo"]);
  assert.equal(r.promo, true);
  assert.deepEqual(r.social, ["Instagram"]);
  assert.deepEqual(r.emails, ["hello@brand.com"]);
  assert.equal(r.contactPath, "/pages/contact");
});

test("score: pixels but no video scores high, with reasons that add up", () => {
  const c = { reachable: true, pixels: ["Meta", "TikTok"], videos: 0, platform: "Shopify", tools: ["Klaviyo"], promo: true, social: ["Instagram"], emails: ["a@b.co"] };
  const s = scoreSite(c);
  assert.equal(s.score, 8);
  assert.equal(s.reasons.reduce((n, r) => n + r.points, 0), s.score);
  assert.ok(s.reasons.every((r) => r.points <= r.max && r.note));
});

test("score: no tracking and lots of video scores low; unreachable gives no score", () => {
  const c = { reachable: true, pixels: [], videos: 3, platform: "", tools: [], promo: false, social: [], emails: [] };
  assert.equal(scoreSite(c).score, 0);
  assert.equal(scoreSite({ reachable: false }), null);
});

test("check: reads the homepage, then the contact page when no email is on it", async () => {
  const seen = [];
  const fetchImpl = async (u) => {
    seen.push(u);
    if (u.endsWith("/robots.txt")) return page("User-agent: *\nDisallow: /cart", true);
    if (u.endsWith("/impressum")) return page('<a href="mailto:info@shop.de">m</a>');
    return page('<a href="/impressum">Impressum</a><script>fbq("init",1)</script>');
  };
  const r = await checkSite("shop.de", { fetchImpl });
  assert.equal(r.reachable, true);
  assert.deepEqual(r.pixels, ["Meta"]);
  assert.deepEqual(r.emails, ["info@shop.de"]);
  assert.ok(seen.includes("https://shop.de/impressum"));
});

test("check: robots.txt that blocks everything is respected and the homepage is never fetched", async () => {
  const seen = [];
  const fetchImpl = async (u) => { seen.push(u); return page("User-agent: *\nDisallow: /"); };
  const r = await checkSite("blocked.com", { fetchImpl });
  assert.equal(r.reachable, false);
  assert.match(r.reason, /robots/);
  assert.deepEqual(seen, ["https://blocked.com/robots.txt"]);
});

test("check: a site that fails to load is reported, not crashed on", async () => {
  const r = await checkSite("down.com", { fetchImpl: async () => { throw new Error("boom"); } });
  assert.equal(r.reachable, false);
});

test("brands: every entry has a name, a domain and a source link; niche words map to files", () => {
  const cov = coverage();
  assert.deepEqual(Object.keys(cov).sort(), ["pet", "skincare", "supplements"]);
  for (const niche of Object.keys(cov)) {
    const { brands } = brandsFor(niche, "Germany");
    assert.ok(brands.length >= 5);
    for (const b of brands) assert.ok(b.name && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(b.domain) && /^https:\/\//.test(b.source));
  }
  assert.equal(nicheKey("Dog food"), "pet");
  assert.equal(nicheKey("Hautpflege"), "skincare");
  assert.equal(nicheKey("vitamins"), "supplements");
  assert.equal(nicheKey("tractors"), null);
  assert.equal(brandsFor("pet", "Australia").brands.length, 0);
});

test("leads: re-checking refreshes the score but keeps status; never duplicates", () => {
  const lead = { company: "Dup Co", country: "Germany", source: "site", sourceId: "dup.de", signal: "s", score: 2, scoreMax: 8, checkedAt: "2026-10-01" };
  assert.deepEqual(addLeads([lead, lead]).added, 1);
  const row = readLeads().find((l) => l.company === "Dup Co");
  updateLead(row.id, { status: "approved" });
  const r = addLeads([{ ...lead, score: 6, checkedAt: "2026-10-18" }]);
  assert.equal(r.added, 0);
  assert.equal(r.updated, 1);
  const after = readLeads().filter((l) => l.company === "Dup Co");
  assert.equal(after.length, 1);
  assert.equal(after[0].score, 6);
  assert.equal(after[0].status, "approved");
  assert.throws(() => updateLead(row.id, { status: "banana" }));
  assert.equal(updateLead("missing", { status: "won" }), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cf-test-"));

const { scoutMeta, getMetaToken, mapMetaError } = await import("../lib/meta.js");
const { parseHiring } = await import("../lib/hiring.js");
const { addLeads, readLeads, updateLead } = await import("../lib/leads.js");
const { ScoutError } = await import("../lib/errors.js");

const reply = (body, ok = true) => ({ ok, json: async () => body, text: async () => JSON.stringify(body) });
const tokenGetter = async () => "TESTTOKEN";

test("meta: groups ads by page, most ads first, and never leaks the token", async () => {
  const snap = "https://www.facebook.com/ads/archive/render_ad/?id=1&access_token=SECRETTOKEN123";
  const ads = [
    { id: "1", page_id: "A", page_name: "Brand A", ad_creative_bodies: ["Glow in 7 days"], ad_delivery_start_time: "2026-09-01", ad_snapshot_url: snap },
    { id: "2", page_id: "A", page_name: "Brand A", ad_delivery_start_time: "2026-08-15", ad_snapshot_url: snap },
    { id: "3", page_id: "A", page_name: "Brand A", ad_snapshot_url: snap },
    { id: "4", page_id: "B", page_name: "Brand B", ad_snapshot_url: snap }
  ];
  const leads = await scoutMeta({ niche: "skincare", country: "Germany", tokenGetter, fetchImpl: async () => reply({ data: ads }) });

  assert.equal(leads.length, 2);
  assert.equal(leads[0].company, "Brand A");
  assert.equal(leads[0].adCount, 3);
  assert.match(leads[0].signal, /3 active ads/);
  assert.match(leads[0].signal, /since 2026-08-15/);
  assert.equal(leads[1].adCount, 1);
  assert.match(leads[1].signal, /1 active ad matching/);
  assert.ok(leads[0].evidence.every((e) => e.url.startsWith("https://www.facebook.com/ads/library/?id=")));
  const all = JSON.stringify(leads);
  assert.ok(!all.includes("SECRETTOKEN123") && !all.includes("TESTTOKEN"), "token must not appear in leads");
});

test("meta: follows paging up to maxPages", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return reply({ data: [{ id: String(calls), page_id: "P", page_name: "P" }], paging: { next: "https://graph.facebook.com/next" } });
  };
  const leads = await scoutMeta({ niche: "pet", country: "United Kingdom", tokenGetter, fetchImpl, maxPages: 2 });
  assert.equal(calls, 2);
  assert.equal(leads[0].adCount, 2);
});

test("meta: asks the right questions (active ads, EU/UK countries)", async () => {
  let seen = "";
  await scoutMeta({ niche: "supplements", country: "Europe", tokenGetter, fetchImpl: async (u) => { seen = u; return reply({ data: [] }); } });
  const q = new URL(seen).searchParams;
  assert.equal(q.get("search_terms"), "supplements");
  assert.equal(q.get("ad_active_status"), "ACTIVE");
  assert.equal(q.get("ad_type"), "ALL");
  assert.match(q.get("ad_reached_countries"), /'FR'/);
});

test("meta: the 'not approved' error becomes a clear message", async () => {
  const body = { error: { code: 10, error_subcode: 2332002, message: "Application does not have permission for this action" } };
  await assert.rejects(
    scoutMeta({ niche: "x", country: "Germany", tokenGetter, fetchImpl: async () => reply(body, false) }),
    (e) => e instanceof ScoutError && e.status === 403 && /facebook\.com\/ads\/library\/api/.test(e.message)
  );
});

test("meta: other error codes map sensibly", () => {
  assert.equal(mapMetaError({ code: 190 }).status, 401);
  assert.equal(mapMetaError({ code: 4 }).status, 429);
  assert.equal(mapMetaError({ code: 999, message: "boom" }).status, 502);
});

test("meta: countries outside UK/EU are refused without calling Meta", async () => {
  let called = false;
  await assert.rejects(
    scoutMeta({ niche: "x", country: "United States", tokenGetter, fetchImpl: async () => { called = true; return reply({}); } }),
    (e) => e instanceof ScoutError && e.status === 422
  );
  assert.equal(called, false);
});

test("meta token: exchanges once, reuses the cache, re-exchanges when the short token changes", async () => {
  let calls = 0;
  const fetchImpl = async (u) => {
    calls++;
    assert.match(u, /fb_exchange_token/);
    return reply({ access_token: `LONG${calls}`, expires_in: 5_000_000 });
  };
  const env = { META_APP_ID: "1", META_APP_SECRET: "s", META_ACCESS_TOKEN: "short-one" };
  assert.equal(await getMetaToken({ env, fetchImpl }), "LONG1");
  assert.equal(await getMetaToken({ env, fetchImpl }), "LONG1");
  assert.equal(calls, 1);
  assert.equal(await getMetaToken({ env: { ...env, META_ACCESS_TOKEN: "short-two" }, fetchImpl }), "LONG2");
});

test("meta token: without app id/secret the short token is used as-is; without any token it explains", async () => {
  assert.equal(await getMetaToken({ env: { META_ACCESS_TOKEN: "abc" } }), "abc");
  await assert.rejects(getMetaToken({ env: {} }), (e) => e instanceof ScoutError && /META_ACCESS_TOKEN/.test(e.message));
});

test("hiring: keeps only links that appeared in the search results", () => {
  const content = [
    { type: "web_search_tool_result", content: [{ url: "https://jobs.example.com/a/" }, { url: "https://jobs.example.com/b" }] },
    {
      type: "text",
      text: "Here you go: " + JSON.stringify([
        { company: "Real A", role: "Motion designer", url: "https://jobs.example.com/a", postedDate: "2026-10-10", summary: "Needs ad variations" },
        { company: "Real B", role: "Video editor", url: "https://jobs.example.com/b#apply", summary: "Short ads" },
        { company: "Made Up", role: "Motion designer", url: "https://invented.example.com/zzz", summary: "Not in results" },
        { company: "Bad Link", role: "x", url: "javascript:alert(1)", summary: "no" }
      ])
    }
  ];
  const leads = parseHiring(content, { niche: "skincare", country: "Germany" });
  assert.deepEqual(leads.map((l) => l.company), ["Real A", "Real B"]);
  assert.equal(leads[0].source, "hiring");
  assert.match(leads[0].signal, /posted 2026-10-10/);
});

test("hiring: junk or empty model output gives no leads instead of crashing", () => {
  assert.deepEqual(parseHiring([{ type: "text", text: "sorry, nothing" }], { niche: "x", country: "Germany" }), []);
  assert.deepEqual(parseHiring([{ type: "text", text: "[not json" }], { niche: "x", country: "Germany" }), []);
  assert.deepEqual(parseHiring(undefined, { niche: "x", country: "Germany" }), []);
});

test("leads: same company from the same source is never added twice; status can change", () => {
  const lead = { company: "Dup Co", country: "Germany", source: "meta", sourceId: "page:1:DE", signal: "s" };
  assert.deepEqual(addLeads([lead, lead]), { added: 1, duplicates: 1 });
  assert.deepEqual(addLeads([lead]), { added: 0, duplicates: 1 });
  const row = readLeads().find((l) => l.company === "Dup Co");
  assert.equal(row.status, "new");
  assert.equal(updateLead(row.id, { status: "approved" }).status, "approved");
  assert.throws(() => updateLead(row.id, { status: "banana" }));
  assert.equal(updateLead("missing", { status: "won" }), null);
});

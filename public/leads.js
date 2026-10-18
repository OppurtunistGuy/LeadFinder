const $ = (id) => document.getElementById(id);
const form = $("form");
const nicheInput = $("niche");
const countrySel = $("country");
const kindSel = $("kind");
const goBtn = $("go");
const hintEl = $("hint");
const msgEl = $("msg");
const errorEl = $("error");
const listEl = $("list");
const emptyEl = $("empty");
const countEl = $("count");
const filterSel = $("filter");

let cfg = { statuses: [], metaCountries: [], hasKey: false, hasMeta: false, demo: false };
let leads = [];

const SOURCE_LABEL = { meta: "Meta ads", hiring: "Hiring post", demo: "DEMO" };

function setMsg(text, isError = false) {
  errorEl.hidden = !(isError && text);
  msgEl.hidden = isError || !text;
  (isError ? errorEl : msgEl).textContent = text || "";
}

function updateHint() {
  const meta = kindSel.value === "meta";
  const parts = [];
  if (cfg.demo) { hintEl.textContent = "DEMO MODE: results are made-up examples for testing only."; return; }
  if (meta && !cfg.metaCountries.includes(countrySel.value)) parts.push(`The free Meta data does not cover ${countrySel.value}. Use Hiring posts, or pick Germany, United Kingdom or Europe.`);
  else if (meta && !cfg.hasMeta) parts.push("Add your Meta token to the .env file to use this (see .env.example).");
  else if (!meta && !cfg.hasKey) parts.push("Add ANTHROPIC_API_KEY to the .env file to search live.");
  hintEl.textContent = parts.join(" ");
}

function card(l) {
  const status = el("select", { class: "status", ariaLabel: `Status for ${l.company}` });
  for (const s of cfg.statuses) status.append(el("option", { value: s, textContent: s, selected: s === l.status }));
  status.addEventListener("change", async () => {
    const res = await fetch(`/api/leads/${l.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: status.value }) });
    if (res.ok) { l.status = status.value; renderList(); } else { status.value = l.status; setMsg("Could not save the status. Try again.", true); }
  });

  const links = (l.evidence || []).map((e) => ({ ...e, url: safeUrl(e.url) })).filter((e) => e.url);
  const parts = [
    el("div", { class: "lead-top" },
      el("h3", { textContent: l.company }),
      status),
    el("div", { class: "badges" },
      el("span", { class: l.source === "demo" ? "badge sample" : "badge", textContent: SOURCE_LABEL[l.source] || l.source }),
      el("span", { class: "badge", textContent: l.country }),
      el("span", { class: "badge", textContent: `Found ${new Date(l.foundAt).toLocaleDateString()}` })),
    el("p", { class: "signal", textContent: l.signal })
  ];
  if (l.sample) parts.push(el("p", { class: "muted", textContent: l.sample }));
  if (l.source === "hiring") parts.push(el("p", { class: "muted", textContent: "Check the posting is still open before reaching out." }));
  if (links.length) parts.push(el("p", { class: "links" }, ...links.flatMap((e, i) => [i ? " · " : "", el("a", { href: e.url, textContent: e.label })])));
  return el("article", { class: "card lead" }, ...parts);
}

function renderList() {
  const f = filterSel.value;
  const shown = leads.filter((l) => f === "all" || l.status === f);
  listEl.replaceChildren(...shown.map(card));
  const fresh = leads.filter((l) => l.status === "new").length;
  countEl.textContent = leads.length ? `${leads.length} lead${leads.length === 1 ? "" : "s"} · ${fresh} new` : "Leads";
  emptyEl.hidden = shown.length > 0;
  emptyEl.textContent = leads.length ? "No leads with this status." : "No leads yet. Pick a niche above and press Find leads.";
}

async function load() {
  leads = await (await fetch("/api/leads")).json();
  renderList();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");
  goBtn.disabled = true;
  goBtn.textContent = "Searching...";
  try {
    const res = await fetch("/api/scout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: kindSel.value, niche: nicheInput.value, country: countrySel.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    setMsg(data.found === 0 ? "Nothing found this time. Try a broader niche or another country." : `Found ${data.found}. Added ${data.added} new, skipped ${data.duplicates} already in your list.`);
    await load();
  } catch (err) {
    setMsg(err.message, true);
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = "Find leads";
  }
});

for (const s of [kindSel, countrySel]) s.addEventListener("change", updateHint);
filterSel.addEventListener("change", renderList);

(async function init() {
  cfg = await (await fetch("/api/config")).json();
  for (const c of cfg.countries) countrySel.append(el("option", { value: c, textContent: c }));
  filterSel.append(el("option", { value: "all", textContent: "All statuses" }));
  for (const s of cfg.statuses) filterSel.append(el("option", { value: s, textContent: s }));
  updateHint();
  load();
})();

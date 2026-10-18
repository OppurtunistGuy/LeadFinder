const $ = (id) => document.getElementById(id);
const form = $("form");
const nicheInput = $("niche");
const countrySel = $("country");
const goBtn = $("go");
const hintEl = $("hint");
const msgEl = $("msg");
const errorEl = $("error");
const listEl = $("list");
const emptyEl = $("empty");
const countEl = $("count");
const filterSel = $("filter");

let cfg = { statuses: [], coverage: {}, demo: false };
let leads = [];

const SOURCE_LABEL = { site: "Website check", demo: "DEMO" };

function setMsg(text, isError = false) {
  errorEl.hidden = !(isError && text);
  msgEl.hidden = isError || !text;
  (isError ? errorEl : msgEl).textContent = text || "";
}

function updateHint() {
  if (cfg.demo) { hintEl.textContent = "DEMO MODE: made-up brands for testing only."; return; }
  const ready = cfg.coverage[nicheInput.value] || [];
  hintEl.textContent = ready.includes(countrySel.value) || (countrySel.value === "Europe" && ready.includes("Germany"))
    ? "Opens each brand's public website once and scores it. Takes about half a minute."
    : `No brands researched for ${countrySel.value} in this niche yet. Ready: ${ready.join(", ") || "none"}.`;
}

function scoreBlock(l) {
  if (l.score == null) return el("p", { class: "muted", textContent: "Not scored. " + l.signal });
  const tone = l.score >= 5 ? "good" : l.score >= 3 ? "ok" : "low";
  const rows = (l.reasons || []).map((r) => el("li", {},
    el("b", { textContent: `${r.points}/${r.max} ${r.label}. ` }),
    el("span", { textContent: r.note })));
  return el("div", { class: "score" },
    el("span", { class: `pill ${tone}`, textContent: `${l.score}/${l.scoreMax}` }),
    el("details", {}, el("summary", { textContent: "Why this score" }), el("ul", { class: "why" }, ...rows)));
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
    el("p", { class: "signal", textContent: l.signal }),
    scoreBlock(l)
  ];
  if (l.contact) parts.push(el("p", { class: "muted", textContent: `Public contact: ${l.contact}` }));
  if (l.sample) parts.push(el("p", { class: "muted", textContent: l.sample }));
  if (links.length) parts.push(el("p", { class: "links" }, ...links.flatMap((e, i) => [i ? " · " : "", el("a", { href: e.url, textContent: e.label })])));
  return el("article", { class: "card lead" }, ...parts);
}

function renderList() {
  const f = filterSel.value;
  const shown = leads.filter((l) => f === "all" || l.status === f).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  listEl.replaceChildren(...shown.map(card));
  const fresh = leads.filter((l) => l.status === "new").length;
  countEl.textContent = leads.length ? `${leads.length} lead${leads.length === 1 ? "" : "s"} · ${fresh} new` : "Leads";
  emptyEl.hidden = shown.length > 0;
  emptyEl.textContent = leads.length ? "No leads with this status." : "No leads yet. Pick a niche above and press Check brands.";
}

async function load() {
  leads = await (await fetch("/api/leads")).json();
  renderList();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");
  goBtn.disabled = true;
  goBtn.textContent = "Checking...";
  try {
    const res = await fetch("/api/scout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ niche: nicheInput.value, country: countrySel.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    setMsg(`Checked ${data.found}. ${data.added} new, ${data.updated} refreshed${data.unreachable ? `, ${data.unreachable} could not be checked` : ""}.`);
    await load();
  } catch (err) {
    setMsg(err.message, true);
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = "Check brands";
  }
});

for (const s of [nicheInput, countrySel]) s.addEventListener("change", updateHint);
filterSel.addEventListener("change", renderList);

(async function init() {
  cfg = await (await fetch("/api/config")).json();
  for (const n of Object.keys(cfg.coverage)) nicheInput.append(el("option", { value: n, textContent: n }));
  for (const c of cfg.countries) countrySel.append(el("option", { value: c, textContent: c }));
  filterSel.append(el("option", { value: "all", textContent: "All statuses" }));
  for (const s of cfg.statuses) filterSel.append(el("option", { value: s, textContent: s }));
  updateHint();
  load();
})();

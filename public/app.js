const $ = (id) => document.getElementById(id);
const form = $("form");
const nicheInput = $("niche");
const countrySel = $("country");
const goBtn = $("go");
const errorEl = $("error");
const reportEl = $("report");
const emptyEl = $("empty");
const historyEl = $("history");
const historyEmpty = $("historyEmpty");

function block(title, ...content) {
  return el("section", { class: "card block" }, el("h3", { textContent: title }), ...content);
}
const para = (t) => el("p", { textContent: t || "No information found." });

function renderReport(r) {
  reportEl.replaceChildren();

  const badges = el("div", { class: "badges" },
    el("span", { class: "badge", textContent: r.country }),
    el("span", { class: r.mode === "sample" ? "badge sample" : "badge", textContent: r.mode === "sample" ? "Sample research (18 Oct 2026)" : "Live research" }),
    el("span", { class: "badge", textContent: new Date(r.createdAt).toLocaleString() })
  );
  reportEl.append(el("div", { class: "report-head" }, el("h2", { textContent: r.niche }), badges));

  const p = r.plan || {};
  const offer = p.openingOffer || {};
  reportEl.append(
    block("1. The plan",
      el("p", {}, el("b", { textContent: "What they buy: " }), p.whatTheyBuy || "-"),
      el("p", {}, el("b", { textContent: "Ad spend signals: " }), p.adSpendSignals || "-"),
      el("p", {}, el("b", { textContent: "Your service fit: " }), p.serviceFit || "-")
    ),
    block("Opening offer",
      el("dl", { class: "offer" },
        el("dt", { textContent: "Offer" }), el("dd", { textContent: offer.name || "-" }),
        el("dt", { textContent: "Test price" }), el("dd", { textContent: offer.priceUSD ? `$${offer.priceUSD}` : "-" }),
        el("dt", { textContent: "Scope" }), el("dd", { textContent: offer.scope || "-" })
      ),
      el("p", { class: "muted", textContent: "Test prices, not verified market averages." })
    ),
    block("Risks to watch", el("ul", { class: "risks" }, ...(p.risks || []).map((t) => el("li", { textContent: t }))))
  );

  const rs = r.research || {};
  reportEl.append(
    block("2. The research",
      el("p", {}, el("b", { textContent: `Free ad data in ${r.country}: ` }), rs.adData || "-"),
      el("p", {}, el("b", { textContent: `Market backdrop in ${r.country} (all categories, not just this niche): ` }), rs.market || "-"),
      el("p", {}, el("b", { textContent: "Outreach rules: " }), rs.rules || "-")
    )
  );
  if (rs.caveat) reportEl.append(el("div", { class: "caveat", textContent: rs.caveat }));

  const links = (r.sources || []).map((s) => ({ ...s, url: safeUrl(s.url) })).filter((s) => s.url);
  if (links.length) {
    reportEl.append(block("Sources", el("ul", { class: "sources" }, ...links.map((s) => el("li", {}, el("a", { href: s.url, textContent: s.title }))))));
  }

  emptyEl.hidden = true;
  reportEl.hidden = false;
}

function showError(msg) { errorEl.textContent = msg; errorEl.hidden = !msg; }

async function loadHistory() {
  const rows = await (await fetch("/api/reports")).json();
  historyEl.replaceChildren();
  historyEmpty.hidden = rows.length > 0;
  for (const row of rows) {
    const btn = el("button", { type: "button" }, row.niche, el("small", { textContent: `${row.country} · ${new Date(row.createdAt).toLocaleDateString()}` }));
    btn.addEventListener("click", async () => {
      const res = await fetch(`/api/reports/${row.id}`);
      if (res.ok) { showError(""); renderReport(await res.json()); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
    historyEl.append(el("li", {}, btn));
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  goBtn.disabled = true;
  goBtn.textContent = "Researching...";
  try {
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ niche: nicheInput.value, country: countrySel.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    renderReport(data);
    loadHistory();
  } catch (err) {
    showError(err.message);
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = "Research it";
  }
});

(async function init() {
  const cfg = await (await fetch("/api/config")).json();
  for (const c of cfg.countries) countrySel.append(el("option", { value: c, textContent: c }));
  $("hint").textContent = cfg.hasKey
    ? "Live research is on. Any niche works."
    : "Live research is off (no API key yet). Sample niches available: supplements, skincare, pet.";
  loadHistory();
})();

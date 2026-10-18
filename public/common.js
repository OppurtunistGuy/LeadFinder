// Shared by every page. Builds elements with textContent only, so text from research or
// from the web can never inject markup into the page.
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "href") { node.href = v; node.target = "_blank"; node.rel = "noopener noreferrer"; }
    else node[k] = v;
  }
  for (const kid of kids) node.append(kid);
  return node;
}

function safeUrl(u) {
  try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:" ? p.href : null; }
  catch { return null; }
}

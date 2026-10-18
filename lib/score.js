// 8-point score from what the public website shows. These are signals, not proof, and the notes say so.

export const MAX_SCORE = 8;

export function scoreSite(c) {
  if (!c || !c.reachable) return null;
  const reasons = [];
  const add = (label, points, max, note) => reasons.push({ label, points, max, note });

  const p = c.pixels.length;
  add("Set up for paid ads", p >= 2 ? 2 : p, 2,
    p ? `Ad tracking found: ${c.pixels.join(", ")}. This shows they are set up for ads, not that ads are running right now.` : "No ad tracking found on the homepage.");

  const v = c.videos;
  add("Room for motion ads", v === 0 ? 2 : v === 1 ? 1 : 0, 2,
    v === 0 ? "No video on the homepage." : v === 1 ? "Only one video on the homepage." : `${v} videos on the homepage, so they already invest in video.`);

  const act = (c.promo ? 1 : 0) + (c.social.length ? 1 : 0);
  add("Active marketing", act, 2,
    [c.promo ? "Promotions on the homepage" : "", c.social.length ? `Social links: ${c.social.join(", ")}` : ""].filter(Boolean).join(". ") || "No promotions or social links on the homepage.");

  add("Reachable contact", c.emails.length ? 1 : 0, 1,
    c.emails.length ? `Public email on their site: ${c.emails[0]}.` : "No public email found. No named decision-maker either way.");

  const cap = c.platform && c.tools.length ? 1 : 0;
  add("Likely able to pay", cap, 1,
    cap ? `${c.platform} shop with ${c.tools.join(", ")}.` : "Not enough signs of a funded marketing setup.");

  const score = reasons.reduce((n, r) => n + r.points, 0);
  return { score, max: MAX_SCORE, reasons };
}

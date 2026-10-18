import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "./paths.js";

export const STATUSES = ["new", "approved", "contacted", "replied", "call booked", "proposal", "won", "lost", "skipped"];

const file = () => path.join(dataDir(), "leads.json");

export function readLeads() {
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8"));
  } catch {
    return [];
  }
}

const write = (rows) => fs.writeFileSync(file(), JSON.stringify(rows, null, 2));

// The same company from the same source must never appear twice.
const keyOf = (l) => `${l.source}|${String(l.sourceId || l.sourceUrl || l.company || "").toLowerCase()}`;

export function addLeads(items) {
  const rows = readLeads();
  const seen = new Set(rows.map(keyOf));
  let added = 0;
  for (const item of items) {
    const lead = { id: crypto.randomUUID(), status: "new", foundAt: new Date().toISOString(), ...item };
    if (seen.has(keyOf(lead))) continue;
    seen.add(keyOf(lead));
    rows.push(lead);
    added++;
  }
  write(rows);
  return { added, duplicates: items.length - added };
}

export function updateLead(id, patch) {
  const rows = readLeads();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) throw new Error("Unknown status");
    row.status = patch.status;
    row.statusChangedAt = new Date().toISOString();
  }
  write(rows);
  return row;
}

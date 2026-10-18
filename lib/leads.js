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

// Fields a re-check may refresh. Status, notes and the id always stay as the user left them.
const REFRESH = ["signal", "score", "scoreMax", "reasons", "contact", "evidence", "checkedAt", "unreachable"];

export function addLeads(items) {
  const rows = readLeads();
  const byKey = new Map(rows.map((r) => [keyOf(r), r]));
  let added = 0;
  let updated = 0;
  for (const item of items) {
    const lead = { id: crypto.randomUUID(), status: "new", foundAt: new Date().toISOString(), ...item };
    const old = byKey.get(keyOf(lead));
    if (old) {
      if (item.checkedAt) {
        for (const f of REFRESH) if (f in item) old[f] = item[f];
        updated++;
      }
      continue;
    }
    byKey.set(keyOf(lead), lead);
    rows.push(lead);
    added++;
  }
  write(rows);
  return { added, updated, duplicates: items.length - added };
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

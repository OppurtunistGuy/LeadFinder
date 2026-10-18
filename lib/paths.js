import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Tests point this at a temp folder with CF_DATA_DIR.
export function dataDir() {
  const dir = process.env.CF_DATA_DIR || path.join(root, "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

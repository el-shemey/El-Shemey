// Load .env for database-backed tests without adding dependencies.
import { readFileSync } from "node:fs";
try {
  const raw = readFileSync(new URL("./.env", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env — offline unit tests still run
}

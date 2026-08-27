/**
 * Client/server boundary check (Phase 3.5 hardening).
 *
 * Rule: files declaring "use client" must never import server-only modules
 * (Prisma, repositories, services, payment/delivery internals).
 *
 *   npm run check:boundaries
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["components", "features", "app"];
const FORBIDDEN = [
  "@prisma/client",
  "lib/server/db",
  "lib/server/auth-service",
  "lib/server/admin-repo",
  "lib/server/learning-repo",
  "lib/server/entitlement-provider",
  "lib/server/delivery",
  "lib/server/payments/provider",
  "lib/server/auth/password",
];

let failures = 0;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, "utf8");
    const isClientComponent = /^["']use client["']/m.test(src);
    if (!isClientComponent) continue; // server surfaces may import freely

    for (const bad of FORBIDDEN) {
      if (src.includes(`from "${bad}`) || src.includes(`from '${bad}`)) {
        console.error(
          `BOUNDARY VIOLATION: client file ${file.replace(ROOT + "\\", "")} imports "${bad}"`,
        );
        failures += 1;
      }
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} boundary violation(s) found.`);
  process.exit(1);
}
console.log("client/server boundary check: OK");

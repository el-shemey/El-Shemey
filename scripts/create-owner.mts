import { PrismaClient } from "@prisma/client";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hash as argonHash } from "@node-rs/argon2";

/**
 * Creates (or resets) the local OWNER account.
 * Dev-only convenience: writes credentials to OWNER-LOGIN.txt (gitignored).
 * Change the password after first sign-in.
 */

const prisma = new PrismaClient();
const EMAIL = "owner@el-shemey.local";

const password = "Owner-" + randomBytes(9).toString("base64url");
const passwordHash = await argonHash(password, {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

const user = await prisma.user.upsert({
  where: { email: EMAIL },
  create: {
    email: EMAIL,
    name: "Owner",
    passwordHash,
    emailVerified: new Date(),
    role: "ADMIN",
  },
  update: { passwordHash, emailVerified: new Date(), role: "ADMIN" },
  select: { id: true, email: true },
});

// Invalidate any old sessions; verification is already satisfied.
await prisma.user.update({
  where: { id: user.id },
  data: { sessionVersion: { increment: 1 } },
});

mkdirSync(".", { recursive: true });
writeFileSync(
  "OWNER-LOGIN.txt",
  [
    "EL-SHEMEY LOCAL OWNER ACCOUNT (development only)",
    `URL:      http://localhost:3000/en/login`,
    `Admin:    http://localhost:3000/admin`,
    `Email:    ${EMAIL}`,
    `Password: ${password}`,
    "",
    "- Stored in OWNER-LOGIN.txt (gitignored).",
    "- Sign in, then change the password via Forgot-password flow if desired",
    "  (dev reset links land in .dev-emails/outbox.jsonl).",
  ].join("\n"),
  "utf8",
);

appendFileSync(
  "promote-result.txt",
  JSON.stringify({ ok: true, ownerId: user.id }) + "\n",
);
await prisma.$disconnect();

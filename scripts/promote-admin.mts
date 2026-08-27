import { PrismaClient } from "@prisma/client";
import { appendFileSync } from "node:fs";

const prisma = new PrismaClient();
const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  appendFileSync(
    "promote-result.txt",
    "Usage: npx tsx scripts/promote-admin.mts <email>\n",
  );
} else {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      appendFileSync("promote-result.txt", JSON.stringify({ found: false }) + "\n");
    } else {
      const updated = await prisma.user.update({
        where: { email },
        data: {
          role: "ADMIN",
          // Ensure the promoted user can actually sign in without hitting
          // the verification gate (dev accounts may be unverified).
          ...(user.emailVerified ? {} : { emailVerified: new Date() }),
        },
        select: { email: true, role: true, emailVerified: true },
      });
      appendFileSync(
        "promote-result.txt",
        JSON.stringify({ ok: true, ...updated }) + "\n",
      );
    }
  } catch (e) {
    appendFileSync("promote-result.txt", "ERROR: " + (e as Error).message + "\n");
  }
}
await prisma.$disconnect();

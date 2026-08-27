import "server-only";
import { getMailProvider, mailMode } from "../lib/server/mail-providers";
import { appendFileSync } from "node:fs";

/**
 * Real-delivery test command (Phase 4 email fix).
 *
 *   npm run mail:test -- to=you@gmail.com
 *
 * Sends a test message through the ACTIVE provider (SMTP if configured,
 * dev outbox otherwise) and reports the outcome. Never prints credentials.
 */
async function main() {
  const arg = process.argv.find((a) => a.startsWith("to="));
  const to = arg?.slice(3);

  const mode = mailMode();
  console.log(`[mail] active mode: ${mode.mode}${mode.host ? ` (${mode.host})` : ""}`);
  console.log(`[mail] MAIL_FROM: ${mode.from ?? "(unset — dev mode)"}`);

  if (!to) {
    console.log("[mail] usage: npm run mail:test -- to=<address>");
    process.exit(1);
  }

  try {
    await getMailProvider().send({
      to,
      subject: "EL-SHEMEY test email",
      locale: "en",
      kind: "NOTICE",
      actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/en`,
    });
    appendFileSync("mail-test-result.txt", `ACCEPTED to=${to}\n`);
    console.log("[mail] ACCEPTED by provider ✓");
  } catch (error) {
    const message = (error as Error).message;
    // Safe subset only — nodemailer auth errors never include the password.
    appendFileSync(
      "mail-test-result.txt",
      `REJECTED to=${to} error=${message.split("\n")[0]}\n`,
    );
    console.error("[mail] FAILED:", message.split("\n")[0]);
    process.exit(1);
  }
}

main();

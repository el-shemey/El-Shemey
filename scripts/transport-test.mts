/**
 * TRANSPORT-LEVEL EMAIL TEST — isolated from all business logic.
 *
 *   npx tsx scripts/transport-test.mts to=you@gmail.com
 *
 * Bypasses OTP/auth/DB entirely. Calls the active transport directly and
 * reports the delivery level reached:
 *   A = local file written (dev outbox)
 *   B = SMTP transaction accepted (messageId returned)
 *   D = delivered to Gmail inbox (only verifiable by the human recipient)
 */
import nodemailer from "nodemailer";
import { appendFileSync, mkdirSync } from "node:fs";

const arg = process.argv.find((a) => a.startsWith("to="));
const to = arg?.slice(3);

console.log("=== EL-SHEMEY TRANSPORT TEST ===");
console.log("SMTP_HOST set:", Boolean(process.env.SMTP_HOST));
console.log("SMTP_PORT set:", process.env.SMTP_PORT ?? "(default 465)");
console.log("SMTP_USER set:", Boolean(process.env.SMTP_USER));
console.log("SMTP_PASS set:", Boolean(process.env.SMTP_PASS));
console.log("MAIL_FROM:", process.env.MAIL_FROM ?? "(unset)");
console.log("Destination:", to ?? "(MISSING — pass to=<address>)");

if (!to) process.exit(1);

// ---- Level A: dev outbox (current runtime default) ----
if (!process.env.SMTP_HOST) {
  mkdirSync(".dev-emails", { recursive: true });
  const entry = {
    to,
    subject: "EL-SHEMEY EMAIL TRANSPORT TEST",
    body: "This is a transport-level test from EL-SHEMEY.",
    level: "A — local file written only",
    at: new Date().toISOString(),
  };
  appendFileSync(".dev-emails/outbox.jsonl", JSON.stringify(entry) + "\n");
  console.log("\nRESULT: LEVEL A — written to .dev-emails/outbox.jsonl");
  console.log("NO real provider is configured. Nothing left this machine.");
  console.log("\nTo reach level B/D add to .env:");
  console.log("  SMTP_HOST=smtp.gmail.com");
  console.log("  SMTP_PORT=465");
  console.log("  SMTP_USER=<your gmail address>");
  console.log("  SMTP_PASS=<16-char Google App Password>");
  console.log("  MAIL_FROM=<your gmail address>");
  process.exit(0);
}

// ---- Level B: real SMTP send (Gmail-ready) ----
try {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: String(process.env.SMTP_PORT ?? "465") === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Verify connection + credentials first (catches auth failures cleanly)
  await transporter.verify();
  console.log("SMTP connection + authentication: OK");

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "EL-SHEMEY EMAIL TRANSPORT TEST",
    text: "This is a transport-level test from EL-SHEMEY.",
  });

  console.log("\nRESULT: LEVEL B — SMTP ACCEPTED");
  console.log("messageId:", info.messageId);
  console.log("response :", info.response); // e.g. "250 2.0.0 OK ... - gsmtp"
  console.log("accepted :", JSON.stringify(info.accepted));
  console.log("rejected :", JSON.stringify(info.rejected));
  console.log("\nLevel D (Gmail inbox) must be confirmed by the recipient.");
} catch (error: unknown) {
  const err = error as {
    code?: string;
    responseCode?: number;
    response?: string;
    command?: string;
    message?: string;
  };
  console.error("\nRESULT: TRANSPORT ERROR");
  console.error("code        :", err.code ?? "(none)");
  console.error("smtp response:", err.responseCode ?? "-", err.response ?? "");
  console.error("failed cmd  :", err.command ?? "-");
  console.error("message     :", err.message?.split("\n")[0]);
  if (/535|530|authentication/i.test(err.message ?? "")) {
    console.error("→ AUTH FAILED. Gmail requires a 16-char APP PASSWORD");
    console.error(
      "  (Google Account → Security → 2-Step Verification → App passwords).",
    );
    console.error("  Normal account passwords are always rejected.");
  }
  process.exit(1);
}

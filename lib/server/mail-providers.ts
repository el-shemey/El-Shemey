import nodemailer from "nodemailer";
import { appendFileSync, mkdirSync } from "node:fs";

/**
 * Email provider abstraction (Phase 4 / delivery fix).
 *
 * Selection (first match wins):
 *   1. SMTP_HOST set  → real SMTP delivery (Gmail-ready: use an APP PASSWORD,
 *      never the account password; Gmail rejects plain passwords).
 *   2. Otherwise      → DevMailProvider writes `.dev-emails/outbox.jsonl`
 *
 * SECURITY: credentials come exclusively from environment variables and are
 * never logged. A message is reported "sent" only after the SMTP server
 * accepts it (transport.sendMail resolves).
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Locale of the recipient UI at send time. */
  locale: "en" | "ar";
  /** Legacy link support (NOTICE/test messages only). */
  actionUrl?: string;
  kind: "VERIFY_EMAIL" | "PASSWORD_RESET" | "NOTICE";
  /** 6-digit OTP rendered in the email body (never logged). */
  otp?: string;
  otpExpiresMinutes?: number;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

/* ------------------------------ Dev adapter ------------------------------ */

export class DevMailProvider implements MailProvider {
  async send(message: MailMessage): Promise<void> {
    const dir = ".dev-emails";
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(
        `${dir}/outbox.jsonl`,
        JSON.stringify({ ...message, sentAt: new Date().toISOString() }) + "\n",
        "utf8",
      );
    } catch {
      // Never crash auth flows because local mail capture failed.
    }
  }
}

/* ------------------------------ SMTP adapter ----------------------------- */

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

export class SmtpMailProvider implements MailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    const rawPort = String(process.env.SMTP_PORT ?? "465").trim();
    const port = Number(rawPort) || 465;
    const secure = port === 465;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      // Port 587 must enforce STARTTLS — opportunistic TLS is not enough for credential-bearing SMTP
      requireTLS: port === 587 ? true : undefined,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: { minVersion: "TLSv1.2" },
    });
  }

  async send(message: MailMessage): Promise<void> {
    // MAIL_FROM defaults to SMTP_USER per existing behavior; validate shape when explicit
    const rawFrom = (process.env.MAIL_FROM || process.env.SMTP_USER || "").trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const from = emailRe.test(rawFrom) ? rawFrom : (process.env.SMTP_USER || "").trim();
    try {
      const info = await this.transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.actionUrl
          ? `${message.subject}\n\n${message.actionUrl}`
          : message.subject,
        html: renderEmailHtml(message),
      });
      // sendMail resolving = provider accepted the message.
      if (!info.messageId) throw new Error("SMTP_ACCEPT_FAILED");
    } catch (error) {
      // Never leak credentials/OTP: coarsen auth failures and any error reflecting secrets
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      const pass = process.env.SMTP_PASS;
      if (pass && (msg.includes(pass) || /auth|credential|password/i.test(msg))) {
        // coarsen auth failures without echoing secrets
        throw new Error("SMTP_AUTH_FAILED");
      }
      if (message.otp && msg.includes(message.otp)) {
        throw new Error("SMTP_SEND_FAILED");
      }
      throw error;
    }
  }
}

/* -------------------------------- Factory -------------------------------- */

const globalForMail = globalThis as unknown as { mail: MailProvider | undefined };

export function getMailProvider(): MailProvider {
  if (!globalForMail.mail) {
    globalForMail.mail = smtpConfigured()
      ? new SmtpMailProvider()
      : new DevMailProvider();
  }
  return globalForMail.mail;
}

/** Diagnostics without leaking secrets. */
export function mailMode(): { mode: "smtp" | "dev"; host?: string; from?: string } {
  return smtpConfigured()
    ? { mode: "smtp", host: process.env.SMTP_HOST, from: process.env.MAIL_FROM }
    : { mode: "dev" };
}
/** Professional EL-SHEMEY email template. */
function renderEmailHtml(message: MailMessage): string {
  const otpBlock = message.otp
    ? `<div style="margin:28px 0;text-align:center">
         <div style="font-size:12px;letter-spacing:2px;color:#9aa5b4;text-transform:uppercase">
           Verification code
         </div>
         <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#f4f7fb;
                     background:#12141f;display:inline-block;padding:14px 26px;
                     border-radius:8px;border:1px solid #33405a;margin-top:10px">
           ${message.otp}
         </div>
         <div style="font-size:12px;color:#6b7093;margin-top:10px">
           Expires in ${message.otpExpiresMinutes ?? 10} minutes &middot; &nbsp;صالح لمدة ${message.otpExpiresMinutes ?? 10} دقائق
         </div>
       </div>`
    : "";
  const action = message.actionUrl
    ? `<p style="text-align:center;margin:24px 0">
         <a href="${message.actionUrl}"
            style="background:#5872f5;color:#ffffff;padding:12px 24px;border-radius:4px;
                   text-decoration:none;font-family:sans-serif;font-size:14px">
           Open link
         </a>
       </p>`
    : "";
  return `<div style="background:#05070b;padding:40px 20px;font-family:'Segoe UI',Arial,sans-serif">
     <div style="max-width:520px;margin:0 auto;background:#0f141d;border:1px solid #202836;
                 border-radius:8px;padding:36px;color:#f4f7fb">
       <p style="font-family:monospace;font-size:11px;letter-spacing:3px;color:#56c2ff;
                 text-transform:uppercase;margin:0 0 18px">
         EL-SHEMEY &middot; Practical AI education
       </p>
       <h2 style="margin:0 0 16px;font-size:22px">${message.subject}</h2>
       ${otpBlock}
       ${action}
       <hr style="border:none;border-top:1px solid #262a3d;margin:28px 0" />
       <p style="font-size:11px;color:#69748a;line-height:1.6;margin:0">
         If you didn't request this, you can safely ignore this email.
         &middot; &nbsp;<span dir="rtl">إذا لم تطلب هذا، تجاهل الرسالة بأمان.</span>
       </p>
     </div>
   </div>`;
}
export class DeliveryNotConfiguredError extends Error {
  constructor(public channel: "EMAIL" | "SMS") {
    super(`DELIVERY_NOT_CONFIGURED:${channel}`);
  }
}

/** Auth-path getter: refuses silent dev fallback in production.
 *  In development, falls back to the existing DevMailProvider (outbox)
 *  so registration/verification can be tested without real SMTP.
 *  Test env (`NODE_ENV=test`) remains strict to preserve existing tests.
 */
export function requireRealMailProvider(): MailProvider {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "development") return new DevMailProvider();
    throw new DeliveryNotConfiguredError("EMAIL");
  }
  return new SmtpMailProvider();
}

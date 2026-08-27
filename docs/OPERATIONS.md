# EL-SHEMEY — Operations Runbook

> Audience: the owner / on-call engineer. Marked sections are
> **LOCAL ONLY**, **STAGING**, or **PRODUCTION**. Nothing here invents
> credentials — every external dependency has a documented configuration gate.

## 1. Environments

|                | LOCAL                           | STAGING                        | PRODUCTION          |
| -------------- | ------------------------------- | ------------------------------ | ------------------- |
| Database       | local PostgreSQL                | Supabase branch                | Supabase production |
| Payments       | fakepay (dev) or Paymob sandbox | Paymob sandbox                 | Paymob live         |
| Video storage  | `local-fs` driver               | object storage (S3-compatible) | object storage      |
| Email          | dev outbox adapter              | real provider (test sender)    | real provider       |
| Error tracking | console JSON                    | optional Sentry DSN            | Sentry DSN          |

## 2. Environment variables

Authoritative list with comments: `.env.example`. Rules:

- Server-only secrets NEVER use the `NEXT_PUBLIC_` prefix.
- The app fails safely when a provider is requested without credentials
  (`ProviderNotConfiguredError` — no fake success paths).
- Health of each integration is visible at `/admin/system`.

## 3. Database

### Migrations

```bash
npx prisma migrate deploy     # applies pending migrations (deterministic SQL)
npx prisma migrate status     # verify drift
```

Migrations are hand-written, ordered, and non-destructive. Never edit an
applied migration; add a new one.

### Backups — PRODUCTION (checklist; execute once Supabase project exists)

- [ ] Enable Supabase point-in-time restore + daily snapshots (retention ≥ 14 days, dashboard → Database → Backups).
- [ ] Verify a restore into a scratch branch/project monthly.
- [ ] Before destructive migrations: manual snapshot + record migration id.

### Restore procedure — PRODUCTION (not yet drilled)

1. Create a fresh Supabase branch/project restored from target snapshot/timestamp.
2. Point `DATABASE_URL`/`DIRECT_URL` at it; run `npx prisma migrate status`.
3. Smoke: `/api/health/ready`, admin login, one lesson playback.
4. Swap connection strings back to primary only after verification.

**LOCAL ONLY:** `pg_dump elshemey_dev > backup.sql` before experiments.

## 4. Deployment checklist — PRODUCTION

- [ ] All env vars set per `.env.example`; no `NEXT_PUBLIC_*` secrets.
- [ ] `npx prisma migrate deploy` clean against production DB.
- [ ] `npm run build && npm run start` behind HTTPS (HSTS enforced by host).
- [ ] `/api/health/live` and `/api/health/ready` return 200.
- [ ] Webhook URL registered in Paymob dashboard (transaction order) and reachable.
- [ ] Admin account created via `scripts/create-owner.mts`; owner password rotated.
- [ ] Rate limiting backend chosen (in-memory limiter is single-instance only).

## 5. Rollback procedure

- Application: redeploy previous image/commit; Prisma migrations stay forward-only — write compensating migrations if schema must revert.
- Bad release with data writes: restore DB from snapshot (§3), then redeploy last-good code.

## 6. Storage

- Development: filesystem under `VIDEO_STORAGE_ROOT` (gitignored). Not durable — treat as disposable.
- Production: S3-compatible `VideoStorageProvider` driver implemented (`lib/server/video/storage-s3.ts`, SigV4, no SDK).
  Activation: `VIDEO_STORAGE_DRIVER=s3` + `S3_BUCKET/S3_REGION/S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY`.
  Missing S3 credentials → `VIDEO_STORAGE_S3_MISCONFIGURED` (fail-loud, no silent fallback).
  Private bucket by contract; access only via authorized stream/download routes.

## 7. Email (SMTP)

**Required variables (production):** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (all three) + `SMTP_PORT` (default 465) + `MAIL_FROM` (defaults to `SMTP_USER` when omitted — existing behavior). See `.env.example` legend.

**Port / TLS expectations:**
- `SMTP_PORT=465` → `secure:true` (implicit TLS), production default for Gmail/standard providers.
- `SMTP_PORT=587` → `secure:false` with `requireTLS:true` (STARTTLS enforced), requires server STARTTLS; `tls.minVersion=TLSv1.2` enforced.
- Timeouts: `connectionTimeout 10s`, `greetingTimeout 10s`, `socketTimeout 15s`.
- Auth errors are coarsened to `SMTP_AUTH_FAILED`; any error reflecting `SMTP_PASS` or OTP is stripped to a coarse code without leaking secrets.

**Production vs development:**
- **Production:** `requireRealMailProvider()` throws `DELIVERY_NOT_CONFIGURED:EMAIL` when any of `HOST/USER/PASS` missing — never falls back to `DevMailProvider`. OTPs remain hashed (SHA-256) at rest; `DevMailProvider` is not selected.
- **Development:** `DevMailProvider` writes `.dev-emails/outbox.jsonl` (`{to,subject,otp,...}` + `sentAt`) when SMTP vars are absent; never crashes auth flows on capture failure.
- `MAIL_FROM` when explicit is validated as an email shape; invalid values fall back to `SMTP_USER`. Unset `MAIL_FROM` defaults to `SMTP_USER` (existing behavior; validated by regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`).

**Production delivery path:** `register → issueOtp (generateOtp 6-digit CSPRNG, 10 min TTL, SHA-256 hash, single-use) → requireRealMailProvider → SmtpMailProvider → nodemailer transport → HTML template (`renderEmailHtml`) with OTP + bilingual expiry (`Expires in 10 minutes / صالح لمدة 10 دقائق`). OTP is only in email body sent server-side; never returned to browser, never logged, `AuthEvent` stores `type/email/userId/outcome` only.

**Secret handling:** No `SMTP_PASS`, `AUTH_SECRET`, `S3_SECRET_ACCESS_KEY`, `PAYMOB_*` ever in logs/API/JWT/session/RSC. Diagnostics `mailMode()` returns `host/from` names only.

### 7.1 Manual SMTP smoke-test (staging/host, no real send until credentials intentionally configured)

Prerequisites: staging deploy with host env `SMTP_HOST/PORT/USER/PASS/MAIL_FROM` + `AUTH_SECRET` + `NEXT_PUBLIC_APP_URL=https://staging...` (valid HTTPS).

1. `SMTP_HOST` configured? `Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS)` true → `requireRealMailProvider` selects `SmtpMailProvider` (verify via `/admin/system` email row or `mailMode()`).
2. Register test account (email): `POST /[lang]/register` → expect `ok + masked` (no OTP in response).
3. Check inbox: receive `Your EL-SHEMEY verification code: <6-digit>` with OTP + 10 min expiry, bilingual.
4. Verify OTP at `/[lang]/verify-email` → `emailVerified` set, reused OTP fails.
5. Request `RESET_PASSWORD` at `/[lang]/forgot-password` → receive second OTP email.
6. Reset password with OTP + new password (≥10 chars, letter+number) → `sessionVersion` increments, old session revoked (Task 1), login with new password succeeds, old password fails.
7. Verify no OTP in `stdout` JSON logs (`category` filter) and no `SMTP_PASS` in any error.
8. Simulate SMTP failure (stop SMTP/mock host): registration returns `DELIVERY_NOT_CONFIGURED` coarse error, no password leak.

**Do NOT print secret values.** Report only `configured / not-configured`; use `TEST_ONLY_PASSWORD` placeholders in tests.

## 8. Payments (Paymob)

- Sandbox first: set sandbox credentials + `PAYMOB_MODE=sandbox`, register the
  webhook URL, complete ONE verified sandbox transaction (the 7B gate).
- Production switch: `PAYMOB_MODE=production` + live keys. Webhook contract,
  state machine and audit behavior are identical (see docs/PAYMENTS.md §10).

## 9. Health checks & monitoring

- `GET /api/health/live` → process alive; no DB touch; always cheap.
- `GET /api/health/ready` → verifies DB within 3 s timeout, TTL-cached 15 s;
  503 on failure. Point uptime monitor at this endpoint.
- Structured error logs emit single-line JSON on stdout (category, message,
  context) — attach a log drain; wire Sentry via `lib/server/errors.ts`.

## 10. Incident response

1. Check `/admin/system` + `/api/health/ready`.
2. Triage by category in structured logs (`DATABASE`, `PAYMENT_PROVIDER`, …).
3. For payment anomalies: pause checkout by removing Paymob env vars
   (adapter refuses to operate); reconcile via `/admin/payments` + PaymentEvent rows.
4. Security incident: rotate `AUTH_SECRET` (invalidates all sessions), revoke
   sessions for affected users from `/admin/users/[id]`, review `/admin/audit`.

## 11. Admin account recovery

- Lost owner access: create/re-promote via `scripts/promote-admin.mts` using
  direct DB access. Session revocation is automatic on role change.
- Compromised user: `/admin/users/[id]` → "Revoke all sessions".

## 12. Log inspection

- Audit trail: `/admin/audit` (filter actor/action/entity/date, paginated).
- Analytics events: `/admin/analytics` aggregates; rows in `AnalyticsEvent`.
- Application errors: stdout JSON — filter by `"category"`.

## 13. Troubleshooting quick table

| Symptom                         | First check                        | Likely cause                              |
| ------------------------------- | ---------------------------------- | ----------------------------------------- |
| Login fails platform-wide       | `AUTH_SECRET` unchanged?           | secret rotation invalidating cookies      |
| Videos 404 for students         | lesson publish chain + entitlement | FREE/PRO gating working as designed       |
| Checkout says "being finalized" | `/admin/settings` Paymob row       | credentials missing/mode wrong            |
| Webhook 401                     | HMAC secret + raw body passthrough | signature mismatch                        |
| Emails not arriving             | `/admin/settings` email row        | provider unconfigured (dev outbox active) |

## 14. Phase 10.6 — Free deployment preparation

### 14.1 FREE / LOCAL PREPARATION (no external service)

All completed without cost:

- [x] Code, tests (198/198), typecheck, lint, build, boundaries — PASS
- [x] Prisma schema validated; 9 deterministic migrations; `migrate deploy` is production command
- [x] Seed idempotent (categories/courses/plans) — dev-only, never auto-run in production
- [x] S3-compatible storage driver implemented (SigV4, no SDK) — VIDEO_STORAGE_DRIVER=s3
- [x] Email adapter: dev outbox active; SMTP seam ready; OTPs hashed, never exposed
- [x] Paymob adapter: HMAC-SHA512, integration_id validation, amount tamper check — credential-bound
- [x] FakePay double-gated (NODE_ENV !== production && FAKEPAY_ENABLED=1) — never in prod
- [x] CSP/HSTS headers active; NEXT_PUBLIC_* contains no secrets
- [x] Health probes: /api/health/live (cheap) + /api/health/ready (DB 3s timeout, 15s TTL)
- [x] CI hardened: Postgres → validate → migrate deploy → generate → seed → lint → typecheck → format → tests → boundaries → build → secret scan
- [x] .env.example complete with safe placeholders; no real credentials

### 14.2 EXTERNAL PRODUCTION ACTIONS (requires account/credential)

| #   | WHAT                         | WHY                     | REQUIRED CREDENTIALS                                                                                | VERIFICATION                                              | STATUS                        |
| --- | ---------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------- |
| 1   | Production PostgreSQL (Supabase) | Runtime data            | DATABASE_URL (pooled 6543?pgbouncer=true) + DIRECT_URL (5432 direct)                               | `npx prisma migrate deploy` + /api/health/ready 200       | BLOCKED                       |
| 2   | Backup                       | PITR + snapshots        | Supabase dashboard → Database → Backups                                                             | Snapshot exists, retention ≥14d                           | BLOCKED — DB not provisioned  |
| 3   | Restore drill                | Prove recovery          | Snapshot + scratch branch/project                                                                   | Restore → migrate status → smoke                          | BLOCKED — DB not provisioned  |
| 4   | Email provider (SMTP)        | OTP/verify/reset        | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM                                               | Send verify email; check inbox                            | BLOCKED                       |
| 5   | S3 storage                   | Durable video/resources | S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY + VIDEO_STORAGE_DRIVER=s3 | Upload → stream → delete via authorized routes            | BLOCKED                       |
| 6   | Paymob sandbox               | Verify adapter          | PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_HMAC_SECRET, PAYMOB_IFRAME_ID, PAYMOB_MODE=sandbox    | One end-to-end sandbox transaction                        | BLOCKED                       |
| 7   | Paymob production            | Live billing            | Live Paymob keys + PAYMOB_MODE=production                                                           | Live transaction + webhook 200                            | BLOCKED                       |
| 8   | Hosting (Node/Next.js)       | Run app                 | Host env vars + Node 22                                                                             | `npm run build && npm run start` behind HTTPS, probes 200 | BLOCKED                       |
| 9   | Domain                       | Public URL              | Domain purchase                                                                                     | DNS resolves                                              | BLOCKED                       |
| 10  | HTTPS                        | TLS + HSTS              | Auto via host (e.g. Vercel)                                                                         | HSTS header + https://                                    | BLOCKED — depends on 8+9      |
| 11  | Monitoring                   | Uptime/alerts           | Optional; point at /api/health/ready; SENTRY_DSN optional                                           | Probe returns 200/503 correctly                           | OPTIONAL — free tier possible |
| 12  | Legal                        | Privacy/terms/refund    | Owner + legal review                                                                                | Pages published                                           | BLOCKED                       |

> No step above is faked. Each BLOCKED item requires a real external account/credential.
> Provision one service at a time; re-run `npx prisma validate && npm run build` after each.

### 14.3 Hosting requirements (provider-agnostic)

- Build: `npm ci && npx prisma generate && npm run build` (Next.js 16.3.2, Node 22)
- Start: `npm run start` (or `npx prisma migrate deploy && npm run start` on first deploy)
- Runtime: Node.js 22; standard Next.js server (routes, actions, streaming, Range requests)
- Env: all vars from .env.example (host-provided, never committed)
- Database: PostgreSQL (Supabase) with pooled (6543?pgbouncer=true) + direct (5432) URLs
- Storage: S3-compatible private bucket (when VIDEO_STORAGE_DRIVER=s3)
- Email: SMTP credentials
- Payments: Paymob credentials + webhook URL `https://YOUR-DOMAIN/api/webhooks/payments/paymob?hmac=<hmac>`
- HTTPS: required in production (HSTS already sent; cookies Secure via Auth.js)

### 14.4 Domain → HTTPS dependency chain

```
Domain purchase
  → DNS → Hosting
    → HTTPS/TLS (host provisions)
      → NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN
        → Webhook URLs (Paymob dashboard)
        → Canonical URLs (sitemap, robots, SEO)
        → Email links (verify/reset)
```

No code depends on localhost in production — NEXT_PUBLIC_APP_URL defaults to https://el-shemey.com for sitemap/robots when unset.

### 14.5 Production readiness checklist

See Phase 10.6 report §16 Production Launch Matrix — canonical checklist updated per phase.

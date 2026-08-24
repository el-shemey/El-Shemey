# EL-SHEMEY — Security Architecture

> Security is architectural, not a patch phase. This document defines the controls each layer must implement.

## Threat Model Summary

Primary assets: user credentials, premium content/media, payment flows, admin capabilities, AI API keys.
Primary adversaries: credential stuffers, content pirates (bypassing paywall), abusers of free/AI endpoints, and opportunistic attackers against admin surfaces.

## 1. Authentication Controls

| Control | Implementation |
|---|---|
| Password hashing | Argon2id (appropriate memory/time params) |
| Email verification | Hashed token, 24h expiry, required before login |
| Password reset | Hashed single-use token, 30-min expiry, invalidates all sessions |
| Brute force | Rate limit login per IP + per account (exponential backoff); generic error messages |
| Session security | HttpOnly, Secure, SameSite=Lax cookies; server-side revocable sessions; rotation on privilege change |
| Session invalidation | On password change/reset; admin-forced logout capability |

No custom cryptography. Auth.js v5 primitives only.

## 2. Authorization Controls

- Every protected Server Action / route handler calls `requireUser()` / `requireRole()` guards — authorization inside the handler, never only in page/layout rendering.
- Roles checked against DB (fresh), not JWT claims alone.
- Admin routes additionally gated by middleware AND layout guard (defense in depth).
- Object-level checks everywhere: users can only read/write their own enrollments and progress.
- Admin actions (role change, refund, content delete) written to an `AuditLog` with actor, action, target, timestamp.

## 3. Entitlement Enforcement (paywall integrity)

The rule: **premium decisions happen server-side, at content-serving time.**

- Lesson pages fetch content server-side after entitlement check; premium lesson bodies are never sent to non-entitled clients (not "blurred", not hidden by CSS — absent from payload).
- API returns locked lessons as metadata-only (title + locked flag), no body/video reference.
- Video: Bunny Stream signed embed tokens, short TTL, issued only after entitlement check.
- Downloads: R2 presigned GET URLs, short TTL, issued per-user after entitlement check.
- No predictable asset URLs (no `/uploads/course-3/video.mp4` public paths).
- Cache-control: authenticated responses `private, no-store`; ISR only for public pages that contain no entitlement-dependent data.
- Rate-limit entitlement-sensitive endpoints to slow scraping.

Known residual risk: determined subscribers can screen-record. Accepted (business reality); watermarking considered post-MVP.

## 4. Application Security

| Area | Control |
|---|---|
| Input validation | Zod schemas on every mutation boundary (Server Actions, route handlers, webhooks) |
| Output encoding | React escaping defaults; no `dangerouslySetInnerHTML` on user content; rich text sanitized server-side |
| CSRF | Auth.js built-in CSRF tokens for auth routes; Server Actions have origin checks; SameSite cookies |
| SQL injection | Prisma parameterized queries exclusively |
| XSS | Strict CSP (below), sanitization of any rich-text input |
| Clickjacking | `frame-ancestors 'none'` except verified video embed frames |
| Headers | CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Dependencies | `npm audit` in CI; Dependabot/Renovate |
| Errors | No stack traces/secrets in responses; Sentry with scrubbing |

CSP baseline (tightened during hardening):
```
default-src 'self'; script-src 'self' 'nonce-*'; frame-src bunny.net;
img-src 'self' data: cdn.bunny.net; connect-src 'self' ...api origins
```

## 5. Rate Limiting & Abuse Prevention

| Endpoint class | Limit (initial) |
|---|---|
| Login / register / reset | 5/min per IP, 10/hour per account |
| Progress writes | sane per-user cap |
| Checkout initiation | 5/hour per user |
| Webhook endpoint | signature-gated; no public rate dependency |
| Future AI endpoints | per-user daily quota enforced server-side |

Implementation: Upstash Redis sliding window (or DB-backed fallback in early dev).

## 6. File & Media Security

- Uploads: presigned PUT to R2 restricted by content-type allowlist + size limits; server validates before issuing.
- Serving: presigned GET, short expiry, per-user issuance.
- Video: platform-signed playback tokens; never raw library URLs in client bundles.
- MIME sniffing disabled on serve (`X-Content-Type-Options: nosniff`).

## 7. Payment Security

- Webhooks: HMAC/signature verification before parsing into domain logic; raw-body handling correct; replay protection via event-ID dedup (`WebhookEvent` table); out-of-order tolerance via state machine transitions (illegal transitions rejected + alerted).
- Amounts validated server-side against Plan table — client-sent prices are display hints only.
- No card data ever touches our servers (provider-hosted checkout/PSP redirect).
- Secrets (HMAC keys, API keys) in environment variables only; rotated on suspicion.
- Refunds initiated from admin only, require SUPER_ADMIN or dual confirmation [OPEN: confirm owner preference].

## 8. AI Security (when features ship)

- Provider keys server-side only; no proxy-to-client key exposure.
- Per-user quotas + global spend caps; anomaly alerts.
- Prompt-injection defense: retrieved course content wrapped as untrusted data; system prompt forbids instruction-following from retrieved text; tool use (future) strictly allowlisted.
- Logging: prompts/responses logged privacy-consciously (retention limit, no secrets), documented in privacy policy.

## 9. Operational Security

- Backups: Neon PITR + daily dumps to R2 (30-day retention), restore tested quarterly.
- Monitoring/alerts: Sentry errors, webhook failure alerts, payment-state anomalies, uptime checks.
- Access: production DB access restricted; no shared credentials; 2FA on all infrastructure accounts (Vercel, Neon, R2, Paymob dashboard, Bunny).
- Audit logs retained ≥ 1 year.
- Incident response: simple runbook (detect → contain → communicate → review) documented before launch.

## 10. Privacy

- Collect minimum viable data; analytics without cross-site tracking (Plausible-class).
- Clear retention/deletion policy; account deletion flow (anonymize, retain financial records as legally required). [OPEN: Egypt PDPL compliance review]

## Hardening Checklist (executed in Phase 6)

- [ ] Abuse-case walkthrough per feature (auth bypass, IDOR, paywall bypass, webhook forgery, rate abuse)
- [ ] OWASP Top 10 review
- [ ] Dependency audit clean
- [ ] Header/CSP verified in prod
- [ ] Restore-from-backup drill
- [ ] Independent review of payment + entitlement code paths

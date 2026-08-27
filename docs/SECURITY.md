# EL-SHEMEY — Security Architecture

> Security is architectural, not a patch phase. This document defines the controls each layer must implement.

## Threat Model Summary

Primary assets: user credentials, premium content/media, payment flows, admin capabilities, AI API keys.
Primary adversaries: credential stuffers, content pirates (bypassing paywall), abusers of free/AI endpoints, and opportunistic attackers against admin surfaces.

## 1. Authentication Controls

| Control              | Implementation                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Password hashing     | Argon2id (appropriate memory/time params)                                                            |
| Email verification   | Hashed token, 24h expiry, required before login                                                      |
| Password reset       | Hashed single-use token, 30-min expiry, invalidates all sessions                                     |
| Brute force          | Rate limit login per IP + per account (exponential backoff); generic error messages                  |
| Session security     | HttpOnly, Secure, SameSite=Lax cookies; server-side revocable sessions; rotation on privilege change |
| Session invalidation | On password change/reset; admin-forced logout capability                                             |

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

| Area             | Control                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Input validation | Zod schemas on every mutation boundary (Server Actions, route handlers, webhooks)                      |
| Output encoding  | React escaping defaults; no `dangerouslySetInnerHTML` on user content; rich text sanitized server-side |
| CSRF             | Auth.js built-in CSRF tokens for auth routes; Server Actions have origin checks; SameSite cookies      |
| SQL injection    | Prisma parameterized queries exclusively                                                               |
| XSS              | Strict CSP (below), sanitization of any rich-text input                                                |
| Clickjacking     | `frame-ancestors 'none'` except verified video embed frames                                            |
| Headers          | CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy                                 |
| Dependencies     | `npm audit` in CI; Dependabot/Renovate                                                                 |
| Errors           | No stack traces/secrets in responses; Sentry with scrubbing                                            |

CSP baseline (tightened during hardening):

```
default-src 'self'; script-src 'self' 'nonce-*'; frame-src bunny.net;
img-src 'self' data: cdn.bunny.net; connect-src 'self' ...api origins
```

## 5. Rate Limiting & Abuse Prevention

| Endpoint class           | Limit (initial)                            |
| ------------------------ | ------------------------------------------ |
| Login / register / reset | 5/min per IP, 10/hour per account          |
| Progress writes          | sane per-user cap                          |
| Checkout initiation      | 5/hour per user                            |
| Webhook endpoint         | signature-gated; no public rate dependency |
| Future AI endpoints      | per-user daily quota enforced server-side  |

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

## Phase 3 security posture (as built)

**IMPLEMENTED NOW:** server-only Prisma singleton (`lib/server/db.ts`, guarded by `server-only` — client imports fail the build); DB credentials exclusively via env (`DATABASE_URL`); Zod validation schemas at every learning-mutation boundary (`lib/domain/schemas.ts`); server-authoritative completion (client input never sets completion truth); entitlement checks centralized in `canViewLesson` + `EntitlementProvider`; defensive progress reconciliation (orphaned records ignored); Payment schema encodes webhook idempotency ((provider, providerRef) unique + idempotencyKey) and prohibits sensitive payload storage by design.

**DEFERRED TO PHASE 4 (auth):** session issuance/verification, userId derivation from verified sessions, login/reset rate limiting, brute-force + enumeration protection, CSRF hardening for cookie flows.

**DEFERRED TO PHASE 5 (payments):** webhook signature verification, payment state machine enforcement, refund authorization, provider credential handling.

**DEFERRED TO PHASE 6+:** rate limiting on content endpoints, signed video URLs, security headers/CSP finalization, dependency audit cadence.

No complete-security claim is made until Phases 4–6 land their controls.

## Phase 4 security posture (as built)

**IMPLEMENTED NOW:** Argon2id credential hashing (@node-rs/argon2, unique salts); Auth.js v5 JWT sessions (7d, HttpOnly/Secure/SameSite=Lax via framework defaults, AUTH_SECRET env-only) with sessionVersion revocation verified server-side per protected surface; email verification + password reset with hashed single-use expiring tokens (SHA-256 at rest, timing-safe compare, sibling-token invalidation); enumeration-safe registration/reset/login responses; typed CredentialsSignin subclass only for EMAIL_NOT_VERIFIED behind a correct password; rate limiting boundary (per-IP + per-account buckets on login/register/reset/resend; in-memory dev impl, Upstash-ready interface); security headers baseline (nosniff, DENY frames, strict-origin-when-cross-origin, Permissions-Policy) applied globally; AuthEvent audit trail (type/email/userId/outcome only); coarse middleware gate + fine-grained requireUser()/requireRole() layered authorization.

**DEFERRED TO PHASE 5:** payment webhook signature verification, refund authorization, subscription state-machine enforcement, provider credential handling.

**DEFERRED TO LATER PHASES:** full CSP with nonces (designed alongside Bunny embeds in Phase 5/6), distributed rate limiting activation (interface ready), individual-session listing/revocation UI, OAuth providers.

## Phase 6 � /learn edge gate adjustment (verified)

The edge middleware no longer hard-blocks anonymous visitors on /[lang]/learn.
Reason: published FREE lessons are an intended PUBLIC PREVIEW (product access model).
The authorization layer remains entirely server-side:

- Dashboard/overview pages: getUser() ? redirect to login when anonymous.
- Lesson pages: anonymous visitors only ever reach getPreviewLessonView(), which
  returns published FREE lesson metadata/body only; PRO/unpublished ? redirect or 404.
- No signed video URL is ever generated for anonymous users (authorizePlayback requires
  a verified userId).
- Progress mutations (/api/learn/progress) require a session (401 otherwise).
  PRO content is never rendered server-side for unentitled users � not even in RSC payloads.

## Phase 10 � headers & provider isolation

- CSP active (default-src 'self'; frame-src limited to Paymob sandbox+production hosts; object-src 'none'; frame-ancestors 'none'). script-src retains 'unsafe-inline' (+ 'unsafe-eval' dev-only) � Next.js runtime requirement; nonce-based strict CSP documented as future hardening.
- HSTS always sent (browsers ignore over HTTP; mandatory once TLS is live).
- FakePay isolation enforced in code, not comments: registry resolves it only when NODE_ENV !== "production" AND FAKEPAY_ENABLED=1; production builds cannot select it.
- Account deletion: admin-initiated, cascades learning data, transfers created-media ownership to acting admin, RETAINS payment/audit rows (FK policy), audited as user.deleted_anonymized.

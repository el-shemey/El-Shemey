# EL-SHEMEY — Decision Log

> Every major decision: choice, reason, alternatives, trade-offs, risk, reversibility.

## D01 — Framework: Next.js App Router + TypeScript

- **Why:** RSC gives fast indexable public pages + secure server-first data access; one codebase for marketing + app; mature ecosystem.
- **Alternatives:** Remix (smaller ecosystem), Nuxt (Vue team familiarity unknown), separate SPA+API (doubles work).
- **Trade-offs:** framework churn risk; vendor coupling to Vercel features (mitigated: use standard primitives).
- **Risk:** low-medium. **Reversible:** medium (costly after Phase 3). **Status:** FIXED.

## D02 — Database: PostgreSQL (Neon managed) via Prisma

- **Why:** relational integrity fits subscriptions/entitlements; Neon branches mirror env-per-PR workflow; PITR backups.
- **Alternatives:** MySQL (equivalent, less branch DX), MongoDB (no — financial data wants constraints), Supabase DB (fine alternative if auth bundled there).
- **Risk:** low. **Reversible:** high early. **Status:** FIXED.

## D03 — Auth: Auth.js v5 credentials + email verification

- **Why:** self-owned sessions/data, no per-user vendor cost, full control of verification/reset flows, works with custom roles.
- **Alternatives:** Clerk (faster start, vendor lock-in + cost scaling, weaker AR-localization control), Supabase Auth (ties us to Supabase stack), NextAuth v4 (older).
- **Trade-offs:** we own password security and brute-force protection (documented in SECURITY.md); slower than managed initially.
- **Risk:** medium (correctness burden on us). **Reversible:** moderate.
- **Status:** ✅ OWNER RECONFIRMED for MVP. Authentication is a HIGH-RISK subsystem: no shortcuts on password hashing, email verification, password reset, secure sessions/cookies, rate limiting, brute-force protection, account-enumeration protection, or abuse prevention. Implementation belongs to its planned phase (Phase 3+); Phase 1 bootstrap may add minimal dependency/config only.

## D12 — Brand assets

- **Decision:** No final logo/brand asset/visual identity is approved yet. The design language is a flexible foundation built from the documented direction (warm editorial learning; cream/graphite/electric-yellow), explicitly resistant to generic AI-generated SaaS aesthetics. Brand assets remain owner-supplied when available.
- **Status:** ✅ OWNER RESOLVED — design-language foundation only; nothing presented as "final brand".

## D04 — Payments: Paymob first, adapter-abstracted

- **Why:** Egypt-native (cards + wallets), hosted checkout keeps PCI scope minimal, HMAC webhooks.
- **Alternatives:** Kashier, Fawry, Stripe (not Egypt-direct; kept as future adapter).
- **Trade-offs:** recurring-billing maturity vs global PSPs is the key risk → manual payment-link fallback designed.
- **Risk:** medium-high (integration reality in Egypt). **Reversible:** yes by design (adapter interface).
- **Status:** ✅ OWNER RESOLVED — Paymob is the MVP provider, behind the adapter interface. Merchant-account availability is NOT a Phase 1 blocker. No real integration/checkout/webhook/credentials until Phase 5.

## D04b — Refunds

- **Decision:** MVP uses single-admin approval. Every refund operation must be auditable: actor/admin, timestamp, amount, reason, original payment reference, refund status.
- **Status:** ✅ OWNER RESOLVED (policy fixed; functionality NOT built until Phase 5+).

## D05 — Video: Bunny Stream signed playback

- **Why:** cheap at MENA bandwidth prices, signed embed tokens satisfy protection requirement, good player.
- **Alternatives:** Mux (better DX/analytics, pricier), YouTube unlisted (no protection/control — rejected), S3+HLS DIY (operational burden).
- **Risk:** low-medium. **Reversible:** high (playbackId abstraction behind a video-provider interface so Mux can replace it later).
- **Status:** ✅ OWNER RESOLVED — Bunny Stream for MVP, playback behind provider abstraction. No video infrastructure built yet.

## D06 — Storage: Cloudflare R2

- **Why:** S3-compatible, zero egress fees, presigned URL support.
- **Alternatives:** AWS S3 (egress costs), Bunny Storage (consolidation option).
- **Risk:** low. **Reversible:** high. **Status:** FIXED.

## D07 — i18n: locale-prefixed routing (`/en`, `/ar`) from Phase 2

- **Why:** RTL is architectural, not cosmetic; SEO needs distinct URLs; paired-column bilingual content model chosen for MVP simplicity.
- **Alternatives:** cookie/domain-based locale (bad SEO), defer Arabic (violates core positioning — rejected).
- **Risk:** low. **Reversible:** hard later — hence day-one decision. **Status:** FIXED.

## D08 — Entitlements: single service + date/state-derived checks

- **Why:** one function answers "premium?"; state machine + period dates make expiry automatic without cron dependence.
- **Alternatives:** cached flags/roles (staleness bugs), client-trusted state (rejected outright).
- **Risk:** low. **Reversible:** n/a (principle). **Status:** FIXED.

## D09 — Money & pricing

- **Why:** float money is unacceptable; Plan table enables future pricing changes/coupons without deploys.
- **Status:** ✅ OWNER RESOLVED — EGP is the primary MVP currency; data model stays multi-currency capable (USD and others later). No final product prices invented; no hardcoded pricing in business logic. Pricing values require explicit owner approval before production use. Placeholder values ("PRICE TBD") only, clearly marked.

## D13 — Legal content

- **Decision:** Legal pages (privacy policy, terms, refund policy) require owner/qualified legal review before production launch. AI-drafted legal text must never ship as final policy.
- **Status:** ✅ OWNER RESOLVED — documented future dependency; no final legal content until reviewed.

## D10 — No user-facing AI in MVP

- **Why:** spec principle 6/7 — validate core learning business first; gateway seams defined so Phase 7 is additive.
- **Status:** FIXED.

## D11 — Analytics: privacy-conscious (Plausible-class) + first-party funnel events table

- **Why:** spec §26 metrics without creepy tracking; first-party table gives funnel precision Plausible can't.
- **Status:** FIXED for approach; vendor final call at Phase 2.

## D14 — Typography system (Phase 1)

- **Decision:** IBM Plex Sans Arabic (Arabic) + IBM Plex Sans (Latin) + IBM Plex Mono (code/technical only). A matching superfamily avoids the "two random fonts" problem; Arabic renders excellently at display sizes; weight contrast carries hierarchy rather than size inflation.
- **Alternatives considered:** Rubik (warmer but weaker Latin pairing), Cairo/Tajawal (common in Arabic web, less editorial), Geist/Inter (rejected: reads as default-AI-startup typography).
- **Digits:** Western digits (123) everywhere including Arabic copy for prices/stats — consistent with Egyptian web convention and keeps tabular alignment.
- **Risk:** low. **Reversible:** high (token-level swap). **Status:** FIXED pending Phase 1 visual sign-off.

## D15 — Visual identity foundation (Phase 1)

- **Decision:** Warm cream paper base (#F7F2E9), graphite ink (#221E18), electric yellow accent (#F0B310) used sparingly, controlled indigo/mint/clay secondaries for level coding and access stamps. Restrained radius (≤ 8px), borders over shadows, editorial composition with hand-drawn annotations used purposefully.
- **Status:** FIXED as flexible foundation per D12 — owner-supplied brand assets will refine, not redefine.

## D16 — UI primitives: zero-dependency overlays + client-island policy

- **Decision:** Overlay/interactive primitives use platform features instead of libraries: native `<dialog>` for modals (top layer, focus trap, Escape for free), CSS-only tooltips, small client components for dropdown/toast/mobile nav. Client components are islands (`components/ui/*` marked `"use client"` where interactive); everything else stays server-rendered.
- **Alternatives:** Radix/shadcn primitives (more robust edge cases, but a dependency + bundle cost for needs we don't have yet).
- **Trade-offs:** we own edge cases (focus return, scroll lock) — revisit if patterns grow complex.
- **Risk:** low-medium. **Reversible:** moderate (component API can wrap Radix later without changing call sites). **Status:** FIXED for Phase 1.

## D17 — Technical visual language

- **Decision:** Coordinate grids, sigmoid curves, neural constellations, mono annotations, and coordinate tags form a supporting visual layer: always `aria-hidden`, low-contrast, behind content, and required to explain something real. Scroll reveal uses CSS `animation-timeline: view()` progressive enhancement — no JS, safe fallback.
- **Status:** FIXED.

## Open Decisions Requiring Owner Input

1. ~~Currency~~ → RESOLVED: EGP primary MVP currency. **Final price points still OPEN** (requires explicit owner approval).
2. Paymob merchant account status/timeline — no longer blocks Phase 1; must exist before Phase 5 integration testing.
3. ~~Video budget~~ → RESOLVED: Bunny Stream for MVP.
4. ~~Refund approval policy~~ → RESOLVED: single-admin approval with full audit trail.
5. Legal pages / PDPL review ownership (owner + qualified legal reviewer) — required before production launch, not a build blocker.
6. Brand assets: logo exists? reference image? — design foundation proceeds without them; owner-supplied assets will refine, not redefine, the system.

## D18 � VISUAL DIRECTION RESET: premium cartoon-tech dark universe (OWNER OVERRIDE)

- **Decision:** The cream/paper editorial identity is replaced by a **dark premium cartoon-tech AI learning universe**: deep navy-black base, indigo/violet accents, controlled electric highlights, an original character language ("Shimmy" � the living prompt sprite), and a technical grid that is part of the UX (learning maps, node paths). Owner explicitly overrides the earlier "no dark+purple" anti-template rule; the contract is updated instead to ban neon-everywhere, blobs, childish clipart, and generic AI-robot mascots.
- **Palette:** semantic dark tokens (base/surface/raised/hover/edge/fg/soft/faint + indigo/violet/electric/gold + level colors).
- **Status:** ? OWNER DIRECTIVE � implemented in Phase 1 as the new visual identity. Cream tokens removed.

## D19 � Phase 2 i18n architecture

- **Decision:** Locale-prefixed routes `/en` `/ar` via `app/[lang]` segment; `middleware.ts` redirects un-prefixed paths using Accept-Language (default en). `<html lang/dir>` lives in `[lang]/layout.tsx`; `/design` kept non-localized with its own layout. Server dictionaries (`lib/i18n/dictionaries.ts`, typed `en` shape) � no client text swapping. SEO: per-locale metadata, hreflang alternates, sitemap.xml, robots.txt (design disallowed).
- **Status:** IMPLEMENTED.

## D20 — Phase 3 domain/data architecture

- **Decision:** Prisma 6 + PostgreSQL/Neon. Core models: Category, Course, Module, Lesson (bilingual fields `*En/*Ar`, stable slugs as locale-independent identity), Enrollment (unique userId+courseId), LessonProgress (unique enrollmentId+lessonId; `completedAt` presence = truth of completion; `completionEvents` counts duplicates/retries for analytics). No ModuleProgress table — module progress derives from lesson records via moduleId. Percentages are derived in the pure domain layer (`lib/domain/progress.ts`), never stored.
- **Identity boundary:** minimal `User` anchor (id/email only) so learning state references a future user without importing Auth.js concepts; credentials/sessions arrive Phase 4.
- **Entitlement boundary:** single interface `EntitlementProvider` (`hasProAccess`) consumed by the access function `canViewLesson`; Phase 3 ships `noEntitlements` (always false). Phase 5 swaps the provider — Course/Lesson access logic untouched. Client never decides access.
- **Content boundary:** UI keeps consuming typed seeds (`lib/courses.ts`); DB seed (`prisma/seed.ts`) mirrors the same catalog structurally via idempotent upserts on slugs. Lesson `contentRef Json?` is an opaque reference — CMS shape deliberately undefined until Phase 8.
- **Tooling notes:** Prisma pinned to v6 (classic `url=env()` datasource; Prisma 7 moved URLs to prisma.config.ts + driver adapters). Initial migration generated offline via `prisma migrate diff --from-empty --to-schema-datamodel`. Domain logic is pure and unit-tested with Vitest (16 tests); repositories are thin server-only wrappers (guarded by `server-only`).
- **Status:** IMPLEMENTED (Phase 3).

## D21 — Egyptian payment methods + payment domain states

- **Decision:** MVP requires CARD, VODAFONE_CASH, FAWRY, INSTAPAY. Domain models `PaymentMethod`/`PaymentStatus` enums + `Payment` table (provider-independent states, minor-unit money, `(provider, providerRef)` uniqueness + idempotency keys) prepared in Phase 3; adapters activate in Phase 5. Paymob stays primary where capabilities are confirmed; Vodafone Cash/Fawry/InstaPay remain UNVERIFIED until merchant flows are confirmed (InstaPay treated as PSP-over-IPN, not a card gateway). Manual fallback allowed only with explicit admin confirmation and audit trail. Entitlements flow exclusively from SUCCEEDED payments through the subscription state machine - never from method or redirect.
- **Security:** no card/PIN/banking credentials stored or logged; provider-hosted/tokenized flows only.
- **Status:** ARCHITECTURE LOCKED (implementation = Phase 5).

## D22 - Phase 4 authentication architecture

- **Decision:** Auth.js v5 credentials provider with JWT session strategy carrying uid/role/sessionVersion. Revocation = password change/reset bumps `sessionVersion`; fresh server-side checks (`requireUser`) compare token vs live DB value on every protected surface, while middleware only gates presence (edge-safe, no Prisma at the edge). Passwords: Argon2id via @node-rs/argon2 (prebuilt native). Verification/reset tokens: 32-byte CSPRNG, stored as SHA-256 hashes, single-use, expiring (24h/30min); reset bumps session version and deletes sibling tokens. Rate limiting: interface-based boundary (`RateLimiter`), in-memory implementation for local/single-instance dev with documented Upstash swap for scaled production. Email: `MailProvider` interface; dev adapter writes `.dev-emails/outbox.jsonl` (gitignored) - production provider deliberately unchosen until approved. Enumeration safety: registration duplicate -> silent generic success; password reset always constant response; login failures generic except EMAIL_NOT_VERIFIED which only surfaces behind a correct password. Audit: AuthEvent table records type/email/userId/outcome only - never credentials, tokens, or IPs.
- **Status:** IMPLEMENTED (Phase 4).

## D23 - Phase 5 monetization/video/ops architecture (as built)

- **Subscriptions:** Plan + Subscription entities with server-authoritative lifecycle; transitions validated by pure state machine (lib/domain/subscriptions.ts); PRO entitlement derives from ACTIVE subscription with time-derived expiry (stored status never trusted alone).
- **Payments:** Payment table activated; Paymob adapter is an INTEGRATION SEAM that refuses operation until merchant credentials exist and endpoints are implemented from official documentation. Manual fallback provider creates PENDING payments; admin "Confirm received" moves to SUCCEEDED with audit.
- **Webhooks:** /api/webhooks/payments/[provider] - raw-body signature verification seam, dedup via unique (provider, externalEventId) on PaymentEvent, transition validation via canApplyPaymentStatus, SUCCEEDED activates subscription transactionally; REFUNDED cancels it.
- **Video:** VideoAsset model in MANUAL REGISTRATION mode (owner registers Bunny video IDs from the dashboard) until Bunny credentials are verified; direct-to-Bunny upload + signed playback are the documented Phase 6 seams behind getAuthorizedPlaybackUrl() which enforces publishState + entitlement BEFORE any token issuance.
- **Admin:** /admin gated by requireRole("ADMIN") on every render AND every server action; AuditLog records actor/action/entity/metadata for all sensitive mutations.

## D24 - Phase 3.5 resolution

- **Decision:** Development runs against a Dockerized local PostgreSQL (elshemey-db). Migrations 000_init + 0002_auth_identity + 0003_monetization_media_ops + 0004 applied live; seed verified idempotent. Neon/staging/prod migration, backup-restore drill, deployment infra DEFERRED to final production-hardening stage per owner. DATABASE_URL remains env-based; no provider-specific logic in application code.
- **Status:** OWNER DECISION - local-first development approved.

## D25 - Scoped hydration suppression on <html>

- **Decision:** `suppressHydrationWarning` applied to the root <html> element in all three layouts. LanguageTool-class extensions inject attributes (e.g. data-lt-installed) into <html> before React hydrates, producing recurring false-positive dev warnings. Blanket suppression remains banned; the scope is exactly one element known to be externally mutated, and every other component stays fully checked.
- **Status:** IMPLEMENTED (Phase 4 polish).

## D26 - OTP email verification + password reset

- **Decision:** Link-based verification/reset replaced by 6-digit OTP codes. Cryptographically random (CSPRNG), zero-padded; stored ONLY as SHA-256 hashes in the existing token tables (no schema change - tables reused with OTP semantics); single-use (usedAt) + expiring (10 min both flows); issuing a new code invalidates all previous active codes for that user; timing-safe comparison; verification attempts rate-limited 5/10min per email; resend 3/hour. Password reset confirms code+new-password together and bumps sessionVersion (full session revocation). Registration redirects to a dedicated /verify-email page with a six-box OTP input (auto-advance/paste/backspace/keyboard+SR accessible); forgot-password is a two-step flow (email -> code+new password).
- **Email template:** professional dark EL-SHEMEY HTML with prominent mono OTP block, bilingual expiry note (EN/AR), safe-ignore footer. Dev adapter persists full message incl. code to .dev-emails/outbox.jsonl (local only).
- **Status:** IMPLEMENTED.

## D22 � Self-hosted video, no third-party provider (Phase 5A)

Owner decision: NO Bunny Stream / Cloudflare Stream / paid video vendor. VideoStorageProvider
abstraction with a local-FS development driver; S3-compatible production driver is the planned
replacement behind the same interface (not implemented � no fake fallback). Metadata in
PostgreSQL (VideoAsset.storageRef renamed from unnyVideoId), binaries outside the DB.

## D23 � Upload trust model

Uploaded media type decided by magic bytes only; size capped while streaming; storage keys
server-generated; partial uploads removed atomically; ADMIN role re-verified per request.

## D24 � Video playback authorization

Single authoritative resolver (uthorizePlayback): session ? publish states ? entitlement ?
short-lived signed URL. The stream route re-runs the chain on EVERY request � signed URLs are
hotlink protection, never the access mechanism. Admins may preview for owner QA.

## D25 � Admin CMS architecture

/admin segment (outside [lang]) guarded server-side by requireRole(ADMIN) at layout AND every
action; UI locale via cookie (dmin_locale) driving html lang/dir � one i18n system, RTL
first-class. Content ops live in lib/server/admin-content.ts: server-generated slugs,
transactional position swaps (unique-constraint safe), completeness-gated publishing.

## D26 � Paymob adapter + FakePay isolation (Phase 7B)

Paymob Accept implemented strictly behind PaymentProviderAdapter: auth?order?payment_key?iframe;
webhook HMAC-SHA512 over the documented field order, constant-time compared; integration_id
merchant validation; amount/currency surfaced and tamper-checked by the domain service. The
adapter throws ProviderNotConfiguredError without credentials � no fake success paths.
Dev-only provider is explicitly named "fakepay", double-gated (NODE_ENV check + FAKEPAY_ENABLED=1),
and never presented as a real PSP. Production enablement gate: one verified SANDBOX transaction.

## D27 � Webhook URL contract

Providers that sign via query parameters (Paymob ?hmac=) receive the full request URL in
verifyAndParseWebhook(rawBody, headers, requestUrl). The route passes request.url verbatim;
adapters own their signature extraction.

## D29 � S3-compatible storage driver (Phase 10)

Dependency-free SigV4 implementation behind the existing VideoStorageProvider (no AWS SDK dependency). Private bucket by contract; keys are the same validated opaque refs; activation via VIDEO_STORAGE_DRIVER=s3 with loud misconfiguration errors. Local driver remains the development default.

## D30 � CSP/HSTS adoption (Phase 10)

CSP restricts frame-src to Paymob checkout hosts, blocks framing/object/base-uri abuse. script-src keeps unsafe-inline (Next runtime) + unsafe-eval (dev only); nonce-based strict CSP deferred until middleware nonce infrastructure exists. HSTS sent unconditionally (inert over HTTP).

## D31 � Password reset verifies channel (Phase 10)

Completing an OTP password reset proves control of the email/phone channel; confirmPasswordResetWithOtp now marks that channel verified in the same transaction. Fixes a real bug where OTP-reset users remained unable to sign in, and removes a hidden inter-test ordering dependency.

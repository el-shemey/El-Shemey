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

## Open Decisions Requiring Owner Input
1. ~~Currency~~ → RESOLVED: EGP primary MVP currency. **Final price points still OPEN** (requires explicit owner approval).
2. Paymob merchant account status/timeline — no longer blocks Phase 1; must exist before Phase 5 integration testing.
3. ~~Video budget~~ → RESOLVED: Bunny Stream for MVP.
4. ~~Refund approval policy~~ → RESOLVED: single-admin approval with full audit trail.
5. Legal pages / PDPL review ownership (owner + qualified legal reviewer) — required before production launch, not a build blocker.
6. Brand assets: logo exists? reference image? — design foundation proceeds without them; owner-supplied assets will refine, not redefine, the system.

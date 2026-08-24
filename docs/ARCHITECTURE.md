# EL-SHEMEY — Architecture

> Phase 0 · Proposed production architecture. Decisions logged in DECISIONS.md.

## 1. High-Level System

```
                    ┌─────────────────────────────┐
                    │        Users (web)          │
                    └──────────────┬──────────────┘
                                   │ HTTPS
                    ┌──────────────▼──────────────┐
                    │   Next.js App (Vercel)      │
                    │  RSC pages · Route handlers │
                    │  Server Actions             │
                    └───┬─────────┬─────────┬─────┘
                        │         │         │
             ┌──────────▼──┐ ┌────▼────┐ ┌──▼───────────┐
             │ PostgreSQL  │ │ S3-compat│ │ External     │
             │ (Neon) via  │ │ Storage  │ │ Services     │
             │ Prisma      │ │ (R2)     │ │ • Payments   │
             └─────────────┘ └────┬────┘ │   (Paymob)   │
                                  │      │ • Video CDN  │
                            signed │     │   (Bunny)    │
                            URLs   │     │ • Email (RE) │
                                   │      │ • AI APIs    │
                                   │      └──────────────┘
                    ┌──────────────▼──────────────┐
                    │  Webhook endpoints          │
                    │  (signature-verified)       │
                    └─────────────────────────────┘
```

## 2. Stack (fixed for MVP)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | RSC for fast public pages, route handlers for webhooks/API |
| Styling | Tailwind CSS | Design tokens as CSS variables + Tailwind config |
| UI primitives | shadcn/ui (selectively) + custom components | Custom where identity matters |
| DB | PostgreSQL (Neon managed) | |
| ORM | Prisma | Migrations in repo |
| Auth | Auth.js v5 (credentials + email verification) | Session cookies, JWT strategy for edge middleware |
| Validation | Zod | Shared schemas client+server |
| Payments | Provider adapter pattern; Paymob first | See PAYMENTS.md |
| Storage | Cloudflare R2 (S3-compatible) | Signed URLs for protected assets |
| Video | Bunny Stream with signed embed tokens | See SECURITY.md §6 |
| Email | Resend + React Email templates | Verification, reset, receipts, dunning |
| AI | Internal provider abstraction (`lib/ai`) | See AI_ARCHITECTURE.md — post-MVP features only |
| Analytics | Plausible (or self-hostable equivalent) + first-party funnel events table | |
| Error tracking | Sentry | |
| Hosting | Vercel + Neon branch previews | |

## 3. Repository Layout

```
el-shemey/
├── app/
│   ├── [locale]/               # i18n routing (en/ar)
│   │   ├── (public)/           # home, explore, courses, pricing, about, faq
│   │   ├── (auth)/             # login, register, verify, forgot-password
│   │   ├── (app)/              # dashboard, learn, courses/[slug], profile, subscription
│   │   └── (admin)/            # admin area, role-gated layout
│   ├── api/
│   │   ├── webhooks/payments/  # signature-verified webhook receiver
│   │   └── ...                 # minimal REST surface; prefer Server Actions
├── features/
│   ├── auth/  courses/  lessons/  progress/
│   ├── subscriptions/  payments/  ai/  admin/  certificates/
├── lib/
│   ├── auth/  db/  payments/  ai/  security/  validation/
│   ├── i18n/  entitlements.ts
├── prisma/                     # schema.prisma + migrations + seed
├── components/                 # shared design-system components
├── config/                     # pricing.ts, plans.ts, site.ts (no hardcoded prices in features)
├── messages/                   # en.json, ar.json
├── tests/                      # unit + integration + e2e
└── docs/
```

Rules:
- `features/*` owns domain logic; `app/*` is thin wiring.
- All money values come from `config/plans.ts` or DB — never inline in components.
- Entitlement decisions go through exactly one function: `lib/entitlements.ts`.

## 4. Rendering & Data Strategy

- Public pages: static or ISR (course catalog revalidates on admin publish via revalidation tag).
- App pages: dynamic, RSC-first; client islands only where interactive.
- Mutations: Server Actions with Zod validation; authz checked inside the action, not just in the page.
- Media: uploaded to R2/Bunny via presigned uploads from the server; playback always via short-lived signed URLs issued after entitlement check.

## 5. Authentication Architecture

- Auth.js v5 credentials provider:
  - Argon2id password hashing.
  - Email verification token required before login (configurable grace for testing).
  - Password reset tokens: hashed at rest, 30-min expiry, single-use, session invalidation on reset.
- Sessions: database strategy initially (revocable); JWT only if edge-middleware perf demands it later.
- Rate limiting on auth endpoints (Upstash Redis or DB-backed limiter): login brute-force, reset-request flood.
- Roles: `USER`, `INSTRUCTOR` (future), `ADMIN`, `SUPER_ADMIN`. Role checks server-side on every protected action/route via a `requireRole()` guard helper.

## 6. Subscription & Entitlement Architecture

State machine owned by the backend:

```
            checkout initiated
                   │
  ┌────────────────▼─────────────────┐
  │ PENDING                          │
  └────┬──────────────┬──────────────┘
   paid │              │ failed/expired
       ▼              ▼
  ┌─────────┐    ┌──────────┐
  │ ACTIVE  │    │ INACTIVE │◄────────────┐
  └──┬───┬──┘    └──────────┘◄────────────┼──
     │   │ cancel requested               │
     │   ▼                                │ payment fails past grace
     │ PAST_DUE (grace window, dunning)   │
     │   │ grace expires                  │
     │   └────────────►INACTIVE           │
     │ cancel at period end               │
     ▼                                    │
  CANCELED (active until period_end) ─────┘
  REFUNDED (immediate revoke)
```

- Single source of truth: `Subscription` row per user (latest), plus immutable `SubscriptionEvent` audit trail appended by webhooks.
- Webhooks are idempotent (event ID dedup table) and HMAC/signature verified before touching state.
- Entitlement check: `hasPremiumAccess(userId)` computed from subscription state + period dates — called server-side everywhere premium content is served. Client may *display* state but never *grants* it.

## 7. Payment Architecture (summary)

Provider-agnostic adapter interface (`lib/payments/provider.ts`):

```ts
interface PaymentProvider {
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhookSignature(req: Request): Promise<WebhookEvent>;
}
```

Paymob implementation first (cards/wallets in Egypt). Stripe adapter stubbed for international expansion. Details in PAYMENTS.md.

## 8. AI Architecture (summary)

Internal gateway interface; providers pluggable (Anthropic/OpenAI/Google). Keys server-side only, usage quotas per user, prompt-injection defenses for retrieval-based features. No user-facing AI in MVP — architecture defined now so features land cleanly in Phase 7. Details in AI_ARCHITECTURE.md.

## 9. Environments & Operations

| Env | Purpose | Data |
|---|---|---|
| Local | dev, Neon branch + seeded data | synthetic |
| Preview | per-PR Vercel preview | synthetic |
| Production | live | real |

- Backups: Neon PITR + daily logical dumps to R2 (30-day retention).
- Monitoring: Sentry (errors), Vercel analytics, uptime ping, webhook failure alerts.
- Secrets: Vercel env vars, never in repo; `.env.example` documents required vars.

## 10. Scalability Notes

MVP load is modest. The design avoids premature scaling: serverless functions + managed Postgres handle thousands of learners. Known future pressure points: video bandwidth (CDN handles it), webhook throughput (queue if needed), AI costs (quotas built into gateway from day one).

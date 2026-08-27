# EL-SHEMEY — Master Implementation Plan

> Phase order, dependencies, and the exact next task. Updated as phases complete.

## Status: PHASE 0-5 COMPLETE · PHASE 6 COMPLETE (learner dashboard, course env, lesson player, server-side completion via session-derived identity; protected video pending Bunny credentials - honest states shipped) · NEXT GATE: PHASE 7 (user-facing AI) + Phase 8 content pipeline in parallel

## Phase Order & Dependencies

| Phase | Scope                                                                                                      | Depends on                      |
| ----- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 0 ✅  | Product + architecture docs (this suite)                                                                   | —                               |
| 1     | Brand + design system; **visual validation gate before any page build**                                    | 0 + brand assets [OPEN]         |
| 2     | Public website (home, explore, course pages, pricing, FAQ, about, auth pages UI) + i18n/RTL skeleton + SEO | 1                               |
| 3     | Learning core (player, content model, progress, free/premium enforcement)                                  | 2 + DB schema                   |
| 4     | User system (dashboard, my learning, profile)                                                              | 3 + auth live                   |
| 5     | Subscriptions + payments (Paymob integration, webhooks, state machine, dunning)                            | 4 + merchant account            |
| 6     | Security hardening + independent review of payments/auth/entitlements                                      | 5                               |
| 7     | AI experience (assistant, practice evaluation, recommendations)                                            | 6                               |
| 8     | Automation Academy content + playground                                                                    | 7 (content can parallel from 5) |
| 9     | Admin/CMS expansion + business analytics                                                                   | 3+ (incremental throughout)     |
| 10    | Growth (certificates, referrals, coupons, email campaigns)                                                 | post-launch learnings           |

MVP = Phases 0–6 (+ minimal admin from 9 pulled forward into 5 for subscription ops).

## Critical Path Items (owner actions)

1. Confirm currency & price points → blocks Plan seeding + pricing copy.
2. Start Paymob merchant application NOW (approval takes time) → gates Phase 5.
3. Provide logo/reference image or approve "design from spec" → gates Phase 1 visual work.
4. Confirm Bunny Stream budget → gates media pipeline in Phase 3.

## Exact Next Task

**PHASE 1, Step 2:** Owner visual review of the `/design` studies against `docs/DESIGN_REVIEW_CHECKLIST.md`. After sign-off (or revision notes): build the design-system component layer (buttons, inputs, nav, stamps, cards, states) and validate responsive/RTL/a11y behavior — still before any full page build.

## Must NOT Be Built Yet

- Any full pages or route structure beyond the bootstrap
- Payment code, webhook receivers
- AI features (gateway interface file only when Phase 7 starts)
- Admin CMS
- Certificates, quizzes, community, affiliates

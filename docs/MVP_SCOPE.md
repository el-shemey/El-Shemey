# EL-SHEMEY — MVP Scope

> The first release is intentionally small. Everything here must exist and be excellent; everything else waits.

## In Scope (MVP)

### Public website
- [ ] Home (hero, what you learn, free learning, featured courses, PRO section, FAQ, final CTA)
- [ ] Explore / course catalog with categories
- [ ] Course detail page (editorial, curriculum, free/premium markers)
- [ ] Pricing (monthly/yearly from config)
- [ ] FAQ, About
- [ ] Login, Register, Forgot/Reset password, Email verification
- [ ] Bilingual AR/EN + full RTL
- [ ] SEO baseline: metadata, OG, sitemap, robots, Course structured data

### Learning core
- [ ] Player: course nav sidebar + lesson content + completion + next/prev
- [ ] Video lessons (protected playback) + rich text lessons + downloadable resources
- [ ] Free/PREMIUM access levels enforced server-side
- [ ] Progress tracking, resume, continue-learning
- [ ] Enrollment created automatically on first lesson start

### User system
- [ ] Dashboard (greeting, continue learning, progress summary, recommendations placeholder)
- [ ] My Learning list
- [ ] Profile (name, locale, password change)

### Business
- [ ] Paymob checkout (hosted page) monthly/yearly
- [ ] Webhook receiver → state machine → entitlements
- [ ] Cancellation at period end, expiration, failed-payment grace + dunning emails
- [ ] Refund processing (admin-initiated)
- [ ] Subscription management page for users

### Admin (minimal CMS)
- [ ] Courses/modules/lessons CRUD, publish toggle, free/premium toggle, reorder
- [ ] User search + inspect + subscription view
- [ ] Metrics v0: active subscribers, recent payments, MRR estimate

## Explicitly Out of Scope (MVP)

- AI assistant / AI practice / AI recommendations (Phase 7 — architecture only)
- Certificates
- Quizzes & challenge engine (schema extensible; UI later)
- Automation Academy playground
- Community, affiliates, coupons/offers, gamification
- Instructor multi-tenancy
- Mobile apps
- True plan proration (cancel+resubscribe instead)
- Watermarking / DRM beyond signed URLs

## Acceptance Criteria (MVP launch gate)

1. A visitor can understand the product and start a free lesson in under 2 minutes.
2. Premium content is unreachable without an active subscription (verified by abuse-case tests).
3. Full payment lifecycle works in provider sandbox including failure paths.
4. Arabic and English experiences are equally complete.
5. Lighthouse: performance ≥ 85 public pages, accessibility ≥ 95 everywhere.
6. E2E suite green: signup → free lesson → subscribe → premium lesson → cancel.

# EL-SHEMEY — Product Requirements

> Status: Phase 0 draft · Owner review required on items marked **[OPEN]**

## 1. Product Definition

**EL-SHEMEY** is a bilingual (Arabic/English) membership platform for practical AI education.

- **Positioning:** "AI Education. Reimagined."
- **Model:** Subscription-first (EL-SHEMEY PRO). Free tier provides genuine value and feeds the funnel.
- **Not:** a generic video marketplace, a Udemy clone, or an AI-generated-looking template site.

## 2. Target Users

| Persona              | Description                                           | Primary need                                  |
| -------------------- | ----------------------------------------------------- | --------------------------------------------- |
| The Career Switcher  | Professional in Egypt/MENA wanting AI skills for work | Practical, structured, trustworthy path       |
| The Freelancer       | Wants to sell AI services (automation, prompting)     | Real projects, workflows, n8n/APIs            |
| The Curious Beginner | Heard of ChatGPT, doesn't know where to start         | Free, friendly entry point                    |
| The Practitioner     | Already uses AI tools, wants depth                    | Advanced content: agents, context engineering |

Primary locale context: Egypt / MENA. Arabic-first audience with strong English comfort; both languages are first-class.

## 3. Core User Journeys

### J1 — Visitor → Subscriber (primary revenue journey)

1. Lands on home page; understands the product in < 5 seconds.
2. Explores courses; opens a course detail page.
3. Starts a **free** lesson without an account (or after minimal signup).
4. Experiences real teaching quality.
5. Hits the free/premium boundary → sees clear value statement.
6. Views pricing → subscribes (monthly or yearly).
7. Checkout → payment provider → webhook → entitlement granted instantly.

### J2 — Registered free user

1. Creates account (email + password; email verification).
2. Dashboard shows "Continue learning" with free content.
3. Consumes all available free lessons at their own pace.
4. Progress persists across devices.
5. Upgrades when they hit the premium boundary.

### J3 — Active subscriber

1. Full library unlocked, server-side entitlement verified per request.
2. Resume where they left off.
3. Manages subscription (renewal, cancellation, plan change) from account area.
4. On cancellation: keeps access until period end; then gracefully downgraded.

### J4 — Lapsed/failed payment user

1. Payment fails → dunning emails → grace period → downgrade.
2. Regains access immediately upon successful re-payment.

### J5 — Admin

1. Signs in, reaches protected admin area (role-checked server-side).
2. Creates/edits courses, modules, lessons; toggles publish state and free/premium.
3. Inspects users, subscription states, basic business metrics.

## 4. Feature Requirements

### F1 — Public website (MVP)

- Home, Explore (course catalog + categories), Course details, Pricing, FAQ, About, Login/Register/Forgot password.
- SEO: metadata, Open Graph, canonical URLs, sitemap, robots, structured data (Course schema), indexable course pages.
- Fully responsive (mobile designed intentionally, not shrunk).
- Bilingual AR/EN with full RTL support.

### F2 — Learning core (MVP)

- Content hierarchy: Course → Module → Lesson (+ future Quiz/Project types).
- Lesson body supports rich text, video embeds (protected), code blocks, prompt blocks, downloadable resources.
- Per-lesson access level: `FREE` / `PREMIUM` (extensible enum for future states: preview, members-only, archived, draft, published).
- Progress tracking: lesson completion, course % complete, resume position.
- Learning player: sidebar curriculum nav, completion marks, locked indicators, next/prev navigation.

### F3 — Accounts & profiles (MVP)

- Email/password auth with email verification and password reset.
- Dashboard: greeting, continue-learning, recommended (placeholder logic in MVP), progress summary.
- Profile: name, language preference, password change, session management.

### F4 — Subscription & payments (MVP)

- Monthly and yearly plans; prices from config/database, never hardcoded.
- Checkout via Egypt/MENA-compatible provider (see PAYMENTS.md).
- Webhook-driven subscription state machine; server-side entitlement checks only.
- Cancellation (at period end), expiration, failed-payment dunning, refunds recorded.

### F5 — Admin/CMS (MVP = minimal)

- CRUD for courses/modules/lessons, publish toggle, free/premium toggle.
- User search & inspection; subscription status view.
- Business metrics v0: active subscribers, MRR estimate, recent payments.

### F6 — Post-MVP (explicitly deferred)

AI course assistant, AI practice evaluation, AI recommendations, certificates, quizzes/challenges engine, Automation Academy playground, community, affiliates, coupons/offers, instructor accounts with own dashboards, mobile apps, offline downloads.

## 5. Content Model Rules

- Access level lives on the lesson/content entity via a single `accessLevel` field consumed by one entitlement service — never scattered boolean checks across components.
- Premium media must never be exposed via public URLs (signed URLs / proxy streaming — see SECURITY.md §6).
- Draft content is invisible to non-admin roles at the API layer, not hidden by CSS.

## 6. Copywriting & Tone

- Human, specific, concrete. Banned-by-default phrases: "unlock your potential", "revolutionize", "supercharge", "master the future".
- Arabic copy written natively, not machine-translated from English. Both languages maintained in a structured i18n dictionary.

## 7. Non-Functional Requirements

| Area            | Requirement                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Performance     | Public pages: LCP < 2.5s on 4G; app pages feel instant (< 200ms perceived nav)                                    |
| Availability    | Target 99.9% for app + learning player                                                                            |
| Accessibility   | WCAG 2.1 AA baseline; keyboard nav; reduced-motion support                                                        |
| Privacy         | Privacy-conscious analytics; no third-party ad trackers; clear privacy policy [OPEN: legal review for Egypt PDPL] |
| Browser support | Last 2 versions of major browsers; iOS Safari 15+                                                                 |

## 8. Success Metrics (MVP)

- Free lesson start → signup conversion
- Signup → paid conversion
- Active subscribers, churn, failed-payment rate
- Lesson completion rate, popular courses

## 9. Open Questions Requiring Owner Input

1. **[OPEN] Currency & price points** — EGP, USD, or dual pricing? Initial monthly/yearly amounts?
2. **[OPEN] Payment provider account** — Paymob assumed as default (see PAYMENTS.md); confirm merchant availability.
3. **[OPEN] Instructor model** — MVP assumes founder-authored content only. Confirm no third-party instructors at launch.
4. **[OPEN] Video hosting budget** — Bunny Stream (cheap, signed) vs Mux (premium). Assumed Bunny Stream.
5. **[OPEN] Domain, brand assets, any reference image** — none provided yet.
6. **[OPEN] Legal pages** — refund policy terms, Egyptian consumer/e-commerce obligations.

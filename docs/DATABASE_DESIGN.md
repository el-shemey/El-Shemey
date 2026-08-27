# EL-SHEMEY — Database Design

> PostgreSQL via Prisma. Phase 0 proposal; schema evolves with migrations.

## Design Principles

1. Entitlements derive from subscription state, never from client claims.
2. Access control is a single enum on content entities, consumed by one entitlement service.
3. Money stored as integers in minor units (piastres/cents) + currency code.
4. All webhook effects idempotent via event dedup.
5. Audit trail for anything money- or access-related.

## Entity Relationship Overview

```
User ──┬── Session / VerificationToken / PasswordResetToken
       ├── Subscription (1 active max) ── SubscriptionEvent[]
       ├── Enrollment ── LessonProgress[]
       ├── Role (enum on User)
       └── WebhookEvent (dedup, global)

Course ── Module ── Lesson ── LessonResource[]
  │                                  │
  └── Category (m2m)                 └── accessLevel: FREE | PREMIUM

Plan (config-backed or DB) ── referenced by Subscription
```

## Prisma Schema (Phase 0 draft)

```prisma
enum UserRole { USER INSTRUCTOR ADMIN SUPER_ADMIN }
enum Locale { en ar }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  passwordHash  String
  name          String?
  preferredLocale Locale @default(en)
  role          UserRole @default(USER)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sessions        Session[]
  subscriptions   Subscription[]
  enrollments     Enrollment[]
}

model Session {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  sessionToken String @unique
  expires DateTime
}

model VerificationToken {
  identifier String
  token String @unique       // hashed at rest
  expires DateTime
  @@id([identifier, token])
}

model PasswordResetToken {
  id String @id @default(cuid())
  userId String
  tokenHash String @unique
  expires DateTime
  usedAt DateTime?
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
}

// ---------- Subscriptions ----------

enum SubscriptionStatus { PENDING ACTIVE PAST_DUE CANCELED EXPIRED REFUNDED }
enum BillingInterval { MONTH YEAR }

model Plan {
  id String @id                    // e.g. "pro_monthly", "pro_yearly"
  name String
  interval BillingInterval
  amount Int                       // minor units
  currency String                  // "EGP" | "USD"
  providerPriceId String?          // Paymob/Stripe plan reference
  isActive Boolean @default(true)
  subscriptions Subscription[]
}

model Subscription {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id])
  planId String
  plan Plan @relation(fields:[planId], references:[id])
  status SubscriptionStatus @default(PENDING)
  provider String                  // "paymob" | "stripe"
  providerCustomerId String?
  providerSubscriptionId String?
  currentPeriodStart DateTime
  currentPeriodEnd DateTime
  cancelAtPeriodEnd Boolean @default(false)
  graceEndsAt DateTime?            // for PAST_DUE dunning window
  canceledAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  events SubscriptionEvent[]

  @@index([userId, status])
}

model SubscriptionEvent {
  id String @id @default(cuid())
  subscriptionId String
  subscription Subscription @relation(fields:[subscriptionId], references:[id])
  type String                      // "payment.succeeded", "renewal.failed", ...
  payload Json
  createdAt DateTime @default(now())

  @@index([subscriptionId, createdAt])
}

// Idempotency: every accepted webhook event recorded once
model WebhookEvent {
  id String @id                    // provider event id
  provider String
  type String
  receivedAt DateTime @default(now())
  processedAt DateTime?
  error String?

  @@unique([provider, id])
}

// ---------- Content ----------

enum ContentAccess { FREE PREMIUM }      // extensible: PREVIEW, MEMBERS_ONLY later
enum PublishState { DRAFT PUBLISHED ARCHIVED }

model Category {
  id String @id @default(cuid())
  slug String @unique              // "prompt-engineering", "automation"
  nameEn String
  nameAr String
  order Int @default(0)
  courses Course[] // implicit m2m via join below if needed
}

model Course {
  id String @id @default(cuid())
  slug String @unique
  titleEn String
  titleAr String
  summaryEn String
  summaryAr String
  descriptionEn String             // rich text (MDX/slate JSON)
  descriptionAr String
  level String                     // beginner | intermediate | advanced
  estimatedHours Int?
  coverImageKey String?
  isFeatured Boolean @default(false)
  publishState PublishState @default(DRAFT)
  publishedAt DateTime?
  categoryId String?
  category Category? @relation(fields:[categoryId], references:[id])
  modules Module[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([publishState, isFeatured])
}

model Module {
  id String @id @default(cuid())
  courseId String
  course Course @relation(fields:[courseId], references:[id], onDelete: Cascade)
  titleEn String
  titleAr String
  position Int
  lessons Lesson[]

  @@index([courseId, position])
}

model Lesson {
  id String @id @default(cuid())
  moduleId String
  module Module @relation(fields:[moduleId], references:[id], onDelete: Cascade)
  slug String
  titleEn String
  titleAr String
  // lessonType enables future quiz/project types without schema rework
  type String @default("lesson")   // lesson | quiz | project (future)
  accessLevel ContentAccess @default(FREE)
  publishState PublishState @default(DRAFT)
  position Int
  bodyEn Json?                     // structured rich content blocks
  bodyAr Json?
  videoPlaybackId String?          // Bunny library id — NEVER a raw public URL
  durationSeconds Int?
  resources LessonResource[]
  progress LessonProgress[]

  @@unique([moduleId, slug])
  @@index([moduleId, position])
}

model LessonResource {
  id String @id @default(cuid())
  lessonId String
  lesson Lesson @relation(fields:[lessonId], references:[id], onDelete: Cascade)
  titleEn String
  titleAr String
  storageKey String                // R2 object key; served via signed URL only
  sizeBytes Int
  mimeType String
}

// ---------- Learning ----------

model Enrollment {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id])
  courseId String
  course Course @relation(fields:[courseId], references:[id])
  startedAt DateTime @default(now())
  lastLessonId String?
  lastActiveAt DateTime?
  completedAt DateTime?
  progress LessonProgress[]

  @@unique([userId, courseId])
}

model LessonProgress {
  id String @id @default(cuid())
  enrollmentId String
  enrollment Enrollment @relation(fields:[enrollmentId], references:[id], onDelete: Cascade)
  lessonId String
  lesson Lesson @relation(fields:[lessonId], references:[id])
  completedAt DateTime?
  positionSeconds Int?             // resume point for video

  @@unique([enrollmentId, lessonId])
}
```

## Notes & Future Tables (not built in MVP)

- `Quiz`, `Question`, `Attempt` — Phase for practice engine.
- `Certificate` — post-MVP; will reference completed Enrollment.
- `Coupon` / `Offer` — applied at checkout; Plan pricing stays base price.
- `Refund` — modeled as SubscriptionEvent + payment record when payments get richer (MVP records refunds as events).
- `FunnelEvent` — first-party analytics table (`event, userId?, anonId, path, meta, at`) for the primary funnel metrics.
- `AiUsageLog` — per-user AI quota accounting (created now conceptually, table added with Phase 7).

## Data Rules

- **Money:** integer minor units + ISO currency code. Never floats. Never display-formatted in DB.
- **Bilingual fields:** paired `*En`/`*Ar` columns for MVP simplicity; migrate to a translation table only if a third locale becomes real.
- **Deletion policy:** Users soft-deleted (anonymized) to preserve financial audit integrity; content uses cascade deletes within course trees.
- **Seed:** seed script creates categories, demo courses (incl. "Claude Mastery" with free/premium split matching spec §12), plans from `config/plans.ts`.

## Phase 3 implementation notes (schema as built)

- `prisma/schema.prisma` implements this design with evolutions: `LessonType` enum added (LESSON/QUIZ/PROJECT); `Lesson.contentRef Json?` is the opaque content boundary; `Module @@unique([courseId, position])`; `LessonProgress.completionEvents` counts duplicate/retry completions while `completedAt` is preserved from first completion (idempotent); module progress derives from lesson records — no ModuleProgress table.
- Minimal `User` identity anchor (id/email) — credentials arrived in Phase 4. **Email invariant: stored normalized to lowercase; every lookup MUST normalize before querying** (`normalizeEmail`).
- `Payment` + `PaymentMethod` + `PaymentStatus` prepared for Phase 5 (see PAYMENTS.md §9 / D21): minor-unit money, EGP default, `(provider, providerRef)` unique, idempotency keys, no sensitive payloads.
- Initial migration: `prisma/migrations/000_init/migration.sql` (generated offline via `migrate diff`); apply with `prisma migrate deploy` once DATABASE_URL points at Neon.
- Seed: `prisma/seed.ts` — deterministic upserts of the course catalog skeleton (no users/payments/pricing).

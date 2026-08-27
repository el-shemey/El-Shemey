# EL-SHEMEY — Development Workflow

> How we work: small increments, explicit scope, reviews between phases.

## 1. Phase Gates

```
PLAN → IMPLEMENT → TEST → VISUAL REVIEW → SECURITY REVIEW
     → PERFORMANCE REVIEW → ACCEPT → NEXT PHASE
```

A phase ends only when its acceptance criteria pass — compilation is not completion.

## 2. Per-Task Protocol (every request)

1. Read current docs.
2. Inspect existing repo state.
3. Identify dependencies.
4. State task plan.
5. Implement only requested scope.
6. Run tests/lint/typecheck.
7. Review result.
8. Fix issues.
9. Update affected docs.
10. Report exactly what changed + what remains.
11. STOP — do not silently advance phases.

## 3. Definition of Done (per feature)

Functional · Visual (matches design system) · Responsive · Accessible · Secure (abuse paths considered) · Performant · Maintainable · Tested · Reviewed.

## 4. Quality Tooling (set up in Phase 1 bootstrap)

| Concern          | Tool                                                     |
| ---------------- | -------------------------------------------------------- |
| Types            | TypeScript strict                                        |
| Lint/format      | ESLint + Prettier                                        |
| Unit/integration | Vitest                                                   |
| E2E              | Playwright (critical journeys: signup, learn, subscribe) |
| DB               | Prisma migrate (+ shadow DB); seed per environment       |
| CI               | GitHub Actions: lint, typecheck, test, build on every PR |

## 5. Testing Priorities

Highest coverage on: entitlement logic, subscription state machine, webhook handling, auth guards, rate limits. UI covered by E2E smoke journeys rather than exhaustive unit tests.

## 6. Git & Reviews

- Conventional commits; feature branches; PRs even when solo (self-review against DoD).
- High-risk areas (payments, auth, entitlements) get an independent review pass (per spec §31: primary agent implements, independent reviewer challenges).
- No direct pushes to production branch.

## 7. Documentation Sync Rule

Any change that alters architecture, data model, security posture, payment flow, or MVP scope updates the relevant doc **in the same task**. Docs live in `/docs`; DECISIONS.md records every major decision with alternatives and trade-offs.

## 8. Environments

Local (seeded) → Preview (per-PR) → Production. Provider test modes everywhere until launch checklist passes.

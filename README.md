# mywebsite — EL-SHEMEY

Bilingual (Arabic/English) membership platform for practical AI education.

**Status:** Phase 1, Step 1 — repository bootstrap + design-language studies.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in locally; never commit secrets
npm run dev
```

Open http://localhost:3000/design to review the design-language studies.

## Scripts

| Command                           | Purpose                 |
| --------------------------------- | ----------------------- |
| `npm run dev`                     | Development server      |
| `npm run build`                   | Production build        |
| `npm run lint`                    | ESLint                  |
| `npm run typecheck`               | TypeScript strict check |
| `npm run format` / `format:check` | Prettier                |

## Documentation

See `docs/` — start with `MASTER_IMPLEMENTATION_PLAN.md`, `DECISIONS.md`, and `DESIGN_REVIEW_CHECKLIST.md`.

All UI work must pass the Anti-AI-Template Contract before acceptance.

# EL-SHEMEY — AI Architecture

> The platform teaches AI; it does not bolt on AI features because it can. Every AI feature must have clear educational value (spec §23).

## 1. Principles

1. Provider-agnostic gateway — swap/add providers without product rewrites.
2. Keys and execution server-side only.
3. Grounding over guessing — course-aware features retrieve real content; the assistant doesn't improvise facts about lessons.
4. Quotas and cost controls exist from day one, even before features do.
5. No AI in MVP. This document defines the seams so Phase 7 lands cleanly.

## 2. Gateway Design

```
features/ai/*
      │  (product code knows only this)
      ▼
lib/ai/gateway.ts          ← single entry: complete(), stream(), embed()
      │
lib/ai/providers/
  ├── anthropic.ts
  ├── openai.ts
  └── google.ts            // each implements AiProvider interface
      │
lib/ai/quota.ts            ← per-user daily/monthly limits, spend caps
```

```ts
export interface AiProvider {
  readonly id: string;
  complete(input: CompleteInput): Promise<CompleteResult>;
  stream(input: CompleteInput): AsyncIterable<string>;
  embed?(input: EmbedInput): Promise<number[]>;
}
```

Selection via env config (`AI_PROVIDER_PRIMARY`, fallback chain). Model choice is data (per-feature config), not scattered literals.

## 3. Planned Features (Phase 7+, value-first)

| Feature | Educational value | Grounding strategy |
|---|---|---|
| Course Assistant | Unstick learners mid-lesson | RAG over current lesson/course transcript + content; refuse outside-scope politely |
| Prompt Practice Evaluator | Feedback on learner-written prompts | Rubric-based evaluation (clarity, context, constraints, structure, output requirements) against lesson criteria |
| Next-step recommendations | Reduce "what now?" friction | Deterministic rules from progress data first; model-assisted ranking only if rules prove insufficient |

Explicitly rejected for launch: general-purpose chatbot, AI-generated courses, autonomous agents acting on user accounts.

## 4. Security Controls

- All prompts assembled server-side; retrieved lesson content injected as clearly-delimited untrusted context with instructions to treat it as data (prompt-injection defense).
- Tool use (future): strict allowlist, no arbitrary HTTP, no credential access.
- Rate limits: per-user daily quota + global daily spend cap + anomaly alerts.
- Logging: request metadata always; prompt/response bodies with limited retention, excluded secrets, documented in privacy policy.
- Abuse: AI endpoints require verified accounts; free-tier quota lower than pro-tier.

## 5. Cost Model

Per-feature token budgets set in config. Dashboard metric (admin) tracks estimated spend per feature per day. Hard ceiling shuts off non-critical features gracefully rather than overspending.

## 6. Evaluation

Before any AI feature ships: golden-set of expected Q&A / evaluations reviewed manually; regression run on prompt/model changes. No vibe-only launches.

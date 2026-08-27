# EL-SHEMEY — Design System

> Current identity: **premium cartoon-tech AI learning universe** (dark). Set by owner directive D18; supersedes the earlier cream/paper direction.

## 1. The World

EL-SHEMEY is a place, not a website. The technical grid is the underlying
system of the world; courses are destinations; modules are stages; lessons are
nodes that light up as you learn. **Shimmy (شيمي)** — a living prompt sprite —
inhabits the environment and appears sparingly: hero, empty states, featured
course, celebration moments.

## 2. Anti-Pattern Contract (hard rules, updated for the dark world)

Banned by default:

- neon everywhere / cyberpunk overload
- giant blurry gradient blobs, random floating particles
- childish clipart, cheap mascots, random emoji
- generic robot-head AI mascots
- excessive glassmorphism or glow on every surface
- excessive rounded rectangles (radius ≤ 10px), uniform card grids
- template hero layouts, meaningless animations, AI-sounding copy

The test: _"If I remove the EL-SHEMEY logo, would this still obviously look
like EL-SHEMEY?"_ If no → redesign.

## 3. Color System (semantic dark tokens)

| Token                           | Value                                                            | Role                       |
| ------------------------------- | ---------------------------------------------------------------- | -------------------------- |
| `--color-base`                  | `#0B0D16`                                                        | The void — page background |
| `--color-surface`               | `#12141F`                                                        | Panels, sections           |
| `--color-raised`                | `#1A1D2E`                                                        | Cards, Shimmy's body       |
| `--color-hover`                 | `#232741`                                                        | Hover / wells              |
| `--color-edge` / `-strong`      | `#262A3D` / `#3B4060`                                            | Structure lines            |
| `--color-fg` / `soft` / `faint` | `#EEEDF8` / `#A7ABC8` / `#7D82A3`                                | Text hierarchy             |
| `--color-indigo` (+`-strong`)   | `#6E79FF` / `#5A64EE`                                            | Primary actions            |
| `--color-violet`                | `#A487FF`                                                        | Arabic voice, flourishes   |
| `--color-electric`              | `#56C2FF`                                                        | Live nodes, focus, links   |
| `--color-gold`                  | `#F0C24B`                                                        | PRO / achievements — rare  |
| levels                          | beginner `#35D49E` · intermediate `#6E8CFF` · advanced `#FF8A5C` | Small accents only         |

Rules: darkness dominates; one restrained glow per level; level color appears
as thin light-lines and badges, never full recolors.

## 4. Typography

IBM Plex Sans Arabic + IBM Plex Sans + IBM Plex Mono (machinery only).
Arabic is first-class: native copy, looser line-height, mirrored layouts.
Hierarchy from weight/spacing/rhythm — not oversized marketing type.

## 5. The Grid as UX

- `.surface-grid` / `.surface-grid-fine` / `.grid-dissolve` — environment layers
- **Knowledge Map** (`components/viz/knowledge-map.tsx`) — connected course destinations with done/current/available/locked node states
- **Syllabus path** (`syllabus.tsx`) — completed lessons illuminate, current node pulses softly (`.node-live`)
- Coordinate tags, sigmoid curve, constellation — annotations that explain something real

## 6. Character Language — Shimmy

`components/character/shimmy.tsx`: moods `happy | thinking | sleepy | celebrate`,
CSS micro-motion (blink, float, hover reactions). Scarcity rule: never decorate
everything with the mascot.

## 7. Motion

Settle entrances, hover lift/tactile press, progress fills, pointer-reactive
hero aurora (skipped under reduced motion), scroll-driven reveals via CSS
`animation-timeline` progressive enhancement. Nothing loops aggressively;
`prefers-reduced-motion` fully honored.

## 7b. Hero Pattern (approved)

The hero is a **direct outcome promise**, not brand poetry:

- **H1 formula:** concrete learner outcome in Egyptian Arabic — currently «من البرومبت لأول أتمتة شغّالة.» with an electric underline on the outcome word.
- **Supporting line:** one sentence covering the full scope (Prompting, Automation, AI Agents, APIs, RAG) and ending with "كل درس بينتهي بحاجة تشتغل" — lessons end with something usable.
- **CTAs:** «ابدأ مجانًا» / «استكشف الكورسات» — literal actions only.
- **LEARN → BUILD → RESULT demo** (`components/viz/hero-learning-demo.tsx`): quiet ~12s loop — learning path draws itself (Prompt → Context → Automation → Agent), a real prompt types out («رتّبلي العملاء الجدد»), pipeline chips activate (n8n → AI → Sheets → Email), and a concrete result lands (`✓ New lead detected — تم إرسال رد تلقائي`). Grid pulses once on success; Shimmy reacts as operator (thinking → celebrate).
- **Accessibility:** `prefers-reduced-motion` freezes the demo on the final result composition statically; all information exists in the DOM without motion; loop restarts are faded, never aggressive.

## 8. Component Library

`components/ui/*`: buttons, forms (custom checkbox/radio/switch), course cards,
knowledge structures, badges/stamps/chips, alerts/toasts/dialogs/menus/
tooltips/skeletons/empty states (Shimmy sleeps in them). Navigation:
`site-header.tsx` with mobile drawer + EN/AR switcher. All RTL-aware via
logical properties. Living reference: `/design`.

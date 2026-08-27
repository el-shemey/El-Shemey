# EL-SHEMEY — Design Review Checklist

> Applied to **every** UI study, component, page, and phase before acceptance. A single failed item blocks sign-off.

## Part 1 — The Contract: must NOT

The interface must not rely on:

- [ ] Generic SaaS layouts (sidebar + stat cards + table everywhere)
- [ ] Predictable hero + three cards + testimonials patterns
- [ ] Neon everywhere / cyberpunk overload / giant gradient washes
- [ ] Excessive glassmorphism; glow on every surface (one restrained glow per level)
- [ ] Childish clipart, cheap mascots, random emoji, generic robot-head AI imagery
- [ ] Random neon effects
- [ ] Giant gradient text / gradient headlines
- [ ] Decorative blobs, particles, or "AI sparkles" with no semantic purpose
- [ ] Generic AI-brain / humanoid robot imagery
- [ ] Excessive rounded rectangles (radius stays ≤ `lg`/8px)
- [ ] Interchangeable dashboard components reused without composition intent
- [ ] Stock-template visual hierarchy
- [ ] Meaningless animations (loops, bounces, movement that adds no information)
- [ ] AI-generated-sounding marketing copy ("Unlock your potential", "Supercharge", "Revolutionize"…)

## Part 2 — The Bar: must demonstrate

- [ ] **Deliberate typography** — hierarchy carried by weight/scale contrast; Arabic treated as first-class (IBM Plex Sans Arabic), never an afterthought
- [ ] **Strong editorial hierarchy** — clear reading order, numbered/indexed structure where it aids learning
- [ ] **Distinctive spacing** — generous, intentional whitespace; sections breathe differently by purpose
- [ ] **Intentional composition** — asymmetry and rhythm used on purpose; not uniform card grids
- [ ] **Educational identity** — the screen teaches or guides, not just displays
- [ ] **Arabic-first thinking** — RTL correctness (logical properties, mirrored intent), native Arabic copy, not translated phrasing
- [ ] **Bilingual quality** — mixed AR/EN content renders correctly and beautifully
- [ ] **Visual storytelling** — elements tell the product story (e.g., syllabus strip) instead of decorating
- [ ] **Restrained motion** — entrance/settle only; honors `prefers-reduced-motion`
- [ ] **Meaningful interaction** — hover/focus states communicate affordance
- [ ] **Recognizable EL-SHEMEY language** — cream paper base, graphite ink, sparing electric yellow; could not be swapped onto a random template unnoticed

## Part 3 — Engineering gates (per component)

- [ ] Keyboard accessible; visible focus (`:focus-visible` token)
- [ ] Semantic HTML (`article`, `nav`, `ol`, headings in order)
- [ ] Contrast ≥ AA against paper base
- [ ] Touch targets ≥ 44px on interactive elements
- [ ] Responsive by design (not desktop shrunk); logical CSS properties for RTL
- [ ] Tokens used — no raw hex values or magic spacing numbers in components
- [ ] No fake data pretending to be real content (placeholders explicitly marked)

## Review ritual

1. Open the work at mobile (390px), tablet (768px), desktop (1280px+).
2. Toggle `prefers-reduced-motion`.
3. Navigate keyboard-only.
4. Ask: _"Could a user mistake this for a generic AI-generated website?"_ If yes → redesign before proceeding.

## Known non-application hydration noise

**`data-lt-installed="true"` on `<html>`** comes from the **LanguageTool browser extension**, not from EL-SHEMEY code. It appears as a hydration warning in local dev only.

- The application itself is deterministic: no `Date.now()`, `Math.random()`, or environment-dependent values during render.
- **Mitigation shipped (D25):** `suppressHydrationWarning` is scoped to the single `<html>` element only - the one node extensions mutate. It does NOT suppress mismatches anywhere else in the tree; real application hydration bugs still surface.
- To confirm: reproduce in an incognito window / clean profile with extensions disabled; the warning disappears.

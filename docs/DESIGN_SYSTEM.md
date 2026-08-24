# EL-SHEMEY — Design System

> Phase 0 direction. Phase 1 validates this visually BEFORE building the full site.

## 1. Anti-Pattern Contract (hard rules)

The following are banned by default. Any use needs explicit art-direction justification:

- dark background + purple/blue gradient washes
- glassmorphism cards, glowing borders, neon accents
- floating blobs, random particles, generic "AI brain"/robot imagery
- identical rounded-card grids, pill-everything, excessive border radius/shadows
- giant gradient headlines, template hero layouts, cookie-cutter pricing tables
- stock/AI-generated illustration style

**Acceptance question for every screen:** *"Could a user mistake this for a generic AI-generated website?"* If yes → redesign.

## 2. Art Direction

**Aesthetic:** warm editorial learning — like a well-designed magazine about technology made by people who love teaching.

- **Base:** warm cream / off-white paper tones dominate. Light-first identity.
- **Ink:** deep graphite/near-black for text and strong structural moments.
- **Accent:** electric yellow as the recognizable brand signal — used sparingly and deliberately (underlines, active states, key CTAs), never as wallpaper.
- **Support:** controlled secondary accent(s) finalized during Phase 1 visual exploration against real screens.
- **Shape language:** restrained radius; crisp edges where structure matters; asymmetry and editorial composition over uniform card grids.
- **Human details:** hand-drawn-inspired annotations/arrows used sparingly to guide the eye; numbered sections; visible grid in places; intentional whitespace.
- **Imagery:** custom product-purpose visuals (annotated screenshots of real workflows, diagrams of trigger→AI→action flows). No decorative 3D renders.

## 3. Typography

Bilingual-first requirement drives the choice. Direction:

- **Arabic:** IBM Plex Sans Arabic — excellent rendering, strong weights, pairs naturally with Latin Plex family. Candidate alternative: Rubik (warmer, slightly playful).
- **Latin:** IBM Plex Sans (matching superfamily) for UI/body; a characterful display treatment (weight/size/tracking contrast rather than a second gimmicky font) for headlines.
- Scale: deliberate modular scale with strong hierarchy; generous line-height for Arabic body text; tabular numerals for stats/prices.
- Final selection validated in Phase 1 on real Arabic headlines before any page build.

## 4. Motion

Smooth, calm, intelligent. Fade/reveal, soft slides, small scale transitions, scroll-based progressive reveals, gentle parallax where it aids hierarchy, purposeful micro-interactions.

Rules: motion communicates hierarchy/progress/interaction — never decoration. Nothing bounces aggressively or loops endlessly. `prefers-reduced-motion` fully honored (transitions become opacity-only).

## 5. Component Foundations (built in Phase 1, validated visually first)

Tokens (CSS variables): colors, spacing, radii, shadows, type scale, z-index, motion durations/easings.

Components: buttons (primary/secondary/ghost + yellow accent usage), inputs/forms with clear error states, navigation (desktop + intentional mobile drawer), course card, curriculum tree, lesson player chrome, progress bar/ring, pricing table (non-cookie-cutter composition), empty/loading/error states, badges for FREE/PRO.

Each component reviewed against §1 contract before reuse.

## 6. Responsive Rules

Mobile is designed, not shrunk: bottom-reachable primary actions, drawer curriculum nav in player, single-column editorial flow, touch-target ≥ 44px, pricing stacked with clear plan comparison.

## 7. Accessibility Baseline

Semantic HTML, keyboard-complete flows, visible focus states (designed, not default blue outline), AA contrast on cream base (verify ink/yellow pairings), labeled forms, media controls accessible, reduced-motion support.

## 8. Copy Voice

Confident, specific, human. Concrete outcomes over hype. Native Arabic writing (not translated-from-English phrasing). See PRODUCT_REQUIREMENTS.md §6 for banned phrases.

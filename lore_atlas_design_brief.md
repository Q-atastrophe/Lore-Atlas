# Lore Atlas — Design Direction Brief

This is the visual companion to the v1.3 spec. It governs all aesthetic decisions in the build. Claude Code reads this brief alongside the spec at Phase 0, looks at the user's `/references` folder, and produces a complete design system before any feature code is written.

The user is visually-oriented and the tool's purpose is partly aesthetic. Treat this brief as load-bearing.

---

## Visual Direction in One Paragraph

Lore Atlas is **dark, glassy, and quiet** — a neutral charcoal-and-translucent chrome that gets out of the way so the user's attached art does the visual work. Frosted-glass surfaces with subtle backdrop blur. Almost-invisible borders. Generous breathing room. Soft motion. Light off-white text on a cool-toned dark base, with a configurable accent color the user can swap. Modern sans-serif for body, **italic serif for entity names** (Worlds, Lorebooks, Scenes, Entries) to give the tool literary warmth without ornament. The vibe is *atlas* or *journal* — every drill-in has a hero banner illustration, like turning a page in a book.

---

## What This Tool Is NOT

It is not:
- Heavily ornamented or decorative (no fancy borders, fleurs-de-lys, vintage filigree, lace, or rococo flourishes — even though some of the user's mood-board references have them)
- Warm-toned earth/brown chrome (the user's *content* is earth-toned; the *chrome* should be neutral so it doesn't compete)
- Bright or saturated (this is a quiet tool, not a vibrant one)
- Pure flat black (charcoal-with-cool-undertone, with translucency, not oppressive solid black)
- Saga-styled (Saga has structural inspiration but Atlas's aesthetic is distinct)

---

## Reference Material

The user's `/references` folder contains 10+ images. Read them as follows:

**Structural references** (what the layouts look like): Saga screenshot showing deck list view, Genshin treasure trace UI, Genshin card archive, user's hand-drawn mockups (Worlds grid, World detail with hero, Lorebook detail).

**Aesthetic mood references** (what the *feel* should be): the SillyTavern Keith character card screenshot is the **closest match** to the desired direction — that's the dark/glassy/translucent/image-led look. Other references (the ornate rose-and-bronze "Temps Accompli," the celestial dark-teal-and-gold "Projects" mockup) show pieces of the *card-and-status* pattern but should not be copied wholesale — ignore their decoration, take only their structural patterns.

**Banner illustration references**: the soft-illustrated tarot-card-style banners show how illustration can fill a card while structure stays clean.

When in doubt about which reference governs which decision: structural questions go to user mockups and Saga; aesthetic questions go to the SillyTavern Keith card screenshot.

---

## Required Outputs from Phase 0

Claude Code produces three deliverables, in this order:

### 1. `tokens.css`

A single CSS file defining all design tokens as custom properties on `:root`. Every component in subsequent phases consumes these tokens — no hardcoded values anywhere.

Required categories (specific values to be proposed by Claude Code based on the references):

**Color tokens:**
- Background levels (deepest base → near-surface) — at least 3 levels
- Surface tokens (translucent panels at various opacities for glass effect) — at least 3 levels
- Text hierarchy (primary, secondary, tertiary, disabled, inverse)
- Default accent color (user-configurable; bake in fae gold `#a07b3a` as initial default, but with note that the user can swap)
- Accent variants (hover, active, muted)
- Border tokens (subtle, default, emphasized) — all low-opacity whites
- Hero banner fallback gradient (two-stop, cool-toned)
- Status colors (active, warning, danger) — muted/desaturated, not bright
- Color-on-image overlay (used in hero banners to ensure title legibility)

**Backdrop blur tokens:**
- `--blur-subtle`, `--blur-default`, `--blur-strong` — values like 8px, 16px, 24px (subject to taste)

**Typography tokens:**
- Sans-serif family for body and UI (recommend Inter, but propose alternatives)
- Italic serif family for entity names (recommend Cormorant Garamond, EB Garamond, or similar — propose alternatives that feel literary without being ornate)
- Size scale: at least 6 sizes (e.g. 11, 13, 15, 17, 20, 28, 36) — propose actual values
- Weight scale (regular, medium, semibold)
- Line-heights for tight (headings) and comfortable (body)

**Spacing tokens:**
- Base unit (recommend 4px)
- Scale: at least 8 steps (4, 8, 12, 16, 24, 32, 48, 64)

**Border-radius tokens:**
- Small, medium, large, full-round
- The "card" radius should feel soft but defined — recommend ~8-12px

**Shadow tokens:**
- Subtle, default, elevated — used sparingly given the glassy aesthetic
- Glow tokens for active states (very low opacity, accent-color-tinted)

**Motion tokens:**
- Standard ease curve (recommend `cubic-bezier(0.4, 0, 0.2, 1)` or similar — propose)
- Standard duration (recommend 200-300ms — propose)
- Hover transition speed (recommend 150ms)

**Hero banner tokens:**
- Default banner heights (e.g. `--banner-height-tall: 320px` for World detail; `--banner-height-short: 200px` for nested views)
- Banner gradient overlay (vertical, fades to background at bottom for content separation)

### 2. `style-guide.md`

A short markdown doc (1-2 pages) documenting the choices made and why. Sections:
- Palette overview with hex values and intended use
- Typography choices with rationale
- Component principles (cards, buttons, inputs, list rows, hero banners)
- Motion philosophy
- Notes on what NOT to do (no heavy decoration, no warm chrome, etc.)

This document is a reference for future-Claude-Code sessions when adding new components — it answers "what should this look like" without re-litigating decisions.

### 3. `phase-0-preview.html`

A standalone HTML page rendering sample components using only `tokens.css`. No JavaScript. No SillyTavern integration. Just visual proof that the tokens work.

Required sample components:
- **Hero banner** with sample image (or gradient fallback variant)
- **Card** representing a World (cover image, name in serif italic, summary text, tag chips, entry count)
- **List row** representing the same World (counterpart layout to the card)
- **Card** representing an entry (smaller, with thumbnail)
- **Entity form** layout (image-left, fields-right) for "New World"
- **Primary button** (e.g. Activate), **secondary button** (e.g. Cancel), **ghost icon button**
- **Text input**, **textarea**, **tag chip input** with sample chips
- **Floating launcher** (collapsed + expanded states)
- **Empty/fallback gradient** banner with no image

Open in browser; user reviews. Iterate until approved. Only then begin Phase 1.

---

## Design Principles to Apply Throughout

1. **Imagery is the hero.** Every component's visual richness should come from the user's attached art. The tool's chrome stays quiet so the art reads.

2. **Glass over solid.** Surfaces (cards, panels, modals) use translucency with backdrop blur. Where translucency isn't possible (e.g. fully obscured panels), the background tone should still feel "lifted" via subtle gradient rather than flat fill.

3. **Borders are nearly invisible.** Most edges are defined by tone contrast (lighter surface against darker background), not lines. Where borders exist, they're 1px at low opacity.

4. **Motion is slow and soft.** No bounces, no snappy spring physics. Ease-in-out, 200-300ms. Hover transitions even faster (150ms) to feel responsive without drawing attention.

5. **Serif italic carries identity.** Worlds, Lorebooks, Scenes, and Entries are always named in italic serif type. Everything else (labels, body, controls, secondary info) is modern sans. The mixed treatment is the tool's signature.

6. **The hero banner ties levels together.** Every drilled-in view has the same hero pattern — image (or gradient) at top with breadcrumb and title, gentle fade into content below. This is the visual through-line of the entire tool.

7. **Empty states should feel intentional.** A World with no cover, a lorebook without entries, a Scene with no lorebooks — these states should look composed (gradient + soft typography), never broken or placeholder-like.

8. **Color is content, not chrome.** The base palette is neutral. Color enters through the user's images, their chosen accent color, and the entity colors (which subtly tint fallback gradients and active indicators). Don't add color to the chrome itself beyond what's necessary for legibility.

9. **Tag chips are soft.** Low-opacity backgrounds, no harsh borders, restrained typography. They sit quietly in the layout.

10. **Tokens are the source of truth.** Once Phase 0 is approved, no component file should hardcode a color, spacing, font size, or duration. Everything references `var(--token-name)`. This is how the tool stays iterable.

---

## What Approval Looks Like

After Phase 0, the user opens `phase-0-preview.html` in a browser and reviews. The user is allowed to ask for changes ("make the accent warmer," "the cards feel too dark," "the banner gradient is too strong," "I want a different serif"). Claude Code iterates on the tokens and re-renders the preview. This loop continues until the user signs off.

Do not begin Phase 1 until the user has signed off on Phase 0 explicitly.

---

## Accent Color Note

The default accent is fae gold `#a07b3a` to match the user's existing project palette, but the entire design must work with the accent swapped to any color. Test the tokens with at least three accent options before signing off — the gold default, a cool jewel-tone (deep teal or amethyst), and a soft warm (dusty rose). If any of those break the design, fix the tokens.

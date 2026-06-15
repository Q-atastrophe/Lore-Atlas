# Lore Atlas — Style Guide

The visual reference for every Lore Atlas component. When a future build session
asks "what should this look like," the answer is here — so the decisions don't get
re-litigated. All values live in [`tokens.css`](tokens.css); this document explains
*why*. **No component file hardcodes a color, size, spacing, radius, or duration —
everything is `var(--la-…)`.**

---

## The one-line vibe

Dark, glassy, quiet. A cool charcoal-and-translucent chrome that gets out of the way
so the user's attached art does the visual work. The closest single reference is the
SillyTavern *Keith* character-card screenshot: frosted panels, near-invisible borders,
off-white text, image-led. Think **atlas / journal** — every drill-in opens on a hero
banner illustration, like turning a page.

---

## Palette

The base is neutral and cool (≈220° blue undertone, very low saturation). **Color
enters through the user's images, the accent, and entity colors — never through the
chrome itself.**

| Token | Hex / value | Use |
|---|---|---|
| `--la-bg-base` | `#0d0f14` | Deepest base — app/modal backdrop |
| `--la-bg-deep` | `#14171e` | Panel floor |
| `--la-bg-raised` | `#1c2029` | Sections lifted off the floor |
| `--la-surface-1/2/3` | white @ 4% / 7% / 11% | Frosted glass panels (with blur) |
| `--la-text-primary` | `#e7e9ee` | Body & titles (cool off-white, never `#fff`) |
| `--la-text-secondary` | `#b0b5bf` | Summaries, labels |
| `--la-text-tertiary` | `#7d828d` | Meta, counts, breadcrumb |
| `--la-border-subtle/default/strong` | white @ 5% / 9% / 16% | 1px lines, used rarely |
| `--la-accent` | `#a07b3a` (fae gold) | **User-configurable.** Active states, primary actions |
| `--la-status-active` | `#6fa583` muted sage | Active World/Scene indicator |
| `--la-status-warning` | `#c79a55` muted amber | Missing/orphaned lorebook |
| `--la-status-danger` | `#c46b65` muted brick | Destructive actions |

**Status colors are deliberately desaturated.** This is a quiet tool; nothing in the
chrome should read as "bright."

### Accent is swappable by design

Default fae gold `#a07b3a`, but the whole system must hold with any accent. Three
presets ship for testing (`[data-accent="gold|teal|rose"]`) and are exercised live in
the preview. At runtime the user's color picker writes the four `--la-accent*` vars.
The accent is stored both as hex and as raw RGB channels (`--la-accent-rgb`) so glows
and tints can be composed with `rgba(var(--la-accent-rgb), α)`.

---

## Typography

Two families, and the contrast between them is the tool's signature.

- **Serif — `Cormorant Garamond` (italic)** — used *only* for entity names: Worlds,
  Lorebooks, Scenes, Entries. Literary warmth without ornament. Always italic.
- **Sans — `Inter`** — everything else: labels, body, controls, counts, breadcrumbs.

> Both are proposed defaults open to change in the Phase 0 review. Garamond / EB
> Garamond are the leading serif alternatives if Cormorant feels too delicate.

Size scale (px): **11 / 13 / 15 / 17 / 20 / 28 / 36** → `--la-fs-100 … --la-fs-700`.
Weights: 400 / 500 / 600. Line-height `--la-lh-tight` (1.15) for headings,
`--la-lh-comfortable` (1.55) for body. Small all-caps UI labels get
`--la-tracking-label` (0.08em) for the "atlas" feel.

---

## Component principles

**Cards** are tall portrait "posters" (`--la-card-aspect: 3/4`, from the user's
mockups). The cover fills the card; the entity name sits in serif italic inside a
translucent gradient strip over the *bottom* of the image (`--la-overlay-on-image`),
with an entry-count line beneath. Radius `--la-radius-md` (10px). The card itself is a
glass surface — visible only when there's no cover (empty state shows the fallback
gradient, never a broken placeholder). Hover lifts subtly (`--la-surface-3`, faint
`--la-shadow-default`, 1px translate-up); the active card carries `--la-glow-active`.

**Buttons**
- *Primary* (Activate, Save): accent fill, `--la-text-inverse` label, no border.
  Hover → `--la-accent-hover`.
- *Secondary* (Cancel, Add existing): glass fill (`--la-surface-2`) + `--la-border-default`.
- *Ghost icon* (toolbar icons, collapse ×): transparent, icon in `--la-text-secondary`,
  hover fills `--la-surface-2` and lifts the icon to `--la-text-primary`.

**Inputs & textareas** sit on `--la-surface-1` with a `--la-border-default` hairline.
Focus does **not** use a hard outline — the border goes to accent and a faint
`--la-glow-active` appears. Placeholder text is `--la-text-tertiary`.

**Tag chips** are soft: `--la-surface-2` fill, no border, `--la-fs-200`,
`--la-text-secondary`, `--la-radius-full`. They sit quietly. Removable chips show an ×
only on hover.

**List rows** are the dense counterpart to cards: a small `--la-thumb-sm` (44px)
rounded thumbnail at left, name (serif italic) + summary preview (sans, secondary) in
the middle, and **status/meta right-aligned** (entry count, active dot). Rows are
separated by tone (`--la-surface-1` zebra or a `--la-border-subtle` rule), not boxes.
The entries view defaults to list; Worlds/Lorebooks default to grid.

**Hero banner** is the through-line. Every drill-in view opens with one:
`--la-banner-tall` (320px) on World detail, `--la-banner-short` (200px) on nested
views. The cover fills with `object-fit: cover`, focal point biased to top. A vertical
`--la-hero-scrim` fades the image into the content background at the bottom. Breadcrumb
(small, off-white, slash-separated) sits top-left; the title (serif italic, `--la-fs-700`,
`--la-hero-title-shadow`) sits bottom-left with a tags/subtitle row beneath. **Fallback:**
no image → `--la-hero-fallback` (or an entity-`color` gradient of the same shape). The
fallback must look *composed*, never empty.

**Glass over solid.** Panels, cards, modals, and the launcher use translucency +
`backdrop-filter: blur(var(--la-blur-…))`. Where full opacity is unavoidable, lift the
tone with a subtle gradient rather than a flat fill. `--la-surface-scrim` is the
fallback for browsers without backdrop-filter.

**Floating launcher** — collapsed: ~44px glass circle, atlas icon + a color dot tinted
to the active World's color. Expanded: ~280px glass pill showing `World → Scene`, a
quick-switch chevron, and a small collapse ×. Both states are `--la-radius-full` glass.

---

## Motion philosophy

Slow and soft. No bounces, no spring physics. Ease-in-out
(`--la-ease-standard`), 240ms for standard transitions and drill-ins, 360ms for modal
and banner reveals, and a quicker 150ms (`--la-duration-hover`) on hover so the tool
feels responsive without calling attention to itself. Drill-in/out crossfades the hero;
it never slides hard.

---

## What NOT to do

- **No heavy decoration.** No fancy borders, fleurs-de-lys, filigree, lace, or rococo
  flourishes — even though some mood-board references (Temps Accompli, the celestial
  gold mockups) have them. Take their *card-and-status structure* only.
- **No warm-toned chrome.** The user's *content* is earth-toned; the *chrome* stays
  cool and neutral so it doesn't compete. The warm accent is the one sanctioned
  exception, used sparingly.
- **No bright or saturated chrome.** Quiet, not vibrant.
- **No pure flat black.** Charcoal with a cool undertone and translucency.
- **No hardcoded values in component files.** If a needed value isn't in `tokens.css`,
  add a token (and surface the choice to the user) rather than inlining it.
- **No broken-looking empty states.** Missing cover, no entries, empty Scene — all
  render as composed gradient + soft type.

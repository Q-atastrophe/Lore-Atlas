# Lore Atlas — Mobile Compatibility Checklist

Goal: make Atlas usable on a phone (~360–430px wide) **without disturbing the
desktop experience**. This is mostly CSS (one mobile breakpoint section) plus a few
touch-interaction tweaks in JS. No data-model or architecture changes.

## Strategy
- **One main breakpoint** (start at `max-width: 600px`) layered on top of the desktop
  styles. Desktop rules stay the default; mobile overrides live in a clearly-marked
  block at the end of `style.css` (like the `body.no-blur` fallback).
- **Touch detection**: prefer `@media (hover: none)` for "no real hover" behaviors
  (card actions, long-press) so it tracks the input type, not just width.
- Reuse the existing token system; add a couple of mobile-only token overrides
  (hero heights, touch target size) rather than hardcoding.
- Verify with `preview_resize` to a phone viewport against SillyTavern's mobile layout.

---

## Phase 1 — Panels & modals go full-screen (biggest win)
- [ ] `.la-panel` / `.la-panel-backdrop`: near-full-screen on mobile (full width, use
      `100dvh` not `vh`, small inset or none, larger corner radius only at top).
- [ ] `.la-modal` (`min(720px, 92vw)` today): full-width sheet, taller, scrolls.
- [ ] Stack the **entity form** — `.la-entity-form-body` grid (40% / 1fr) → single
      column (image on top, fields below).
- [ ] Stack the **entry editor** — `.la-ee-top` (image + title/keys) → column; the
      advanced `.la-ee-grid` (6 fields) → 1–2 columns; content textarea full width.
- [ ] Stack the **scene editor** — image/fields grid → column; the full-width lorebook
      tabs already span, just confirm spacing.
- [ ] Content popout modal (`.la-content-popout`): full-screen on mobile.

## Phase 2 — Touch interactions (no hover, no right-click)
- [ ] **Card action buttons** (`.la-card-action`) are hover-revealed today
      (`.la-card:hover .la-card-action`). Under `@media (hover: none)` make them
      always-visible (list-row buttons are already always-on — done).
- [ ] **Long-press → context menu.** The launcher (`components/launcher.js`),
      entry rows, card/lorebook/scene rows use the `contextmenu` event. Add a
      long-press (~500ms touch hold) that calls the same `openContextMenu(...)`.
- [ ] **Touch targets**: bump `.la-card-action` / `.la-list-edit` / chevrons to ~44px
      under touch.
- [ ] Verify `:hover`-only color/feedback states have a tap/active equivalent.

## Phase 3 — The floating launcher
- [ ] Add `touch-action: none` to `#lore-atlas-launcher` so drag doesn't also scroll.
- [ ] Re-check default position + `clampToViewport` against the mobile viewport so it
      doesn't land under SillyTavern's mobile chrome or the keyboard.
- [ ] Confirm the expanded pill width (`~280px`) fits / shrinks on narrow screens.
- [ ] Quick-switch dropdown + context menu: consider bottom-sheet positioning on mobile
      (or at least confirm the viewport clamping reads well).

## Phase 4 — Cards / grid / hero
- [ ] Poster grid: responsive columns (2-up, maybe 1-up on very narrow) instead of the
      desktop sizing.
- [ ] Hero banner heights (`--la-banner-tall/short/home` = 320/200/150) shrink on
      mobile so they don't eat the short viewport.
- [ ] Card title size step-down (`la-card-name-sm/-xs`) — confirm it still reads small.

## Phase 5 — Toolbars that overflow
- [ ] `.la-detail-bar` (tabs + search + view-toggle + Add button in one row) wraps or
      collapses on mobile — likely: tabs on their own row, tools below; consider
      hiding the grid/list view-toggle (default to one mode) to save space.
- [ ] Worlds view header (title + search + New World) same treatment.

## Phase 6 — Viewport mechanics
- [ ] Replace `100vh`/`88vh` with `100dvh`/`dvh` equivalents for the panel & modals.
- [ ] On-screen keyboard: ensure the editors (name/summary/content fields) stay
      visible when the keyboard opens (scroll-into-view on focus if needed).
- [ ] `-webkit-overflow-scrolling` / momentum scroll on the scroll containers.
- [ ] The `body.no-blur` fallback already gives an opaque, perf-friendly mode — good for
      low-end phones; make sure mobile reads well in BOTH blur on/off.

## Testing
- [ ] `preview_resize` to ~390×844 (iPhone) and a small Android size.
- [ ] Drive each flow: open panel → world → lorebooks/scenes → entry editor → scene
      editor; create/edit/delete; activate; launcher drag + long-press menu.
- [ ] Screenshot each at mobile width.
- [ ] Sanity-check both blur-on and `no-blur` modes.

---

## Open decisions (confirm before building)
- Breakpoint value: 600px, or split (tablet ~768 vs phone ~430)?
- Card grid on phone: 2 columns or 1?
- View-toggle on mobile: keep both grid/list, or force one?
- Launcher on mobile: keep floating/draggable, or dock it (e.g., a fixed corner button)?

## Suggested order
1. Phase 1 (full-screen panel/modal + stacking) — unlocks everything else.
2. Phase 2 (touch: card actions + long-press) — makes it actually operable.
3. Phases 3–5 polish.
4. Phase 6 mechanics + testing pass.

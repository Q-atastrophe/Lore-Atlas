# Lore Atlas — Mobile Compatibility Checklist

Goal: make Atlas usable on a phone (~360–430px wide) **without disturbing the
desktop experience**. Mostly CSS (one mobile breakpoint + `@media (hover:none)`)
plus a few touch-interaction tweaks. No data-model or architecture changes.

**Status:** Phases 1–5 done and verified live at 375px. Remaining: on-screen-keyboard
handling, momentum scrolling, and a couple of minor long-name polish items (Phase 6).

## Decisions (locked)
- Launcher on mobile: **docked to a fixed corner** (no drag).
- Card grid on phone: **2 columns**.
- View toggle: **single button** that flips grid↔list (done, also on desktop).
- Breakpoint: **600px**; touch behaviors also keyed on `@media (hover: none)`.

---

## Phase 1 — Panels & modals full-screen
- [x] `.la-panel` / `.la-panel-backdrop`: full-screen (`100dvh`), opaque on mobile
      (was translucent — ST bled through).
- [x] `.la-modal`: full-width opaque sheet.
- [x] Stack the entity form (image/fields → one column; image capped + centered).
- [x] Stack the entry editor (`.la-ee-top` → column).
- [x] Scene editor stacks (shares the entity form).
- [ ] Content popout modal full-screen (verify; likely fine via `.la-modal`).

## Phase 2 — Touch interactions
- [x] Card action buttons always-visible under `@media (hover: none)`.
- [x] **Long-press → context menu** (`attachLongPress` in core/util.js): wired to the
      launcher, entry rows, and lorebook cards/rows; shared click-suppressor stops the
      row from also activating. Mouse/pen untouched (desktop right-click still works).
- [x] Touch targets bumped to ~40px (card actions, list buttons, view toggle).
- [x] Tap equivalents for `:hover`-only reveals.

## Phase 3 — Launcher
- [x] `touch-action: none` (already present).
- [x] Docks bottom-right via JS (CSS `bottom` resolved off-screen under ST's mobile
      layout); drag disabled on mobile; re-docks on resize/orientation.
- [x] Quick-switch reachable on touch via the long-press menu.

## Phase 4 — Cards / grid / hero
- [x] Poster grid → 2 columns, tighter gaps.
- [x] Hero banners shrink (220/160/120) so they don't swallow the viewport.
- [x] Hero + list-row + card names readable: shrink + clamp long names to 2 lines.

## Phase 5 — Toolbars
- [x] `.la-detail-bar` wraps: search full row, toggle + Add button below.
- [x] Worlds home header (`.la-view-header`) wraps the same way.

## Phase 6 — Viewport mechanics (REMAINING)
- [x] `100dvh` for panel/modals (dodges the mobile URL-bar `vh` bug).
- [x] z-index raised above ST's floating mobile chrome (z 9999); ST confirm popups
      stay above (top-layer `<dialog>`).
- [ ] On-screen keyboard: scroll focused field into view in the editors.
- [ ] Momentum scrolling on the scroll containers (`-webkit-overflow-scrolling`).
- [ ] Re-check both blur-on and `no-blur` modes on a real device.

## Minor polish (REMAINING)
- [ ] World-detail **Activate** button can graze the hero title's 2nd line on
      absurdly long names — add right-padding/clearance.
- [ ] Long breadcrumb already ellipsizes; confirm it reads on the narrowest phones.

## Testing
- [x] `preview_resize` to 375px + drive each flow; screenshot.
- [ ] Final pass on the actual Android emulator (real touch, long-press, keyboard).

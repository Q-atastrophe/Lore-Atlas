# Lore Atlas — SillyTavern Extension v1.3 Build Spec

A visual lore management extension for SillyTavern. Lore Atlas organizes world info (lorebooks and their entries) into **Worlds** (top-level universes) and **Scenes** (named loadouts within a World), with a card-based UI, image-led visual hierarchy, in-place editing with auto-save, and a floating launcher that lives outside the extensions menu.

This document supersedes v1.0, v1.1, and v1.2. Read alongside the **Lore Atlas Design Direction Brief** (sibling document) — that brief governs all visual decisions, this spec governs structure and behavior.

---

## Overview

Lore Atlas is the daily-use surface for working with lore. Once installed, the user almost never opens SillyTavern's native World Info panel. They open Lore Atlas. Browsing, organizing, editing, activating, all from within Atlas.

The data layer is untouched. SillyTavern's native lorebook JSON files remain the source of truth. Lore Atlas adds a metadata layer (Worlds, Scenes, image references, tags) stored in `extension_settings.lore_atlas`. Uninstall the extension and nothing is lost — lorebooks still work natively.

---

## Core Concepts

**World**: a top-level universe or project. Has a name, cover image, summary description, tags, and a set of member lorebooks. Examples: Faelands, Demonworld, Modern AU. Few of them, persistent, large in scope.

**Lorebook**: a standard SillyTavern world info file. Can belong to one or more Worlds (multi-World assignment). Has an optional cover image and tags. Contains entries.

**Scene**: a named subset of a World's lorebooks, used for scene-specific activation. Examples within Faelands: "Before the Iron Forest," "Marian's Reign," "Present — Male Lead Scene," "Present — Marian Alone." A Scene is always scoped to a parent World. Has its own optional cover image, summary, and tags.

**Entry**: a single world info entry inside a lorebook. Has standard SillyTavern fields (name, keys, content, position, depth, order, probability, all toggles) plus an Atlas-attached image and tags.

**Tags**: free-form string array on Worlds, Lorebooks, Scenes, and Entries. Used for filtering and visual grouping within their respective views. Tag autocomplete pulls from existing tags in the same scope.

**Activation**:
- **Click a World** (no Scene picked): all the World's member lorebooks become active. Everything outside that World is deactivated.
- **Click a Scene within a World**: only the Scene's lorebooks become active. Everything else (including other lorebooks in the same World) is deactivated.
- Launcher displays current state: `Faelands → Male Lead Scene`, or just `Faelands` if no Scene is picked.

---

## Core Goals

1. **Three-level drill-down navigation.** Worlds → Lorebooks-within-World (or Scenes) → Entries-within-Lorebook. Matches the user's mental model.
2. **Universal hero banner.** Every drill-in view has a top hero banner with the entity's cover image (and graceful gradient fallback). Visually consistent across the entire tool.
3. **Grid AND list view at every level.** User toggle, persists per-view. Grid is image-led; list is dense-info with status indicators on the right.
4. **Image upload via Atlas UI.** Click upload area or drag from desktop. No folder rules. Base64 in settings.
5. **Floating launcher.** Persistent draggable element. Not in the extensions menu. Defaults to collapsed icon; expands to show `World → Scene` and quick-switch.
6. **Auto-save with safety.** Edits commit automatically with a visible saved/saving indicator. Per-entry undo (20 steps in-memory). Destructive operations require confirmation.
7. **Entry editor mirrors SillyTavern native structure.** Same fields, same arrangement, same controls — visually wrapped in Atlas's aesthetic. Familiar to anyone who knows the native editor.
8. **Native format, no lock-in.** Lorebook JSON never modified beyond what SillyTavern would do natively. Atlas-specific data lives entirely in extension settings.

---

## Non-Goals (v1.3)

- Chat tagging / chat-aware auto-switching (v1.5)
- Lorebook templates for fast Scene creation (v1.5)
- Token-count display (v2)
- Advanced search across entry content (v2)
- Timeline / event-log features (sibling extension project)
- Mobile UI, i18n, accessibility beyond basic keyboard navigation

---

## Technical Setup

**Extension folder:** `SillyTavern/public/scripts/extensions/third-party/lore-atlas/`

**Files (rough plan; Claude Code can refactor):**
```
lore-atlas/
├── manifest.json
├── index.js                  # Entry point. Registers extension, mounts launcher.
├── style.css                 # Imports tokens.css; component styles.
├── tokens.css                # Phase 0 output. All design variables.
├── style-guide.md            # Phase 0 output. Documents visual choices.
│
├── components/
│   ├── launcher.js           # Floating draggable launcher.
│   ├── hero-banner.js        # Universal hero banner component.
│   ├── image-upload.js       # File picker + drag-from-desktop + base64.
│   ├── card.js               # Universal card (used for Worlds, Lorebooks, Scenes).
│   ├── list-row.js           # Universal list row (counterpart to card).
│   ├── tag-input.js          # Chip-style tag input with autocomplete.
│   ├── entity-form.js        # Image-left + fields-right form (used for create/edit).
│   └── view-toggle.js        # Grid/list toggle widget.
│
├── views/
│   ├── panel.js              # Main Atlas panel shell with breadcrumbs.
│   ├── worlds-view.js        # Worlds grid/list (top level).
│   ├── world-detail.js       # Inside-a-World: lorebooks + scenes panel.
│   ├── lorebook-detail.js    # Inside-a-Lorebook: entries list.
│   ├── entry-editor.js       # Entry editor mirroring SillyTavern.
│   └── scene-editor.js       # Scene create/edit form.
│
├── core/
│   ├── storage.js            # Save/load Atlas state via extension_settings.
│   ├── lorebook-api.js       # Wraps SillyTavern world info read/write/activation.
│   ├── undo.js               # Per-entry in-memory undo.
│   └── activation.js         # Activation logic (World vs Scene).
│
└── templates/                # HTML templates (one per major component).
```

**SillyTavern integration points:**
- `SillyTavern.getContext()` for core access
- `world_names`, `selected_world_info`, world info CRUD APIs (`public/scripts/world-info.js`)
- `extension_settings.lore_atlas` for Atlas's own state
- `eventSource` for chat-changed and world-info-changed events
- `renderExtensionTemplateAsync` for HTML templates

---

## Data Model

### `extension_settings.lore_atlas`

```json
{
  "worlds": [ /* World objects */ ],
  "activeWorldId": "world_faelands",
  "activeSceneId": "scene_male_lead",
  "covers": {
    "worlds": { "world_faelands": "data:image/png;base64,..." },
    "lorebooks": { "fae_world_core": "data:image/png;base64,..." },
    "scenes": { "scene_male_lead": "data:image/png;base64,..." },
    "entries": {
      "fae_world_core": { "1": "data:image/png;base64,..." }
    }
  },
  "launcherPosition": { "x": 20, "y": 60 },
  "launcherCollapsed": false,
  "viewPreferences": {
    "worldsView": "grid",
    "lorebooksView": "grid",
    "entriesView": "list"
  },
  "settings": {
    "confirmBeforeSwitchingWorld": false,
    "confirmBeforeDelete": true,
    "showEntryCounts": true,
    "accentColor": "#a07b3a",
    "worldsHomeBannerOverride": null
  }
}
```

### World object

```json
{
  "id": "world_faelands",
  "name": "Faelands",
  "summary": "Original fae-fiction worldbuilding. Day Court, Iron Forest, etc.",
  "tags": ["main", "fae", "wip"],
  "color": "#a07b3a",
  "lorebooks": ["fae_world_core", "ophelion_character", "evander_character", "marian_current_life", "iron_court_hidden"],
  "scenes": [ /* Scene objects */ ],
  "created": 1234567890,
  "modified": 1234567890
}
```

The same lorebook filename may appear in multiple Worlds' `lorebooks` arrays — multi-World assignment is supported.

### Scene object (nested inside a World)

```json
{
  "id": "scene_male_lead",
  "name": "Present — Male Lead Scene",
  "summary": "Standard scene with Ophelion, Evander, or Aramis. Iron Court hidden.",
  "tags": ["present-day", "firewalled"],
  "color": "#7d5fa3",
  "lorebooks": ["fae_world_core", "ophelion_character", "evander_character", "marian_current_life"],
  "created": 1234567890,
  "modified": 1234567890
}
```

A Scene's `lorebooks` array is always a subset of its parent World's `lorebooks`. If a lorebook is removed from a World, Atlas automatically removes it from all Scenes that referenced it.

### Lorebook metadata

Since lorebook JSON files belong to SillyTavern and aren't modified by Atlas, Atlas tracks lorebook-level metadata (tags, cover image) by lorebook filename in its own settings:

```json
{
  "lorebookMeta": {
    "fae_world_core": {
      "tags": ["world", "always-on"],
      "summary": "Core fae world rules: customs, archetypes, geas, courts."
    }
  }
}
```

### Cover fallback chain

When rendering a hero banner:
1. Try the entity's own cover image
2. If absent, try the parent entity's cover (Lorebook → its first assigned World's cover; Scene → parent World's cover; Entry → parent Lorebook's cover)
3. If still absent, render a gradient using the entity's `color` field
4. If no color, use the default Atlas gradient

The Worlds-view top-level banner: shows the currently-active World's cover, with the `worldsHomeBannerOverride` setting as a manual override.

### Undo history

In-memory, per-entry, up to 20 steps. Doesn't persist across reloads. Captures the previous state of editable fields before each save.

---

## UI Components

### 1. The Floating Launcher

Persistent floating element. Default top-right of viewport, ~20px from edges. Draggable; position persists.

**Collapsed state (~44×44px circle):**
- Atlas icon
- Color dot indicating active World's color
- Click: opens main panel
- Right-click: context menu (Quick switch, Open panel, Hide)
- Drag: reposition

**Expanded state (~280×44px pill):**
- Atlas icon (left)
- Active state text (center, prominent):
  - `Faelands → Male Lead Scene` (World + Scene active)
  - `Faelands` (World active, no Scene)
  - `Custom` (manually-toggled lorebooks no longer match a saved state)
  - `None` (nothing active)
- Quick-switch chevron (right): dropdown showing all Worlds, plus Scenes under the active World
- Collapse button (small × in corner)

### 2. Universal Hero Banner

Used at every drill level. Component takes: `coverImage`, `fallbackImage`, `color`, `title`, `subtitle`, `breadcrumb`.

**Structure:**
- Banner area: 240-320px tall (varies by view; tallest on World detail, shorter for nested views)
- Cover image fills with `object-fit: cover`, focal point biased to top
- Soft vertical gradient overlay at bottom of banner — fades cover into the content background
- Breadcrumb sits at top-left of banner (small, off-white, with separator slashes)
- Title (serif italic, large, with text shadow for legibility) sits at bottom-left
- Subtitle/tags row below title

**Fallback rendering:**
- If no cover image available through the chain → gradient using the entity's `color`
- Gradient direction: top-to-bottom, with color at full saturation at top fading to translucent at bottom

### 3. The Main Atlas Panel

Opens from launcher. Modal or large drawer over chat. Header shows breadcrumb reflecting current drill level. Each view has its own grid/list toggle that respects per-view preferences.

#### View 1: Worlds View

- **Hero banner** at top: currently-active World's cover (or settings override / default gradient)
- Header bar below banner: "Worlds", search input, "+ New World" button, sort dropdown, grid/list toggle
- **Grid mode**: cards showing cover, World name (serif italic), entry count badge, tag chips, active-indicator dot
- **List mode**: rows showing thumbnail, World name, summary preview, tags, entry count, active indicator (right-aligned)
- Click a card/row: drill into World detail (View 2)
- "+ New World" opens the entity creation form (image left, fields right)

#### View 2: World Detail (e.g. Faelands)

- **Hero banner** at top: this World's cover image
- Breadcrumb in banner: `Worlds / Faelands`

**Two sections below banner:**

**Section A: Lorebooks in this World**
- Header: search/filter, "+ New Lorebook" button, "Add existing lorebook" button (opens picker), grid/list toggle
- **Grid mode**: lorebook cards with covers, name, entry count, tag chips
- **List mode**: rows with thumbnail, name, summary preview, tag chips, entry count
- Card/row click: drill into Lorebook detail (View 3)
- Right-click: context menu (remove from World, delete lorebook entirely, edit metadata)

**Section B: Scenes in this World**
- Header: "Scenes", "+ New Scene" button
- Compact card list of Scenes (smaller than lorebook cards)
- Each Scene card: small cover (or color block), name, lorebook count, active indicator, "Activate" button on hover
- Click a Scene: opens Scene editor (modal)
- Active Scene visually highlighted

#### View 3: Lorebook Detail (e.g. Marian)

- **Hero banner** at top: this Lorebook's cover (falls back to parent World)
- Breadcrumb: `Worlds / Faelands / Marian`
- Header below banner: search/filter for entries, "+ New Entry" button, view toggle
- **List mode (default for entries)**: rows with thumbnail, entry name, keys preview (chips), content preview, active indicator
- **Grid mode** (optional): entry cards with image, name, keys, truncated content
- Click an entry: opens Entry Editor (View 4)

#### View 4: Entry Editor

Visually mirrors SillyTavern's native world info editor structure — same fields, same arrangement, same controls — themed via Atlas.

**Layout:**
- Small lorebook hero strip at top (compact version of the lorebook hero banner) — keeps user oriented
- Entry image area (clickable to upload)
- Top row of controls matching SillyTavern: Title/Memo input, Strategy (chips), Position dropdown, Depth, Order, Trigger %, action icons
- Content area below
- Collapsible "Advanced" section with secondary keys, group, automation ID, toggles
- Auto-save indicator (top-right): "Saved" / "Saving..." / "Unsaved (will retry)"
- Undo button + Ctrl+Z shortcut

### 4. Entity Creation/Edit Form (Universal Pattern)

Used for creating/editing Worlds, Lorebooks, and Scenes. Same layout, different fields.

- Modal or large overlay
- **Left side (~40% width)**: large vertical image upload area. Click to pick file. Drag image from desktop into it. Existing cover shown here; "Replace" hover overlay.
- **Right side (~60% width)**:
  - Name input
  - Tags chip input (existing tags shown as clickable chips below the input)
  - Summary textarea
  - Color picker (for accent/fallback gradient color)
  - For Scenes: lorebook picker (which of the parent World's lorebooks are in this Scene)
- Save button bottom-right; Cancel top-right

### 5. Image Upload Behavior

Universal across the tool:
1. Click an image area → browser file picker
2. OR drag an image from desktop onto an image area
3. File read via File API
4. If >1MB after format selection: auto-compress (resize longest edge to 800px max, JPEG quality 0.85)
5. Saved as base64 in `extension_settings.lore_atlas.covers.{type}.{id}`
6. Displayed via `<img src="data:image/...;base64,...">`

---

## Behaviors

### Auto-save

- Entry edits trigger save after 500ms inactivity (debounced)
- Indicator cycle: Idle → Saving... → Saved → Idle (after ~2s)
- Save failure: "Unsaved (will retry)" — retries every 5s
- World/Lorebook/Scene metadata: save immediately on any change (no debounce)

### Undo

- Ctrl+Z (Cmd+Z) within entry editor: undoes last edit to that entry
- Up to 20 steps per entry
- Visible undo button in editor header
- Destructive ops (delete entry/lorebook/Scene/World) are NOT undoable — they require upfront confirmation

### Activation logic

**Activating a World (no Scene picked):**
1. Enable all of the World's member lorebooks
2. Disable all lorebooks NOT in the World
3. Set `activeWorldId`, clear `activeSceneId`
4. Update launcher display

**Activating a Scene within a World:**
1. Enable only the Scene's lorebooks
2. Disable everything else
3. Set `activeWorldId` to the Scene's parent, `activeSceneId` to the Scene
4. Update launcher display

**Manual toggle outside Atlas:**
- Atlas listens for world info change events
- If current active set no longer matches any saved World/Scene, launcher shows "Custom"
- User can re-pick a World/Scene to reset

**Edge cases:**
- Lorebook in a World no longer exists (file deleted) → warning indicator; skipped during activation
- Lorebook in a Scene no longer in parent World → auto-removed from Scene; logged

### Multi-World lorebook handling

- The "Add existing lorebook" picker shows lorebooks not currently in *this* World (may be in others)
- Removing a lorebook from a World removes it from that World only — stays in others
- Deleting a lorebook entirely: confirmation modal lists all Worlds and Scenes affected
- Lorebook cards in any World view may optionally show small badges indicating other Worlds it belongs to

### Lorebook management

**Create:** "+ New Lorebook" in World detail → entity form (image, name, tags, summary) → calls SillyTavern world info create → automatically assigned to current World

**Add existing:** "Add existing lorebook" → picker shows lorebooks not in this World → click to assign

**Remove from World:** card context menu → "Remove from World" → lorebook stays in others if assigned; otherwise becomes unassigned

**Delete:** card context menu → "Delete lorebook" → confirmation modal listing all Worlds/Scenes referencing it → on confirm: removes file + all references

### World management

**Create:** "+ New World" → entity form (image, name, tags, summary)

**Edit:** click inline on World detail header metadata → auto-save

**Delete:** Worlds view context menu → "Delete World" → confirmation modal warning about Scenes and member lorebooks → on confirm: removes World; lorebooks become unassigned but NOT deleted; Scenes deleted with the World

### Scene management

All CRUD inside parent World's detail view. Scene editor opens as modal:
- Image upload, name, tags, summary, color picker
- Lorebook picker: checkboxes for all of parent World's lorebooks
- Save / Activate / Delete buttons

---

## Phased Build Order

17 phases (0-16). Each is testable end-to-end. Commit to git after each phase passes.

### Phase 0 — Design System Setup
Claude Code reads the **Lore Atlas Design Direction Brief** and the `/references` folder, then produces:
- `tokens.css` — all CSS variables (colors, spacing, typography, shadows, radius, blur, motion)
- `style-guide.md` — short doc explaining choices
- `phase-0-preview.html` — sample components (card, button, input, hero banner, list row vs grid card) rendered with the tokens
**Approval gate:** user reviews the preview. Iterate until happy. Only then proceed to Phase 1.

### Phase 1 — Hello Lore Atlas
Scaffold extension. `manifest.json` + minimal `index.js`. Console logs "Lore Atlas loaded."
**Test:** Refresh; see log.

### Phase 2 — Floating Launcher (collapsed only)
Floating draggable launcher icon. Position persists. Click opens an empty panel modal saying "Lore Atlas." Styled per Phase 0 tokens.
**Test:** Launcher visible, draggable, click opens placeholder.

### Phase 3 — Image Upload Infrastructure
Universal image upload component (file picker + drag-from-desktop + base64 + auto-compression). Test with throwaway button.
**Test:** Upload an image; renders; refresh and confirms persistence.

### Phase 4 — Hero Banner Component + Worlds View (CRUD)
Universal hero banner component (image + breadcrumb + title + fallback gradient). Worlds view inside the panel: header bar, grid of World cards with covers + tags + summary, entity form for create/edit. Tags chip input with autocomplete.
**Test:** Create "Faelands" World with cover, summary, tags. Hero banner displays its cover at top of Worlds view.

### Phase 5 — Grid/List View Toggle
Grid/list toggle widget at top-right of Worlds view. List mode renders rows with thumbnail/name/summary/tags/count. Preference persists.
**Test:** Toggle between grid and list. Both look polished.

### Phase 6 — World Detail View (read-only lorebook list)
Click a World card → drill into detail view. Hero banner at top showing World's cover. Below: placeholder section for "Lorebooks" (empty initially) and section for "Scenes" (empty initially). Breadcrumb. Back navigation.
**Test:** Drill in and out of a World; hero banner renders correctly.

### Phase 7 — Lorebook Assignment (multi-World capable)
"Add existing lorebook" picker shows lorebooks not in this World (may be in others). Assigning adds to the World's `lorebooks` array. Lorebooks shown as a basic grid in the World detail.
**Test:** Assign some lorebooks to Faelands. Assign one to a second World. Confirm multi-World assignment works.

### Phase 8 — Lorebook Cards + Covers + Grid/List
Style lorebook list as proper cards with covers (reuses Phase 3 upload). Grid/list toggle for the lorebook section. List mode shows rows with thumbnail/name/summary/tags/count.
**Test:** Lorebook cards look as polished as World cards. Toggle works.

### Phase 9 — Activation + Launcher Active Indicator
"Activate" button on World detail header enables only that World's lorebooks. Launcher expanded state shows active World name + quick-switch dropdown.
**Test:** Activate Faelands; verify SillyTavern's native world info shows correct selections. Quick-switch between Worlds.

### Phase 10 — Scenes (Data Model + Editor + Covers)
Scenes section in World detail. Scene editor modal (image, name, tags, summary, color, lorebook checkboxes). Create / edit / delete Scenes.
**Test:** Create "Before Iron Forest" and "Male Lead Scene" inside Faelands. Each has its own cover.

### Phase 11 — Scene Activation + Composite Launcher Display
Activating a Scene enables only its lorebooks. Launcher displays `World → Scene`. Quick-switch dropdown now shows Worlds AND Scenes under the active World.
**Test:** Activate "Male Lead Scene"; verify only its lorebooks active. Launcher shows "Faelands → Male Lead Scene."

### Phase 12 — Lorebook Detail View (entries list, read-only)
Click a lorebook card → drill into list of entries. Hero banner uses lorebook's cover (or parent World fallback). Entries shown as list rows (thumbnail placeholder, name, keys preview, content preview).
**Test:** Drill into a lorebook with many entries; all show up.

### Phase 13 — Entry Editor (Essentials + Auto-save + Undo)
Click an entry → editor opens (visual mirror of SillyTavern native). Name, keys, content fields with auto-save (500ms debounce) and visible indicator. Ctrl+Z restores previous state.
**Test:** Edit an entry; close Atlas; reopen; changes persist. Ctrl+Z restores.

### Phase 14 — Entry Images + Entry Create/Delete
Entry editor includes image upload (reuses Phase 3). Entry list rows show thumbnails. "+ New Entry" creates empties. Right-click → Delete with confirmation.
**Test:** Add image to an entry; create new entry; delete an entry.

### Phase 15 — Advanced Entry Fields
Collapsible "Advanced" section: secondary keys, position dropdown, depth, order, probability, group, automation ID, all toggles. Visually parallels SillyTavern native arrangement. Auto-save extends to all fields.
**Test:** Edit advanced fields; confirm values write correctly via SillyTavern's native world info panel.

### Phase 16 — Lorebook Create/Delete + Polish
"+ New Lorebook" in World detail creates a fresh lorebook assigned to the current World. "Remove from World" and "Delete lorebook" via context menu. Polish pass: animations, hover states, empty states, error states, edge cases (orphaned image references, deleted lorebooks in Scenes), keyboard navigation basics.
**Test:** Create a new lorebook from inside Faelands. Add entries. Delete it. Atlas remains stable.

---

## Quality Bar for v1.3

- Atlas never crashes SillyTavern under any user input.
- All state changes persist across reloads.
- Launcher position survives.
- Disabling the extension returns SillyTavern to normal state with no orphaned UI.
- Round-trip safe: open lorebooks in Atlas, close, open natively — no corruption.
- Image upload size cap enforced (compress to <1MB or reject).
- Storage usage warning if `extension_settings.lore_atlas` exceeds ~50MB.
- All destructive ops require confirmation.
- Auto-save indicator always accurate.
- All visual decisions use `tokens.css` variables — never hardcoded colors/spacing in component files.
- Codebase readable enough for the user to ask Claude Code "what does this function do" six months from now and get a useful answer. Inline comments where logic is non-obvious.

---

## Implementer Notes (for Claude Code)

- This is a vibe-coded personal tool for a visually-oriented creative writer, not production software. Optimize for clarity, modifiability, and visual polish.
- **Read the Design Direction Brief before writing any CSS or styling code.** All visual decisions flow from the tokens produced in Phase 0. If a decision isn't covered by the tokens, surface it to the user rather than choosing arbitrarily.
- Use git from the start. Initialize repo before Phase 1. Commit after each phase with descriptive messages.
- Reference scaffolding: https://github.com/city-unit/st-extension-example
- Most relevant SillyTavern source files: `public/scripts/world-info.js`, `public/scripts/extensions.js`, `public/scripts/st-context.js`
- For UI patterns: Doom's Enhancement Suite (floating shelf — vibe-coded with Claude Code, proof of concept), SillyTavern-WorldInfoDrawer (folder patterns), Lorebook Studio (entry editing patterns)
- Defer mobile responsiveness, i18n, accessibility beyond basic keyboard nav
- When in doubt about a design choice, optimize for visual experience over feature density. Fewer features that feel great > more features that feel cluttered.
- Ask the user before making destructive default choices; surface ambiguities rather than guessing.

---

## Roadmap Beyond v1.3

- **v1.5**: Chat tagging (link chats to World/Scene, auto-switch on `CHAT_CHANGED`), Scene templates, lorebook duplicate, lorebook rename, "Atlas home" image management
- **v2**: Token counts on cards, advanced search across entry content, bulk operations, tag-based filtering at all levels, export/import Atlas state
- **Sibling extension — Timeline** (~2-3 weeks after Atlas v1.5): event log with dates, recent-events injection, world-timeline reference, per-chat current position, period-based lorebook gating, integration with Atlas Scenes

---

## Context the User Will Provide Separately

Building Lore Atlas for an original fae-fiction worldbuilding project. The project has multiple lorebooks organized by category (world lore, character-specific, hidden/secret). A critical "information firewall" requirement: certain lorebooks must NEVER be active during scenes with male leads (e.g. Iron Court Hidden). Scenes within the Faelands World are the primary firewall mechanism — separate Scenes for "Male Lead" (firewall-compliant) vs "Marian Alone" (full access).

Long-term ambition: AUs (Faelands, Demonworld, Modern AU as separate Worlds), with some lorebooks (e.g. character bibles) appearing in multiple Worlds via multi-World assignment.

User is not a software engineer. Build with that in mind: clear code, plain-language inline comments where logic is non-obvious, easy rollback via git, no clever-but-fragile patterns. User is visually-oriented and cares deeply about how the tool feels.

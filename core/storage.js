// ============================================================================
// core/storage.js — Lore Atlas's own persisted state.
// ----------------------------------------------------------------------------
// Everything Atlas remembers across reloads (Worlds, Scenes, cover images,
// launcher position, view preferences, settings) lives under
// `extension_settings.lore_atlas`. SillyTavern persists that object for us when
// we call saveSettingsDebounced() / saveSettings(); we never touch storage
// directly. Uninstall the extension and the lorebooks themselves are untouched —
// only this metadata layer goes away.
//
// This module owns the state SHAPE and the low-level read/save helpers. Entity
// CRUD (Worlds, Scenes, lorebook metadata) layers on top in later phases.
//
// Import-depth note: files in this subfolder sit one level deeper than index.js,
// so SillyTavern's core modules need an extra "../". extensions.js lives at
// public/scripts/extensions.js; script.js lives at public/script.js.
// ============================================================================

import { getContext } from '../../../../extensions.js';
// Immediate (non-debounced) save. saveSettingsDebounced waits ~1s before writing,
// which is fine for typing but can drop a one-off action (like moving the
// launcher) if the user reloads right after. We use this immediate version for
// those discrete actions.
import { saveSettings } from '../../../../../script.js';

// The single key under extension_settings where all Atlas state lives.
const STORAGE_KEY = 'lore_atlas';

// The default Atlas state, mirroring the data model in the v1.3 spec. Used to
// seed first-run state and to backfill keys missing from older saved state.
// `launcherPosition` starts null so the launcher computes a top-right default at
// mount (see components/launcher.js); once moved, the real coords are stored.
const DEFAULT_STATE = {
    worlds: [],
    activeWorldId: null,
    activeSceneId: null,
    covers: {
        worlds: {},
        lorebooks: {},
        scenes: {},
        entries: {},
    },
    lorebookMeta: {},
    launcherPosition: null,
    launcherCollapsed: true,   // spec: launcher defaults to the collapsed icon
    viewPreferences: {
        worldsView: 'grid',
        lorebooksView: 'grid',
        scenesView: 'grid',
        entriesView: 'list',
    },
    settings: {
        confirmBeforeSwitchingWorld: false,
        confirmBeforeDelete: true,
        showEntryCounts: true,
        accentColor: '#a07b3a',
        worldsHomeBannerOverride: null,
    },
};

/**
 * Returns Atlas's live state object (the one stored inside extension_settings, so
 * mutating it and then calling saveState()/saveStateNow() persists the change).
 * Seeds defaults on first run and backfills any keys added in newer versions, so
 * the rest of the code never has to null-check individual fields.
 *
 * @returns {typeof DEFAULT_STATE} the live Atlas state.
 */
export function getState() {
    const root = getContext().extensionSettings;

    // First run: create the Atlas section from defaults.
    if (!root[STORAGE_KEY] || typeof root[STORAGE_KEY] !== 'object') {
        root[STORAGE_KEY] = structuredClone(DEFAULT_STATE);
    }

    const state = root[STORAGE_KEY];

    // Backfill any missing top-level keys (state saved by an older Atlas that
    // predates a field).
    for (const key of Object.keys(DEFAULT_STATE)) {
        if (!(key in state)) {
            state[key] = structuredClone(DEFAULT_STATE[key]);
        }
    }
    // covers and settings are nested objects — backfill their keys too.
    for (const key of Object.keys(DEFAULT_STATE.covers)) {
        if (!(key in state.covers)) state.covers[key] = {};
    }
    for (const key of Object.keys(DEFAULT_STATE.settings)) {
        if (!(key in state.settings)) state.settings[key] = DEFAULT_STATE.settings[key];
    }

    return state;
}

/**
 * Persists the current state (debounced ~1s). Best for high-frequency mutations
 * like typing in an editor, where we don't want a disk write per keystroke.
 */
export function saveState() {
    getContext().saveSettingsDebounced();
}

/**
 * Persists immediately (no debounce). Use for discrete one-off actions the user
 * might reload right after — moving/collapsing the launcher, toggling a setting —
 * so the change isn't lost inside the debounce window. Fire-and-forget.
 */
export function saveStateNow() {
    saveSettings();
}

/**
 * Sets a top-level state field and persists it immediately.
 * @param {string} key
 * @param {*} value
 */
export function setStateField(key, value) {
    getState()[key] = value;
    saveStateNow();
}

// ---- Launcher position / collapsed (Phase 2) ----

/**
 * Returns the saved launcher position, or null if it has never been placed
 * (the launcher then computes a top-right default at mount).
 * @returns {{x:number, y:number}|null}
 */
export function getLauncherPosition() {
    return getState().launcherPosition;
}

/**
 * Saves the launcher's top-left position immediately.
 * @param {{x:number, y:number}} pos
 */
export function setLauncherPosition(pos) {
    setStateField('launcherPosition', pos);
}

/** @returns {boolean} whether the launcher is collapsed (icon-only). */
export function getLauncherCollapsed() {
    return getState().launcherCollapsed;
}

/** @param {boolean} collapsed Saves the launcher collapsed/expanded state. */
export function setLauncherCollapsed(collapsed) {
    setStateField('launcherCollapsed', collapsed);
}

// ---- Worlds (Phase 4) ----
//
// A World is a top-level universe (Faelands, Demonworld, …). It owns member
// lorebooks (by filename) and nested Scenes. Atlas stores Worlds here; the
// lorebook JSON files themselves stay owned by SillyTavern.

// New Worlds pick a starting color from this small fae-leaning palette, so a fresh
// World's fallback gradient / active dot isn't a jarring default. User-editable.
const WORLD_COLORS = ['#a07b3a', '#7d5fa3', '#3a7ba0', '#3a8f6a', '#a0533a', '#5f6fa0'];

/**
 * Generates a reasonably-unique id with a given prefix, e.g. "world_lx9f2a3b".
 * Time-based prefix keeps ids roughly sortable; the random suffix avoids
 * collisions within the same millisecond.
 * @param {string} prefix
 * @returns {string}
 */
export function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Returns the live array of Worlds (push/splice then saveState to persist).
 * @returns {Array<object>}
 */
export function getWorlds() {
    return getState().worlds;
}

/**
 * Finds a World by id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getWorldById(id) {
    return getWorlds().find(w => w.id === id);
}

/**
 * Creates a World, appends it, persists, and returns it. Accepts partial
 * overrides; anything omitted gets a sensible default.
 * @param {Partial<{name:string, summary:string, tags:string[], color:string, lorebooks:string[]}>} [overrides]
 * @returns {object} the created World.
 */
export function createWorld(overrides = {}) {
    const now = Date.now();
    const worlds = getWorlds();
    const world = {
        id: generateId('world'),
        name: overrides.name ?? 'New World',
        summary: overrides.summary ?? '',
        tags: Array.isArray(overrides.tags) ? [...overrides.tags] : [],
        // Rotate through the palette by current count so successive Worlds differ.
        color: overrides.color ?? WORLD_COLORS[worlds.length % WORLD_COLORS.length],
        lorebooks: Array.isArray(overrides.lorebooks) ? [...overrides.lorebooks] : [],
        scenes: [],
        created: now,
        modified: now,
    };
    worlds.push(world);
    saveStateNow();
    return world;
}

/**
 * Applies changes to a World, bumps `modified`, and persists. Unknown ids no-op.
 * @param {string} id
 * @param {Partial<{name:string, summary:string, tags:string[], color:string, lorebooks:string[]}>} changes
 * @returns {object|undefined} the updated World.
 */
export function updateWorld(id, changes) {
    const world = getWorldById(id);
    if (!world) return undefined;
    Object.assign(world, changes);
    world.modified = Date.now();
    saveStateNow();
    return world;
}

/**
 * Deletes a World by id. Also removes its cover image and clears it as the active
 * World if it was active. Its Scenes go with it (they're nested). Member lorebooks
 * are NOT deleted — they just become unassigned from this World (their files and
 * any other World assignments are untouched).
 * @param {string} id
 */
export function deleteWorld(id) {
    const worlds = getWorlds();
    const index = worlds.findIndex(w => w.id === id);
    if (index === -1) return;
    worlds.splice(index, 1);
    const state = getState();
    if (state.activeWorldId === id) {
        state.activeWorldId = null;
        state.activeSceneId = null;
    }
    // Drop the World's cover so it doesn't linger as orphaned base64.
    if (state.covers.worlds[id]) delete state.covers.worlds[id];
    saveStateNow();
}

// ---- Scenes (Phase 10) ----
//
// A Scene is a named subset of a World's lorebooks (e.g. "Male Lead Scene" — the
// firewall-compliant set). Scenes are nested inside their parent World. A Scene's
// lorebooks are always kept to a subset of the World's lorebooks.

/** Returns the live Scenes array for a World (push/splice + saveState to persist). */
export function getScenes(worldId) {
    return getWorldById(worldId)?.scenes ?? [];
}

/** Finds a Scene by id within a World. */
export function getSceneById(worldId, sceneId) {
    return getScenes(worldId).find(s => s.id === sceneId);
}

/**
 * Creates a Scene inside a World and returns it. Its lorebooks are filtered to the
 * World's current lorebooks (a Scene can never reference lore the World doesn't have).
 * @param {string} worldId
 * @param {Partial<{name:string, summary:string, tags:string[], color:string, lorebooks:string[]}>} [overrides]
 * @returns {object|null}
 */
export function createScene(worldId, overrides = {}) {
    const world = getWorldById(worldId);
    if (!world) return null;
    const now = Date.now();
    const inWorld = new Set(world.lorebooks);
    const scene = {
        id: generateId('scene'),
        name: overrides.name ?? 'New Scene',
        summary: overrides.summary ?? '',
        tags: Array.isArray(overrides.tags) ? [...overrides.tags] : [],
        color: overrides.color ?? world.color,
        lorebooks: (overrides.lorebooks ?? []).filter(n => inWorld.has(n)),
        created: now,
        modified: now,
    };
    world.scenes.push(scene);
    saveStateNow();
    return scene;
}

/**
 * Applies changes to a Scene (lorebooks re-filtered to the World's subset), bumps
 * `modified`, persists. Returns the updated Scene or undefined.
 */
export function updateScene(worldId, sceneId, changes) {
    const world = getWorldById(worldId);
    const scene = world && getSceneById(worldId, sceneId);
    if (!scene) return undefined;
    const next = { ...changes };
    if (Array.isArray(next.lorebooks)) {
        const inWorld = new Set(world.lorebooks);
        next.lorebooks = next.lorebooks.filter(n => inWorld.has(n));
    }
    Object.assign(scene, next);
    scene.modified = Date.now();
    saveStateNow();
    return scene;
}

/**
 * Deletes a Scene: removes it, drops its cover, and clears it as the active Scene
 * if it was active.
 */
export function deleteScene(worldId, sceneId) {
    const scenes = getScenes(worldId);
    const i = scenes.findIndex(s => s.id === sceneId);
    if (i === -1) return;
    scenes.splice(i, 1);
    const state = getState();
    if (state.activeSceneId === sceneId) state.activeSceneId = null;
    if (state.covers.scenes[sceneId]) delete state.covers.scenes[sceneId];
    saveStateNow();
}

/** Unique sorted tags across a World's Scenes — autocomplete source for Scene tags. */
export function getAllSceneTags(worldId) {
    const set = new Set();
    for (const scene of getScenes(worldId)) {
        for (const tag of (scene.tags || [])) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

// ---- World ↔ lorebook assignment (Phase 7, multi-World) ----
//
// A lorebook is referenced by filename and may belong to MANY Worlds at once. The
// lorebook file itself is never touched here — only the World's `lorebooks` array.

/**
 * Assigns a lorebook (by filename) to a World. No-op if already present. Persists.
 * @param {string} worldId
 * @param {string} lorebookName
 */
export function addLorebookToWorld(worldId, lorebookName) {
    const world = getWorldById(worldId);
    if (!world || world.lorebooks.includes(lorebookName)) return;
    world.lorebooks.push(lorebookName);
    world.modified = Date.now();
    saveStateNow();
}

/**
 * Removes a lorebook from a World (and from any of that World's Scenes that
 * referenced it, since a Scene's lorebooks are always a subset of its World's).
 * The lorebook stays in any OTHER Worlds and its file is untouched. Persists.
 * @param {string} worldId
 * @param {string} lorebookName
 */
export function removeLorebookFromWorld(worldId, lorebookName) {
    const world = getWorldById(worldId);
    if (!world) return;
    const i = world.lorebooks.indexOf(lorebookName);
    if (i === -1) return;
    world.lorebooks.splice(i, 1);
    // Keep Scenes consistent: drop the lorebook from any Scene that had it.
    for (const scene of (world.scenes || [])) {
        const j = scene.lorebooks?.indexOf(lorebookName) ?? -1;
        if (j !== -1) scene.lorebooks.splice(j, 1);
    }
    world.modified = Date.now();
    saveStateNow();
}

/**
 * Returns the Worlds a lorebook is assigned to (used for "also in …" badges and
 * the delete-impact warning).
 * @param {string} lorebookName
 * @returns {object[]} the World objects referencing this lorebook.
 */
export function getWorldsForLorebook(lorebookName) {
    return getWorlds().filter(w => w.lorebooks.includes(lorebookName));
}

/**
 * Returns the sorted unique set of tags used across all Worlds — the autocomplete
 * source for the World tag input ("same scope" per the spec).
 * @returns {string[]}
 */
export function getAllWorldTags() {
    const set = new Set();
    for (const w of getWorlds()) {
        for (const tag of (w.tags || [])) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

// ---- Active World (full activation logic arrives in Phase 9) ----

/** @returns {string|null} the active World id, or null. */
export function getActiveWorldId() {
    return getState().activeWorldId;
}

/** @param {string|null} id Sets the active World id (clears the Scene) and persists. */
export function setActiveWorldId(id) {
    const state = getState();
    state.activeWorldId = id;
    state.activeSceneId = null;
    saveStateNow();
}

/** @returns {string|null} the active Scene id, or null. */
export function getActiveSceneId() {
    return getState().activeSceneId;
}

/**
 * Marks a Scene active (and its parent World). Persists. Used by Scene activation.
 * @param {string} worldId
 * @param {string} sceneId
 */
export function setActiveScene(worldId, sceneId) {
    const state = getState();
    state.activeWorldId = worldId;
    state.activeSceneId = sceneId;
    saveStateNow();
}

// ---- Settings ----

/**
 * Reads a value from the nested settings object (e.g. 'confirmBeforeSwitchingWorld').
 * @param {string} key
 * @returns {*}
 */
export function getSetting(key) {
    return getState().settings[key];
}

/**
 * Sets a nested settings value and persists immediately.
 * @param {string} key
 * @param {*} value
 */
export function setSetting(key, value) {
    getState().settings[key] = value;
    saveStateNow();
}

// ---- Lorebook metadata (Phase 8) ----
//
// Lorebook JSON files belong to SillyTavern, so Atlas tracks its own per-lorebook
// metadata (tags, summary) keyed by lorebook filename. Covers live separately
// under covers.lorebooks (see setCover). A lorebook's name is its filename and is
// not edited here (rename is a later milestone).

/**
 * Returns a lorebook's Atlas metadata, with defaults backfilled.
 * @param {string} name lorebook filename.
 * @returns {{ tags: string[], summary: string }}
 */
export function getLorebookMeta(name) {
    const meta = getState().lorebookMeta[name];
    return {
        tags: Array.isArray(meta?.tags) ? meta.tags : [],
        summary: typeof meta?.summary === 'string' ? meta.summary : '',
    };
}

/**
 * Sets a lorebook's metadata (tags/summary) and persists immediately. Empty
 * metadata is pruned so we don't accumulate blank records.
 * @param {string} name
 * @param {{ tags?: string[], summary?: string }} changes
 */
export function setLorebookMeta(name, changes) {
    const store = getState().lorebookMeta;
    const next = { ...getLorebookMeta(name), ...changes };
    if ((next.tags?.length ?? 0) === 0 && !next.summary) {
        delete store[name];
    } else {
        store[name] = { tags: [...(next.tags || [])], summary: next.summary || '' };
    }
    saveStateNow();
}

/**
 * Unique sorted tags across all lorebooks — autocomplete source for lorebook tags.
 * @returns {string[]}
 */
export function getAllLorebookTags() {
    const set = new Set();
    for (const meta of Object.values(getState().lorebookMeta)) {
        for (const tag of (meta?.tags || [])) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

// ---- View preferences (Phase 5) ----
//
// Each view (Worlds, Lorebooks, Entries) remembers whether it's showing grid or
// list. Stored under viewPreferences.{key}View and persisted immediately, since a
// toggle is a discrete one-off the user may reload right after.

/** Valid view-preference keys. */
const VIEW_KEYS = ['worldsView', 'lorebooksView', 'scenesView', 'entriesView'];

/**
 * Returns 'grid' or 'list' for a view (falls back to 'grid' for unknown keys).
 * @param {'worldsView'|'lorebooksView'|'entriesView'} key
 * @returns {'grid'|'list'}
 */
export function getViewPreference(key) {
    if (!VIEW_KEYS.includes(key)) return 'grid';
    return getState().viewPreferences[key] ?? 'grid';
}

/**
 * Sets a view's grid/list preference and persists immediately.
 * @param {'worldsView'|'lorebooksView'|'entriesView'} key
 * @param {'grid'|'list'} mode
 */
export function setViewPreference(key, mode) {
    if (!VIEW_KEYS.includes(key)) return;
    getState().viewPreferences[key] = mode;
    saveStateNow();
}

// ---- Cover images (Phase 3) ----
//
// Cover images are stored as base64 data URLs under covers.{type}.{id}, where
// {type} is 'worlds' | 'lorebooks' | 'scenes'. (Entry images are nested one level
// deeper — covers.entries[lorebook][entryId] — and get their own helpers when the
// entry editor lands.) Keeping images here, separate from the entity objects, keeps
// the entity records small and easy to read.

// The flat cover buckets that setCover/getCover/removeCover operate on.
const FLAT_COVER_TYPES = ['worlds', 'lorebooks', 'scenes'];

/**
 * Returns the stored cover data URL for an entity, or null if none.
 * @param {'worlds'|'lorebooks'|'scenes'} type
 * @param {string} id
 * @returns {string|null}
 */
export function getCover(type, id) {
    if (!FLAT_COVER_TYPES.includes(type)) return null;
    return getState().covers[type][id] ?? null;
}

/**
 * Saves (or clears) an entity's cover image and persists immediately. Pass a
 * falsy dataUrl to remove the cover. Warns if total Atlas storage is getting large.
 * @param {'worlds'|'lorebooks'|'scenes'} type
 * @param {string} id
 * @param {string|null} dataUrl base64 data URL, or null/'' to clear.
 */
export function setCover(type, id, dataUrl) {
    if (!FLAT_COVER_TYPES.includes(type)) return;
    const covers = getState().covers[type];
    if (dataUrl) {
        covers[id] = dataUrl;
    } else {
        delete covers[id];
    }
    saveStateNow();
    warnIfStorageLarge();
}

/**
 * Removes an entity's cover image.
 * @param {'worlds'|'lorebooks'|'scenes'} type
 * @param {string} id
 */
export function removeCover(type, id) {
    setCover(type, id, null);
}

// ---- Storage size guard (Phase 3) ----
//
// Base64 images live inside extension_settings, which SillyTavern serializes to
// JSON on every save. If the user uploads many large covers this can bloat, so we
// surface a one-time-ish warning past a soft threshold (~50MB per the spec).

// Soft cap before we warn the user (bytes).
const STORAGE_WARN_BYTES = 50 * 1024 * 1024;

// Remember whether we've already warned this session, so we don't nag on every save.
let storageWarned = false;

/**
 * Rough byte size of the Atlas state (JSON length ≈ bytes for our mostly-ASCII +
 * base64 content). Cheap enough to run on save.
 * @returns {number}
 */
export function estimateStateBytes() {
    try {
        return JSON.stringify(getState()).length;
    } catch {
        return 0;
    }
}

/**
 * Warns once (via toastr if available, else console) when Atlas storage crosses the
 * soft cap. Reset back below the cap re-arms the warning.
 */
export function warnIfStorageLarge() {
    const bytes = estimateStateBytes();
    if (bytes > STORAGE_WARN_BYTES) {
        if (!storageWarned) {
            storageWarned = true;
            const mb = (bytes / (1024 * 1024)).toFixed(0);
            const msg = `Lore Atlas is using about ${mb}MB of storage. Consider removing some cover images to keep SillyTavern's settings file manageable.`;
            if (typeof toastr !== 'undefined') {
                toastr.warning(msg, 'Lore Atlas storage', { timeOut: 8000 });
            } else {
                console.warn('[Lore Atlas]', msg);
            }
        }
    } else {
        storageWarned = false;
    }
}

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

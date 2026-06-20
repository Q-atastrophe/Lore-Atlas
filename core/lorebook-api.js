// ============================================================================
// core/lorebook-api.js — a thin wrapper around SillyTavern's world info system.
// ----------------------------------------------------------------------------
// Lorebooks ARE SillyTavern "world info" files. Atlas never owns them; it reads
// them through this wrapper so that if ST's internal API changes there's exactly
// one file to fix. Everything here degrades gracefully (returns empty/0/null
// rather than throwing) — Atlas must never crash SillyTavern.
//
// Read APIs used so far (from getContext()):
//   getWorldInfoNames() -> string[]  (lorebook filenames, no .json)
//   loadWorldInfo(name) -> Promise<{ entries: object } | null>
// Write/activation APIs land in later phases.
// ============================================================================

import { getContext } from '../../../../extensions.js';
// Entry create/delete aren't on getContext(), so we use ST's world-info functions
// directly (already loaded by ST; importing just returns the cached module).
import { createWorldInfoEntry, deleteWorldInfoEntry, createNewWorldInfo, deleteWorldInfo } from '../../../../world-info.js';

/**
 * Returns the names of all lorebooks SillyTavern knows about (filenames without
 * `.json`). A fresh copy, so callers may sort/filter freely.
 * @returns {string[]}
 */
export function getLorebookNames() {
    const ctx = getContext();
    if (typeof ctx?.getWorldInfoNames !== 'function') return [];
    try {
        return ctx.getWorldInfoNames() ?? [];
    } catch {
        return [];
    }
}

/**
 * Loads a single lorebook's full data (entries + metadata). ST caches loaded
 * world info, so repeat calls for the same name are instant. Returns null on any
 * failure — treat as "couldn't read this lorebook" and carry on.
 * @param {string} name
 * @returns {Promise<object|null>}
 */
export async function getLorebookData(name) {
    const ctx = getContext();
    if (typeof ctx?.loadWorldInfo !== 'function') return null;
    try {
        return (await ctx.loadWorldInfo(name)) ?? null;
    } catch {
        return null;
    }
}

/**
 * Counts the entries in a lorebook. World info stores entries as an object keyed
 * by uid, so the count is the number of keys.
 * @param {string} name
 * @returns {Promise<number>}
 */
export async function getLorebookEntryCount(name) {
    const data = await getLorebookData(name);
    if (!data || typeof data.entries !== 'object' || data.entries === null) return 0;
    return Object.keys(data.entries).length;
}

/**
 * Returns a lorebook's entries as an array, in SillyTavern's display order. Each
 * entry keeps its native fields (uid, comment, key, keysecondary, content, disable,
 * …). Returns [] if the lorebook can't be read.
 * @param {string} name
 * @returns {Promise<object[]>}
 */
export async function getLorebookEntries(name) {
    const data = await getLorebookData(name);
    if (!data || typeof data.entries !== 'object' || data.entries === null) return [];
    const entries = Object.values(data.entries);
    // Display order: ST's displayIndex, then order, then uid as a stable fallback.
    entries.sort((a, b) =>
        (a.displayIndex ?? a.order ?? a.uid ?? 0) - (b.displayIndex ?? b.order ?? b.uid ?? 0));
    return entries;
}

/**
 * A human label for an entry: its title/memo (comment), else its first key, else
 * a uid-based fallback. Never empty.
 * @param {object} entry
 * @returns {string}
 */
export function entryDisplayName(entry) {
    if (entry?.comment) return entry.comment;
    if (Array.isArray(entry?.key) && entry.key.length) return entry.key[0];
    return `Entry ${entry?.uid ?? ''}`.trim();
}

/**
 * True if a lorebook of this name still exists in SillyTavern. Used to flag
 * orphaned references (a World pointing at a deleted file).
 * @param {string} name
 * @returns {boolean}
 */
export function lorebookExists(name) {
    return getLorebookNames().includes(name);
}

// ---- Entry read/write (Phase 13) ----

/**
 * Returns a single entry object (by uid) from a lorebook, or null.
 * @param {string} lorebookName
 * @param {string|number} uid
 * @returns {Promise<object|null>}
 */
export async function getEntry(lorebookName, uid) {
    const data = await getLorebookData(lorebookName);
    return data?.entries?.[uid] ?? null;
}

/**
 * Applies field changes to an entry and persists the lorebook through SillyTavern's
 * own saveWorldInfo (which updates ST's cache immediately and writes to disk). We
 * mutate the cached data object in place, then hand it back to ST to save — exactly
 * what ST's native editor does.
 * @param {string} lorebookName
 * @param {string|number} uid
 * @param {object} changes partial entry fields (comment, key, content, …).
 * @returns {Promise<boolean>} true if the entry existed and was saved.
 */
export async function updateEntry(lorebookName, uid, changes) {
    const ctx = getContext();
    const data = await getLorebookData(lorebookName);
    if (!data || !data.entries || !data.entries[uid]) return false;
    Object.assign(data.entries[uid], changes);
    if (typeof ctx?.saveWorldInfo === 'function') {
        // immediately=true so a "close Atlas, reopen" round-trip is always persisted.
        await ctx.saveWorldInfo(lorebookName, data, true);
    }
    return true;
}

/**
 * Creates a new (empty) entry in a lorebook using ST's entry template, persists,
 * and returns it. Returns null on failure.
 * @param {string} lorebookName
 * @returns {Promise<object|null>}
 */
export async function createEntry(lorebookName) {
    const ctx = getContext();
    const data = await getLorebookData(lorebookName);
    if (!data) return null;
    const entry = createWorldInfoEntry(lorebookName, data);
    if (!entry) return null;
    if (typeof ctx?.saveWorldInfo === 'function') {
        await ctx.saveWorldInfo(lorebookName, data, true);
    }
    return entry;
}

/**
 * Deletes an entry by uid and persists. We confirm in Atlas's own UI, so ST's
 * native confirm is skipped (silent). Returns true if it was deleted.
 * @param {string} lorebookName
 * @param {string|number} uid
 * @returns {Promise<boolean>}
 */
export async function deleteEntry(lorebookName, uid) {
    const ctx = getContext();
    const data = await getLorebookData(lorebookName);
    if (!data || !data.entries || !(uid in data.entries)) return false;
    const ok = await deleteWorldInfoEntry(data, uid, { silent: true });
    if (ok && typeof ctx?.saveWorldInfo === 'function') {
        await ctx.saveWorldInfo(lorebookName, data, true);
    }
    return ok;
}

// ---- Lorebook file create/delete (Phase 16) ----

/**
 * Creates a brand-new (empty) lorebook FILE in SillyTavern. The server may sanitize
 * the requested name, so we diff the name list to return the actual created name.
 * @param {string} name
 * @returns {Promise<{name?: string, exists?: boolean}|null>}
 *   { name } on success, { exists:true } if a lorebook of that name already exists,
 *   or null on failure.
 */
export async function createLorebook(name) {
    if (!name) return null;
    const before = new Set(getLorebookNames());
    if (before.has(name)) return { exists: true };
    const ok = await createNewWorldInfo(name);
    if (!ok) return null;
    const after = getLorebookNames();
    const created = after.find(n => !before.has(n)) || (after.includes(name) ? name : null);
    return created ? { name: created } : null;
}

/**
 * Deletes a lorebook FILE from SillyTavern entirely (ST also clears it from the
 * active selection, character/persona references, and its cache).
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function deleteLorebookFile(name) {
    try {
        return await deleteWorldInfo(name);
    } catch {
        return false;
    }
}

// ---- Activation (Phase 9) ----
//
// SillyTavern's GLOBAL lorebook selection is driven by a hidden select2 multiselect
// <select id="world_info"> whose option values are indices into world_names. We set
// its value and trigger "change", which runs ST's own handler (persists + emits its
// world-info event) — so Atlas activation behaves exactly like a manual toggle.

/**
 * Names of the lorebooks currently active in ST's global selection, in selection
 * order. Returns [] if the control isn't present.
 * @returns {string[]}
 */
export function getActiveLorebooks() {
    const names = getLorebookNames();
    // $ is SillyTavern's global jQuery. Guard in case it isn't ready.
    const selected = (typeof $ === 'function') ? $('#world_info').val() : null;
    if (!Array.isArray(selected)) return [];
    return selected.map(i => names[Number(i)]).filter(Boolean);
}

/**
 * Refreshes SillyTavern after an entry edit so the change is reflected everywhere
 * without a page reload:
 *  - re-applies the global world-info selection (rebuilds the active set), and
 *  - reloads ST's native World Info editor panel if it's open on this book (so its
 *    toggle/UI matches the saved state).
 * The prompt scan already reads our updated cache; this keeps the visible UI honest.
 * @param {string} [lorebookName]
 */
export function refreshActiveWorldInfo(lorebookName) {
    const ctx = getContext();
    if (typeof $ === 'function') {
        $('#world_info').trigger('change');
    }
    if (lorebookName && typeof ctx?.reloadWorldInfoEditor === 'function') {
        ctx.reloadWorldInfoEditor(lorebookName);
    }
}

/**
 * Makes EXACTLY the given lorebooks the global selection — enabling each and
 * disabling all others. Missing names (deleted files) are skipped, not errored,
 * so a stale World still activates the parts that remain. Goes through ST's native
 * change handler.
 * @param {string[]} targetNames
 * @returns {{applied: string[], skipped: string[]}}
 */
export function setActiveLorebooks(targetNames) {
    const names = getLorebookNames();
    const applied = [];
    const skipped = [];
    const indices = [];
    for (const name of targetNames) {
        const index = names.indexOf(name);
        if (index >= 0) { indices.push(String(index)); applied.push(name); }
        else { skipped.push(name); }
    }
    if (typeof $ === 'function') {
        $('#world_info').val(indices).trigger('change');
    }
    return { applied, skipped };
}

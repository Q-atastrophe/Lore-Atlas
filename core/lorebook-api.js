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

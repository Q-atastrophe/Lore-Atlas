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
 * True if a lorebook of this name still exists in SillyTavern. Used to flag
 * orphaned references (a World pointing at a deleted file).
 * @param {string} name
 * @returns {boolean}
 */
export function lorebookExists(name) {
    return getLorebookNames().includes(name);
}

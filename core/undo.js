// ============================================================================
// core/undo.js — per-entry in-memory undo.
// ----------------------------------------------------------------------------
// Captures the previous state of an entry's editable fields before each save, so
// Ctrl+Z (or the editor's undo button) can step back. Up to 20 steps per entry,
// in memory only — it does NOT persist across reloads (per the spec).
//
// State here is just a plain snapshot object the editor defines (e.g.
// { comment, key, content }); this module doesn't care about its shape.
// ============================================================================

const MAX_STEPS = 20;

// key (e.g. "lorebook::uid") -> array of past states (oldest first, newest last).
const stacks = new Map();

/**
 * Pushes a snapshot of the state being REPLACED, so it can be restored later.
 * @param {string} key
 * @param {object} state the state prior to the change about to be saved.
 */
export function pushUndo(key, state) {
    if (!stacks.has(key)) stacks.set(key, []);
    const stack = stacks.get(key);
    stack.push(state);
    if (stack.length > MAX_STEPS) stack.shift();   // drop the oldest beyond the cap
}

/**
 * Pops and returns the most recent prior state, or null if there's nothing to undo.
 * @param {string} key
 * @returns {object|null}
 */
export function popUndo(key) {
    const stack = stacks.get(key);
    if (!stack || stack.length === 0) return null;
    return stack.pop();
}

/** @returns {boolean} whether there's anything to undo for this key. */
export function canUndo(key) {
    return (stacks.get(key)?.length ?? 0) > 0;
}

/** Clears the undo history for a key (e.g. when leaving the editor). */
export function clearUndo(key) {
    stacks.delete(key);
}

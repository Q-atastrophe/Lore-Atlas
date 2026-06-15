// ============================================================================
// core/activation.js — applying a World (or Scene) to SillyTavern.
// ----------------------------------------------------------------------------
// Activating a World enables EXACTLY its member lorebooks and disables everything
// else, then records it as the active World. Both the World detail "Activate"
// button and the launcher's quick-switch go through requestActivateWorld(), so the
// "confirm before switching" setting is honored everywhere.
//
// Scene activation arrives in Phase 11; this file already exposes the display-state
// computation the launcher uses, which will grow to understand Scenes then.
// ============================================================================

import { getContext } from '../../../../extensions.js';
import { POPUP_TYPE, POPUP_RESULT, callGenericPopup } from '../../../../popup.js';
import {
    getWorldById, getWorlds, setActiveWorldId, getActiveWorldId, getSetting,
} from './storage.js';
import { setActiveLorebooks, getActiveLorebooks, getLorebookNames } from './lorebook-api.js';

// Atlas emits this after activation so the launcher (and anything else) can react.
// Payload: { worldId, name, applied: string[], skipped: string[] }.
export const LORE_ATLAS_ACTIVATED = 'lore_atlas_activated';

/** Set-equality for two string arrays (order-independent). */
function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every(x => set.has(x));
}

/**
 * User-facing World activation. Honors the confirm-before-switching setting, then
 * activates. Returns the result, or null if unknown / cancelled.
 * @param {string} worldId
 * @returns {Promise<{world: object, applied: string[], skipped: string[]}|null>}
 */
export async function requestActivateWorld(worldId) {
    const world = getWorldById(worldId);
    if (!world) return null;

    if (getSetting('confirmBeforeSwitchingWorld')) {
        const ok = await callGenericPopup(
            `Activate “${world.name}”? This will change which lorebooks are loaded.`,
            POPUP_TYPE.CONFIRM,
        );
        if (ok !== POPUP_RESULT.AFFIRMATIVE) return null;
    }
    return activateWorld(worldId);
}

/**
 * Activates a World: makes its lorebooks the global selection, records it active,
 * emits LORE_ATLAS_ACTIVATED, and (by default) shows a toast listing what's now on.
 * @param {string} worldId
 * @param {object} [options]
 * @param {boolean} [options.notify=true]
 * @returns {{world: object, applied: string[], skipped: string[]}|null}
 */
export function activateWorld(worldId, { notify = true } = {}) {
    const world = getWorldById(worldId);
    if (!world) return null;

    const { applied, skipped } = setActiveLorebooks(world.lorebooks);
    setActiveWorldId(worldId);   // also clears any active Scene

    const eventSource = getContext()?.eventSource;
    eventSource?.emit?.(LORE_ATLAS_ACTIVATED, { worldId, name: world.name, applied, skipped });

    if (notify) notifyActivated(world.name, applied, skipped);
    return { world, applied, skipped };
}

/** Caps a name list for display: "a, b, c +4 more". */
function formatNames(names) {
    const MAX = 8;
    return names.length <= MAX ? names.join(', ') : `${names.slice(0, MAX).join(', ')} +${names.length - MAX} more`;
}

/**
 * Toast confirming the new active set — so the user can trust the switch without
 * opening ST's World Info tab. A missing lorebook gets a louder, longer warning
 * (firewall safety: silently dropping lore is dangerous).
 */
function notifyActivated(worldName, applied, skipped) {
    if (typeof toastr === 'undefined') return;
    const title = `Activated “${worldName}”`;
    const opts = { escapeHtml: true, timeOut: 5000, extendedTimeOut: 2500 };
    if (skipped.length > 0) {
        const activePart = applied.length ? `Now active: ${formatNames(applied)}. ` : 'No lorebooks active. ';
        toastr.warning(`${activePart}⚠ Skipped ${skipped.length} missing: ${formatNames(skipped)}`, title, { ...opts, timeOut: 8000, extendedTimeOut: 4000 });
    } else if (applied.length === 0) {
        toastr.info('This World has no lorebooks — all lore disabled.', title, opts);
    } else {
        toastr.success(`Now active: ${formatNames(applied)}`, title, opts);
    }
}

/**
 * Works out what the launcher should display by comparing the ACTUAL active
 * lorebook selection to the active World. Catches lorebooks toggled outside Atlas.
 *
 *  - active World whose lorebooks match the selection -> the World name
 *  - active World but the selection differs           -> "Custom" (toggled away)
 *  - no active World but some lorebooks are on         -> "Custom"
 *  - nothing active                                    -> "None"
 *
 * Missing lorebooks (deleted files) are ignored when matching, so a stale-but-
 * correctly-applied World doesn't read as "Custom" forever.
 *
 * @returns {{ text: string, state: 'active'|'custom'|'empty', color: string|null }}
 */
export function computeLauncherDisplay() {
    const current = getActiveLorebooks();
    const world = getActiveWorldId() ? getWorldById(getActiveWorldId()) : null;

    if (world) {
        const existing = new Set(getLorebookNames());
        const expected = world.lorebooks.filter(n => existing.has(n));
        if (sameSet(expected, current)) {
            return { text: world.name, state: 'active', color: world.color };
        }
        return { text: 'Custom', state: 'custom', color: null };
    }
    return current.length > 0
        ? { text: 'Custom', state: 'custom', color: null }
        : { text: 'None', state: 'empty', color: null };
}

/**
 * The list of Worlds for the launcher quick-switch, each tagged active/not.
 * @returns {Array<{id:string, name:string, color:string, active:boolean}>}
 */
export function getQuickSwitchWorlds() {
    const activeId = getActiveWorldId();
    return getWorlds().map(w => ({ id: w.id, name: w.name, color: w.color, active: w.id === activeId }));
}

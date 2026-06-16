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
    getSceneById, setActiveScene, getActiveSceneId,
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

// ---- Scene activation (Phase 11) ----

/**
 * User-facing Scene activation. Honors the confirm setting, then activates.
 * @param {string} worldId
 * @param {string} sceneId
 * @returns {Promise<{world:object, scene:object, applied:string[], skipped:string[]}|null>}
 */
export async function requestActivateScene(worldId, sceneId) {
    const world = getWorldById(worldId);
    const scene = world && getSceneById(worldId, sceneId);
    if (!scene) return null;

    if (getSetting('confirmBeforeSwitchingWorld')) {
        const ok = await callGenericPopup(
            `Activate Scene “${scene.name}”? Only its lorebooks will be loaded.`,
            POPUP_TYPE.CONFIRM,
        );
        if (ok !== POPUP_RESULT.AFFIRMATIVE) return null;
    }
    return activateScene(worldId, sceneId);
}

/**
 * Activates a Scene: makes EXACTLY its lorebooks the selection (everything else,
 * including other lorebooks in the same World, is disabled), records the Scene
 * (and its parent World) active, emits the event, and toasts.
 * @param {string} worldId
 * @param {string} sceneId
 * @param {object} [options]
 * @param {boolean} [options.notify=true]
 */
export function activateScene(worldId, sceneId, { notify = true } = {}) {
    const world = getWorldById(worldId);
    const scene = world && getSceneById(worldId, sceneId);
    if (!scene) return null;

    const { applied, skipped } = setActiveLorebooks(scene.lorebooks);
    setActiveScene(worldId, sceneId);

    const eventSource = getContext()?.eventSource;
    eventSource?.emit?.(LORE_ATLAS_ACTIVATED, { worldId, sceneId, name: `${world.name} → ${scene.name}`, applied, skipped });

    if (notify) notifyActivated(`${world.name} → ${scene.name}`, applied, skipped);
    return { world, scene, applied, skipped };
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
 * When a Scene is active and its lorebooks match, the display is composite:
 * worldName + sceneName (rendered "World → Scene" by the launcher).
 *
 * @returns {{ text:string, worldName:string|null, sceneName:string|null, state:'active'|'custom'|'empty', color:string|null }}
 */
export function computeLauncherDisplay() {
    const current = getActiveLorebooks();
    const existing = new Set(getLorebookNames());
    const worldId = getActiveWorldId();
    const sceneId = getActiveSceneId();
    const world = worldId ? getWorldById(worldId) : null;

    // Active Scene: only its lorebooks should be on.
    if (world && sceneId) {
        const scene = getSceneById(worldId, sceneId);
        if (scene) {
            const expected = scene.lorebooks.filter(n => existing.has(n));
            if (sameSet(expected, current)) {
                return { text: `${world.name} → ${scene.name}`, worldName: world.name, sceneName: scene.name, state: 'active', color: scene.color || world.color };
            }
            return custom();
        }
    }
    // Active World (no Scene): all its lorebooks should be on.
    if (world) {
        const expected = world.lorebooks.filter(n => existing.has(n));
        if (sameSet(expected, current)) {
            return { text: world.name, worldName: world.name, sceneName: null, state: 'active', color: world.color };
        }
        return custom();
    }
    return current.length > 0 ? custom() : { text: 'None', worldName: null, sceneName: null, state: 'empty', color: null };

    function custom() { return { text: 'Custom', worldName: null, sceneName: null, state: 'custom', color: null }; }
}

/**
 * Quick-switch data for the launcher: all Worlds, plus the Scenes of the active
 * World (per the spec). A World reads "active" only when it's the active World AND
 * no Scene is active; a Scene reads "active" by its id.
 * @returns {{ worlds: Array<{id,name,color,active}>, activeWorldName: string|null, scenes: Array<{id,name,color,active}> }}
 */
export function getQuickSwitchData() {
    const activeWorldId = getActiveWorldId();
    const activeSceneId = getActiveSceneId();
    const worlds = getWorlds().map(w => ({
        id: w.id, name: w.name, color: w.color,
        active: w.id === activeWorldId && !activeSceneId,
    }));
    const activeWorld = activeWorldId ? getWorldById(activeWorldId) : null;
    const scenes = (activeWorld?.scenes ?? []).map(s => ({
        id: s.id, worldId: activeWorldId, name: s.name, color: s.color, active: s.id === activeSceneId,
    }));
    return { worlds, activeWorldName: activeWorld?.name ?? null, scenes };
}

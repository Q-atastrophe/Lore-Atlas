// ============================================================================
// core/navigation.js — the panel's drill-down router.
// ----------------------------------------------------------------------------
// Atlas is a three-level drill-down (Worlds → World detail → Lorebook detail →
// entry editor). This module owns the navigation stack and renders the active
// view into the panel body. Views call navigateTo()/goBack() to move around; the
// panel shell shows a back button while the stack is deeper than the root.
//
// Routes (params in parens):
//   'worlds'        — the Worlds home (root)
//   'world-detail'  — a single World (worldId)
//   ... more levels land in later phases (lorebook-detail, entry-editor).
//
// Note: this imports the view renderers and the views import navigateTo/goBack
// from here. That's a circular import, but it's fine: every reference is called
// at runtime (never at module load), and the exports are hoisted functions.
// ============================================================================

import { renderWorldsView } from '../views/worlds-view.js';
import { renderWorldDetail } from '../views/world-detail.js';
import { renderLorebookDetail } from '../views/lorebook-detail.js';
import { renderEntryEditor } from '../views/entry-editor.js';

// The panel body the active view renders into.
let container = null;
// Called after each navigation with the new stack depth, so the panel shell can
// show/hide its back button.
let onDepthChange = null;
// The navigation stack; the last entry is the active route.
let stack = [{ name: 'worlds', params: {} }];

// An optional async hook the active view registers (e.g. the entry editor flushing
// a pending auto-save) — awaited before we navigate away, so the next view reads
// fresh data. Consumed (cleared) each time it runs.
let leaveHook = null;

/**
 * Lets the active view register a teardown to run before navigation leaves it.
 * @param {(() => (void|Promise<void>))|null} fn
 */
export function setLeaveHook(fn) {
    leaveHook = fn;
}

async function runLeaveHook() {
    const fn = leaveHook;
    leaveHook = null;
    if (fn) { try { await fn(); } catch { /* never block navigation on a save error */ } }
}

/**
 * Wires navigation to a panel body and renders the root view. Called each time
 * the panel opens; resets to the Worlds root.
 * @param {HTMLElement} panelBody
 * @param {(depth: number) => void} [depthChange] notified of stack depth changes.
 */
export function mountNavigation(panelBody, depthChange = null) {
    container = panelBody;
    onDepthChange = depthChange;
    leaveHook = null;   // drop any hook left over from a previous session
    stack = [{ name: 'worlds', params: {} }];
    renderActive();
}

/**
 * Pushes a new route and renders it.
 * @param {string} name route name
 * @param {object} [params]
 */
export async function navigateTo(name, params = {}) {
    await runLeaveHook();
    stack.push({ name, params });
    renderActive();
}

/** Pops one level (no-op at the root) and renders. */
export async function goBack() {
    await runLeaveHook();
    if (stack.length > 1) {
        stack.pop();
        renderActive();
    }
}

/**
 * Pops up to `steps` levels (stopping at the root) and renders once. Used by deep
 * breadcrumbs to jump back several levels.
 * @param {number} steps
 */
export async function back(steps = 1) {
    await runLeaveHook();
    let n = steps;
    while (n-- > 0 && stack.length > 1) stack.pop();
    renderActive();
}

/** Jumps back to the Worlds root. */
export async function navigateRoot() {
    await runLeaveHook();
    stack = stack.slice(0, 1);
    renderActive();
}

/** True if there's somewhere to go back to. */
export function canGoBack() {
    return stack.length > 1;
}

/** Renders whatever route is on top of the stack into the container. */
function renderActive() {
    if (!container) return;
    container.innerHTML = '';
    const route = stack[stack.length - 1];
    switch (route.name) {
        case 'world-detail':
            renderWorldDetail(container, route.params.worldId);
            break;
        case 'lorebook-detail':
            renderLorebookDetail(container, route.params.worldId, route.params.lorebookName);
            break;
        case 'entry-editor':
            renderEntryEditor(container, route.params.worldId, route.params.lorebookName, route.params.uid);
            break;
        case 'worlds':
        default:
            renderWorldsView(container);
            break;
    }
    onDepthChange?.(stack.length);
}

// ============================================================================
// components/launcher.js — the floating, draggable Atlas launcher.
// ----------------------------------------------------------------------------
// A small always-on element over the chat that opens the Atlas panel. It lives
// OUTSIDE SillyTavern's extensions menu (by design — see the spec): it floats,
// it's draggable, and its position persists across reloads.
//
// Phase 2 builds only the COLLAPSED state: a ~44px glass circle with the Atlas
// icon and a color dot for the active World's color (default accent for now).
// The expanded "World → Scene" pill arrives in later phases.
//
// Click vs. drag: the whole circle is both draggable and clickable, so we only
// treat a press as a "click" (open the panel) if the pointer barely moved. A real
// drag past a few pixels repositions instead and is NOT counted as a click.
// ============================================================================

import { openPanel } from '../views/panel.js';
import { getLauncherPosition, setLauncherPosition } from '../core/storage.js';

// Element id (also used to find/remove it for cleanup and double-init guarding).
const LAUNCHER_ID = 'lore-atlas-launcher';

// Pointer travel (px) below which a press counts as a click rather than a drag.
const DRAG_THRESHOLD = 4;

// Margin from the viewport edge for the default top-right placement.
const EDGE_MARGIN = 20;

// Kept at module scope so helpers can reach the live element without threading it
// through every caller.
let launcherEl = null;

/**
 * Clamps a top-left position so the launcher stays fully within the viewport.
 * @param {number} x
 * @param {number} y
 * @returns {{x:number, y:number}}
 */
function clampToViewport(x, y) {
    const rect = launcherEl.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);
    return {
        x: Math.min(Math.max(0, x), maxX),
        y: Math.min(Math.max(0, y), maxY),
    };
}

/** Applies a top-left position to the launcher element. */
function applyPosition(x, y) {
    launcherEl.style.left = `${x}px`;
    launcherEl.style.top = `${y}px`;
}

/**
 * Computes the default top-right placement (~20px from the top and right edges),
 * used on first run before the launcher has ever been moved.
 * @returns {{x:number, y:number}}
 */
function defaultPosition() {
    const rect = launcherEl.getBoundingClientRect();
    return { x: window.innerWidth - rect.width - EDGE_MARGIN, y: EDGE_MARGIN };
}

/**
 * Wires pointer dragging with click-vs-drag discrimination. On release: if the
 * pointer barely moved, it's a click → open the panel; otherwise it was a drag →
 * persist the new position.
 */
function setupDragAndClick() {
    let pointerDown = false;
    let moved = false;            // crossed the drag threshold this press?
    let startX = 0, startY = 0;   // pointer position at press
    let originX = 0, originY = 0; // launcher position at press

    launcherEl.addEventListener('pointerdown', (e) => {
        pointerDown = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = launcherEl.getBoundingClientRect();
        originX = rect.left;
        originY = rect.top;
        // Capture so we keep getting move/up even if the pointer leaves the circle.
        try { launcherEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });

    launcherEl.addEventListener('pointermove', (e) => {
        if (!pointerDown) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        // Only start treating this as a drag once past the threshold, so tiny
        // hand-tremor on a click doesn't suppress the click.
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        launcherEl.classList.add('la-launcher-dragging');
        const { x, y } = clampToViewport(originX + dx, originY + dy);
        applyPosition(x, y);
    });

    const endPress = (e) => {
        if (!pointerDown) return;
        pointerDown = false;
        try { launcherEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

        if (moved) {
            // It was a drag — persist the final position.
            launcherEl.classList.remove('la-launcher-dragging');
            const rect = launcherEl.getBoundingClientRect();
            setLauncherPosition({ x: Math.round(rect.left), y: Math.round(rect.top) });
        } else {
            // It was a click — open the panel.
            openPanel();
        }
    };

    launcherEl.addEventListener('pointerup', endPress);
    launcherEl.addEventListener('pointercancel', (e) => {
        // Treat a cancel like the end of a drag: never opens the panel.
        moved = true;
        endPress(e);
    });
}

/**
 * Builds the launcher, adds it to the page, restores its saved position (or the
 * top-right default), and wires dragging + click-to-open. Call once at startup.
 * Guards against double-mount by removing any existing launcher first.
 */
export function mountLauncher() {
    removeLauncher();

    launcherEl = document.createElement('div');
    launcherEl.id = LAUNCHER_ID;
    launcherEl.className = 'la-launcher la-launcher-collapsed';
    launcherEl.title = 'Open Lore Atlas';
    launcherEl.innerHTML = `
        <i class="fa-solid fa-book-atlas la-launcher-glyph"></i>
        <span class="la-launcher-dot"></span>`;
    document.body.appendChild(launcherEl);

    // Restore the saved position, clamped in case the window shrank since; or fall
    // back to the top-right default on first run.
    const saved = getLauncherPosition();
    const base = saved ?? defaultPosition();
    const { x, y } = clampToViewport(base.x, base.y);
    applyPosition(x, y);

    setupDragAndClick();
}

/** Removes the launcher from the page (cleanup / re-init / disable). */
export function removeLauncher() {
    const existing = document.getElementById(LAUNCHER_ID);
    if (existing) existing.remove();
    launcherEl = null;
}

// ============================================================================
// views/panel.js — the main Atlas panel shell.
// ----------------------------------------------------------------------------
// Opens from the floating launcher as a modal over the chat: a dimmed backdrop
// plus a centered glass panel. The panel body hosts the current view — for now
// the Worlds view (Phase 4). Later phases swap the body content for drill-down
// views (World detail, Lorebook detail, entry editor) while this shell stays put.
//
// Kept self-contained: a single live element at a time, closed by the × button,
// a click on the backdrop, or the Escape key. All styling lives in style.css via
// the Phase 0 tokens — nothing visual is hardcoded here.
// ============================================================================

import { renderWorldsView } from './worlds-view.js';
import { getState } from '../core/storage.js';

// id of the backdrop element; also used to find/remove an already-open panel.
const PANEL_ID = 'lore-atlas-panel';

// The live backdrop element while the panel is open (null when closed).
let backdropEl = null;

/** Closes the panel on Escape. Registered only while the panel is open. */
function onKeydown(e) {
    if (e.key === 'Escape') closePanel();
}

/**
 * Opens the Atlas panel. If it's already open, does nothing (no stacking).
 */
export function openPanel() {
    if (backdropEl) return;

    // One-time tidy: drop the throwaway Phase 3 test image if it's still around.
    const state = getState();
    if ('_phase3TestImage' in state) delete state._phase3TestImage;

    // Dimmed, blurred backdrop that captures outside-clicks to close.
    backdropEl = document.createElement('div');
    backdropEl.id = PANEL_ID;
    backdropEl.className = 'la-panel-backdrop';
    backdropEl.innerHTML = `
        <div class="la-panel" role="dialog" aria-label="Lore Atlas">
            <button class="la-panel-close" title="Close" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="la-panel-body"></div>
        </div>`;

    document.body.appendChild(backdropEl);

    // Mount the current view (the Worlds view) into the panel body.
    renderWorldsView(backdropEl.querySelector('.la-panel-body'));

    // Close affordances: × button, backdrop click (but not clicks inside the
    // panel), and Escape.
    backdropEl.querySelector('.la-panel-close').addEventListener('click', closePanel);
    backdropEl.addEventListener('pointerdown', (e) => {
        if (e.target === backdropEl) closePanel();
    });
    document.addEventListener('keydown', onKeydown);

    // Next frame: add the "open" class so the CSS entrance transition plays.
    requestAnimationFrame(() => backdropEl?.classList.add('open'));
}

/**
 * Closes the panel and tears down its listeners. Safe to call when already closed.
 */
export function closePanel() {
    document.removeEventListener('keydown', onKeydown);
    const existing = backdropEl || document.getElementById(PANEL_ID);
    if (existing) existing.remove();
    backdropEl = null;
}

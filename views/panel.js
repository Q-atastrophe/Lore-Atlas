// ============================================================================
// views/panel.js — the main Atlas panel shell.
// ----------------------------------------------------------------------------
// Opens from the floating launcher as a modal over the chat: a dimmed backdrop
// plus a centered glass panel. Right now (Phase 2) it only shows the title
// "Lore Atlas" as a placeholder; later phases fill its body with the Worlds view,
// breadcrumbs, drill-down navigation, etc.
//
// Kept self-contained: a single live element at a time, closed by the × button,
// a click on the backdrop, or the Escape key. All styling lives in style.css via
// the Phase 0 tokens — nothing visual is hardcoded here.
// ============================================================================

import { createImageUpload } from '../components/image-upload.js';
import { getState, saveStateNow } from '../core/storage.js';

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

    // Dimmed, blurred backdrop that captures outside-clicks to close.
    backdropEl = document.createElement('div');
    backdropEl.id = PANEL_ID;
    backdropEl.className = 'la-panel-backdrop';

    // The panel itself. innerHTML is a static template (no user data yet), so it's
    // safe; later phases that inject names will escape them.
    backdropEl.innerHTML = `
        <div class="la-panel" role="dialog" aria-label="Lore Atlas">
            <button class="la-panel-close" title="Close" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="la-panel-body">
                <div class="la-panel-placeholder">
                    <div class="la-panel-title">Lore Atlas</div>
                    <!-- TEMPORARY Phase 3 test harness — replaced by the Worlds view in Phase 4. -->
                    <div class="la-panel-testbox" id="la-phase3-test">
                        <div class="la-test-caption">Phase 3 test — upload an image (click or drag from desktop). It should render here and survive a refresh.</div>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(backdropEl);
    mountPhase3Test(backdropEl.querySelector('#la-phase3-test'));

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
 * TEMPORARY (Phase 3): mounts a throwaway image-upload area into the placeholder
 * panel to prove the upload pipeline and persistence. The picked image is stored
 * under a throwaway state field (`_phase3TestImage`) and reloaded on open, so a
 * refresh shows it persisted. This whole function and its markup go away in Phase 4
 * when the real Worlds view (with proper per-entity covers) replaces the placeholder.
 *
 * @param {HTMLElement} host
 */
function mountPhase3Test(host) {
    if (!host) return;
    const state = getState();
    const upload = createImageUpload({
        initialImage: state._phase3TestImage ?? null,
        shape: 'portrait',
        label: 'Upload test image',
        onImage: (dataUrl) => {
            // Persist immediately so a refresh demonstrates persistence.
            getState()._phase3TestImage = dataUrl;
            saveStateNow();
        },
    });
    host.appendChild(upload.el);
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

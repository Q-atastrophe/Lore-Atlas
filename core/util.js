// ============================================================================
// core/util.js — tiny shared helpers used across Atlas components.
// ============================================================================

/**
 * Escapes a string for safe insertion into HTML (text or attribute context).
 * Use this on any user-provided value (names, summaries, tags) before putting it
 * into innerHTML.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Builds a CSS background for an entity fallback gradient. If a color is given,
 * the gradient is that color at full strength up top fading toward the dark base
 * (per the spec's fallback rendering); otherwise the neutral default token.
 * @param {string|null|undefined} color hex color, or falsy for the default.
 * @returns {string} a CSS background value.
 */
export function fallbackGradient(color) {
    if (!color) return 'var(--la-hero-fallback)';
    return `linear-gradient(165deg, ${color} 0%, rgba(0,0,0,0) 78%), var(--la-bg-deep)`;
}

// One shared document-level guard that swallows the click which fires when a finger
// lifts after a long-press — so the underlying row/card doesn't ALSO activate. A
// single capture-phase listener (installed once) beats the target's own handlers.
let _suppressClick = false;
let _suppressorInstalled = false;
function installClickSuppressor() {
    if (_suppressorInstalled) return;
    _suppressorInstalled = true;
    document.addEventListener('click', (e) => {
        if (_suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); _suppressClick = false; }
    }, true);
}

/**
 * Fires `handler(x, y)` when the user touch-presses and holds on `el` (the mobile
 * stand-in for right-click). Touch only — mouse/pen are untouched, so desktop
 * right-click keeps working through the element's own `contextmenu` listener. A
 * small move (scroll) or an early lift cancels it, and the trailing click is
 * swallowed so the element's normal tap action doesn't also run.
 *
 * @param {HTMLElement} el
 * @param {(x:number, y:number) => void} handler
 * @param {{ms?:number, moveTol?:number}} [opts]
 */
export function attachLongPress(el, handler, { ms = 500, moveTol = 10 } = {}) {
    installClickSuppressor();
    let timer = null, sx = 0, sy = 0;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') return;
        sx = e.clientX; sy = e.clientY;
        cancel();
        timer = setTimeout(() => {
            timer = null;
            _suppressClick = true;
            setTimeout(() => { _suppressClick = false; }, 700);   // safety: never leave it stuck
            handler(sx, sy);
        }, ms);
    });
    el.addEventListener('pointermove', (e) => {
        if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > moveTol) cancel();
    });
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointercancel', cancel);
}

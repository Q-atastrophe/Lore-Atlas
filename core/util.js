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

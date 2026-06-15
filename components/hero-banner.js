// ============================================================================
// components/hero-banner.js — the universal hero banner.
// ----------------------------------------------------------------------------
// The visual through-line of Atlas: every drilled-in view opens with one of
// these — a cover image (or composed gradient fallback) with a breadcrumb at the
// top-left and the entity title (serif italic) at the bottom-left, fading into
// the content below. Used at every level (Worlds home, World detail, Lorebook
// detail, the entry editor's compact strip), so it takes explicit props rather
// than reaching into state.
// ============================================================================

import { escapeHtml, fallbackGradient } from '../core/util.js';

/**
 * Creates a hero banner element.
 *
 * @param {object} opts
 * @param {string|null} [opts.coverImage] data URL / src for the cover. If absent,
 *        a gradient fallback (from opts.color, else the default) is rendered.
 * @param {string|null} [opts.color] entity color used for the fallback gradient.
 * @param {string} [opts.title] entity name (rendered serif italic).
 * @param {string} [opts.subtitle] short line under the title (sans).
 * @param {string[]} [opts.breadcrumb] path segments, e.g. ['Worlds', 'Faelands'].
 * @param {(index: number) => void} [opts.onBreadcrumbClick] if given, makes the
 *        breadcrumb segments BEFORE the last one clickable (passes their index).
 * @param {string[]} [opts.tags] tag chips shown under the title.
 * @param {'tall'|'short'|'home'} [opts.height='tall'] banner height.
 * @returns {HTMLElement}
 */
export function createHeroBanner(opts = {}) {
    const {
        coverImage = null,
        color = null,
        title = '',
        subtitle = '',
        breadcrumb = [],
        onBreadcrumbClick = null,
        tags = [],
        height = 'tall',
    } = opts;

    const el = document.createElement('div');
    el.className = `la-hero la-hero-${height}` + (coverImage ? '' : ' la-hero-fallback');

    // Cover layer: an image background, or the fallback gradient.
    const cover = document.createElement('div');
    cover.className = 'la-hero-cover';
    if (coverImage) {
        // Data URLs (and normal paths) contain no double quotes, so wrapping in
        // url("…") is safe.
        cover.style.backgroundImage = `url("${coverImage}")`;
    } else {
        cover.style.background = fallbackGradient(color);
    }

    // Scrim fades the cover into the content background and keeps text legible.
    const scrim = document.createElement('div');
    scrim.className = 'la-hero-scrim';

    // Breadcrumb (top-left), slash-separated. Segments before the last become
    // clickable when onBreadcrumbClick is provided (for back navigation).
    const crumb = document.createElement('div');
    crumb.className = 'la-hero-breadcrumb';
    if (breadcrumb.length) {
        crumb.innerHTML = breadcrumb
            .map((seg, i) => {
                const isLast = i === breadcrumb.length - 1;
                const clickable = onBreadcrumbClick && !isLast;
                return `<span class="la-hero-crumb${clickable ? ' la-clickable' : ''}" data-index="${i}">${escapeHtml(seg)}</span>`;
            })
            .join('<span class="la-hero-sep">/</span>');
        if (onBreadcrumbClick) {
            crumb.querySelectorAll('.la-hero-crumb.la-clickable').forEach(el => {
                el.addEventListener('click', () => onBreadcrumbClick(Number(el.dataset.index)));
            });
        }
    }

    // Content (bottom-left): title, subtitle, tag chips.
    const content = document.createElement('div');
    content.className = 'la-hero-content';
    const tagsHtml = tags.length
        ? `<div class="la-chips la-hero-tags">${tags.map(t => `<span class="la-chip">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';
    content.innerHTML = `
        <h2 class="la-hero-title la-entity-name">${escapeHtml(title)}</h2>
        ${subtitle ? `<div class="la-hero-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        ${tagsHtml}`;

    el.append(cover, scrim, crumb, content);
    return el;
}

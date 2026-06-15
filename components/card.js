// ============================================================================
// components/card.js — the universal poster card.
// ----------------------------------------------------------------------------
// A tall portrait "poster" (from the user's mockups): the cover fills the card,
// the entity name sits in serif italic over a translucent strip at the bottom,
// with an entry/lorebook count line and tag chips beneath. Used for Worlds (now),
// and later Lorebooks, Scenes, and Entries. Image-led: when there's no cover, the
// fallback gradient (from the entity color) fills it — never a broken placeholder.
// ============================================================================

import { escapeHtml, fallbackGradient } from '../core/util.js';

/**
 * Creates a poster card element.
 *
 * @param {object} opts
 * @param {string} opts.title entity name (serif italic).
 * @param {string|null} [opts.coverImage] cover data URL/src; falls back to gradient.
 * @param {string|null} [opts.color] entity color for the fallback gradient.
 * @param {string} [opts.count] small count line, e.g. "14 entries".
 * @param {string[]} [opts.tags] tag chips.
 * @param {boolean} [opts.active] show the active glow + dot.
 * @param {'world'|'lorebook'|'scene'|'entry'} [opts.kind='world'] size/variant hint.
 * @param {() => void} [opts.onClick] click handler for the card body.
 * @returns {HTMLElement}
 */
export function createCard(opts = {}) {
    const {
        title = '',
        coverImage = null,
        color = null,
        count = '',
        tags = [],
        active = false,
        kind = 'world',
        onClick = null,
    } = opts;

    const el = document.createElement('div');
    el.className = `la-card la-card-${kind}` + (active ? ' la-card-active' : '');
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.title = title;

    const cover = document.createElement('div');
    cover.className = 'la-card-cover';
    if (coverImage) cover.style.backgroundImage = `url("${coverImage}")`;
    else cover.style.background = fallbackGradient(color);

    const veil = document.createElement('div');
    veil.className = 'la-card-veil';

    const tagsHtml = tags.length
        ? `<div class="la-chips la-card-tags">${tags.slice(0, 3).map(t => `<span class="la-chip">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';
    const meta = document.createElement('div');
    meta.className = 'la-card-meta';
    meta.innerHTML = `
        <div class="la-card-name la-entity-name">${escapeHtml(title)}</div>
        ${count ? `<div class="la-card-count">${escapeHtml(count)}</div>` : ''}
        ${tagsHtml}`;

    el.append(cover, veil, meta);
    if (active) {
        const dot = document.createElement('span');
        dot.className = 'la-card-dot';
        el.appendChild(dot);
    }

    if (onClick) {
        el.addEventListener('click', onClick);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        });
    }
    return el;
}

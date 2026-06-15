// ============================================================================
// components/list-row.js — the universal list row.
// ----------------------------------------------------------------------------
// The dense counterpart to the poster card: a small rounded thumbnail at the
// left, the entity name (serif italic) + a summary preview in the middle, and
// status/meta (tag chips, count, active dot) right-aligned. Used for Worlds (now)
// and later Lorebooks, Scenes, and Entries. Same data as a card, laid out for
// scanning a long list.
// ============================================================================

import { escapeHtml, fallbackGradient } from '../core/util.js';

/**
 * Creates a list row element.
 *
 * @param {object} opts
 * @param {string} opts.title entity name (serif italic).
 * @param {string|null} [opts.coverImage] thumbnail cover; falls back to gradient.
 * @param {string|null} [opts.color] entity color for the fallback gradient.
 * @param {string} [opts.summary] one-line summary preview.
 * @param {string} [opts.count] right-aligned count, e.g. "14 entries".
 * @param {string[]} [opts.tags] tag chips (right side).
 * @param {boolean} [opts.active] show the active dot.
 * @param {() => void} [opts.onClick] row click handler (e.g. drill in).
 * @param {() => void} [opts.onEdit] if given, shows a hover pencil button (so the
 *        row click can be reserved for drilling in).
 * @returns {HTMLElement}
 */
export function createListRow(opts = {}) {
    const {
        title = '',
        coverImage = null,
        color = null,
        summary = '',
        count = '',
        tags = [],
        active = false,
        onClick = null,
        onEdit = null,
    } = opts;

    const el = document.createElement('div');
    el.className = 'la-list-row';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');

    const thumb = document.createElement('div');
    thumb.className = 'la-list-thumb';
    if (coverImage) thumb.style.backgroundImage = `url("${coverImage}")`;
    else thumb.style.background = fallbackGradient(color);

    const body = document.createElement('div');
    body.className = 'la-list-body';
    body.innerHTML = `
        <div class="la-list-name la-entity-name">${escapeHtml(title)}</div>
        ${summary ? `<div class="la-list-summary">${escapeHtml(summary)}</div>` : ''}`;

    const end = document.createElement('div');
    end.className = 'la-list-end';
    const tagsHtml = tags.length
        ? `<div class="la-chips la-list-tags">${tags.slice(0, 3).map(t => `<span class="la-chip">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';
    end.innerHTML = `
        ${tagsHtml}
        ${count ? `<div class="la-list-count">${escapeHtml(count)}</div>` : ''}
        ${active ? '<span class="la-list-dot" title="Active"></span>' : ''}`;

    el.append(thumb, body, end);

    // Hover edit button — click doesn't bubble to the row click.
    if (onEdit) {
        const editBtn = document.createElement('button');
        editBtn.className = 'la-list-edit';
        editBtn.title = 'Edit';
        editBtn.setAttribute('aria-label', 'Edit');
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); onEdit(); });
        end.appendChild(editBtn);
    }

    if (onClick) {
        el.addEventListener('click', onClick);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        });
    }
    return el;
}

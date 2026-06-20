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
 * @param {() => void} [opts.onClick] click handler for the card body (e.g. drill in).
 * @param {() => void} [opts.onEdit] if given, shows a pencil button on hover that
 *        opens the editor (so the body click can be reserved for drilling in).
 * @param {() => void} [opts.onRemove] if given, shows a hover button to remove the
 *        item from this World (used for lorebook cards).
 * @param {() => void} [opts.onActivate] if given, shows a hover "activate" button
 *        (used for Scene cards).
 * @param {() => void} [opts.onDelete] if given, shows a hover trash button (delete
 *        the entity — World / Scene / lorebook entirely).
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
        onEdit = null,
        onRemove = null,
        onActivate = null,
        onDelete = null,
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

    // Scale the name font down for longer names so they wrap to fewer lines and
    // never get clipped (lorebook filenames can be long single tokens).
    const len = title.length;
    const nameSize = len > 22 ? ' la-card-name-xs' : (len > 14 ? ' la-card-name-sm' : '');

    // Cards stay clean: name + count only. Tags live in the list view, not here.
    const meta = document.createElement('div');
    meta.className = 'la-card-meta';
    meta.innerHTML = `
        <div class="la-card-name la-entity-name${nameSize}">${escapeHtml(title)}</div>
        ${count ? `<div class="la-card-count">${escapeHtml(count)}</div>` : ''}`;

    el.append(cover, veil, meta);
    if (active) {
        const dot = document.createElement('span');
        dot.className = 'la-card-dot';
        el.appendChild(dot);
    }

    // Hover action buttons (top-right). Their clicks don't bubble to the body click.
    if (onEdit || onRemove || onActivate || onDelete) {
        const actions = document.createElement('div');
        actions.className = 'la-card-actions';
        if (onActivate) {
            const act = document.createElement('button');
            act.className = 'la-card-action la-card-activate';
            act.title = 'Activate';
            act.setAttribute('aria-label', 'Activate');
            act.innerHTML = '<i class="fa-solid fa-bolt"></i>';
            act.addEventListener('click', (e) => { e.stopPropagation(); onActivate(); });
            actions.appendChild(act);
        }
        if (onRemove) {
            const rm = document.createElement('button');
            rm.className = 'la-card-action la-card-remove';
            rm.title = 'Remove from this World';
            rm.setAttribute('aria-label', 'Remove from this World');
            rm.innerHTML = '<i class="fa-solid fa-link-slash"></i>';
            rm.addEventListener('click', (e) => { e.stopPropagation(); onRemove(); });
            actions.appendChild(rm);
        }
        if (onEdit) {
            const ed = document.createElement('button');
            ed.className = 'la-card-action la-card-edit';
            ed.title = 'Edit';
            ed.setAttribute('aria-label', 'Edit');
            ed.innerHTML = '<i class="fa-solid fa-pen"></i>';
            ed.addEventListener('click', (e) => { e.stopPropagation(); onEdit(); });
            actions.appendChild(ed);
        }
        if (onDelete) {
            const del = document.createElement('button');
            del.className = 'la-card-action la-card-delete';
            del.title = 'Delete';
            del.setAttribute('aria-label', 'Delete');
            del.innerHTML = '<i class="fa-solid fa-trash"></i>';
            del.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
            actions.appendChild(del);
        }
        el.appendChild(actions);
    }

    if (onClick) {
        el.addEventListener('click', onClick);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        });
    }
    return el;
}

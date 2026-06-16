// ============================================================================
// components/lorebook-checklist.js — the Scene's lorebook-subset picker.
// ----------------------------------------------------------------------------
// A checkbox list of the parent World's lorebooks, used inside the Scene editor to
// choose which of them belong to the Scene (a Scene is always a subset of its
// World). This is the firewall mechanism: a "Male Lead" Scene simply unchecks the
// hidden lorebooks.
// ============================================================================

import { escapeHtml } from '../core/util.js';

/**
 * Creates the checklist.
 * @param {object} opts
 * @param {string[]} opts.worldLorebooks the parent World's lorebooks (the choices).
 * @param {string[]} [opts.selected] which are currently in the Scene.
 * @returns {{ el: HTMLElement, getSelected: () => string[] }}
 */
export function createLorebookChecklist({ worldLorebooks = [], selected = [] }) {
    const sel = new Set(selected);

    const el = document.createElement('div');
    el.className = 'la-field';
    el.innerHTML = `
        <span class="la-field-label">Lorebooks in this Scene</span>
        <div class="la-checklist"></div>`;
    const list = el.querySelector('.la-checklist');

    if (worldLorebooks.length === 0) {
        list.innerHTML = `<div class="la-checklist-empty">This World has no lorebooks yet — add some first.</div>`;
    } else {
        // A select-all / none helper row for quick firewall edits.
        const tools = document.createElement('div');
        tools.className = 'la-checklist-tools';
        tools.innerHTML = `
            <button type="button" class="la-checklist-all">All</button>
            <button type="button" class="la-checklist-none">None</button>`;
        list.appendChild(tools);

        for (const name of worldLorebooks) {
            const row = document.createElement('label');
            row.className = 'la-checklist-item';
            row.dataset.name = name;
            row.innerHTML = `
                <input type="checkbox" ${sel.has(name) ? 'checked' : ''} />
                <span class="la-checklist-name la-entity-name">${escapeHtml(name)}</span>`;
            list.appendChild(row);
        }

        const setAll = (on) => list.querySelectorAll('.la-checklist-item input').forEach(cb => { cb.checked = on; });
        tools.querySelector('.la-checklist-all').addEventListener('click', () => setAll(true));
        tools.querySelector('.la-checklist-none').addEventListener('click', () => setAll(false));
    }

    return {
        el,
        getSelected() {
            return [...list.querySelectorAll('.la-checklist-item')]
                .filter(item => item.querySelector('input').checked)
                .map(item => item.dataset.name);
        },
    };
}

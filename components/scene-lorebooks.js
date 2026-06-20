// ============================================================================
// components/scene-lorebooks.js — the Scene editor's lorebook picker.
// ----------------------------------------------------------------------------
// Two TABS inside the Scene editor:
//   - "World" : the parent World's base lorebooks (checkboxes, default all on).
//     These are the lore the World always needs; uncheck to firewall one out of
//     this Scene.
//   - "Scene" : EXTRA lorebooks layered on top, specific to this Scene (any
//     SillyTavern lorebook outside the World), shown as removable chips with a
//     dropdown to add more.
//
// Both panels stay in the DOM (the inactive one is just hidden), so getSelected()
// can always read both. It returns the union (checked World lorebooks + extras) —
// exactly the set that becomes active when the Scene is activated.
// ============================================================================

import { getLorebookNames } from '../core/lorebook-api.js';
import { escapeHtml } from '../core/util.js';

/**
 * @param {object} opts
 * @param {string[]} opts.worldLorebooks the parent World's lorebooks (the base).
 * @param {string[]} [opts.selected] the Scene's current lorebooks (World-checked + extras).
 * @returns {{ el: HTMLElement, getSelected: () => string[] }}
 */
export function createSceneLorebooks({ worldLorebooks = [], selected = [] }) {
    const worldSet = new Set(worldLorebooks);
    const selSet = new Set(selected);
    let extras = selected.filter(n => !worldSet.has(n));   // mutable list of extras

    const el = document.createElement('div');
    el.className = 'la-field la-scene-lb';
    el.innerHTML = `
        <span class="la-field-label">Lorebooks in scene</span>
        <div class="la-scene-lb-tabs">
            <button type="button" class="la-scene-lb-tab la-active" data-tab="world">World <span class="la-scene-lb-count" data-count="world"></span></button>
            <button type="button" class="la-scene-lb-tab" data-tab="scene">Scene <span class="la-scene-lb-count" data-count="scene"></span></button>
        </div>
        <div class="la-scene-lb-panel" data-panel="world">
            <div class="la-field-hint la-scene-lb-note">Always loaded — uncheck to firewall a book out of this scene.</div>
            <div class="la-checklist la-scene-world-lb"></div>
        </div>
        <div class="la-scene-lb-panel" data-panel="scene" hidden>
            <div class="la-field-hint la-scene-lb-note">Extra lorebooks layered on top — including ones outside this World.</div>
            <div class="la-scene-extra"></div>
        </div>`;

    // --- Tab switching ---
    const tabs = [...el.querySelectorAll('.la-scene-lb-tab')];
    const panels = [...el.querySelectorAll('.la-scene-lb-panel')];
    tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.toggle('la-active', t === tab));
        panels.forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    }));

    // --- Tab count badges (kept current even while a panel is hidden) ---
    const worldList = el.querySelector('.la-scene-world-lb');
    function updateCounts() {
        const worldCount = worldList.querySelectorAll('.la-checklist-item input:checked').length;
        el.querySelector('[data-count="world"]').textContent = worldCount ? worldCount : '';
        el.querySelector('[data-count="scene"]').textContent = extras.length ? extras.length : '';
    }

    // --- World lorebooks checklist ---
    if (worldLorebooks.length === 0) {
        worldList.innerHTML = `<div class="la-checklist-empty">This World has no lorebooks yet.</div>`;
    } else {
        const tools = document.createElement('div');
        tools.className = 'la-checklist-tools';
        tools.innerHTML = `<button type="button" class="la-checklist-all">All</button><button type="button" class="la-checklist-none">None</button>`;
        worldList.appendChild(tools);
        for (const name of worldLorebooks) {
            const row = document.createElement('label');
            row.className = 'la-checklist-item';
            row.dataset.name = name;
            row.innerHTML = `<input type="checkbox" ${selSet.has(name) ? 'checked' : ''} /><span class="la-checklist-name la-entity-name">${escapeHtml(name)}</span>`;
            worldList.appendChild(row);
        }
        worldList.addEventListener('change', updateCounts);
        const setAll = (on) => { worldList.querySelectorAll('.la-checklist-item input').forEach(cb => { cb.checked = on; }); updateCounts(); };
        tools.querySelector('.la-checklist-all').addEventListener('click', () => setAll(true));
        tools.querySelector('.la-checklist-none').addEventListener('click', () => setAll(false));
    }

    // --- Scene extras: chips + an add dropdown ---
    const extraWrap = el.querySelector('.la-scene-extra');
    function renderExtras() {
        extraWrap.innerHTML = '';

        const chips = document.createElement('div');
        chips.className = 'la-scene-extra-chips';
        if (extras.length === 0) {
            chips.innerHTML = `<span class="la-scene-extra-empty">No extra lorebooks.</span>`;
        } else {
            for (const name of extras) {
                const chip = document.createElement('span');
                chip.className = 'la-chip la-chip-removable';
                chip.innerHTML = `${escapeHtml(name)}<span class="la-chip-x" title="Remove">&times;</span>`;
                chip.querySelector('.la-chip-x').addEventListener('click', () => {
                    extras = extras.filter(n => n !== name);
                    renderExtras();
                });
                chips.appendChild(chip);
            }
        }
        extraWrap.appendChild(chips);

        // Add dropdown: SillyTavern lorebooks not in the World and not already added.
        const available = getLorebookNames()
            .filter(n => !worldSet.has(n) && !extras.includes(n))
            .sort((a, b) => a.localeCompare(b));
        if (available.length > 0) {
            const sel = document.createElement('select');
            sel.className = 'la-input la-scene-extra-add';
            sel.innerHTML = `<option value="">+ Add a lorebook…</option>` +
                available.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
            sel.addEventListener('change', () => {
                if (sel.value) { extras.push(sel.value); renderExtras(); }
            });
            extraWrap.appendChild(sel);
        }
        updateCounts();
    }
    renderExtras();
    updateCounts();

    return {
        el,
        getSelected() {
            const checkedWorld = [...worldList.querySelectorAll('.la-checklist-item')]
                .filter(item => item.querySelector('input').checked)
                .map(item => item.dataset.name);
            return [...checkedWorld, ...extras];
        },
    };
}

// ============================================================================
// components/scene-lorebooks.js — the Scene editor's lorebook picker.
// ----------------------------------------------------------------------------
// A full-width control (sits under the image+fields grid) with two symmetric TABS,
// plus the Scene's Color picker top-right of the tab row:
//   - "World" : the parent World's base lorebooks. Checkboxes (default all on) —
//     uncheck to firewall one out of this Scene. "+ Add lorebooks" assigns more to
//     the World.
//   - "Scene" : EXTRA lorebooks layered on top — any SillyTavern lorebook outside
//     the World. Same All/None + checklist + empty state; "+ Add lorebooks" picks
//     from lorebooks outside the World.
//
// getSelected() returns the union of checked World books + checked extras — exactly
// what becomes active when the Scene is activated. getColor() returns the picker.
// ============================================================================

import { getLorebookNames } from '../core/lorebook-api.js';
import { getWorldById, addLorebookToWorld } from '../core/storage.js';
import { openLorebookPicker } from './lorebook-picker.js';
import { escapeHtml } from '../core/util.js';

/**
 * @param {object} opts
 * @param {string} opts.worldId the parent World id.
 * @param {string[]} [opts.selected] the Scene's current lorebooks (World-checked + extras).
 * @param {string} [opts.color] the Scene's color.
 * @returns {{ el: HTMLElement, getSelected: () => string[], getColor: () => string }}
 */
export function createSceneLorebooks({ worldId, selected = [], color = '#a07b3a' }) {
    const worldLB = () => [...new Set(getWorldById(worldId)?.lorebooks ?? [])];
    const worldSet0 = new Set(worldLB());

    // Source of truth: which world books are included, and the scene's own extras.
    const selectedWorld = new Set(selected.filter(n => worldSet0.has(n)));
    const extraPool = [...new Set(selected.filter(n => !worldSet0.has(n)))];
    const selectedExtra = new Set(extraPool);

    const el = document.createElement('div');
    el.className = 'la-scene-lb';
    el.innerHTML = `
        <div class="la-scene-lb-head">
            <div class="la-scene-lb-tabs">
                <button type="button" class="la-scene-lb-tab la-active" data-tab="world">World <span class="la-scene-lb-count" data-count="world"></span></button>
                <button type="button" class="la-scene-lb-tab" data-tab="scene">Scene <span class="la-scene-lb-count" data-count="scene"></span></button>
            </div>
            <label class="la-scene-lb-color">
                <span class="la-field-label">Color</span>
                <input type="color" class="la-color la-scene-lb-color-input" />
            </label>
        </div>
        <div class="la-scene-lb-panel" data-panel="world"></div>
        <div class="la-scene-lb-panel" data-panel="scene" hidden></div>`;

    const colorInput = el.querySelector('.la-scene-lb-color-input');
    colorInput.value = color || '#a07b3a';

    // --- Tab switching ---
    const tabs = [...el.querySelectorAll('.la-scene-lb-tab')];
    const panels = [...el.querySelectorAll('.la-scene-lb-panel')];
    tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.toggle('la-active', t === tab));
        panels.forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    }));

    function updateCounts() {
        el.querySelector('[data-count="world"]').textContent = selectedWorld.size || '';
        el.querySelector('[data-count="scene"]').textContent = selectedExtra.size || '';
    }

    /**
     * Renders one tab panel: [All] [None] [+ Add lorebooks] toolbar + a checklist
     * (or an empty state). `items` are the lorebook names; `selSet` tracks inclusion.
     */
    function renderPanel(panelEl, items, selSet, emptyText, onAdd) {
        panelEl.innerHTML = '';

        const tools = document.createElement('div');
        tools.className = 'la-checklist-tools';
        tools.innerHTML = `<button type="button" class="la-checklist-all">All</button><button type="button" class="la-checklist-none">None</button>`;
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'la-checklist-add';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add lorebooks';
        addBtn.addEventListener('click', onAdd);
        tools.appendChild(addBtn);
        panelEl.appendChild(tools);

        const list = document.createElement('div');
        list.className = 'la-checklist la-scene-lb-list';
        if (items.length === 0) {
            list.innerHTML = `<div class="la-checklist-empty">${escapeHtml(emptyText)}</div>`;
        } else {
            for (const name of items) {
                const row = document.createElement('label');
                row.className = 'la-checklist-item';
                row.dataset.name = name;
                row.innerHTML = `<input type="checkbox" ${selSet.has(name) ? 'checked' : ''} /><span class="la-checklist-name la-entity-name">${escapeHtml(name)}</span>`;
                row.querySelector('input').addEventListener('change', (e) => {
                    if (e.target.checked) selSet.add(name); else selSet.delete(name);
                    updateCounts();
                });
                list.appendChild(row);
            }
        }
        panelEl.appendChild(list);

        tools.querySelector('.la-checklist-all').addEventListener('click', () => {
            items.forEach(n => selSet.add(n));
            list.querySelectorAll('.la-checklist-item input').forEach(cb => { cb.checked = true; });
            updateCounts();
        });
        tools.querySelector('.la-checklist-none').addEventListener('click', () => {
            items.forEach(n => selSet.delete(n));
            list.querySelectorAll('.la-checklist-item input').forEach(cb => { cb.checked = false; });
            updateCounts();
        });
    }

    const worldPanel = el.querySelector('.la-scene-lb-panel[data-panel="world"]');
    const scenePanel = el.querySelector('.la-scene-lb-panel[data-panel="scene"]');

    function renderWorld() {
        renderPanel(
            worldPanel, worldLB(), selectedWorld,
            'No lorebooks in this World yet. Use “Add lorebooks”.',
            () => openLorebookPicker({
                worldId,
                heading: 'Add lorebooks to this World',
                onPick: (name) => { addLorebookToWorld(worldId, name); selectedWorld.add(name); },
                onAssigned: () => { renderWorld(); updateCounts(); },
            }),
        );
    }
    function renderScene() {
        renderPanel(
            scenePanel, [...extraPool], selectedExtra,
            'No scene lorebooks yet. Use “Add lorebooks” to layer some on.',
            () => openLorebookPicker({
                worldId,                          // hide the World's own books
                heading: 'Add scene lorebooks',
                exclude: extraPool,               // live ref — added ones drop out
                onPick: (name) => { extraPool.push(name); selectedExtra.add(name); },
                onAssigned: () => { renderScene(); updateCounts(); },
            }),
        );
    }

    renderWorld();
    renderScene();
    updateCounts();

    return {
        el,
        getSelected() {
            const world = worldLB();
            const checkedWorld = [...selectedWorld].filter(n => world.includes(n));
            const checkedExtra = extraPool.filter(n => selectedExtra.has(n));
            return [...checkedWorld, ...checkedExtra];
        },
        getColor() { return colorInput.value; },
    };
}

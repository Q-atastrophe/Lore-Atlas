// ============================================================================
// components/lorebook-picker.js — "Add existing lorebook" picker.
// ----------------------------------------------------------------------------
// A modal listing the SillyTavern lorebooks that are NOT already in this World
// (they may belong to OTHER Worlds — multi-World assignment is the point). Click
// a row's Add button to assign it; the row drops out and the detail view refreshes
// behind the modal. Stays open so several can be added in a row.
// ============================================================================

import { getLorebookNames } from '../core/lorebook-api.js';
import { getWorldById, addLorebookToWorld, getWorldsForLorebook } from '../core/storage.js';
import { escapeHtml } from '../core/util.js';

const PICKER_ID = 'lore-atlas-lorebook-picker';

/**
 * Opens the picker.
 * @param {object} opts
 * @param {string} [opts.worldId] the World (used for "also in" notes, and — unless
 *        onPick is given — the World a chosen lorebook is added to).
 * @param {string} [opts.heading='Add existing lorebook'] modal heading.
 * @param {boolean} [opts.excludeWorld=true] hide lorebooks already in the World.
 * @param {string[]} [opts.exclude] a LIVE array of extra names to hide (re-read each
 *        render, so pushing to it after onPick drops the row out).
 * @param {(name: string) => void} [opts.onPick] called when a lorebook is chosen.
 *        Defaults to assigning it to the World.
 * @param {() => void} [opts.onAssigned] called after each pick (to refresh callers).
 */
export function openLorebookPicker({
    worldId = null,
    heading = 'Add existing lorebook',
    excludeWorld = true,
    exclude = [],
    onPick = null,
    onAssigned = () => {},
}) {
    document.getElementById(PICKER_ID)?.remove();

    let filter = '';

    const backdrop = document.createElement('div');
    backdrop.id = PICKER_ID;
    backdrop.className = 'la-modal-backdrop';
    backdrop.innerHTML = `
        <div class="la-modal la-picker" role="dialog" aria-label="${escapeHtml(heading)}">
            <div class="la-modal-header">
                <div class="la-modal-heading la-entity-name">${escapeHtml(heading)}</div>
                <button class="la-modal-close" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="la-picker-search la-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" class="la-search-input la-picker-filter" placeholder="Search lorebooks…" />
            </div>
            <div class="la-picker-list"></div>
            <div class="la-modal-footer">
                <div class="la-modal-footer-left la-picker-hint"></div>
                <div class="la-modal-footer-right">
                    <button class="la-btn la-btn-primary la-picker-done">Done</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(backdrop);

    const listEl = backdrop.querySelector('.la-picker-list');
    const hintEl = backdrop.querySelector('.la-picker-hint');
    const filterInput = backdrop.querySelector('.la-picker-filter');

    /** Lorebooks available to add: exist in ST, minus the World's (if asked) and the
     *  live `exclude` list. */
    function available() {
        const world = worldId ? getWorldById(worldId) : null;
        const inWorld = new Set(excludeWorld ? (world?.lorebooks ?? []) : []);
        const excluded = new Set(exclude);
        const q = filter.trim().toLowerCase();
        return getLorebookNames()
            .filter(name => !inWorld.has(name) && !excluded.has(name))
            .filter(name => !q || name.toLowerCase().includes(q))
            .sort((a, b) => a.localeCompare(b));
    }

    function renderList() {
        const names = available();
        listEl.innerHTML = '';

        if (names.length === 0) {
            const totalKnown = getLorebookNames().length;
            const empty = document.createElement('div');
            empty.className = 'la-empty';
            empty.innerHTML = totalKnown === 0
                ? `<i class="fa-solid fa-book la-empty-icon"></i>
                   <div class="la-empty-text">No lorebooks exist yet. Create one in SillyTavern's World Info, then add it here.</div>`
                : `<i class="fa-solid fa-circle-check la-empty-icon"></i>
                   <div class="la-empty-text">${filter.trim() ? 'No matches.' : 'Every lorebook is already in this World.'}</div>`;
            listEl.appendChild(empty);
            hintEl.textContent = '';
            return;
        }

        for (const name of names) {
            // "also in" note: other Worlds already using this lorebook.
            const others = getWorldsForLorebook(name).map(w => w.name);
            const note = others.length
                ? `<div class="la-picker-note">also in ${others.map(escapeHtml).join(', ')}</div>`
                : '';
            const row = document.createElement('div');
            row.className = 'la-picker-row';
            row.innerHTML = `
                <div class="la-picker-info">
                    <div class="la-picker-name la-entity-name">${escapeHtml(name)}</div>
                    ${note}
                </div>
                <button class="la-btn la-btn-secondary la-picker-add"><i class="fa-solid fa-plus"></i> Add</button>`;
            row.querySelector('.la-picker-add').addEventListener('click', () => {
                if (onPick) onPick(name);
                else addLorebookToWorld(worldId, name);
                onAssigned();
                renderList(); // the just-added one drops out of "available"
            });
            listEl.appendChild(row);
        }
        hintEl.textContent = `${names.length} available`;
    }

    function close() {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    backdrop.querySelector('.la-modal-close').addEventListener('click', close);
    backdrop.querySelector('.la-picker-done').addEventListener('click', close);
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(); });
    filterInput.addEventListener('input', () => { filter = filterInput.value; renderList(); });

    renderList();
    requestAnimationFrame(() => backdrop.classList.add('open'));
    filterInput.focus();
}

// ============================================================================
// views/lorebook-detail.js — a single Lorebook's entries (read-only, Phase 12).
// ----------------------------------------------------------------------------
// Drilled into from a lorebook card. Layout mirrors the World detail (frozen top,
// scrolling content):
//   [ compact hero — lorebook cover (or parent World fallback) + breadcrumb ]
//   [ search + grid/list toggle ]
//   [ entries — list rows (default) or a grid of entry cards ]
//
// Phase 12 is read-only: entries display their title, key chips, and a content
// preview. The entry editor (clicking a row) arrives in Phase 13.
// ============================================================================

import {
    getWorldById, getCover, getViewPreference, setViewPreference,
    getEntryCover, removeEntryCover, deleteLorebookEverywhere, getLorebookImpact,
} from '../core/storage.js';
import { getLorebookEntries, entryDisplayName, createEntry, deleteEntry, deleteLorebookFile } from '../core/lorebook-api.js';
import { navigateRoot, goBack, navigateTo } from '../core/navigation.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { createViewToggle } from '../components/view-toggle.js';
import { createCard } from '../components/card.js';
import { openContextMenu } from '../components/context-menu.js';
import { escapeHtml, attachLongPress } from '../core/util.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../popup.js';

let host = null;
let currentWorldId = null;
let currentLorebook = null;
let searchQuery = '';
let contentEl = null;
let fillToken = 0;

/**
 * Renders the Lorebook detail view (fresh drill-in).
 * @param {HTMLElement} container the panel body.
 * @param {string} worldId parent World id (for breadcrumb + cover fallback).
 * @param {string} lorebookName
 */
export function renderLorebookDetail(container, worldId, lorebookName) {
    host = container;
    currentWorldId = worldId;
    currentLorebook = lorebookName;
    searchQuery = '';
    draw();
}

function draw() {
    const world = getWorldById(currentWorldId);
    host.innerHTML = '';

    // Hero: lorebook cover, falling back to the parent World's cover, then the
    // World's color gradient (per the spec's fallback chain).
    const cover = getCover('lorebooks', currentLorebook) || (world ? getCover('worlds', world.id) : null);
    host.appendChild(createHeroBanner({
        coverImage: cover,
        color: world?.color ?? null,
        title: currentLorebook,
        breadcrumb: ['Worlds', world?.name ?? '…', currentLorebook],
        onBreadcrumbClick: (index) => {
            if (index === 0) navigateRoot();           // -> Worlds
            else if (index === 1) goBack();             // -> this World's detail
        },
        height: 'home',
    }));

    // Frozen bar: search + grid/list toggle.
    const bar = document.createElement('div');
    bar.className = 'la-detail-bar';
    bar.innerHTML = `
        <div class="la-view-title la-entity-name">Entries</div>
        <div class="la-detail-tools"></div>`;
    const tools = bar.querySelector('.la-detail-tools');

    const searchWrap = document.createElement('div');
    searchWrap.className = 'la-search';
    searchWrap.innerHTML = `
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" class="la-search-input" placeholder="Search entries…" />`;
    const input = searchWrap.querySelector('input');
    input.value = searchQuery;
    input.addEventListener('input', () => { searchQuery = input.value; fillContent(); });

    const toggle = createViewToggle({
        value: getViewPreference('entriesView'),
        onChange: (mode) => { setViewPreference('entriesView', mode); fillContent(); },
    });
    tools.append(searchWrap, toggle.el);

    // "+ New Entry" — creates an empty entry and opens it in the editor.
    const newBtn = document.createElement('button');
    newBtn.className = 'la-btn la-btn-primary la-new-entry';
    newBtn.innerHTML = '<i class="fa-solid fa-plus"></i> New Entry';
    newBtn.addEventListener('click', async () => {
        const entry = await createEntry(currentLorebook);
        if (entry) navigateTo('entry-editor', { worldId: currentWorldId, lorebookName: currentLorebook, uid: entry.uid });
    });

    // "Delete lorebook" — removes the lorebook FILE from SillyTavern entirely.
    const delBtn = document.createElement('button');
    delBtn.className = 'la-btn la-btn-danger la-delete-lorebook';
    delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
    delBtn.title = 'Delete this lorebook from SillyTavern';
    delBtn.addEventListener('click', confirmDeleteThisLorebook);
    tools.append(newBtn, delBtn);

    host.appendChild(bar);

    const scroll = document.createElement('div');
    scroll.className = 'la-view-scroll';
    contentEl = document.createElement('div');
    scroll.appendChild(contentEl);
    host.appendChild(scroll);
    fillContent();
}

/** Confirms (with impact) and deletes this lorebook entirely, then goes back. */
async function confirmDeleteThisLorebook() {
    const impact = getLorebookImpact(currentLorebook);
    let html = `Delete lorebook <strong>${escapeHtml(currentLorebook)}</strong> from SillyTavern entirely?<br><br>This permanently removes the lorebook and all its entries. It cannot be undone.`;
    if (impact.length) {
        const lines = impact.map(w => {
            const scenes = w.scenes.length ? ` <span style="opacity:0.7">(scenes: ${w.scenes.map(escapeHtml).join(', ')})</span>` : '';
            return `• ${escapeHtml(w.name)}${scenes}`;
        }).join('<br>');
        html += `<br><br>It will be removed from these Worlds:<br>${lines}`;
    }
    const ok = await callGenericPopup(html, POPUP_TYPE.CONFIRM);
    if (!ok) return;
    await deleteLorebookFile(currentLorebook);
    deleteLorebookEverywhere(currentLorebook);
    goBack();   // the lorebook is gone — return to the World detail
}

/** Loads entries (async) and renders them filtered by the search, in the saved mode. */
async function fillContent() {
    if (!contentEl) return;
    const token = ++fillToken;
    const mode = getViewPreference('entriesView');
    contentEl.className = mode === 'list' ? 'la-list' : 'la-grid';
    contentEl.innerHTML = '';

    const all = await getLorebookEntries(currentLorebook);
    if (token !== fillToken) return;   // superseded by a newer fill

    const q = searchQuery.trim().toLowerCase();
    const entries = !q ? all : all.filter(e => {
        const keys = [...(e.key || []), ...(e.keysecondary || [])].join(' ').toLowerCase();
        return entryDisplayName(e).toLowerCase().includes(q)
            || keys.includes(q)
            || (e.content || '').toLowerCase().includes(q);
    });

    if (entries.length === 0) {
        contentEl.appendChild(emptyState(q ? `No entries match “${searchQuery}”.` : 'This lorebook has no entries yet.'));
        return;
    }

    for (const entry of entries) {
        contentEl.appendChild(mode === 'list' ? entryRow(entry) : entryCard(entry));
    }
}

/** A dense entry row: thumbnail, title, key chips, content preview, enabled dot. */
function entryRow(entry) {
    const keys = (entry.key || []).slice(0, 6);
    const enabled = !entry.disable;
    const row = document.createElement('div');
    row.className = 'la-entry-row la-entry-clickable';
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    const open = () => navigateTo('entry-editor', { worldId: currentWorldId, lorebookName: currentLorebook, uid: entry.uid });
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    // Right-click (desktop) or long-press (touch) opens the same entry menu.
    const entryMenu = [
        { label: 'Edit entry', icon: 'fa-pen', action: open },
        { label: 'Delete entry', icon: 'fa-trash', danger: true, action: () => confirmDeleteEntry(entry) },
    ];
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, entryMenu); });
    attachLongPress(row, (x, y) => openContextMenu(x, y, entryMenu));
    const cover = getEntryCover(currentLorebook, entry.uid);
    const thumb = cover
        ? `<div class="la-entry-thumb" style="background-image:url('${cover}')"></div>`
        : `<div class="la-entry-thumb"><i class="fa-solid fa-feather"></i></div>`;
    row.innerHTML = `
        ${thumb}
        <div class="la-entry-body">
            <div class="la-entry-head">
                <span class="la-entry-name la-entity-name">${escapeHtml(entryDisplayName(entry))}</span>
                ${keys.length ? `<span class="la-entry-keys">${keys.map(k => `<span class="la-chip la-key-chip">${escapeHtml(k)}</span>`).join('')}</span>` : ''}
            </div>
            ${entry.content ? `<div class="la-entry-content">${escapeHtml(entry.content)}</div>` : '<div class="la-entry-content la-entry-empty-content">No content</div>'}
        </div>
        <div class="la-entry-end">
            <span class="la-entry-dot ${enabled ? 'la-on' : 'la-off'}" title="${enabled ? 'Enabled' : 'Disabled'}"></span>
            <button class="la-list-edit la-list-delete la-entry-delete" title="Delete entry" aria-label="Delete entry"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    // Visible delete button (clicking the row opens the editor, so this can't bubble).
    row.querySelector('.la-entry-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteEntry(entry);
    });
    return row;
}

/** A compact entry card for grid mode (image-led; keys as chips). */
function entryCard(entry) {
    const keys = (entry.key || []).slice(0, 3);
    return createCard({
        title: entryDisplayName(entry),
        coverImage: getEntryCover(currentLorebook, entry.uid),
        color: getWorldById(currentWorldId)?.color ?? null,
        count: `${(entry.key || []).length} key${(entry.key || []).length === 1 ? '' : 's'}`,
        tags: keys,
        kind: 'entry',
        onClick: () => navigateTo('entry-editor', { worldId: currentWorldId, lorebookName: currentLorebook, uid: entry.uid }),
    });
}

/** Confirms and deletes an entry, clears its cover, and refreshes the list. */
async function confirmDeleteEntry(entry) {
    const ok = await callGenericPopup(
        `Delete entry “${entryDisplayName(entry)}”? This cannot be undone.`,
        POPUP_TYPE.CONFIRM,
    );
    if (!ok) return;
    await deleteEntry(currentLorebook, entry.uid);
    removeEntryCover(currentLorebook, entry.uid);
    fillContent();
}

/** Composed empty state. */
function emptyState(text) {
    const el = document.createElement('div');
    el.className = 'la-empty la-empty-section';
    el.innerHTML = `<i class="fa-solid fa-feather la-empty-icon"></i><div class="la-empty-text">${escapeHtml(text)}</div>`;
    return el;
}

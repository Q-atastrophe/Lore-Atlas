// ============================================================================
// views/worlds-view.js — the top-level Worlds view.
// ----------------------------------------------------------------------------
// The home of Atlas: a hero banner across the top, a header bar (title, search,
// "+ New World"), and a grid of World poster cards. Creating/editing a World uses
// the universal entity form; deleting goes through its confirm. This is the first
// real view — drill-into-World detail arrives in Phase 6, and the grid/list toggle
// in Phase 5 (the cards already render grid-style here).
// ============================================================================

import {
    getWorlds, getWorldById, createWorld, updateWorld, deleteWorld,
    getAllWorldTags, getCover, setCover, getActiveWorldId, getState,
    getViewPreference, setViewPreference,
} from '../core/storage.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { createCard } from '../components/card.js';
import { createListRow } from '../components/list-row.js';
import { createViewToggle } from '../components/view-toggle.js';
import { openEntityForm } from '../components/entity-form.js';
import { navigateTo } from '../core/navigation.js';
import { escapeHtml } from '../core/util.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../popup.js';

// The mounted container, current search text, and the items container, kept at
// module scope so the view can re-render itself in place after any change.
let host = null;
let searchQuery = '';
let itemsEl = null;

/**
 * Chooses the cover for the Worlds-view hero banner, per the spec's fallback:
 * a manual override, else the active World's cover, else the first World's cover
 * (so the banner is meaningful before activation exists), else none (gradient).
 * @returns {{ coverImage: string|null, color: string|null }}
 */
function computeHomeBanner() {
    const state = getState();
    const override = state.settings.worldsHomeBannerOverride;
    if (override) return { coverImage: override, color: null };

    const activeId = getActiveWorldId();
    const worlds = getWorlds();
    const target = (activeId && getWorldById(activeId)) || worlds[0] || null;
    if (!target) return { coverImage: null, color: null };
    return { coverImage: getCover('worlds', target.id), color: target.color };
}

/** Builds the entry-count-ish subtitle line for a World card. */
function worldCountLabel(world) {
    const n = world.lorebooks?.length ?? 0;
    return `${n} lorebook${n === 1 ? '' : 's'}`;
}

/** Opens the create form and, on save, persists the new World + cover. */
function openCreate() {
    openEntityForm({
        mode: 'create',
        heading: 'New World',
        tagSuggestions: getAllWorldTags(),
        onSave: (vals) => {
            const world = createWorld({
                name: vals.name, summary: vals.summary, tags: vals.tags, color: vals.color,
            });
            if (vals.coverImage) setCover('worlds', world.id, vals.coverImage);
            render();
        },
    });
}

/** Confirms and deletes a World (its Scenes go too; lorebooks become unassigned). */
async function confirmDeleteWorld(world) {
    const ok = await callGenericPopup(
        `Delete World “${escapeHtml(world.name)}”?<br><br>Its Scenes are deleted with it. Its lorebooks become unassigned but are <strong>not</strong> deleted from SillyTavern.`,
        POPUP_TYPE.CONFIRM,
    );
    if (!ok) return;
    deleteWorld(world.id);
    render();
}

/** Opens the edit form for a World; saves changes or deletes. */
function openEdit(world) {
    openEntityForm({
        mode: 'edit',
        heading: 'Edit World',
        values: {
            name: world.name,
            tags: world.tags,
            summary: world.summary,
            color: world.color,
            coverImage: getCover('worlds', world.id),
        },
        tagSuggestions: getAllWorldTags().filter(t => !world.tags.includes(t)),
        onSave: (vals) => {
            updateWorld(world.id, {
                name: vals.name, summary: vals.summary, tags: vals.tags, color: vals.color,
            });
            setCover('worlds', world.id, vals.coverImage || null);
            render();
        },
        onDelete: () => { deleteWorld(world.id); render(); },
    });
}

/** Filters Worlds by the current search text (name + tags). */
function filteredWorlds() {
    const worlds = getWorlds();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return worlds;
    return worlds.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.tags || []).some(t => t.toLowerCase().includes(q)));
}

/** Re-renders the whole view into its host container. */
function render() {
    if (!host) return;
    host.innerHTML = '';

    // --- Hero banner ---
    const { coverImage, color } = computeHomeBanner();
    // The Worlds home uses the compact 'home' banner. It's frozen (always visible)
    // along with the header, so it's kept short to leave room for the scrolling list.
    host.appendChild(createHeroBanner({
        coverImage, color,
        title: 'Worlds',
        breadcrumb: ['Worlds'],
        height: 'home',
    }));

    // --- Header bar ---
    const header = document.createElement('div');
    header.className = 'la-view-header';
    header.innerHTML = `
        <div class="la-view-title la-entity-name">Worlds</div>
        <div class="la-view-tools">
            <div class="la-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" class="la-search-input" placeholder="Search worlds…" />
            </div>
            <div class="la-view-toggle-slot"></div>
            <button class="la-btn la-btn-primary la-new-world"><i class="fa-solid fa-plus"></i> New World</button>
        </div>`;
    const search = header.querySelector('.la-search-input');
    search.value = searchQuery;
    search.addEventListener('input', () => { searchQuery = search.value; fillItems(); });
    header.querySelector('.la-new-world').addEventListener('click', openCreate);

    // Grid/list toggle — persists per-view and re-renders the items in place.
    const toggle = createViewToggle({
        value: getViewPreference('worldsView'),
        onChange: (mode) => { setViewPreference('worldsView', mode); fillItems(); },
    });
    header.querySelector('.la-view-toggle-slot').appendChild(toggle.el);
    host.appendChild(header);

    // --- Scrollable items region ---
    // The hero + header are frozen; this wrapper is the ONLY thing that scrolls.
    // The grid/list lives inside it so the grid never becomes a scroll container
    // itself (which breaks aspect-ratio row sizing and makes cards overlap).
    const scroll = document.createElement('div');
    scroll.className = 'la-view-scroll';
    itemsEl = document.createElement('div');
    scroll.appendChild(itemsEl);
    host.appendChild(scroll);
    fillItems();
}

/**
 * Populates the items container with the current (filtered) Worlds, in whichever
 * mode (grid/list) is the saved preference. Also swaps the container's class so
 * the layout matches the mode.
 */
function fillItems() {
    if (!itemsEl) return;
    const mode = getViewPreference('worldsView');
    itemsEl.className = mode === 'list' ? 'la-list' : 'la-grid';
    itemsEl.innerHTML = '';

    const worlds = filteredWorlds();
    const searching = !!searchQuery.trim();

    for (const world of worlds) {
        const shared = {
            title: world.name,
            coverImage: getCover('worlds', world.id),
            color: world.color,
            tags: world.tags,
            active: getActiveWorldId() === world.id,
            // Click drills into the World; the hover pencil opens the editor; the
            // hover trash deletes it.
            onClick: () => navigateTo('world-detail', { worldId: world.id }),
            onEdit: () => openEdit(world),
            onDelete: () => confirmDeleteWorld(world),
        };
        itemsEl.appendChild(mode === 'list'
            ? createListRow({ ...shared, summary: world.summary, count: worldCountLabel(world) })
            : createCard({ ...shared, count: worldCountLabel(world), kind: 'world' }));
    }

    // Create affordance at the end (matches the mockup), hidden while searching.
    if (!searching) {
        itemsEl.appendChild(mode === 'list' ? createListCreateRow() : createCreateTile());
    } else if (worlds.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'la-empty';
        empty.innerHTML = `<div class="la-empty-text">No worlds match “${escapeHtml(searchQuery)}”.</div>`;
        itemsEl.appendChild(empty);
    }
}

/** The "Create New" poster tile used in grid mode. */
function createCreateTile() {
    const tile = document.createElement('div');
    tile.className = 'la-card la-card-create';
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.title = 'Create a new World';
    tile.innerHTML = `<div class="la-card-create-inner"><i class="fa-solid fa-plus"></i><span>Create New</span></div>`;
    tile.addEventListener('click', openCreate);
    tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCreate(); } });
    return tile;
}

/** The "Create New" row used in list mode. */
function createListCreateRow() {
    const row = document.createElement('div');
    row.className = 'la-list-row la-list-create';
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.title = 'Create a new World';
    row.innerHTML = `<div class="la-list-create-inner"><i class="fa-solid fa-plus"></i><span>Create New World</span></div>`;
    row.addEventListener('click', openCreate);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCreate(); } });
    return row;
}

/**
 * Renders the Worlds view into the given container. Call each time the panel opens.
 * @param {HTMLElement} container
 */
export function renderWorldsView(container) {
    host = container;
    render();
}

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
} from '../core/storage.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { createCard } from '../components/card.js';
import { openEntityForm } from '../components/entity-form.js';
import { escapeHtml } from '../core/util.js';

// The mounted container and current search text, kept at module scope so the
// view can re-render itself in place after any change.
let host = null;
let searchQuery = '';

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
    // The Worlds home uses the SHORTER banner so the first row of cards stays in
    // view (the taller banner is reserved for World detail, where it's the focus).
    host.appendChild(createHeroBanner({
        coverImage, color,
        title: 'Worlds',
        breadcrumb: ['Worlds'],
        height: 'short',
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
            <button class="la-btn la-btn-primary la-new-world"><i class="fa-solid fa-plus"></i> New World</button>
        </div>`;
    const search = header.querySelector('.la-search-input');
    search.value = searchQuery;
    search.addEventListener('input', () => { searchQuery = search.value; renderGridOnly(); });
    header.querySelector('.la-new-world').addEventListener('click', openCreate);
    host.appendChild(header);

    // --- Grid ---
    const grid = document.createElement('div');
    grid.className = 'la-grid';
    grid.dataset.role = 'worlds-grid';
    host.appendChild(grid);
    fillGrid(grid);
}

/** Re-renders just the grid (used while typing in search, to keep focus). */
function renderGridOnly() {
    const grid = host?.querySelector('[data-role="worlds-grid"]');
    if (grid) fillGrid(grid);
}

/** Populates a grid element with the current (filtered) World cards + create tile. */
function fillGrid(grid) {
    grid.innerHTML = '';
    const worlds = filteredWorlds();

    for (const world of worlds) {
        grid.appendChild(createCard({
            title: world.name,
            coverImage: getCover('worlds', world.id),
            color: world.color,
            count: worldCountLabel(world),
            tags: world.tags,
            active: getActiveWorldId() === world.id,
            kind: 'world',
            onClick: () => openEdit(world),
        }));
    }

    // "Create new" tile (matches the user's mockup), unless a search is filtering.
    if (!searchQuery.trim()) {
        const tile = document.createElement('div');
        tile.className = 'la-card la-card-create';
        tile.tabIndex = 0;
        tile.setAttribute('role', 'button');
        tile.title = 'Create a new World';
        tile.innerHTML = `<div class="la-card-create-inner"><i class="fa-solid fa-plus"></i><span>Create New</span></div>`;
        tile.addEventListener('click', openCreate);
        tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCreate(); } });
        grid.appendChild(tile);
    } else if (worlds.length === 0) {
        // Composed empty state for a search with no matches.
        const empty = document.createElement('div');
        empty.className = 'la-empty';
        empty.innerHTML = `<div class="la-empty-text">No worlds match “${escapeHtml(searchQuery)}”.</div>`;
        grid.appendChild(empty);
    }
}

/**
 * Renders the Worlds view into the given container. Call each time the panel opens.
 * @param {HTMLElement} container
 */
export function renderWorldsView(container) {
    host = container;
    render();
}

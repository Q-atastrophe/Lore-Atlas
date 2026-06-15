// ============================================================================
// views/world-detail.js — a single World's detail page (tabbed).
// ----------------------------------------------------------------------------
// Drilled into from a World card. Layout (top is frozen, content scrolls):
//   [ compact hero — World cover + "Worlds /" breadcrumb back ]   (frozen)
//   [ Lorebooks | Scenes tabs ........ search + grid/list toggle ] (frozen)
//   [ content for the active tab — grid or list ]                  (scrolls)
//
// In Phase 6 the content is empty (composed empty states): lorebook assignment
// fills the Lorebooks tab in Phase 7, and the Scenes tab gets its cards/editor in
// Phase 10. The tabs, per-tab search, and per-tab grid/list toggle are built now.
// ============================================================================

import { getWorldById, getCover, getViewPreference, setViewPreference } from '../core/storage.js';
import { navigateRoot } from '../core/navigation.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { createViewToggle } from '../components/view-toggle.js';
import { escapeHtml } from '../core/util.js';

// Module state for the current detail session. activeTab + searches reset on each
// fresh drill-in (renderWorldDetail); tab switches/search/toggle update in place.
let host = null;
let currentWorldId = null;
let activeTab = 'lorebooks';
let search = { lorebooks: '', scenes: '' };
let contentEl = null;

// Which saved view-preference key backs each tab.
const TAB_PREF = { lorebooks: 'lorebooksView', scenes: 'scenesView' };

/**
 * Renders the World detail view into the panel body (fresh drill-in).
 * @param {HTMLElement} container the panel body.
 * @param {string} worldId
 */
export function renderWorldDetail(container, worldId) {
    host = container;
    currentWorldId = worldId;
    activeTab = 'lorebooks';
    search = { lorebooks: '', scenes: '' };
    draw();
}

/** Builds the frozen hero + tab bar and the scrolling content area. */
function draw() {
    const world = getWorldById(currentWorldId);
    host.innerHTML = '';

    // Guard: the World may have been deleted — composed "gone" state + back.
    if (!world) {
        const scroll = document.createElement('div');
        scroll.className = 'la-view-scroll';
        const gone = document.createElement('div');
        gone.className = 'la-empty';
        gone.innerHTML = `
            <i class="fa-solid fa-circle-question la-empty-icon"></i>
            <div class="la-empty-text">This World no longer exists.</div>
            <button class="la-btn la-btn-secondary la-back-to-worlds">Back to Worlds</button>`;
        gone.querySelector('.la-back-to-worlds').addEventListener('click', navigateRoot);
        scroll.appendChild(gone);
        host.appendChild(scroll);
        return;
    }

    // Compact hero (same height as the Worlds home) — frozen. Just cover + title +
    // breadcrumb, to leave maximum room for the lorebook/scene content below.
    host.appendChild(createHeroBanner({
        coverImage: getCover('worlds', world.id),
        color: world.color,
        title: world.name,
        breadcrumb: ['Worlds', world.name],
        onBreadcrumbClick: (index) => { if (index === 0) navigateRoot(); },
        height: 'home',
    }));

    // Frozen bar: tabs (left) + the active tab's tools (right).
    const bar = document.createElement('div');
    bar.className = 'la-detail-bar';
    bar.innerHTML = `
        <div class="la-tabs" role="tablist">
            <button class="la-tab" data-tab="lorebooks" role="tab">Lorebooks</button>
            <button class="la-tab" data-tab="scenes" role="tab">Scenes</button>
        </div>
        <div class="la-detail-tools"></div>`;

    bar.querySelectorAll('.la-tab').forEach(tab => {
        tab.classList.toggle('la-active', tab.dataset.tab === activeTab);
        tab.addEventListener('click', () => {
            if (activeTab !== tab.dataset.tab) { activeTab = tab.dataset.tab; draw(); }
        });
    });

    // Active tab's tools: search + grid/list toggle (both Lorebooks and Scenes).
    const tools = bar.querySelector('.la-detail-tools');
    const searchWrap = document.createElement('div');
    searchWrap.className = 'la-search';
    searchWrap.innerHTML = `
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" class="la-search-input" placeholder="Search ${escapeHtml(activeTab)}…" />`;
    const input = searchWrap.querySelector('input');
    input.value = search[activeTab];
    input.addEventListener('input', () => { search[activeTab] = input.value; fillContent(); });

    const toggle = createViewToggle({
        value: getViewPreference(TAB_PREF[activeTab]),
        onChange: (mode) => { setViewPreference(TAB_PREF[activeTab], mode); fillContent(); },
    });
    tools.append(searchWrap, toggle.el);
    host.appendChild(bar);

    // Scrolling content for the active tab.
    const scroll = document.createElement('div');
    scroll.className = 'la-view-scroll';
    contentEl = document.createElement('div');
    scroll.appendChild(contentEl);
    host.appendChild(scroll);
    fillContent();
}

/**
 * Fills the content area for the active tab in its saved grid/list mode. In Phase 6
 * there are no lorebooks/scenes yet, so this renders the composed empty state;
 * later phases list the actual items here (respecting the search + view mode).
 */
function fillContent() {
    if (!contentEl) return;
    const mode = getViewPreference(TAB_PREF[activeTab]);
    contentEl.className = mode === 'list' ? 'la-list' : 'la-grid';
    contentEl.innerHTML = '';

    const empty = document.createElement('div');
    empty.className = 'la-empty la-empty-section';
    if (activeTab === 'lorebooks') {
        empty.innerHTML = `
            <i class="fa-solid fa-book la-empty-icon"></i>
            <div class="la-empty-text">No lorebooks in this World yet.</div>`;
    } else {
        empty.innerHTML = `
            <i class="fa-solid fa-masks-theater la-empty-icon"></i>
            <div class="la-empty-text">No scenes yet.</div>`;
    }
    contentEl.appendChild(empty);
}

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

import {
    getWorldById, getCover, getViewPreference, setViewPreference,
    removeLorebookFromWorld,
} from '../core/storage.js';
import { getLorebookEntryCount, lorebookExists } from '../core/lorebook-api.js';
import { navigateRoot } from '../core/navigation.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { createViewToggle } from '../components/view-toggle.js';
import { createCard } from '../components/card.js';
import { createListRow } from '../components/list-row.js';
import { openLorebookPicker } from '../components/lorebook-picker.js';
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

    // Lorebooks tab: the "Add existing lorebook" picker (multi-World assignment).
    if (activeTab === 'lorebooks') {
        const addBtn = document.createElement('button');
        addBtn.className = 'la-btn la-btn-secondary la-add-existing';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add existing';
        addBtn.addEventListener('click', () => openLorebookPicker({
            worldId: currentWorldId,
            onAssigned: () => fillContent(),
        }));
        tools.append(addBtn);
    }

    host.appendChild(bar);

    // Scrolling content for the active tab.
    const scroll = document.createElement('div');
    scroll.className = 'la-view-scroll';
    contentEl = document.createElement('div');
    scroll.appendChild(contentEl);
    host.appendChild(scroll);
    fillContent();
}

// Bumped on every fillContent() call; async renders check it so a slower earlier
// fill (e.g. mid-typing) can't overwrite a newer one.
let fillToken = 0;

/**
 * Fills the content area for the active tab, respecting the search text and the
 * saved grid/list mode. Lorebooks render as cards/rows with live entry counts and
 * a remove action; Scenes are still a placeholder (Phase 10).
 */
async function fillContent() {
    if (!contentEl) return;
    const token = ++fillToken;
    const world = getWorldById(currentWorldId);
    const mode = getViewPreference(TAB_PREF[activeTab]);
    contentEl.className = mode === 'list' ? 'la-list' : 'la-grid';

    // Scenes tab — placeholder until Phase 10.
    if (activeTab === 'scenes') {
        contentEl.innerHTML = '';
        contentEl.appendChild(emptyState('fa-masks-theater', 'No scenes yet.'));
        return;
    }

    // Lorebooks tab.
    const q = search.lorebooks.trim().toLowerCase();
    const names = (world?.lorebooks ?? []).filter(n => !q || n.toLowerCase().includes(q));

    if (names.length === 0) {
        contentEl.innerHTML = '';
        contentEl.appendChild(q
            ? emptyState('fa-book', `No lorebooks match “${search.lorebooks}”.`)
            : emptyState('fa-book', 'No lorebooks in this World yet. Use “Add existing” to assign one.'));
        return;
    }

    // Entry counts come from SillyTavern asynchronously (it caches loaded world
    // info, so this is cheap after the first read).
    const counts = await Promise.all(names.map(n => getLorebookEntryCount(n)));
    if (token !== fillToken) return; // a newer fill superseded this one

    contentEl.innerHTML = '';
    names.forEach((name, i) => {
        const exists = lorebookExists(name);
        const countLabel = exists
            ? `${counts[i]} ${counts[i] === 1 ? 'entry' : 'entries'}`
            : 'missing file';
        const shared = {
            title: name,
            coverImage: getCover('lorebooks', name),
            color: world.color,
            count: countLabel,
            // onClick (drill into lorebook entries) arrives in Phase 12.
            onRemove: () => { removeLorebookFromWorld(currentWorldId, name); fillContent(); },
        };
        contentEl.appendChild(mode === 'list'
            ? createListRow({ ...shared, summary: exists ? '' : 'This lorebook no longer exists in SillyTavern.' })
            : createCard({ ...shared, kind: 'lorebook' }));
    });
}

/** Builds a composed empty-state panel. */
function emptyState(icon, text) {
    const empty = document.createElement('div');
    empty.className = 'la-empty la-empty-section';
    empty.innerHTML = `
        <i class="fa-solid ${escapeHtml(icon)} la-empty-icon"></i>
        <div class="la-empty-text">${escapeHtml(text)}</div>`;
    return empty;
}

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
    getWorldById, getCover, setCover, getViewPreference, setViewPreference,
    addLorebookToWorld, removeLorebookFromWorld, getLorebookMeta, setLorebookMeta, getAllLorebookTags,
    deleteLorebookEverywhere, getLorebookImpact,
    getActiveWorldId, getActiveSceneId,
    getScenes, getSceneById, createScene, updateScene, deleteScene, getAllSceneTags,
} from '../core/storage.js';
import { getLorebookEntryCount, lorebookExists, createLorebook, deleteLorebookFile } from '../core/lorebook-api.js';
import { requestActivateWorld, requestActivateScene } from '../core/activation.js';
import { navigateRoot, navigateTo } from '../core/navigation.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { createViewToggle } from '../components/view-toggle.js';
import { createCard } from '../components/card.js';
import { createListRow } from '../components/list-row.js';
import { openLorebookPicker } from '../components/lorebook-picker.js';
import { openEntityForm } from '../components/entity-form.js';
import { createSceneLorebooks } from '../components/scene-lorebooks.js';
import { openContextMenu } from '../components/context-menu.js';
import { escapeHtml } from '../core/util.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../popup.js';

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
    const hero = createHeroBanner({
        coverImage: getCover('worlds', world.id),
        color: world.color,
        title: world.name,
        breadcrumb: ['Worlds', world.name],
        onBreadcrumbClick: (index) => { if (index === 0) navigateRoot(); },
        height: 'home',
    });

    // Activate button (bottom-right of the hero): enables exactly this World's
    // lorebooks. Shows "Active" only when the FULL World is active (no Scene) —
    // when a Scene is active you can still click to activate the whole World.
    const isActive = getActiveWorldId() === world.id && !getActiveSceneId();
    const activateBtn = document.createElement('button');
    activateBtn.className = 'la-btn la-activate-btn ' + (isActive ? 'la-btn-secondary la-activate-on' : 'la-btn-primary');
    activateBtn.innerHTML = isActive
        ? '<i class="fa-solid fa-circle-check"></i> Active'
        : '<i class="fa-solid fa-bolt"></i> Activate';
    activateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await requestActivateWorld(world.id);
        if (res) draw();   // re-render so the button + state reflect activation
    });
    hero.appendChild(activateBtn);   // hero is position: relative

    host.appendChild(hero);

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
        const newLbBtn = document.createElement('button');
        newLbBtn.className = 'la-btn la-btn-primary la-new-lorebook';
        newLbBtn.innerHTML = '<i class="fa-solid fa-plus"></i> New Lorebook';
        newLbBtn.addEventListener('click', openNewLorebookForm);
        tools.append(addBtn, newLbBtn);
    }

    // Scenes tab: the "New Scene" button.
    if (activeTab === 'scenes') {
        const newSceneBtn = document.createElement('button');
        newSceneBtn.className = 'la-btn la-btn-primary la-new-scene';
        newSceneBtn.innerHTML = '<i class="fa-solid fa-plus"></i> New Scene';
        newSceneBtn.addEventListener('click', () => openSceneEditor(null));
        tools.append(newSceneBtn);
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

    // Scenes tab — the World's Scenes (synchronous; no entry counts to fetch).
    if (activeTab === 'scenes') {
        const q = search.scenes.trim().toLowerCase();
        const scenes = getScenes(currentWorldId).filter(s =>
            !q || s.name.toLowerCase().includes(q) || (s.tags || []).some(t => t.toLowerCase().includes(q)));
        contentEl.innerHTML = '';
        if (scenes.length === 0) {
            contentEl.appendChild(q
                ? emptyState('fa-masks-theater', `No scenes match “${search.scenes}”.`)
                : emptyState('fa-masks-theater', 'No scenes yet. Use “New Scene” to create one.'));
            return;
        }
        for (const scene of scenes) {
            const n = scene.lorebooks.length;
            const shared = {
                title: scene.name,
                coverImage: getCover('scenes', scene.id),
                color: scene.color,
                count: `${n} lorebook${n === 1 ? '' : 's'}`,
                tags: scene.tags,
                active: getActiveSceneId() === scene.id,
                onClick: () => openSceneEditor(scene.id),   // click a Scene opens its editor
                // The hover bolt activates the Scene (only its lorebooks).
                onActivate: async () => { const res = await requestActivateScene(currentWorldId, scene.id); if (res) draw(); },
                onDelete: () => confirmDeleteScene(scene),
            };
            contentEl.appendChild(mode === 'list'
                ? createListRow({ ...shared, summary: scene.summary })
                : createCard({ ...shared, kind: 'scene' }));
        }
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
        const meta = getLorebookMeta(name);
        const countLabel = exists
            ? `${counts[i]} ${counts[i] === 1 ? 'entry' : 'entries'}`
            : 'missing file';
        const shared = {
            title: name,
            coverImage: getCover('lorebooks', name),
            color: world.color,        // tints the fallback gradient when no cover
            count: countLabel,
            tags: meta.tags,
            onClick: () => navigateTo('lorebook-detail', { worldId: currentWorldId, lorebookName: name }),
            onEdit: () => openLorebookEditor(name),
            onRemove: () => { removeLorebookFromWorld(currentWorldId, name); fillContent(); },
            onDelete: () => confirmDeleteLorebook(name),
        };
        const el = mode === 'list'
            ? createListRow({ ...shared, summary: exists ? meta.summary : 'This lorebook no longer exists in SillyTavern.' })
            : createCard({ ...shared, kind: 'lorebook' });
        // Right-click: full lorebook context menu (edit / remove / delete entirely).
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openContextMenu(e.clientX, e.clientY, [
                { label: 'Edit metadata', icon: 'fa-pen', action: () => openLorebookEditor(name) },
                { label: 'Remove from World', icon: 'fa-link-slash', action: () => { removeLorebookFromWorld(currentWorldId, name); fillContent(); } },
                { label: 'Delete lorebook', icon: 'fa-trash', danger: true, action: () => confirmDeleteLorebook(name) },
            ]);
        });
        contentEl.appendChild(el);
    });
}

/**
 * Opens the create form for a brand-new lorebook (its name becomes the SillyTavern
 * filename). On save: create the ST file, assign it to this World, and store its
 * Atlas metadata + cover.
 */
function openNewLorebookForm() {
    openEntityForm({
        mode: 'create',
        heading: 'New Lorebook',
        hideColor: true,
        imageLabel: 'Upload cover',
        summaryPlaceholder: 'What does this lorebook cover?',
        tagSuggestions: getAllLorebookTags(),
        onSave: async (vals) => {
            const res = await createLorebook(vals.name);
            if (!res) { if (typeof toastr !== 'undefined') toastr.error('Could not create the lorebook.', 'Lore Atlas'); return; }
            if (res.exists) { if (typeof toastr !== 'undefined') toastr.warning(`A lorebook named “${vals.name}” already exists. Use “Add existing” instead.`, 'Lore Atlas'); return; }
            const name = res.name;
            addLorebookToWorld(currentWorldId, name);
            if ((vals.tags && vals.tags.length) || vals.summary) setLorebookMeta(name, { tags: vals.tags, summary: vals.summary });
            if (vals.coverImage) setCover('lorebooks', name, vals.coverImage);
            fillContent();
        },
    });
}

/**
 * Confirms (with an impact list of affected Worlds/Scenes) and then deletes a
 * lorebook FILE from SillyTavern entirely, plus all its Atlas references.
 * @param {string} name
 */
async function confirmDeleteLorebook(name) {
    const impact = getLorebookImpact(name);
    let html = `Delete lorebook <strong>${escapeHtml(name)}</strong> from SillyTavern entirely?<br><br>This permanently removes the lorebook and all its entries. It cannot be undone.`;
    if (impact.length) {
        const lines = impact.map(w => {
            const scenes = w.scenes.length ? ` <span style="opacity:0.7">(scenes: ${w.scenes.map(escapeHtml).join(', ')})</span>` : '';
            return `• ${escapeHtml(w.name)}${scenes}`;
        }).join('<br>');
        html += `<br><br>It will be removed from these Worlds:<br>${lines}`;
    }
    const ok = await callGenericPopup(html, POPUP_TYPE.CONFIRM);
    if (!ok) return;
    await deleteLorebookFile(name);     // remove the ST file + ST references
    deleteLorebookEverywhere(name);     // remove all Atlas references
    fillContent();
}

/**
 * Opens the lorebook metadata editor: cover image, tags, and summary. The
 * lorebook's name is its filename, so Name and Color are hidden (the form is the
 * universal entity form adapted via hideName/hideColor).
 * @param {string} name
 */
function openLorebookEditor(name) {
    const meta = getLorebookMeta(name);
    openEntityForm({
        mode: 'edit',
        heading: name,
        hideName: true,
        hideColor: true,
        imageLabel: 'Upload cover',
        summaryPlaceholder: 'What does this lorebook cover?',
        values: {
            name,
            tags: meta.tags,
            summary: meta.summary,
            coverImage: getCover('lorebooks', name),
        },
        tagSuggestions: getAllLorebookTags().filter(t => !meta.tags.includes(t)),
        onSave: (vals) => {
            setLorebookMeta(name, { tags: vals.tags, summary: vals.summary });
            setCover('lorebooks', name, vals.coverImage || null);
            fillContent();
        },
    });
}

/**
 * Opens the Scene editor (create when sceneId is null, else edit). Uses the
 * universal entity form plus a lorebook checklist (the Scene's subset of the
 * World's lorebooks). A new Scene starts with all the World's lorebooks checked,
 * so the user just unchecks the ones to firewall out.
 * @param {string|null} sceneId
 */
function openSceneEditor(sceneId) {
    const world = getWorldById(currentWorldId);
    if (!world) return;
    const scene = sceneId ? getSceneById(currentWorldId, sceneId) : null;

    const checklist = createSceneLorebooks({
        worldLorebooks: world.lorebooks,
        selected: scene ? scene.lorebooks : [...world.lorebooks],
    });

    openEntityForm({
        mode: scene ? 'edit' : 'create',
        heading: scene ? 'Edit Scene' : 'New Scene',
        imageLabel: 'Upload cover',
        summaryPlaceholder: 'What happens in this scene?',
        values: {
            name: scene?.name ?? '',
            tags: scene?.tags ?? [],
            summary: scene?.summary ?? '',
            color: scene?.color ?? world.color,
            coverImage: sceneId ? getCover('scenes', sceneId) : null,
        },
        tagSuggestions: getAllSceneTags(currentWorldId).filter(t => !(scene?.tags ?? []).includes(t)),
        extraNote: '<strong>World lorebooks</strong> are always loaded (uncheck to firewall a book out of this scene). <strong>Scene lorebooks</strong> are loaded on top — including ones outside this world.',
        extraField: checklist.el,
        onSave: (vals) => {
            const lorebooks = checklist.getSelected();
            if (scene) {
                updateScene(currentWorldId, sceneId, {
                    name: vals.name, summary: vals.summary, tags: vals.tags, color: vals.color, lorebooks,
                });
                setCover('scenes', sceneId, vals.coverImage || null);
            } else {
                const created = createScene(currentWorldId, {
                    name: vals.name, summary: vals.summary, tags: vals.tags, color: vals.color, lorebooks,
                });
                if (created && vals.coverImage) setCover('scenes', created.id, vals.coverImage);
            }
            fillContent();
        },
        onDelete: scene ? () => { deleteScene(currentWorldId, sceneId); fillContent(); } : null,
    });
}

/** Confirms and deletes a Scene. */
async function confirmDeleteScene(scene) {
    const ok = await callGenericPopup(
        `Delete Scene “${escapeHtml(scene.name)}”? This cannot be undone.`,
        POPUP_TYPE.CONFIRM,
    );
    if (!ok) return;
    deleteScene(currentWorldId, scene.id);
    fillContent();
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

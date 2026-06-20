// ============================================================================
// views/entry-editor.js — the entry editor.
// ----------------------------------------------------------------------------
// Drilled into from a lorebook entry. Mirrors SillyTavern's native world-info
// entry: Title/Memo, Keys, Content, an entry image, and a collapsible Advanced
// section (secondary keys, position, depth, order, trigger %, inclusion group,
// automation ID, and the common toggles). Every field auto-saves after 500ms of
// inactivity (and immediately on blur / toggle), with a Saved / Saving… / Unsaved
// indicator. Ctrl+Z (or the Undo button) restores the previous saved state (20
// in-memory steps).
// ============================================================================

import { getWorldById, getCover, getEntryCover, setEntryCover, removeEntryCover } from '../core/storage.js';
import { getEntry, updateEntry, deleteEntry, entryDisplayName } from '../core/lorebook-api.js';
import { back, goBack } from '../core/navigation.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { createTagInput } from '../components/tag-input.js';
import { createImageUpload } from '../components/image-upload.js';
import { pushUndo, popUndo, canUndo } from '../core/undo.js';
import { escapeHtml } from '../core/util.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../popup.js';

let buildToken = 0;
let saveTimer = null;
let retryTimer = null;
const SAVE_DEBOUNCE_MS = 500;
const RETRY_MS = 5000;

// SillyTavern's world_info_position enum, with friendly labels for the dropdown.
const POSITIONS = [
    { v: 0, label: '↑ Before Char' },
    { v: 1, label: '↓ After Char' },
    { v: 2, label: "↑ Author's Note" },
    { v: 3, label: "↓ Author's Note" },
    { v: 4, label: '@ At Depth' },
    { v: 5, label: '↑ Example Msgs' },
    { v: 6, label: '↓ Example Msgs' },
];

// The toggles we expose (entry boolean fields). Order mirrors ST's grouping.
const TOGGLES = [
    { k: 'constant', label: 'Constant (🔵 always active)' },
    { k: 'selective', label: 'Selective (use secondary keys)' },
    { k: 'vectorized', label: 'Vectorized' },
    { k: 'disable', label: 'Disabled' },
    { k: 'excludeRecursion', label: 'Exclude from recursion' },
    { k: 'preventRecursion', label: 'Prevent further recursion' },
];

const intOr = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

/** Renders the entry editor (fresh drill-in). */
export function renderEntryEditor(container, worldId, lorebookName, uid) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    build(container, worldId, lorebookName, uid);
}

async function build(container, worldId, lorebookName, uid) {
    const token = ++buildToken;
    const world = getWorldById(worldId);
    const entry = await getEntry(lorebookName, uid);
    if (token !== buildToken) return;

    container.innerHTML = '';

    if (!entry) {
        const gone = document.createElement('div');
        gone.className = 'la-view-scroll';
        gone.innerHTML = `<div class="la-empty"><i class="fa-solid fa-circle-question la-empty-icon"></i><div class="la-empty-text">This entry no longer exists.</div></div>`;
        container.appendChild(gone);
        return;
    }

    const undoKey = `${lorebookName}::${uid}`;

    // --- Hero: entry image -> lorebook -> World cover. ---
    const cover = getEntryCover(lorebookName, uid)
        || getCover('lorebooks', lorebookName)
        || (world ? getCover('worlds', world.id) : null);
    const hero = createHeroBanner({
        coverImage: cover,
        color: world?.color ?? null,
        title: entryDisplayName(entry),
        breadcrumb: ['Worlds', world?.name ?? '…', lorebookName, entryDisplayName(entry)],
        onBreadcrumbClick: (index) => { flushSave(); if (index < 3) back(3 - index); },
        height: 'home',
    });
    container.appendChild(hero);

    // --- Frozen toolbar: delete + undo + save indicator. ---
    const bar = document.createElement('div');
    bar.className = 'la-detail-bar';
    bar.innerHTML = `
        <div class="la-view-title la-entity-name">Entry</div>
        <div class="la-detail-tools">
            <button class="la-btn la-btn-danger la-entry-delete" title="Delete entry"><i class="fa-solid fa-trash"></i></button>
            <button class="la-btn la-btn-secondary la-entry-undo" title="Undo (Ctrl+Z)"><i class="fa-solid fa-rotate-left"></i> Undo</button>
            <span class="la-save-indicator" data-state="idle"><i class="fa-solid fa-circle-check"></i><span class="la-save-text">Saved</span></span>
        </div>`;
    container.appendChild(bar);
    const undoBtn = bar.querySelector('.la-entry-undo');
    const indicator = bar.querySelector('.la-save-indicator');

    bar.querySelector('.la-entry-delete').addEventListener('click', async () => {
        flushSave();
        const ok = await callGenericPopup(`Delete entry “${entryDisplayName(entry)}”? This cannot be undone.`, POPUP_TYPE.CONFIRM);
        if (!ok) return;
        await deleteEntry(lorebookName, uid);
        removeEntryCover(lorebookName, uid);
        goBack();
    });

    // --- Scrolling fields. ---
    const scroll = document.createElement('div');
    scroll.className = 'la-view-scroll';
    scroll.innerHTML = `
        <div class="la-entry-editor">
            <div class="la-field la-ee-image-field">
                <span class="la-field-label">Image</span>
                <div class="la-ee-image"></div>
            </div>
            <label class="la-field">
                <span class="la-field-label">Title / Memo</span>
                <input type="text" class="la-input la-ee-name" placeholder="Entry title" />
            </label>
            <div class="la-field">
                <span class="la-field-label">Keys</span>
                <div class="la-ee-keys"></div>
            </div>
            <label class="la-field la-ee-content-field">
                <span class="la-field-label">Content</span>
                <textarea class="la-textarea la-ee-content" placeholder="Entry content…"></textarea>
            </label>

            <details class="la-advanced">
                <summary class="la-advanced-summary"><i class="fa-solid fa-chevron-right la-advanced-caret"></i> Advanced</summary>
                <div class="la-advanced-body">
                    <div class="la-field">
                        <span class="la-field-label">Secondary keys</span>
                        <div class="la-ee-seckeys"></div>
                    </div>
                    <div class="la-ee-grid">
                        <label class="la-field">
                            <span class="la-field-label">Position</span>
                            <select class="la-input la-ee-position">
                                ${POSITIONS.map(p => `<option value="${p.v}">${escapeHtml(p.label)}</option>`).join('')}
                            </select>
                        </label>
                        <label class="la-field">
                            <span class="la-field-label">Depth</span>
                            <input type="number" class="la-input la-ee-depth" />
                        </label>
                        <label class="la-field">
                            <span class="la-field-label">Order</span>
                            <input type="number" class="la-input la-ee-order" />
                        </label>
                        <label class="la-field">
                            <span class="la-field-label">Trigger %</span>
                            <input type="number" min="0" max="100" class="la-input la-ee-prob" />
                        </label>
                        <label class="la-field">
                            <span class="la-field-label">Inclusion group</span>
                            <input type="text" class="la-input la-ee-group" placeholder="optional" />
                        </label>
                        <label class="la-field">
                            <span class="la-field-label">Automation ID</span>
                            <input type="text" class="la-input la-ee-autoid" placeholder="optional" />
                        </label>
                    </div>
                    <div class="la-ee-toggles">
                        ${TOGGLES.map(t => `
                            <label class="la-toggle">
                                <input type="checkbox" data-toggle="${t.k}" />
                                <span>${escapeHtml(t.label)}</span>
                            </label>`).join('')}
                    </div>
                </div>
            </details>
        </div>`;
    container.appendChild(scroll);

    // Field refs.
    const nameInput = scroll.querySelector('.la-ee-name');
    const contentInput = scroll.querySelector('.la-ee-content');
    const positionSelect = scroll.querySelector('.la-ee-position');
    const depthInput = scroll.querySelector('.la-ee-depth');
    const orderInput = scroll.querySelector('.la-ee-order');
    const probInput = scroll.querySelector('.la-ee-prob');
    const groupInput = scroll.querySelector('.la-ee-group');
    const autoIdInput = scroll.querySelector('.la-ee-autoid');
    const toggleEls = {};
    for (const t of TOGGLES) toggleEls[t.k] = scroll.querySelector(`[data-toggle="${t.k}"]`);

    // Initial values from the entry.
    nameInput.value = entry.comment ?? '';
    contentInput.value = entry.content ?? '';
    positionSelect.value = String(entry.position ?? 0);
    depthInput.value = entry.depth ?? 4;
    orderInput.value = entry.order ?? 100;
    probInput.value = entry.probability ?? 100;
    groupInput.value = entry.group ?? '';
    autoIdInput.value = entry.automationId ?? '';
    for (const t of TOGGLES) toggleEls[t.k].checked = !!entry[t.k];

    const keysInput = createTagInput({ tags: Array.isArray(entry.key) ? entry.key : [], suggestions: [], placeholder: 'add key…', onChange: () => scheduleSave() });
    scroll.querySelector('.la-ee-keys').appendChild(keysInput.el);
    const secKeysInput = createTagInput({ tags: Array.isArray(entry.keysecondary) ? entry.keysecondary : [], suggestions: [], placeholder: 'add secondary key…', onChange: () => scheduleSave() });
    scroll.querySelector('.la-ee-seckeys').appendChild(secKeysInput.el);

    // Entry image (Atlas metadata, saved separately; live-applied to the hero).
    const heroCover = hero.querySelector('.la-hero-cover');
    const upload = createImageUpload({
        initialImage: getEntryCover(lorebookName, uid),
        shape: 'square',
        label: 'Entry image',
        onImage: (dataUrl) => {
            setEntryCover(lorebookName, uid, dataUrl);
            if (heroCover) { heroCover.style.background = ''; heroCover.style.backgroundImage = `url("${dataUrl}")`; }
        },
    });
    scroll.querySelector('.la-ee-image').appendChild(upload.el);

    // --- Save / undo machinery (covers ALL entry fields) ---
    const readFields = () => ({
        comment: nameInput.value,
        key: keysInput.getTags(),
        keysecondary: secKeysInput.getTags(),
        content: contentInput.value,
        position: intOr(positionSelect.value, 0),
        depth: intOr(depthInput.value, 4),
        order: intOr(orderInput.value, 100),
        probability: Math.max(0, Math.min(100, intOr(probInput.value, 100))),
        group: groupInput.value,
        automationId: autoIdInput.value,
        ...Object.fromEntries(TOGGLES.map(t => [t.k, toggleEls[t.k].checked])),
    });
    const snap = (o) => JSON.stringify(o);
    let lastSaved = readFields();

    function setFields(s) {
        nameInput.value = s.comment;
        keysInput.setTags(s.key);
        secKeysInput.setTags(s.keysecondary);
        contentInput.value = s.content;
        positionSelect.value = String(s.position);
        depthInput.value = s.depth;
        orderInput.value = s.order;
        probInput.value = s.probability;
        groupInput.value = s.group;
        autoIdInput.value = s.automationId;
        for (const t of TOGGLES) toggleEls[t.k].checked = !!s[t.k];
    }

    function setIndicator(state) {
        const map = {
            idle: ['fa-circle-check', 'Saved'], saving: ['fa-spinner fa-spin', 'Saving…'],
            saved: ['fa-circle-check', 'Saved'], error: ['fa-triangle-exclamation', 'Unsaved (will retry)'],
        };
        const [icon, text] = map[state] || map.idle;
        indicator.dataset.state = state;
        indicator.querySelector('i').className = `fa-solid ${icon}`;
        indicator.querySelector('.la-save-text').textContent = text;
    }
    function updateUndoBtn() { undoBtn.disabled = !canUndo(undoKey); }
    updateUndoBtn();

    async function persist(snapshot) {
        setIndicator('saving');
        try {
            await updateEntry(lorebookName, uid, snapshot);
            lastSaved = snapshot;
            setIndicator('saved');
            setTimeout(() => { if (indicator.dataset.state === 'saved') setIndicator('idle'); }, 2000);
        } catch {
            setIndicator('error');
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => persist(readFields()), RETRY_MS);
        }
    }

    async function flushSave() {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        const cur = readFields();
        if (snap(cur) === snap(lastSaved)) return;
        pushUndo(undoKey, lastSaved);
        updateUndoBtn();
        await persist(cur);
    }
    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    }
    async function doUndo() {
        const prev = popUndo(undoKey);
        if (!prev) return;
        setFields(prev);
        updateUndoBtn();
        await persist(prev);
    }

    // Wire fields: text/number debounce on input + flush on blur; selects/toggles
    // flush immediately (discrete changes).
    for (const el of [nameInput, contentInput, depthInput, orderInput, probInput, groupInput, autoIdInput]) {
        el.addEventListener('input', scheduleSave);
        el.addEventListener('change', flushSave);
    }
    positionSelect.addEventListener('change', flushSave);
    for (const t of TOGGLES) toggleEls[t.k].addEventListener('change', flushSave);
    undoBtn.addEventListener('click', doUndo);

    scroll.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    });
}

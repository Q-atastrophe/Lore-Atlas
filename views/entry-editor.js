// ============================================================================
// views/entry-editor.js — the entry editor (essentials, Phase 13).
// ----------------------------------------------------------------------------
// Drilled into from a lorebook entry. Mirrors SillyTavern's native world-info
// entry: Title/Memo (comment), Keys (chip input), and Content. Edits auto-save
// after 500ms of inactivity (and immediately on blur), with a visible Saved /
// Saving… / Unsaved indicator. Ctrl+Z (or the Undo button) restores the previous
// saved state, up to 20 in-memory steps.
//
// Position / depth / order / probability / toggles and the entry image arrive in
// Phases 14–15; this view keeps the essentials.
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

// Build token: a fresh drill-in bumps it so a slow async build can't overwrite a
// newer view.
let buildToken = 0;
// Pending auto-save timer (module-scoped so a new build can cancel a stale one).
let saveTimer = null;
let retryTimer = null;

const SAVE_DEBOUNCE_MS = 500;
const RETRY_MS = 5000;

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
    if (token !== buildToken) return;   // superseded while loading

    container.innerHTML = '';

    if (!entry) {
        const gone = document.createElement('div');
        gone.className = 'la-view-scroll';
        gone.innerHTML = `<div class="la-empty"><i class="fa-solid fa-circle-question la-empty-icon"></i><div class="la-empty-text">This entry no longer exists.</div></div>`;
        container.appendChild(gone);
        return;
    }

    const undoKey = `${lorebookName}::${uid}`;

    // --- Compact hero: entry image, falling back to lorebook, then World cover. ---
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

    // --- Frozen toolbar: title + undo + save indicator. ---
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

    // Delete this entry (with confirmation) -> back to the lorebook.
    bar.querySelector('.la-entry-delete').addEventListener('click', async () => {
        flushSave();
        const ok = await callGenericPopup(
            `Delete entry “${entryDisplayName(entry)}”? This cannot be undone.`,
            POPUP_TYPE.CONFIRM,
        );
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
        </div>`;
    container.appendChild(scroll);

    const nameInput = scroll.querySelector('.la-ee-name');
    const contentInput = scroll.querySelector('.la-ee-content');
    nameInput.value = entry.comment ?? '';
    contentInput.value = entry.content ?? '';

    const keysInput = createTagInput({
        tags: Array.isArray(entry.key) ? entry.key : [],
        suggestions: [],
        placeholder: 'add key…',
        onChange: () => scheduleSave(),
    });
    scroll.querySelector('.la-ee-keys').appendChild(keysInput.el);

    // Entry image upload — saved separately from the entry's text (Atlas metadata),
    // and live-applied to the hero so the user sees it immediately.
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

    // --- Save / undo machinery ---
    const readFields = () => ({
        comment: nameInput.value,
        key: keysInput.getTags(),
        content: contentInput.value,
    });
    const sameSnap = (a, b) =>
        a.comment === b.comment &&
        a.content === b.content &&
        a.key.length === b.key.length &&
        a.key.every((k, i) => k === b.key[i]);

    // The last state persisted to ST (the baseline an edit is measured against).
    let lastSaved = readFields();

    function setIndicator(state) {
        const map = {
            idle: ['fa-circle-check', 'Saved'],
            saving: ['fa-spinner fa-spin', 'Saving…'],
            saved: ['fa-circle-check', 'Saved'],
            error: ['fa-triangle-exclamation', 'Unsaved (will retry)'],
        };
        const [icon, text] = map[state] || map.idle;
        indicator.dataset.state = state;
        indicator.querySelector('i').className = `fa-solid ${icon}`;
        indicator.querySelector('.la-save-text').textContent = text;
    }
    function updateUndoBtn() { undoBtn.disabled = !canUndo(undoKey); }
    updateUndoBtn();

    /** Persists the given snapshot (used by both auto-save and undo). */
    async function persist(snapshot) {
        setIndicator('saving');
        try {
            await updateEntry(lorebookName, uid, { comment: snapshot.comment, key: snapshot.key, content: snapshot.content });
            lastSaved = snapshot;
            setIndicator('saved');
            // Settle back to idle after a moment.
            setTimeout(() => { if (indicator.dataset.state === 'saved') setIndicator('idle'); }, 2000);
        } catch {
            setIndicator('error');
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => persist(readFields()), RETRY_MS);
        }
    }

    /** Saves now if there are unsaved changes (pushing the prior state to undo). */
    async function flushSave() {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        const cur = readFields();
        if (sameSnap(cur, lastSaved)) return;
        pushUndo(undoKey, lastSaved);     // remember the state we're replacing
        updateUndoBtn();
        await persist(cur);
    }

    /** Debounced auto-save (500ms after the last edit). */
    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    }

    async function doUndo() {
        const prev = popUndo(undoKey);
        if (!prev) return;
        // Restore the fields and persist WITHOUT pushing a new undo step.
        nameInput.value = prev.comment;
        contentInput.value = prev.content;
        keysInput.setTags(prev.key);
        updateUndoBtn();
        await persist(prev);
    }

    nameInput.addEventListener('input', scheduleSave);
    contentInput.addEventListener('input', scheduleSave);
    nameInput.addEventListener('change', flushSave);   // blur -> immediate save
    contentInput.addEventListener('change', flushSave);
    undoBtn.addEventListener('click', doUndo);

    // Ctrl/Cmd+Z within the editor → entry-level undo.
    scroll.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            doUndo();
        }
    });
}

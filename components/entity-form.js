// ============================================================================
// components/entity-form.js — the universal create/edit form.
// ----------------------------------------------------------------------------
// One modal pattern for creating and editing Worlds (now) and later Lorebooks and
// Scenes: a large image upload on the left (~40%) and the fields on the right
// (~60%) — Name, Tags, Summary, Color. It layers above the main panel.
//
// It's deliberately generic: the caller passes the initial values and gets the
// edited values back via onSave. Storage and view-refresh are the caller's job,
// which keeps this form reusable across entity types. Scene-specific extras (the
// lorebook picker) plug in later through the `extraFields` hook.
// ============================================================================

import { POPUP_TYPE, callGenericPopup } from '../../../../popup.js';
import { createImageUpload } from './image-upload.js';
import { createTagInput } from './tag-input.js';
import { escapeHtml } from '../core/util.js';

const FORM_ID = 'lore-atlas-entity-form';

/**
 * Opens the entity form. Returns nothing; results come back through callbacks.
 *
 * @param {object} opts
 * @param {'create'|'edit'} [opts.mode='create']
 * @param {string} [opts.heading] modal heading, e.g. 'New World' / 'Edit World'.
 * @param {object} [opts.values] initial field values:
 *        { name, tags[], summary, color, coverImage }.
 * @param {string[]} [opts.tagSuggestions] existing tags for autocomplete.
 * @param {boolean} [opts.hideName] hide the Name field (e.g. lorebooks, whose name
 *        is their filename). The saved name passes through values.name unchanged.
 * @param {boolean} [opts.hideColor] hide the Color field (e.g. lorebooks).
 * @param {string} [opts.imageLabel='Upload image'] placeholder for the upload area.
 * @param {string} [opts.summaryPlaceholder]
 * @param {string} [opts.extraNote] HTML note inserted beneath the summary (right
 *        column) — e.g. the Scene editor's "what the lorebook tabs mean" blurb.
 * @param {HTMLElement} [opts.extraField] an extra element placed FULL-WIDTH below the
 *        image+fields grid (e.g. the Scene editor's lorebook tabs). The caller keeps
 *        its own reference to read its value in onSave.
 * @param {(values: {name:string, tags:string[], summary:string, color:string, coverImage:string|null}) => void} opts.onSave
 * @param {() => void} [opts.onDelete] if provided (edit mode), shows a Delete button.
 */
export function openEntityForm(opts = {}) {
    const {
        mode = 'create',
        heading = mode === 'edit' ? 'Edit' : 'New',
        values = {},
        tagSuggestions = [],
        hideName = false,
        hideColor = false,
        imageLabel = 'Upload image',
        summaryPlaceholder = 'What is this world?',
        extraNote = null,
        extraField = null,
        onSave = () => {},
        onDelete = null,
    } = opts;

    // Don't stack two forms.
    document.getElementById(FORM_ID)?.remove();

    // Local working copy of the cover (updated by the image-upload component).
    let coverImage = values.coverImage ?? null;

    const backdrop = document.createElement('div');
    backdrop.id = FORM_ID;
    backdrop.className = 'la-modal-backdrop';
    backdrop.innerHTML = `
        <div class="la-modal la-entity-form" role="dialog" aria-label="${escapeHtml(heading)}">
            <div class="la-modal-header">
                <div class="la-modal-heading la-entity-name">${escapeHtml(heading)}</div>
                <button class="la-modal-close" title="Cancel" aria-label="Cancel"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="la-entity-form-scroll">
                <div class="la-entity-form-body">
                    <div class="la-entity-form-image"></div>
                    <div class="la-entity-form-fields">
                        ${hideName ? '' : `
                        <label class="la-field">
                            <span class="la-field-label">Name</span>
                            <input type="text" class="la-input la-field-name" placeholder="Name" />
                        </label>`}
                        <div class="la-field">
                            <span class="la-field-label">Tags</span>
                            <div class="la-field-tags"></div>
                        </div>
                        <label class="la-field">
                            <span class="la-field-label">Summary</span>
                            <textarea class="la-textarea la-field-summary" placeholder="${escapeHtml(summaryPlaceholder)}"></textarea>
                        </label>
                        ${extraNote ? `<div class="la-field-note">${extraNote}</div>` : ''}
                        ${hideColor ? '' : `
                        <label class="la-field la-field-color-row">
                            <span class="la-field-label">Color</span>
                            <input type="color" class="la-color la-field-color" />
                        </label>`}
                    </div>
                </div>
                <div class="la-entity-form-extra"></div>
            </div>
            <div class="la-modal-footer">
                <div class="la-modal-footer-left"></div>
                <div class="la-modal-footer-right">
                    <button class="la-btn la-btn-secondary la-form-cancel">Cancel</button>
                    <button class="la-btn la-btn-primary la-form-save">Save</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(backdrop);

    // --- Image upload (left) ---
    const upload = createImageUpload({
        initialImage: coverImage,
        shape: 'portrait',
        label: imageLabel,
        onImage: (dataUrl) => { coverImage = dataUrl; },
    });
    backdrop.querySelector('.la-entity-form-image').appendChild(upload.el);

    // --- Fields (right) --- (name/color may be hidden for some entity types)
    const nameInput = backdrop.querySelector('.la-field-name');
    const summaryInput = backdrop.querySelector('.la-field-summary');
    const colorInput = backdrop.querySelector('.la-field-color');
    if (nameInput) nameInput.value = values.name ?? '';
    summaryInput.value = values.summary ?? '';
    if (colorInput) colorInput.value = values.color ?? '#a07b3a';

    const tagInput = createTagInput({
        tags: values.tags ?? [],
        suggestions: tagSuggestions,
    });
    backdrop.querySelector('.la-field-tags').appendChild(tagInput.el);

    // Optional full-width extra (e.g. the Scene's lorebook tabs) below the grid.
    if (extraField) {
        backdrop.querySelector('.la-entity-form-extra').appendChild(extraField);
    }

    // --- Delete (edit mode) ---
    if (onDelete) {
        const del = document.createElement('button');
        del.className = 'la-btn la-btn-danger la-form-delete';
        del.textContent = 'Delete';
        del.addEventListener('click', async () => {
            const label = nameInput ? nameInput.value : (values.name || 'this');
            const ok = await callGenericPopup(
                `Delete “${label}”? This cannot be undone.`,
                POPUP_TYPE.CONFIRM,
            );
            if (ok) { close(); onDelete(); }
        });
        backdrop.querySelector('.la-modal-footer-left').appendChild(del);
    }

    // --- Close / save wiring ---
    function close() {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    backdrop.querySelector('.la-modal-close').addEventListener('click', close);
    backdrop.querySelector('.la-form-cancel').addEventListener('click', close);
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(); });

    backdrop.querySelector('.la-form-save').addEventListener('click', () => {
        // Name comes from the field, or (when hidden) passes through unchanged.
        const name = nameInput ? nameInput.value.trim() : (values.name ?? '');
        if (nameInput && !name) { nameInput.focus(); nameInput.classList.add('la-input-error'); return; }
        onSave({
            name,
            tags: tagInput.getTags(),
            summary: summaryInput.value.trim(),
            color: colorInput ? colorInput.value : (values.color ?? null),
            coverImage,
        });
        close();
    });

    if (nameInput) {
        nameInput.addEventListener('input', () => nameInput.classList.remove('la-input-error'));
    }

    requestAnimationFrame(() => backdrop.classList.add('open'));
    // Focus the name if present, otherwise the tag field, so the form is keyboard-ready.
    (nameInput || backdrop.querySelector('.la-taginput-field'))?.focus();
}

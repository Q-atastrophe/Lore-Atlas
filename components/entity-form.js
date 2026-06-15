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
 * @param {(values: {name:string, tags:string[], summary:string, color:string, coverImage:string|null}) => void} opts.onSave
 * @param {() => void} [opts.onDelete] if provided (edit mode), shows a Delete button.
 */
export function openEntityForm(opts = {}) {
    const {
        mode = 'create',
        heading = mode === 'edit' ? 'Edit' : 'New',
        values = {},
        tagSuggestions = [],
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
            <div class="la-entity-form-body">
                <div class="la-entity-form-image"></div>
                <div class="la-entity-form-fields">
                    <label class="la-field">
                        <span class="la-field-label">Name</span>
                        <input type="text" class="la-input la-field-name" placeholder="World name" />
                    </label>
                    <div class="la-field">
                        <span class="la-field-label">Tags</span>
                        <div class="la-field-tags"></div>
                    </div>
                    <label class="la-field">
                        <span class="la-field-label">Summary</span>
                        <textarea class="la-textarea la-field-summary" placeholder="What is this world?"></textarea>
                    </label>
                    <label class="la-field la-field-color-row">
                        <span class="la-field-label">Color</span>
                        <input type="color" class="la-color la-field-color" />
                    </label>
                </div>
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
        label: 'Upload image',
        onImage: (dataUrl) => { coverImage = dataUrl; },
    });
    backdrop.querySelector('.la-entity-form-image').appendChild(upload.el);

    // --- Fields (right) ---
    const nameInput = backdrop.querySelector('.la-field-name');
    const summaryInput = backdrop.querySelector('.la-field-summary');
    const colorInput = backdrop.querySelector('.la-field-color');
    nameInput.value = values.name ?? '';
    summaryInput.value = values.summary ?? '';
    colorInput.value = values.color ?? '#a07b3a';

    const tagInput = createTagInput({
        tags: values.tags ?? [],
        suggestions: tagSuggestions,
    });
    backdrop.querySelector('.la-field-tags').appendChild(tagInput.el);

    // --- Delete (edit mode) ---
    if (onDelete) {
        const del = document.createElement('button');
        del.className = 'la-btn la-btn-danger la-form-delete';
        del.textContent = 'Delete';
        del.addEventListener('click', async () => {
            const ok = await callGenericPopup(
                `Delete “${nameInput.value || 'this'}”? This cannot be undone.`,
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
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); nameInput.classList.add('la-input-error'); return; }
        onSave({
            name,
            tags: tagInput.getTags(),
            summary: summaryInput.value.trim(),
            color: colorInput.value,
            coverImage,
        });
        close();
    });

    nameInput.addEventListener('input', () => nameInput.classList.remove('la-input-error'));

    requestAnimationFrame(() => backdrop.classList.add('open'));
    nameInput.focus();
}

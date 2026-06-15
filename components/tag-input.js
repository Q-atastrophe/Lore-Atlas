// ============================================================================
// components/tag-input.js — chip-style tag input with autocomplete.
// ----------------------------------------------------------------------------
// A soft chip input used on Worlds / Lorebooks / Scenes / Entries. You type a tag
// and press Enter (or comma) to add it; chips show with a hover × to remove;
// Backspace on an empty field removes the last chip. Existing tags "in scope" are
// offered below the field as clickable suggestion chips (filtered by what you're
// typing) — that's the autocomplete.
//
// Tags are de-duplicated case-insensitively but stored as typed.
// ============================================================================

import { escapeHtml } from '../core/util.js';

/**
 * Creates a tag input.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.tags] initial tags.
 * @param {string[]} [opts.suggestions] existing tags in scope, for autocomplete.
 * @param {string} [opts.placeholder='add tag…']
 * @param {(tags: string[]) => void} [opts.onChange] called whenever tags change.
 * @returns {{ el: HTMLElement, getTags: () => string[], setTags: (t: string[]) => void }}
 */
export function createTagInput(opts = {}) {
    const {
        tags = [],
        suggestions = [],
        placeholder = 'add tag…',
        onChange = () => {},
    } = opts;

    let current = [...tags];

    const el = document.createElement('div');
    el.className = 'la-taginput';
    el.innerHTML = `
        <div class="la-taginput-box">
            <input type="text" class="la-taginput-field" placeholder="${escapeHtml(placeholder)}" />
        </div>
        <div class="la-taginput-suggestions"></div>`;

    const box = el.querySelector('.la-taginput-box');
    const field = el.querySelector('.la-taginput-field');
    const suggestRow = el.querySelector('.la-taginput-suggestions');

    /** True if `tag` is already present (case-insensitive). */
    const has = (tag) => current.some(t => t.toLowerCase() === tag.toLowerCase());

    function emit() { onChange([...current]); }

    function addTag(raw) {
        const tag = raw.trim();
        if (!tag || has(tag)) return;
        current.push(tag);
        render();
        emit();
    }

    function removeTag(tag) {
        current = current.filter(t => t !== tag);
        render();
        emit();
    }

    function renderChips() {
        // Remove existing chips (keep the input as the last child).
        box.querySelectorAll('.la-chip').forEach(c => c.remove());
        for (const tag of current) {
            const chip = document.createElement('span');
            chip.className = 'la-chip la-chip-removable';
            chip.innerHTML = `${escapeHtml(tag)}<span class="la-chip-x" title="Remove">&times;</span>`;
            chip.querySelector('.la-chip-x').addEventListener('click', (e) => {
                e.stopPropagation();
                removeTag(tag);
            });
            box.insertBefore(chip, field);
        }
    }

    function renderSuggestions() {
        const typed = field.value.trim().toLowerCase();
        // Unused suggestions, optionally filtered by what's being typed.
        const available = suggestions
            .filter(s => !has(s))
            .filter(s => !typed || s.toLowerCase().includes(typed));
        suggestRow.innerHTML = '';
        for (const s of available) {
            const chip = document.createElement('span');
            chip.className = 'la-chip la-chip-suggest';
            chip.textContent = s;
            chip.title = 'Add tag';
            chip.addEventListener('click', () => { addTag(s); field.focus(); });
            suggestRow.appendChild(chip);
        }
        suggestRow.classList.toggle('la-empty', available.length === 0);
    }

    function render() {
        renderChips();
        renderSuggestions();
    }

    field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(field.value);
            field.value = '';
            renderSuggestions();
        } else if (e.key === 'Backspace' && field.value === '' && current.length) {
            removeTag(current[current.length - 1]);
        }
    });
    field.addEventListener('input', renderSuggestions);
    // Clicking anywhere in the box focuses the field (chips' × handled separately).
    box.addEventListener('click', () => field.focus());

    render();

    return {
        el,
        getTags: () => [...current],
        setTags: (t) => { current = [...t]; render(); },
    };
}

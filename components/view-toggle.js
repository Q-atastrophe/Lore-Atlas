// ============================================================================
// components/view-toggle.js — the grid/list toggle widget.
// ----------------------------------------------------------------------------
// A small two-button segmented control (grid | list) shown at the top-right of a
// view's header. Reusable across Worlds / Lorebooks / Entries; the caller wires
// onChange to persist the preference and re-render.
// ============================================================================

/**
 * Creates a grid/list toggle.
 *
 * @param {object} opts
 * @param {'grid'|'list'} [opts.value='grid'] the initially-selected mode.
 * @param {(mode: 'grid'|'list') => void} [opts.onChange] called when the mode changes.
 * @returns {{ el: HTMLElement, setValue: (mode: 'grid'|'list') => void }}
 */
export function createViewToggle(opts = {}) {
    const { value = 'grid', onChange = () => {} } = opts;
    let mode = value;

    const el = document.createElement('div');
    el.className = 'la-view-toggle';
    el.setAttribute('role', 'group');
    el.innerHTML = `
        <button class="la-view-toggle-btn" data-mode="grid" title="Grid view" aria-label="Grid view">
            <i class="fa-solid fa-table-cells-large"></i>
        </button>
        <button class="la-view-toggle-btn" data-mode="list" title="List view" aria-label="List view">
            <i class="fa-solid fa-list"></i>
        </button>`;

    function reflect() {
        for (const btn of el.querySelectorAll('.la-view-toggle-btn')) {
            btn.classList.toggle('la-active', btn.dataset.mode === mode);
        }
    }

    el.querySelectorAll('.la-view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const next = btn.dataset.mode;
            if (next === mode) return;
            mode = next;
            reflect();
            onChange(mode);
        });
    });

    reflect();
    return {
        el,
        setValue(next) { mode = next; reflect(); },
    };
}

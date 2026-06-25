// ============================================================================
// components/view-toggle.js — the grid/list toggle widget.
// ----------------------------------------------------------------------------
// A single icon button at the top-right of a view's header. It shows the CURRENT
// mode's icon and flips grid<->list on each click, highlighting (accent) while in
// list mode. Reusable across Worlds / Lorebooks / Scenes / Entries; the caller
// wires onChange to persist the preference and re-render.
// ============================================================================

/**
 * Creates a grid/list toggle (one button that flips between the two).
 *
 * @param {object} opts
 * @param {'grid'|'list'} [opts.value='grid'] the initially-selected mode.
 * @param {(mode: 'grid'|'list') => void} [opts.onChange] called when the mode changes.
 * @returns {{ el: HTMLElement, setValue: (mode: 'grid'|'list') => void }}
 */
export function createViewToggle(opts = {}) {
    const { value = 'grid', onChange = () => {} } = opts;
    let mode = value;

    const el = document.createElement('button');
    el.className = 'la-view-toggle';
    el.setAttribute('aria-label', 'Toggle grid or list view');

    function reflect() {
        // Show the current mode's icon; highlight while in list mode.
        el.innerHTML = mode === 'grid'
            ? '<i class="fa-solid fa-table-cells-large"></i>'
            : '<i class="fa-solid fa-list"></i>';
        el.title = mode === 'grid' ? 'Grid view — tap for list' : 'List view — tap for grid';
        el.classList.toggle('la-active', mode === 'list');
        el.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
    }

    el.addEventListener('click', () => {
        mode = mode === 'grid' ? 'list' : 'grid';
        reflect();
        onChange(mode);
    });

    reflect();
    return {
        el,
        setValue(next) { mode = next; reflect(); },
    };
}

// ============================================================================
// components/context-menu.js — a small reusable right-click menu.
// ----------------------------------------------------------------------------
// Opens a floating menu at a point, clamped to the viewport. Closes on outside
// click or Escape. Items are { label, icon, danger?, action }.
// ============================================================================

import { escapeHtml } from '../core/util.js';

let menuEl = null;

function close() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
}
function onOutside(e) { if (menuEl && !menuEl.contains(e.target)) close(); }
function onKey(e) { if (e.key === 'Escape') close(); }

/**
 * Opens a context menu at (x, y).
 * @param {number} x
 * @param {number} y
 * @param {Array<{label:string, icon?:string, danger?:boolean, action:()=>void}>} items
 */
export function openContextMenu(x, y, items) {
    close();
    menuEl = document.createElement('div');
    menuEl.className = 'la-context-menu';
    for (const it of items) {
        const el = document.createElement('div');
        el.className = 'la-context-menu-item' + (it.danger ? ' la-danger' : '');
        el.innerHTML = `<i class="fa-solid ${escapeHtml(it.icon || 'fa-circle')}"></i><span>${escapeHtml(it.label)}</span>`;
        el.addEventListener('click', () => { close(); it.action(); });
        menuEl.appendChild(el);
    }
    document.body.appendChild(menuEl);
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    menuEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
}

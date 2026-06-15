// ============================================================================
// components/launcher.js — the floating, draggable Atlas launcher.
// ----------------------------------------------------------------------------
// Lives OUTSIDE SillyTavern's extensions menu: it floats over chat, is draggable,
// and its position + collapsed/expanded choice persist across reloads.
//
// Two states:
//   - Collapsed  : a ~44px glass circle (atlas icon + a dot tinted to the active
//                  World's color). Left-click opens the panel.
//   - Expanded   : a ~280px glass pill showing the active state text
//                  (World name / "Custom" / "None"), a quick-switch chevron, and a
//                  collapse button. Left-click (on the body) opens the panel.
//
// Right-click (either state) opens a small context menu: Open Atlas, Quick switch,
// Expand/Collapse. The quick-switch dropdown lists the Worlds; clicking one
// activates it. The display refreshes itself on Atlas activation and whenever ST's
// world-info selection changes (so a manual toggle shows as "Custom").
//
// Click vs. drag: a press that barely moves is a click; a real drag repositions and
// is not treated as a click.
// ============================================================================

import { openPanel } from '../views/panel.js';
import {
    getLauncherPosition, setLauncherPosition,
    getLauncherCollapsed, setLauncherCollapsed,
} from '../core/storage.js';
import { getContext } from '../../../../extensions.js';
import {
    computeLauncherDisplay, getQuickSwitchWorlds, requestActivateWorld,
    LORE_ATLAS_ACTIVATED,
} from '../core/activation.js';
import { escapeHtml } from '../core/util.js';

const LAUNCHER_ID = 'lore-atlas-launcher';
const DRAG_THRESHOLD = 4;     // px of travel below which a press is a click
const EDGE_MARGIN = 20;       // default placement inset from the viewport edge

let launcherEl = null;        // the live launcher element
let dropdownEl = null;        // the open quick-switch dropdown (null when closed)
let menuEl = null;            // the open context menu (null when closed)

// ---- Position ----

function clampToViewport(x, y) {
    const rect = launcherEl.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);
    return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
}

function applyPosition(x, y) {
    launcherEl.style.left = `${x}px`;
    launcherEl.style.top = `${y}px`;
}

function defaultPosition() {
    const rect = launcherEl.getBoundingClientRect();
    return { x: window.innerWidth - rect.width - EDGE_MARGIN, y: EDGE_MARGIN };
}

/** Re-clamps the current position (after a resize / collapse-expand width change). */
function reclamp() {
    const rect = launcherEl.getBoundingClientRect();
    const { x, y } = clampToViewport(rect.left, rect.top);
    applyPosition(x, y);
}

// ---- Build / render ----

/**
 * (Re)builds the launcher's inner markup for the current collapsed/expanded state
 * and fills in the active display. Re-wires the inner buttons each time.
 */
function render() {
    closeDropdown();
    closeMenu();
    const collapsed = getLauncherCollapsed();
    const display = computeLauncherDisplay();
    launcherEl.className = 'la-launcher ' + (collapsed ? 'la-launcher-collapsed' : 'la-launcher-expanded');
    launcherEl.title = collapsed ? `Lore Atlas — ${display.text}` : '';

    const dotColor = display.color || 'var(--la-accent)';

    if (collapsed) {
        launcherEl.innerHTML = `
            <i class="fa-solid fa-book-atlas la-launcher-glyph"></i>
            <span class="la-launcher-dot"></span>`;
        launcherEl.querySelector('.la-launcher-dot').style.background = dotColor;
    } else {
        launcherEl.innerHTML = `
            <i class="fa-solid fa-book-atlas la-launcher-glyph"></i>
            <span class="la-launcher-dot la-launcher-dot-inline"></span>
            <span class="la-launcher-state">
                <span class="la-launcher-world la-entity-name">${escapeHtml(display.text)}</span>
            </span>
            <button class="la-launcher-btn la-launcher-chevron" title="Quick switch"><i class="fa-solid fa-chevron-down"></i></button>
            <button class="la-launcher-btn la-launcher-collapse" title="Collapse"><i class="fa-solid fa-xmark"></i></button>`;
        launcherEl.querySelector('.la-launcher-dot').style.background = dotColor;
        launcherEl.classList.toggle('la-launcher-state-custom', display.state === 'custom');
        launcherEl.classList.toggle('la-launcher-state-empty', display.state === 'empty');

        launcherEl.querySelector('.la-launcher-chevron').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
        launcherEl.querySelector('.la-launcher-collapse').addEventListener('click', (e) => {
            e.stopPropagation();
            setCollapsed(true);
        });
    }

    reclamp();
}

/** Updates just the active display (cheap) without a full rebuild when possible. */
export function refreshLauncher() {
    if (!launcherEl) return;
    // A rebuild is simplest and keeps the dot/state classes correct.
    render();
}

// ---- Collapse / expand ----

function setCollapsed(collapsed) {
    setLauncherCollapsed(collapsed);
    render();
}

// ---- Drag + click ----

function setupDragAndClick() {
    let pointerDown = false;
    let moved = false;
    let startX = 0, startY = 0, originX = 0, originY = 0;

    launcherEl.addEventListener('pointerdown', (e) => {
        // Let inner buttons handle their own clicks; don't start a drag from them.
        if (e.target.closest('.la-launcher-btn')) return;
        closeDropdown();
        closeMenu();
        pointerDown = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = launcherEl.getBoundingClientRect();
        originX = rect.left;
        originY = rect.top;
        try { launcherEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });

    launcherEl.addEventListener('pointermove', (e) => {
        if (!pointerDown) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        launcherEl.classList.add('la-launcher-dragging');
        const { x, y } = clampToViewport(originX + dx, originY + dy);
        applyPosition(x, y);
    });

    const endPress = (e) => {
        if (!pointerDown) return;
        pointerDown = false;
        try { launcherEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (moved) {
            launcherEl.classList.remove('la-launcher-dragging');
            const rect = launcherEl.getBoundingClientRect();
            setLauncherPosition({ x: Math.round(rect.left), y: Math.round(rect.top) });
        } else {
            // A click on the launcher body opens the panel (both states).
            openPanel();
        }
    };
    launcherEl.addEventListener('pointerup', endPress);
    launcherEl.addEventListener('pointercancel', (e) => { moved = true; endPress(e); });

    // Right-click context menu.
    launcherEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openMenu(e.clientX, e.clientY);
    });
}

// ---- Quick-switch dropdown ----

function closeDropdown() {
    if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
    document.removeEventListener('pointerdown', onOutsideDropdown, true);
    document.removeEventListener('keydown', onDropdownKey, true);
    launcherEl?.querySelector('.la-launcher-chevron')?.classList.remove('la-open');
}

function onOutsideDropdown(e) {
    if (!dropdownEl) return;
    if (dropdownEl.contains(e.target) || e.target.closest('.la-launcher-chevron')) return;
    closeDropdown();
}
function onDropdownKey(e) { if (e.key === 'Escape') closeDropdown(); }

function openDropdown() {
    closeDropdown();
    const worlds = getQuickSwitchWorlds();
    dropdownEl = document.createElement('div');
    dropdownEl.className = 'la-launcher-dropdown';
    if (worlds.length === 0) {
        dropdownEl.innerHTML = '<div class="la-launcher-dropdown-empty">No Worlds yet</div>';
    } else {
        dropdownEl.innerHTML = `<div class="la-launcher-dropdown-label">Worlds</div>`;
        for (const w of worlds) {
            const item = document.createElement('div');
            item.className = 'la-launcher-dropdown-item' + (w.active ? ' la-active' : '');
            item.innerHTML = `
                <span class="la-launcher-swatch" style="background:${escapeHtml(w.color)}"></span>
                <span class="la-launcher-dropdown-name la-entity-name">${escapeHtml(w.name)}</span>
                ${w.active ? '<i class="fa-solid fa-circle-check la-launcher-active-mark"></i>' : ''}`;
            item.addEventListener('click', () => {
                closeDropdown();
                requestActivateWorld(w.id);   // refresh comes via the activation event
            });
            dropdownEl.appendChild(item);
        }
    }
    positionPopover(dropdownEl);
    launcherEl.querySelector('.la-launcher-chevron')?.classList.add('la-open');
    document.addEventListener('pointerdown', onOutsideDropdown, true);
    document.addEventListener('keydown', onDropdownKey, true);
}

function toggleDropdown() {
    if (dropdownEl) closeDropdown();
    else openDropdown();
}

// ---- Context menu ----

function closeMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    document.removeEventListener('pointerdown', onOutsideMenu, true);
    document.removeEventListener('keydown', onMenuKey, true);
}
function onOutsideMenu(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }
function onMenuKey(e) { if (e.key === 'Escape') closeMenu(); }

function openMenu(x, y) {
    closeMenu();
    closeDropdown();
    const collapsed = getLauncherCollapsed();
    menuEl = document.createElement('div');
    menuEl.className = 'la-context-menu';
    const items = [
        { label: 'Open Atlas', icon: 'fa-book-atlas', action: () => openPanel() },
        { label: 'Quick switch', icon: 'fa-chevron-down', action: () => { if (collapsed) setCollapsed(false); openDropdown(); } },
        collapsed
            ? { label: 'Expand bar', icon: 'fa-up-right-and-down-left-from-center', action: () => setCollapsed(false) }
            : { label: 'Collapse', icon: 'fa-down-left-and-up-right-to-center', action: () => setCollapsed(true) },
    ];
    for (const it of items) {
        const el = document.createElement('div');
        el.className = 'la-context-menu-item';
        el.innerHTML = `<i class="fa-solid ${it.icon}"></i><span>${escapeHtml(it.label)}</span>`;
        el.addEventListener('click', () => { closeMenu(); it.action(); });
        menuEl.appendChild(el);
    }
    document.body.appendChild(menuEl);
    // Place at the cursor, clamped to the viewport.
    const r = menuEl.getBoundingClientRect();
    const px = Math.min(x, window.innerWidth - r.width - 8);
    const py = Math.min(y, window.innerHeight - r.height - 8);
    menuEl.style.left = `${Math.max(8, px)}px`;
    menuEl.style.top = `${Math.max(8, py)}px`;
    document.addEventListener('pointerdown', onOutsideMenu, true);
    document.addEventListener('keydown', onMenuKey, true);
}

/** Positions a popover (dropdown) below the launcher, clamped to the viewport. */
function positionPopover(el) {
    document.body.appendChild(el);
    const lr = launcherEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let left = lr.right - r.width;                 // right-align to the launcher
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    let top = lr.bottom + 6;
    if (top + r.height > window.innerHeight - 8) {  // not enough room below -> above
        top = Math.max(8, lr.top - r.height - 6);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
}

// ---- Mount / teardown ----

/**
 * Builds the launcher, restores its position + collapsed state, wires interaction,
 * and subscribes to events that change the active display. Call once at startup.
 */
export function mountLauncher() {
    removeLauncher();

    launcherEl = document.createElement('div');
    launcherEl.id = LAUNCHER_ID;
    document.body.appendChild(launcherEl);

    render();   // builds markup for the saved collapsed/expanded state

    // Restore saved position (clamped) or default to the top-right.
    const saved = getLauncherPosition();
    const base = saved ?? defaultPosition();
    const { x, y } = clampToViewport(base.x, base.y);
    applyPosition(x, y);

    setupDragAndClick();

    // Keep the active display honest: our own activation, plus lorebooks toggled
    // directly in ST's World Info (-> "Custom") and chat switches.
    const ctx = getContext();
    const eventSource = ctx?.eventSource;
    const eventTypes = ctx?.eventTypes;
    eventSource?.on?.(LORE_ATLAS_ACTIVATED, refreshLauncher);
    if (eventTypes?.WORLDINFO_SETTINGS_UPDATED) eventSource?.on?.(eventTypes.WORLDINFO_SETTINGS_UPDATED, refreshLauncher);
    if (eventTypes?.CHAT_CHANGED) eventSource?.on?.(eventTypes.CHAT_CHANGED, refreshLauncher);
}

/** Removes the launcher and any open popovers (cleanup / re-init). */
export function removeLauncher() {
    closeDropdown();
    closeMenu();
    const existing = document.getElementById(LAUNCHER_ID);
    if (existing) existing.remove();
    launcherEl = null;
}

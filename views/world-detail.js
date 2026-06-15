// ============================================================================
// views/world-detail.js — a single World's detail page.
// ----------------------------------------------------------------------------
// Drilled into from a World card. Opens with the tall hero banner (this World's
// cover), a breadcrumb back to Worlds, then two sections: the World's Lorebooks
// and its Scenes. In Phase 6 both sections are read-only placeholders with
// composed empty states — lorebook assignment lands in Phase 7 and Scenes in
// Phase 10, which fill these sections in.
// ============================================================================

import { getWorldById, getCover } from '../core/storage.js';
import { navigateRoot } from '../core/navigation.js';
import { createHeroBanner } from '../components/hero-banner.js';
import { escapeHtml } from '../core/util.js';

/**
 * Builds a titled section with an action slot and a body (defaults to an empty
 * state). Sections are reused for Lorebooks and Scenes.
 *
 * @param {object} opts
 * @param {string} opts.title section title.
 * @param {string} [opts.emptyText] composed empty-state line.
 * @param {string} [opts.emptyIcon] Font Awesome icon name for the empty state.
 * @returns {HTMLElement}
 */
function buildSection({ title, emptyText = '', emptyIcon = 'fa-book' }) {
    const section = document.createElement('div');
    section.className = 'la-section';
    section.innerHTML = `
        <div class="la-section-header">
            <div class="la-section-title">${escapeHtml(title)}</div>
            <div class="la-section-actions"></div>
        </div>
        <div class="la-section-body">
            <div class="la-empty la-empty-section">
                <i class="fa-solid ${escapeHtml(emptyIcon)} la-empty-icon"></i>
                <div class="la-empty-text">${escapeHtml(emptyText)}</div>
            </div>
        </div>`;
    return section;
}

/**
 * Renders the World detail view into the panel body.
 * @param {HTMLElement} container the panel body.
 * @param {string} worldId
 */
export function renderWorldDetail(container, worldId) {
    const world = getWorldById(worldId);

    // The whole detail page scrolls inside this wrapper (the panel's × and the
    // shell back button stay put). Matches the Worlds view's scroll structure.
    const scroll = document.createElement('div');
    scroll.className = 'la-view-scroll';
    container.appendChild(scroll);

    // Guard: the World may have been deleted (e.g. from another view) — show a
    // composed "gone" state with a way back rather than a broken page.
    if (!world) {
        const gone = document.createElement('div');
        gone.className = 'la-empty';
        gone.innerHTML = `
            <i class="fa-solid fa-circle-question la-empty-icon"></i>
            <div class="la-empty-text">This World no longer exists.</div>
            <button class="la-btn la-btn-secondary la-back-to-worlds">Back to Worlds</button>`;
        gone.querySelector('.la-back-to-worlds').addEventListener('click', navigateRoot);
        scroll.appendChild(gone);
        return;
    }

    // Tall hero with the World's cover (falls back to its color gradient), and a
    // clickable "Worlds" breadcrumb back to the root.
    scroll.appendChild(createHeroBanner({
        coverImage: getCover('worlds', world.id),
        color: world.color,
        title: world.name,
        subtitle: world.summary,
        breadcrumb: ['Worlds', world.name],
        onBreadcrumbClick: (index) => { if (index === 0) navigateRoot(); },
        tags: world.tags,
        height: 'tall',
    }));

    // Sections (placeholders in Phase 6).
    scroll.appendChild(buildSection({
        title: 'Lorebooks',
        emptyText: 'No lorebooks in this World yet.',
        emptyIcon: 'fa-book',
    }));
    scroll.appendChild(buildSection({
        title: 'Scenes',
        emptyText: 'No scenes yet.',
        emptyIcon: 'fa-masks-theater',
    }));
}

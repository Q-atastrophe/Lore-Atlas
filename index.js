/* ============================================================================
   LORE ATLAS — entry point
   ----------------------------------------------------------------------------
   A visual lore-management surface for SillyTavern: Worlds, Scenes, Lorebooks,
   and Entries, with a card-based UI and a floating launcher.

   How SillyTavern loads this file
   -------------------------------
   manifest.json declares `"js": "index.js"` and `"hooks": { "activate": "init" }`.
   On startup, SillyTavern injects this module, then calls the exported `init()`
   function below (see activateExtensions() in public/scripts/extensions.js).
   So `init()` is our single, reliable "the app is ready, start here" entry point.

   This file grows over the phased build (see lore_atlas_v1.3_spec.md). For now
   (Phase 1) it does the bare minimum: announce that it loaded.
   ============================================================================ */

// Folder name as SillyTavern sees it (used later for template/asset paths).
// NOTE: the folder contains a space; SillyTavern URL-encodes it when fetching,
// so the literal name with a space is correct here.
const EXTENSION_NAME = 'Lore Atlas';

/**
 * Entry point. Called by SillyTavern once the extension is activated.
 * Subsequent phases mount the floating launcher and panel from here.
 */
export function init() {
    console.log('Lore Atlas loaded.');
}

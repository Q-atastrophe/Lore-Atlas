// ============================================================================
// components/image-upload.js — the universal image upload area.
// ----------------------------------------------------------------------------
// One reusable component used everywhere Atlas takes an image: World/Lorebook/
// Scene covers and entry images. It handles the whole pipeline described in the
// spec (section 5):
//
//   1. Click the area  -> browser file picker.
//   2. Drag an image from the desktop onto the area -> dropped file.
//   3. Read via the File API.
//   4. If the file is over ~1MB, auto-compress: resize the longest edge to 800px
//      and re-encode as JPEG (quality 0.85), stepping quality down if needed so
//      the result lands under the cap. Small files are kept as-is (so a crisp PNG
//      with transparency isn't needlessly flattened to JPEG).
//   5. The base64 data URL is handed back via onImage(); the caller decides where
//      to store it (e.g. storage.setCover).
//   6. Displayed via an <img> with object-fit: cover.
//
// The component is purely about producing a data URL. It never touches storage
// itself — that keeps it reusable across every entity type.
// ============================================================================

// Files at or below this size are kept as-is; larger ones get compressed.
const COMPRESS_OVER_BYTES = 1024 * 1024;     // 1 MB
// Longest-edge target when resizing during compression.
const MAX_EDGE = 800;
// Hard ceiling we try to keep compressed output under.
const TARGET_MAX_BYTES = 1024 * 1024;        // 1 MB
// JPEG qualities to try, in order, until the output fits under the ceiling.
const QUALITY_STEPS = [0.85, 0.7, 0.55];

/**
 * Rough byte size of a base64 data URL (4 base64 chars ≈ 3 bytes).
 * @param {string} dataUrl
 * @returns {number}
 */
function dataUrlBytes(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return Math.ceil(b64.length * 0.75);
}

/** Reads a File as a base64 data URL (no resize / re-encode). */
function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

/** Loads a data URL into an HTMLImageElement (so we can draw it to a canvas). */
function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode image'));
        img.src = dataUrl;
    });
}

/**
 * Resizes (longest edge -> MAX_EDGE if larger) and re-encodes an image as JPEG,
 * stepping quality down until it fits under TARGET_MAX_BYTES. Returns the best
 * (smallest acceptable, or smallest tried) data URL.
 *
 * @param {string} sourceDataUrl
 * @returns {Promise<string>}
 */
async function compress(sourceDataUrl) {
    const img = await loadImage(sourceDataUrl);

    // Scale so the longest edge is at most MAX_EDGE; never upscale.
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Try decreasing qualities; return the first that fits, else the smallest.
    let best = null;
    for (const q of QUALITY_STEPS) {
        const out = canvas.toDataURL('image/jpeg', q);
        if (!best || dataUrlBytes(out) < dataUrlBytes(best)) best = out;
        if (dataUrlBytes(out) <= TARGET_MAX_BYTES) return out;
    }
    return best;
}

/**
 * Turns a picked/dropped File into a storage-ready base64 data URL, compressing
 * only when needed. Rejects non-image files.
 *
 * @param {File} file
 * @returns {Promise<string>} the data URL.
 */
export async function fileToDataUrl(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
        throw new Error('Please choose an image file.');
    }
    const raw = await readAsDataUrl(file);
    if (file.size <= COMPRESS_OVER_BYTES) {
        return raw;     // small enough — keep original (preserves PNG transparency)
    }
    return compress(raw);
}

/**
 * Creates an image upload area.
 *
 * @param {object} [options]
 * @param {string|null} [options.initialImage] data URL to show initially.
 * @param {(dataUrl: string) => void} [options.onImage] called with the new data URL
 *        after a successful pick/drop (and compression).
 * @param {(err: Error) => void} [options.onError] called if reading/compression fails.
 * @param {'portrait'|'square'} [options.shape='portrait'] aspect of the area.
 * @param {string} [options.label='Upload image'] placeholder label when empty.
 * @returns {{ el: HTMLElement, setImage: (dataUrl: string|null) => void, getImage: () => string|null }}
 */
export function createImageUpload(options = {}) {
    const {
        initialImage = null,
        onImage = () => {},
        onError = (err) => {
            if (typeof toastr !== 'undefined') toastr.error(err.message, 'Lore Atlas');
            else console.warn('[Lore Atlas]', err.message);
        },
        shape = 'portrait',
        label = 'Upload image',
    } = options;

    let current = initialImage;

    const el = document.createElement('div');
    el.className = `la-upload la-upload-${shape}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.title = 'Click to choose an image, or drag one here';

    // Hidden native file input drives the click-to-pick path.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    el.appendChild(input);

    // Rendered content (image or empty placeholder) is rebuilt by render().
    const content = document.createElement('div');
    content.className = 'la-upload-content';
    el.appendChild(content);

    function render() {
        if (current) {
            content.innerHTML = `
                <img class="la-upload-img" alt="" />
                <div class="la-upload-overlay"><i class="fa-solid fa-arrows-rotate"></i><span>Replace</span></div>`;
            content.querySelector('.la-upload-img').src = current;
        } else {
            content.innerHTML = `
                <div class="la-upload-empty">
                    <i class="fa-solid fa-plus la-upload-plus"></i>
                    <span class="la-upload-label">${label}</span>
                </div>`;
        }
    }

    async function handleFile(file) {
        try {
            const dataUrl = await fileToDataUrl(file);
            current = dataUrl;
            render();
            onImage(dataUrl);
        } catch (err) {
            onError(err instanceof Error ? err : new Error(String(err)));
        }
    }

    // --- Click to pick ---
    el.addEventListener('click', () => input.click());
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (file) handleFile(file);
        input.value = '';   // allow re-picking the same file later
    });

    // --- Drag from desktop ---
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.classList.add('la-upload-dragover');
    });
    el.addEventListener('dragleave', (e) => {
        // Only clear when actually leaving the area (not when moving over a child).
        if (e.target === el || !el.contains(e.relatedTarget)) {
            el.classList.remove('la-upload-dragover');
        }
    });
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('la-upload-dragover');
        const file = e.dataTransfer?.files && e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    render();

    return {
        el,
        setImage(dataUrl) { current = dataUrl || null; render(); },
        getImage() { return current; },
    };
}

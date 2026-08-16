// =========================================================
// UTILITIES
// =========================================================
// Small generic helpers with no state of their own, used by several other
// files. Load before anything that calls them (brand-picker.js,
// color-picker.js, color-images.js, variants.js, specifications.js,
// product-form.js).

// Escapes a string before it's interpolated into innerHTML. Color names are
// currently drawn from a fixed set of option boxes, but uploaded file names
// and any future free-text field (custom spec names, etc.) are fully
// user-controlled - a crafted filename like `<img src=x onerror=...>` would
// otherwise execute when rendered.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Small helper for a unique-enough client-side id. Only used to key DOM
// buttons back to the right image object - never sent to the server.
function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

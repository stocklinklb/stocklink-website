// =========================================================
// SEARCHABLE COLOR PICKER
// =========================================================
// FEATURE: colors used to be 3 hardcoded option-boxes (Black, White, Blue),
// so nothing outside that fixed set could ever be added as a variant color.
// This replaces them with a search-as-you-type picker backed by a starter
// palette (with hex values, used for the chip/table swatch dots), plus the
// ability to add any typed name that isn't in the palette as a custom
// color (its dot just falls back to a neutral gray, since there's no hex
// to draw from). #color-options now holds dynamically rendered chips
// instead of static markup.
//
// Depends on: state.js (selectedOptions), dom.js (colorSearchInput,
// colorSearchDropdown, colorChipsContainer), utils.js (escapeHtml).
// generateVariants() and renderColorImageUpload() are called here but
// defined in variants.js / color-images.js - fine since they only run
// later, at event time, once every script has loaded.

const COLOR_LIST = [
  { name: "Black", hex: "#111827" },
  { name: "White", hex: "#e5e7eb" },
  { name: "Silver", hex: "#c0c0c0" },
  { name: "Space Gray", hex: "#4b4b4d" },
  { name: "Graphite", hex: "#41424c" },
  { name: "Gold", hex: "#d4af37" },
  { name: "Rose Gold", hex: "#b76e79" },
  { name: "Midnight", hex: "#1c1c28" },
  { name: "Starlight", hex: "#e6e2d8" },
  { name: "Titanium", hex: "#8a8d8f" },
  { name: "Natural Titanium", hex: "#8a8577" },
  { name: "Desert Titanium", hex: "#ab9d8a" },
  { name: "Sierra Blue", hex: "#9bb5ce" },
  { name: "Alpine Green", hex: "#5b6f5a" },
  { name: "Blue", hex: "#2f6fed" },
  { name: "Navy", hex: "#1e293b" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Green", hex: "#2fed3f" },
  { name: "Mint", hex: "#a7f3d0" },
  { name: "Red", hex: "#dc2626" },
  { name: "Coral", hex: "#ff7f6b" },
  { name: "Orange", hex: "#f97316" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Purple", hex: "#7e22ce" },
  { name: "Lavender", hex: "#c4b5fd" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Cream", hex: "#fdf6e3" },
];

// Looks up a hex value for a color name (case-insensitive). Falls back to
// a neutral gray for custom colors typed in that aren't in COLOR_LIST -
// there's no hex to draw from for those, so the dot is just a placeholder.
function getColorHex(name) {
  const match = COLOR_LIST.find(
    (c) => c.name.toLowerCase() === String(name).toLowerCase(),
  );
  return match ? match.hex : "#9ca3af";
}

function renderColorChips() {
  if (!colorChipsContainer) return;

  colorChipsContainer.innerHTML = selectedOptions.colors
    .map((color) => {
      const hex = getColorHex(color.name);
      return `
        <div class="color-chip" data-color-chip="${escapeHtml(color.name)}">
          <span class="color-chip-dot" style="background:${hex}"></span>
          ${escapeHtml(color.name)}
          <button
            type="button"
            class="color-chip-remove"
            data-color="${escapeHtml(color.name)}"
            aria-label="Remove ${escapeHtml(color.name)}"
          >&times;</button>
        </div>
      `;
    })
    .join("");
}

function closeColorDropdown() {
  if (!colorSearchDropdown) return;
  colorSearchDropdown.classList.remove("open");
  colorSearchDropdown.innerHTML = "";
}

let colorActiveIndex = -1;

function getColorDropdownItems() {
  return Array.from(
    colorSearchDropdown.querySelectorAll(".color-dropdown-item"),
  );
}

function setColorActiveIndex(index) {
  const items = getColorDropdownItems();
  if (!items.length) {
    colorActiveIndex = -1;
    return;
  }

  // Wrap around in both directions so ArrowDown off the last item goes back
  // to the top, and ArrowUp off the first goes to the bottom - standard
  // combobox behavior.
  colorActiveIndex = ((index % items.length) + items.length) % items.length;

  items.forEach((item, i) => {
    item.classList.toggle("active", i === colorActiveIndex);
  });

  items[colorActiveIndex].scrollIntoView({ block: "nearest" });
}

function renderColorDropdown(query) {
  if (!colorSearchDropdown) return;

  colorActiveIndex = -1;

  const trimmedQuery = query.trim();
  const q = trimmedQuery.toLowerCase();

  const alreadySelected = (name) =>
    selectedOptions.colors.some(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );

  const matches = COLOR_LIST.filter(
    (c) => c.name.toLowerCase().includes(q) && !alreadySelected(c.name),
  ).slice(0, 8);

  let html = matches
    .map(
      (c) => `
        <div class="color-dropdown-item" data-color-name="${escapeHtml(c.name)}">
          <span class="color-dot-preview" style="background:${c.hex}"></span>
          ${escapeHtml(c.name)}
        </div>
      `,
    )
    .join("");

  // Offer "add as new color" whenever what's typed doesn't exactly match
  // an existing palette entry or an already-selected color - lets the
  // admin add a color that isn't in the built-in list at all.
  const exactMatch =
    COLOR_LIST.some((c) => c.name.toLowerCase() === q) ||
    alreadySelected(trimmedQuery);

  if (trimmedQuery && !exactMatch) {
    html += `
      <div class="color-dropdown-item color-dropdown-add" data-add-custom="${escapeHtml(trimmedQuery)}">
        + Add "${escapeHtml(trimmedQuery)}"
      </div>
    `;
  }

  if (!html) {
    html = `<div class="color-dropdown-empty">No colors found</div>`;
  }

  colorSearchDropdown.innerHTML = html;
  colorSearchDropdown.classList.add("open");
}

function addColor(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return;

  const alreadySelected = selectedOptions.colors.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (alreadySelected) return;

  selectedOptions.colors.push({ id: null, name: trimmed });

  renderColorChips();
  generateVariants();
  renderColorImageUpload(selectedOptions.colors);

  if (colorSearchInput) colorSearchInput.value = "";
  closeColorDropdown();
}

function removeColor(name) {
  selectedOptions.colors = selectedOptions.colors.filter(
    (c) => c.name.toLowerCase() !== String(name).toLowerCase(),
  );

  renderColorChips();
  generateVariants();
  renderColorImageUpload(selectedOptions.colors);
}

if (colorSearchInput) {
  colorSearchInput.addEventListener("input", () => {
    renderColorDropdown(colorSearchInput.value);
  });

  colorSearchInput.addEventListener("focus", () => {
    renderColorDropdown(colorSearchInput.value);
  });

  colorSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      // Only meaningful once there's a list to move through - and if the
      // dropdown isn't open yet (e.g. arrowing down before typing), open it
      // first rather than doing nothing.
      e.preventDefault();

      if (!colorSearchDropdown.classList.contains("open")) {
        renderColorDropdown(colorSearchInput.value);
      }

      setColorActiveIndex(colorActiveIndex + 1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();

      if (!colorSearchDropdown.classList.contains("open")) {
        renderColorDropdown(colorSearchInput.value);
      }

      setColorActiveIndex(colorActiveIndex === -1 ? -1 : colorActiveIndex - 1);
      return;
    }

    if (e.key === "Enter") {
      // Prevent an Enter press here from bubbling up and submitting/
      // triggering anything else on the page (there's no <form>, but
      // this keeps behavior predictable if one is ever added).
      e.preventDefault();

      // Prefer whatever the arrow keys highlighted; fall back to the first
      // item (previous behavior) when nothing's been highlighted yet.
      const items = getColorDropdownItems();
      const targetItem =
        colorActiveIndex !== -1 ? items[colorActiveIndex] : items[0];

      if (targetItem?.dataset.addCustom) {
        addColor(targetItem.dataset.addCustom);
      } else if (targetItem?.dataset.colorName) {
        addColor(targetItem.dataset.colorName);
      } else if (colorSearchInput.value.trim()) {
        addColor(colorSearchInput.value);
      }
    }

    if (e.key === "Escape") {
      closeColorDropdown();
    }
  });
}

document.addEventListener("click", (e) => {
  const dropdownItem = e.target.closest(".color-dropdown-item");
  if (dropdownItem) {
    if (dropdownItem.dataset.addCustom) {
      addColor(dropdownItem.dataset.addCustom);
    } else if (dropdownItem.dataset.colorName) {
      addColor(dropdownItem.dataset.colorName);
    }
    return;
  }

  const removeBtn = e.target.closest(".color-chip-remove");
  if (removeBtn) {
    removeColor(removeBtn.dataset.color);
    return;
  }

  // Click-away closes the dropdown.
  if (!e.target.closest("#color-picker")) {
    closeColorDropdown();
  }
});

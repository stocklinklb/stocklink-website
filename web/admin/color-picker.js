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

  // --- Added from spreadsheet (Samsung/Tecno/Infinix/Honor/Xiaomi) ---
  { name: "Amalfi Blue", hex: "#4a7fb5" },
  { name: "Aurora Purple", hex: "#8b5fbf" },
  { name: "Black Abyss", hex: "#0a0a0c" },
  { name: "Bloom Pink", hex: "#f4a6c1" },
  { name: "Charcoal", hex: "#36454f" },
  { name: "Cloud White", hex: "#f5f5f0" },
  { name: "Cloudline Blue", hex: "#a8c5e0" },
  { name: "Cobalt Violet", hex: "#5b4b8a" },
  { name: "Coral Green", hex: "#6fae8a" },
  { name: "Cyan", hex: "#22d3ee" },
  { name: "Cypress Green", hex: "#4a6b52" },
  { name: "Deep Ocean Blue", hex: "#1c4966" },
  { name: "Desert Gold", hex: "#c9a35d" },
  { name: "Dive Blue", hex: "#1e5f8c" },
  { name: "Dusk Purple", hex: "#6b5b7d" },
  { name: "Dynamic Orange", hex: "#ff6b1a" },
  { name: "Ethereal Blue", hex: "#a3c9e8" },
  { name: "Fir Green", hex: "#2e4d3a" },
  { name: "Fizz Blue", hex: "#5ec8e0" },
  { name: "Forest Green", hex: "#228b22" },
  { name: "Frost Silver", hex: "#d6d9dc" },
  { name: "Frosted White", hex: "#eef0ee" },
  { name: "Galaxy Blue", hex: "#2b3a67" },
  { name: "Geek Black", hex: "#161616" },
  { name: "Geek White", hex: "#eeeeee" },
  { name: "Glacier Blue", hex: "#8fbcd4" },
  { name: "Golden White", hex: "#f0e6c8" },
  { name: "Gray", hex: "#808080" },
  { name: "Graygreen", hex: "#7a8a76" },
  { name: "Green Texture", hex: "#3f7d4f" },
  { name: "Halo Blue", hex: "#3f7fc1" },
  { name: "Icyblue", hex: "#bfe3f0" },
  { name: "Ink Black", hex: "#151517" },
  { name: "Iris Blue", hex: "#3a6ea5" },
  { name: "Jetblack", hex: "#0d0d0d" },
  { name: "Lavender Mist", hex: "#d8cdf0" },
  { name: "Lavender Purple", hex: "#9b7fc7" },
  { name: "Light Blue", hex: "#93c5fd" },
  { name: "Light Gray", hex: "#d1d5db" },
  { name: "Light Green", hex: "#86efac" },
  { name: "Light Pink", hex: "#f9a8d4" },
  { name: "Light Violet", hex: "#c9b8e8" },
  { name: "Lilac", hex: "#c8a2c8" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Luminous Orange", hex: "#ff8c3d" },
  { name: "Lunar Titanium", hex: "#9a9a94" },
  { name: "Malachite Green", hex: "#0bda51" },
  { name: "Melting Silver", hex: "#c8cdd0" },
  { name: "Meteor Silver", hex: "#b8bcc0" },
  { name: "Midnight Black", hex: "#0e0e12" },
  { name: "Midnight Blue", hex: "#191970" },
  { name: "Mint Cream", hex: "#e6f5ec" },
  { name: "Mint Green", hex: "#98ff98" },
  { name: "Mist Blue", hex: "#a9c6d8" },
  { name: "Mist Titanium", hex: "#9c9a92" },
  { name: "Misty Purple", hex: "#a893c2" },
  { name: "Mocha Brown", hex: "#6f4e37" },
  { name: "Monza Red", hex: "#c8102e" },
  { name: "Moonlight Black", hex: "#131316" },
  { name: "Moonlight White", hex: "#eceff1" },
  { name: "Moonshadow Black", hex: "#121214" },
  { name: "Mystic Purple", hex: "#6a4c93" },
  { name: "Nebula Titanium", hex: "#7d7d82" },
  { name: "Night Pulse", hex: "#1a1a2e" },
  { name: "Ocean Cyan", hex: "#2ea6b5" },
  { name: "Olive", hex: "#6b6b1f" },
  { name: "Palm Green", hex: "#3f8a52" },
  { name: "Peach Pink", hex: "#ffb6a3" },
  { name: "Playful Orange", hex: "#ff8a3d" },
  { name: "Polaris Titanium", hex: "#8f9296" },
  { name: "Quiet Violet", hex: "#8570a0" },
  { name: "Red Blaze", hex: "#e0301e" },
  { name: "Reddish Brown", hex: "#7a3b2e" },
  { name: "Roma Silver", hex: "#cfd2d4" },
  { name: "Sandy Purple", hex: "#a893a3" },
  { name: "Shadow Black", hex: "#0f0f10" },
  { name: "Silk Green", hex: "#5a8f6b" },
  { name: "Silver Dancer", hex: "#c4c8cb" },
  { name: "Silver Glacier", hex: "#d3dade" },
  { name: "Sky Blue", hex: "#87ceeb" },
  { name: "Sleek Black", hex: "#121214" },
  { name: "Solar Orange", hex: "#ff7a1a" },
  { name: "Starry Purple", hex: "#4b3f72" },
  { name: "Stellar Blue", hex: "#3f6ea5" },
  { name: "Storm Titanium", hex: "#75767b" },
  { name: "Sunlike Orange", hex: "#ff9147" },
  { name: "Sunrise Gold", hex: "#e8b84b" },
  { name: "Sunset Orange", hex: "#ff6f3c" },
  { name: "Titan Black", hex: "#161618" },
  { name: "Titanium Black", hex: "#3a3a3c" },
  { name: "Titanium Gray", hex: "#8e8e93" },
  { name: "Titanium Grey", hex: "#8e8e93" },
  { name: "Titanium Silver", hex: "#c6c8ca" },
  { name: "Titanium Silverblue", hex: "#9fb4c4" },
  { name: "Titanium Whitesilver", hex: "#d9dbdc" },
  { name: "Torino Black", hex: "#141416" },
  { name: "Twilight Gold", hex: "#c9a86a" },
  { name: "Velvet Black", hex: "#141414" },
  { name: "Velvet Gray", hex: "#5f6062" },

  // --- Added: iPhone-specific color names (11 through 17 series) not already covered ---
  { name: "Midnight Green", hex: "#4e5851" }, // iPhone 11 Pro
  { name: "Pacific Blue", hex: "#3b5f77" }, // iPhone 12 Pro
  { name: "Deep Purple", hex: "#4e3b5e" }, // iPhone 14 Pro
  { name: "Space Black", hex: "#2b2b2c" }, // iPhone 14/15 Pro
  { name: "Blue Titanium", hex: "#3f5e77" }, // iPhone 15 Pro
  { name: "White Titanium", hex: "#e4e2dc" }, // iPhone 15 Pro
  { name: "Ultramarine", hex: "#5e7ce2" }, // iPhone 16
  // Note: iPhone 17-series names below are less certain — verify against Apple's current listing
  { name: "Sage", hex: "#b7bfa8" }, // iPhone 17 (unverified)
  { name: "Mist Blue", hex: "#a9c1d9" }, // iPhone 17 (unverified)
  { name: "Cosmic Orange", hex: "#c9662e" }, // iPhone 17 Pro (unverified)
  { name: "Deep Blue", hex: "#1f3a5f" },
  { name: "Light Gold", hex: "#e6d2a8" }, // iPhone 17 Air
  { name: "Space Black", hex: "#1a1a1c" }, // iPhone 17 Air          // iPhone 17 Pro (unverified)
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

// =========================================================
// ELEMENT REFERENCES
// =========================================================
// Single source of truth for the API origin. Previously
// "http://localhost:3000" was hardcoded in four separate places (here, the
// image delete handler, uploadColorImages, and the image <img> src) - one
// place to change when this is deployed anywhere but localhost.

console.log("CURRENT URL:", window.location.href);
const BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "POCO",
  "Google",
  "Huawei",
  "Honor",
  "Oppo",
  "Realme",
  "Vivo",
  "OnePlus",
  "Nothing",
  "Tecno",
  "Infinix",
  "Anker",
  "JBL",
  "UGREEN",
];

window.addEventListener("beforeunload", function () {
  console.trace("PAGE IS LEAVING");
});
console.log("ADD PRODUCT JS LOADED");
// API_BASE (from config.js) IS the products resource base already
// (".../products") — don't append "/products" again here, or every
// request doubles up to ".../products/products".
const API = API_BASE;

let selectedBrand = "";
const urlParams = new URLSearchParams(window.location.search);
const deletedImages = [];
let productId = urlParams.get("id");

let editMode = productId !== null;

console.log({
  productId,
  editMode,
});
let currentProduct = null;

// Required specs, keyed by category. Only the fields that actually exist
// in that category's rendered form get validated.
const requiredSpecsByCategory = {
  Phone: ["processor", "ram", "screenSize", "mainCamera", "battery"],
  Tablet: ["processor", "ram", "screenSize", "mainCamera", "battery"],
  Watch: ["caseSize", "displayType", "batteryLife"],
  Accessory: ["accessoryType", "compatibility"],
};
//Live character counter
descriptionInput.addEventListener("input", () => {
  descriptionCount.textContent = `${descriptionInput.value.length} / 300`;
});
// Note: a "generateVariantsButton" reference to a #generate-variants-btn
// element used to live here but no such element exists in add-product.html
// and nothing ever attached a listener to it - removed as dead code. If a
// manual "Generate Variants" trigger is wanted, add the button to the HTML
// and wire it to generateVariants().
// Transform Page to Edit Mode

if (editMode) {
  saveProductButton.textContent = "Update Product";
  resetProductButton.textContent = "Revert to previous state";
}
// fill brands

// =========================================================
// STATE
// =========================================================
function resetProductForm() {
  // clear normal inputs
  document.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });

  // reset selects
  // Now that add-product.html has a blank "Select category" default option
  // (Bug 20 fix), reset back to that blank state instead of silently
  // pre-picking "Phone" for the admin.
  categoryOption.value = "";
  brandOption.value = "";

  // BUG FIX: clearing the hidden #brand input alone left the visible
  // brand search input showing the old typed/selected brand name (and
  // selectedBrand still holding it), so the field looked untouched even
  // though the underlying value had actually been reset.
  selectedBrand = "";
  if (brandSearchInput) brandSearchInput.value = "";
  closeBrandDropdown();
  descriptionInput.value = "";
  descriptionCount.textContent = "0 / 300";
  // clear selected options
  selectedOptions.storage = [];
  selectedOptions.ram = [];
  selectedOptions.size = [];
  selectedOptions.colors = [];
  selectedOptions.condition = [];

  // remove selected styling
  document.querySelectorAll(".option-box.selected").forEach((option) => {
    option.classList.remove("selected");
  });

  // clear variants
  generatedVariants = [];
  renderVariantsTable([]);

  // regenerate specifications
  renderSpecifications(categoryOption.value);

  // clear custom specs
  customSpecsContainer.innerHTML = "";

  // Clear uploaded/selected image state and its DOM - previously reset
  // cleared every other piece of state but left colorImages and the color
  // upload boxes untouched, so old previews stayed on screen right under
  // the "Product form cleared" toast.
  Object.keys(colorImages).forEach((color) => {
    colorImages[color].forEach((image) => {
      if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    });
    delete colorImages[color];
  });
  colorImagesContainer.innerHTML = "";

  // BUG FIX: reset cleared selectedOptions.colors but never re-rendered
  // #color-options, so the old chips (and an open search dropdown, if the
  // admin happened to be mid-search) stayed on screen after "Product form
  // cleared" appeared.
  renderColorChips();
  closeColorDropdown();

  updateBrandFields();
  updateVariantsSections();

  showToast("Product form cleared", "success");
}
resetProductButton.addEventListener("click", () => {
  if (editMode) {
    // BUG FIX: reload() re-requests the *same* URL, which in edit mode
    // still has ?id=... on it - so it just re-fetches and re-fills the
    // same product's data instead of giving a blank form. Navigating to
    // the plain create URL is what actually clears everything.
    window.location.href = "add-product.html";

    return;
  }
  resetProductForm();
});
const selectedOptions = {
  storage: [],
  ram: [],
  size: [],
  colors: [],
  condition: [],
};
const colorImages = {};
// Variants generator
let generatedVariants = [];

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

// Which variant dimensions apply to each category, in display order.
// This is the single source of truth for category-aware variants:
// generateVariants() cartesian-products only these, renderVariantsTable()
// only shows columns for these, validateProduct()/saveProduct() only
// require/send these. Phone and Tablet need storage+RAM, Watch only needs
// size, Accessory needs neither - color and condition apply everywhere.
const CATEGORY_VARIANT_DIMENSIONS = {
  Phone: ["storage", "ram", "color", "condition"],
  Tablet: ["storage", "ram", "color", "condition"],
  Watch: ["size", "color", "condition"],
  Accessory: ["color", "condition"],
};

// Returns the dimension list for whatever category is currently selected,
// or [] if no category (or an unrecognized one) is selected yet.
function getVariantDimensions() {
  const category = categoryOption.value;
  const brand = brandOption.value;

  if (category === "Phone") {
    if (brand === "Apple") {
      return ["storage", "color", "condition"];
    }

    return ["storage", "ram", "color", "condition"];
  }

  if (category === "Tablet") {
    if (brand === "Apple") {
      return ["storage", "color", "condition"];
    }
    return ["storage", "ram", "color", "condition"];
  }

  if (category === "Watch") {
    return ["size", "color", "condition"];
  }

  if (category === "Accessory") {
    return ["color", "condition"];
  }

  return [];
}

// Battery health isn't a "pick one or more" dimension like storage/RAM/color -
// it's a single number typed once (see #battery-health) that applies to
// every variant of the product. It's kept out of getVariantDimensions()
// (which drives the cartesian-product combinations in generateVariants())
// on purpose - selectedOptions has no "batteryHealth" array, so treating it
// like the other dimensions used to throw when getOptionListForDimension()
// tried to read .length off undefined, which silently broke variant
// generation for every Apple Phone/Tablet/Watch. Whether the field applies
// mirrors the show/hide logic in updateVariantsSections().

// Builds a stable identity key for a variant combination, used to preserve
// price/stock/sku when the option selection changes and variants are
// regenerated. Values are normalized (trimmed + lowercased) so that a
// harmless whitespace/casing difference between the DB value and the
// option-box text can't silently break the match.
// Fixed field order/list (rather than reading dims off the current
// category) so a key built from a freshly-generated variant always
// matches a key built from a previously-saved one, even for fields the
// current category doesn't use - those just normalize to "" on both
// sides.
function variantKey(variant) {
  return ["storage", "ram", "size", "color", "condition"]
    .map((key) => {
      const part = variant[key];
      return part === null || part === undefined
        ? ""
        : String(part).trim().toLowerCase();
    })
    .join("|");
}

function renderColorImageUpload(colors) {
  if (!colorImagesContainer) return;

  // remove colors that are no longer selected
  [...colorImagesContainer.children].forEach((box) => {
    const color = box.dataset.colorBox;

    if (!colors.some((c) => c.name === color)) {
      delete colorImages[color];
      box.remove();
    }
  });

  // create missing colors only
  colors.forEach((color) => {
    const existing = colorImagesContainer.querySelector(
      `[data-color-box="${color.name}"]`,
    );

    if (existing) return;

    colorImages[color.name] ??= [];

    const box = document.createElement("div");

    box.className = "color-image-box";

    box.dataset.colorBox = color.name;
    const hex = getColorHex(color.name);
    box.innerHTML = `

<h4>
  <span 
    class="color-dot-preview" 
    style="background:${getColorHex(color.name)}">
  </span>

  ${escapeHtml(color.name)}
</h4>

<label class="file-upload-btn">

  Choose Images

  <input
    type="file"
    multiple
    accept="image/*"
    class="color-image-input"
    data-color="${escapeHtml(color.name)}"
  >

</label>

<div class="selected-images"></div>

`;

    colorImagesContainer.appendChild(box);
  });

  // restore previews
  // BUG FIX: this was passing the whole `color` object ({id, name}) into
  // renderSelectedImages(), which builds a selector like
  // `[data-color-box="${color}"]` expecting a plain string. An object
  // stringifies to "[object Object]", so the selector matched nothing and
  // previously uploaded photos silently never rendered.
  colors.forEach((color) => {
    renderSelectedImages(color.name);
  });
}

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
function batteryHealthApplies() {
  const category = categoryOption.value;
  const brand = brandOption.value;

  return (
    brand === "Apple" &&
    (category === "Phone" || category === "Tablet" || category === "Watch")
  );
}
// Buckets a battery health percentage into a visual tier for the variants
// table (see .battery-cell CSS) - purely cosmetic, doesn't affect what gets
// saved. Empty/unset shows as neutral rather than implying good or bad.
function batteryTier(value) {
  const num = Number(value);
  if (!value || Number.isNaN(num)) return "unset";
  if (num >= 90) return "good";
  if (num >= 80) return "fair";
  return "poor";
}
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
// =========================================================
// SEARCHABLE BRAND PICKER
// =========================================================
// FEATURE: brand used to be a plain <select> populated from BRANDS, so
// only that fixed list could ever be chosen. This mirrors the color
// picker's search-as-you-type pattern instead: typing filters BRANDS,
// clicking a result (or pressing Enter) selects it, and a typed name with
// no match can still be added as a custom brand - #brand now holds a
// single selected value (unlike colors, brand is single-select, so there
// are no removable chips - the search input itself just displays the
// current selection).
let brandActiveIndex = -1;

function getBrandDropdownItems() {
  return Array.from(
    brandSearchDropdown.querySelectorAll(".brand-dropdown-item"),
  );
}

function setBrandActiveIndex(index) {
  const items = getBrandDropdownItems();
  if (!items.length) {
    brandActiveIndex = -1;
    return;
  }

  // Wrap around in both directions so ArrowDown off the last item goes back
  // to the top, and ArrowUp off the first goes to the bottom - standard
  // combobox behavior.
  brandActiveIndex = ((index % items.length) + items.length) % items.length;

  items.forEach((item, i) => {
    item.classList.toggle("active", i === brandActiveIndex);
  });

  items[brandActiveIndex].scrollIntoView({ block: "nearest" });
}

function renderBrandDropdown(query) {
  if (!brandSearchDropdown) return;

  brandActiveIndex = -1;

  const trimmedQuery = query.trim();
  const q = trimmedQuery.toLowerCase();

  const matches = BRANDS.filter((b) => b.toLowerCase().includes(q)).slice(0, 8);

  let html = matches
    .map(
      (b) => `
        <div class="brand-dropdown-item" data-brand-name="${escapeHtml(b)}">
          ${escapeHtml(b)}
        </div>
      `,
    )
    .join("");

  // Offer "add as new brand" whenever what's typed doesn't exactly match
  // an entry already in BRANDS - lets the admin add a brand that isn't in
  // the built-in list at all.
  const exactMatch = BRANDS.some((b) => b.toLowerCase() === q);

  if (trimmedQuery && !exactMatch) {
    html += `
      <div class="brand-dropdown-item brand-dropdown-add" data-add-custom="${escapeHtml(trimmedQuery)}">
        + Add "${escapeHtml(trimmedQuery)}"
      </div>
    `;
  }

  if (!html) {
    html = `<div class="brand-dropdown-empty">No brands found</div>`;
  }

  brandSearchDropdown.innerHTML = html;
  brandSearchDropdown.classList.add("open");
}

function closeBrandDropdown() {
  if (!brandSearchDropdown) return;
  brandSearchDropdown.classList.remove("open");
  brandSearchDropdown.innerHTML = "";
}

// Selects (or replaces) the single chosen brand. Keeps #brand (the hidden
// input the rest of the file reads via brandOption.value), the visible
// search input text, and the selectedBrand variable all in sync, then
// dispatches a "change" event so the existing brandOption "change"
// listener (updateVariantsSections/generateVariants) still runs - setting
// .value on a plain input doesn't fire that natively the way a real
// <select> would.
function selectBrand(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return;

  selectedBrand = trimmed;
  brandOption.value = trimmed;
  if (brandSearchInput) brandSearchInput.value = trimmed;

  closeBrandDropdown();

  brandOption.dispatchEvent(new Event("change"));
}

if (brandSearchInput) {
  brandSearchInput.addEventListener("input", () => {
    renderBrandDropdown(brandSearchInput.value);
  });

  brandSearchInput.addEventListener("focus", () => {
    renderBrandDropdown(brandSearchInput.value);
  });

  brandSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      // Only meaningful once there's a list to move through - and if the
      // dropdown isn't open yet (e.g. arrowing down before typing), open it
      // first rather than doing nothing.
      e.preventDefault();

      if (!brandSearchDropdown.classList.contains("open")) {
        renderBrandDropdown(brandSearchInput.value);
      }

      setBrandActiveIndex(brandActiveIndex + 1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();

      if (!brandSearchDropdown.classList.contains("open")) {
        renderBrandDropdown(brandSearchInput.value);
      }

      setBrandActiveIndex(brandActiveIndex === -1 ? -1 : brandActiveIndex - 1);
      return;
    }

    if (e.key === "Enter") {
      // Prevent an Enter press here from bubbling up and submitting/
      // triggering anything else on the page (there's no <form>, but this
      // keeps behavior predictable if one is ever added).
      e.preventDefault();

      // Prefer whatever the arrow keys highlighted; fall back to the first
      // item (previous behavior) when nothing's been highlighted yet.
      const items = getBrandDropdownItems();
      const targetItem =
        brandActiveIndex !== -1 ? items[brandActiveIndex] : items[0];

      if (targetItem?.dataset.addCustom) {
        selectBrand(targetItem.dataset.addCustom);
      } else if (targetItem?.dataset.brandName) {
        selectBrand(targetItem.dataset.brandName);
      } else if (brandSearchInput.value.trim()) {
        selectBrand(brandSearchInput.value);
      }
    }

    if (e.key === "Escape") {
      closeBrandDropdown();
    }
  });
}

document.addEventListener("click", (e) => {
  const dropdownItem = e.target.closest(".brand-dropdown-item");
  if (dropdownItem) {
    if (dropdownItem.dataset.addCustom) {
      selectBrand(dropdownItem.dataset.addCustom);
    } else if (dropdownItem.dataset.brandName) {
      selectBrand(dropdownItem.dataset.brandName);
    }
    return;
  }

  // Click-away closes the dropdown.
  if (!e.target.closest("#brand-picker")) {
    closeBrandDropdown();
  }
});
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

// Small helper for a unique-enough client-side id. Only used to key DOM
// buttons back to the right image object - never sent to the server.
function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

document.addEventListener("change", (e) => {
  if (!e.target.classList.contains("color-image-input")) return;

  const color = e.target.dataset.color;

  const files = Array.from(e.target.files);

  if (!colorImages[color]) {
    colorImages[color] = [];
  }

  files.forEach((file) => {
    // If this color has no images at all yet, default the very first one
    // added to be the cover - mirrors the same default the backend
    // applies on upload, so the star shows the right state immediately
    // instead of waiting on a round trip.
    const isFirstImageForColor = colorImages[color].length === 0;

    colorImages[color].push({
      localId: makeLocalId(),
      file,
      existing: false,
      isCover: isFirstImageForColor,
    });
  });

  renderSelectedImages(color);
});
function renderSelectedImages(color) {
  const box = document.querySelector(`[data-color-box="${color}"]`);

  if (!box) return;

  const container = box.querySelector(".selected-images");

  container.innerHTML = "";

  colorImages[color].forEach((image) => {
    const card = document.createElement("div");

    card.className = "image-card";

    card.innerHTML = `

      <button
        class="delete-image-btn"
        data-color="${color}"
        data-local-id="${image.localId}">
        ×
      </button>

      <button
        class="cover-star-btn ${image.isCover ? "is-cover" : ""}"
        data-color="${color}"
        data-local-id="${image.localId}"
        title="${image.isCover ? "Cover image" : "Set as cover image"}"
        aria-pressed="${image.isCover ? "true" : "false"}">
        ${image.isCover ? "★" : "☆"}
      </button>

      <img src="${
        image.existing
          ? image.url.startsWith("http")
            ? image.url
            : API_ROOT + image.url
          : (image.previewUrl ??= URL.createObjectURL(image.file))
      }">

      <p>${escapeHtml(
        image.existing ? image.url.split("/").pop() : image.file.name,
      )}</p>

    `;

    container.appendChild(card);
  });
}

// Marks a single image as the cover for its color, un-marking whichever
// image previously held that spot. Looks the image up by its stable
// localId (rather than array position) so this can never land on the
// wrong photo even if a render happens to be in flight. Updates local
// state + re-renders immediately (so the star fills instantly, no
// confirmation dialog), and - if the image already exists in the
// database - fires the PUT in the background to persist it.
// Newly-selected-but-not-yet-uploaded images just carry the flag in
// local state; uploadColorImages() below reads it off and tells the
// server which one to mark as cover at upload time.
function setCoverImage(color, localId) {
  const images = colorImages[color];
  if (!images) return;

  const target = images.find((image) => image.localId === localId);
  if (!target) return;

  images.forEach((image) => {
    image.isCover = image.localId === localId;
  });

  renderSelectedImages(color);

  if (target.existing) {
    fetch(
      `${API_BASE.replace("/products", "")}/upload/product-images/${target.id}/cover`,
      {
        method: "PUT",
        credentials: "include",
      },
    ).catch((error) => {
      console.error("Failed to set cover image:", error);
      showToast("Could not update cover image", "error");
    });
  }
}

document.addEventListener("click", (e) => {
  const starBtn = e.target.closest(".cover-star-btn");
  if (!starBtn) return;

  setCoverImage(starBtn.dataset.color, starBtn.dataset.localId);
});
// Queues an already-uploaded image for deletion on the server. Called from
// saveProduct() after the product save succeeds, so a cancelled edit (form
// reset, navigating away without saving) doesn't orphan-delete photos the
// admin only removed locally.
async function deleteRemovedImages() {
  for (const id of deletedImages) {
    await fetch(
      `${API_BASE.replace("/products", "")}/upload/product-images/${id}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );
  }

  deletedImages.length = 0;
}

document.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".delete-image-btn");
  if (!deleteBtn) return;

  const color = deleteBtn.dataset.color;
  const localId = deleteBtn.dataset.localId;

  const images = colorImages[color];
  const index = images.findIndex((image) => image.localId === localId);
  if (index === -1) return;

  const image = images[index];

  // Existing image in the database - queue it for deletion (see
  // deleteRemovedImages above) rather than deleting it immediately.
  if (image.existing) {
    deletedImages.push(image.id);
  }

  // Revoke the blob URL before dropping the reference, so the browser can
  // actually free the memory instead of holding it for the life of the tab.
  if (image.previewUrl) {
    URL.revokeObjectURL(image.previewUrl);
  }

  // Remove locally
  images.splice(index, 1);

  renderSelectedImages(color);
});
// Maps each dimension name to the selectedOptions list that drives it.
// Pulled out to a function (rather than a plain object) because
// selectedOptions.colors holds {id, name} objects while every other list
// holds plain strings - callers need to know which is which.
function getOptionListForDimension(dim) {
  if (dim === "color") return selectedOptions.colors;
  return selectedOptions[dim];
}

function generateVariants() {
  const dims = getVariantDimensions();

  // No category selected (or an unrecognized one) - nothing to generate.
  if (dims.length === 0) {
    generatedVariants = [];
    renderVariantsTable([]);
    return;
  }

  // Only combine dimensions that are both relevant to this category AND
  // actually have at least one value picked. A dimension with nothing
  // selected yet contributes nothing - it no longer falls back to a
  // `[null]` placeholder, which used to produce useless rows like
  // "null + null + Black + New" for a category (e.g. Accessory) that
  // never even shows a storage/RAM/size picker.
  const activeDims = dims.filter(
    (dim) => getOptionListForDimension(dim).length > 0,
  );

  if (activeDims.length === 0) {
    generatedVariants = [];
    renderVariantsTable([]);
    return;
  }

  // Keep a lookup of the variants that already exist so we don't wipe out
  // price/stock/sku the user already entered when they tweak the options.
  const existingByKey = {};
  generatedVariants.forEach((variant) => {
    existingByKey[variantKey(variant)] = variant;
  });

  // Cartesian product across only the active dimensions, building up each
  // combination as a plain object that only has keys for those dimensions
  // (e.g. an Accessory combination is just { color, condition }).
  let combinations = [{}];

  activeDims.forEach((dim) => {
    const values = getOptionListForDimension(dim);
    const next = [];

    combinations.forEach((combo) => {
      values.forEach((value) => {
        // Colors are {id, name} objects everywhere else in selectedOptions;
        // variants only ever store the plain name string.
        next.push({ ...combo, [dim]: dim === "color" ? value.name : value });
      });
    });

    combinations = next;
  });

  const newVariants = combinations.map((combo) => {
    const existing = existingByKey[variantKey(combo)];

    return {
      ...combo,
      price: existing ? existing.price : 0,
      stock: existing ? existing.stock : 0,
      sku: existing ? existing.sku : null,
      // Same battery health value on every variant of the product - not
      // part of the combo cartesian product, just carried along so it
      // survives into the save payload.
      batteryHealth: existing ? existing.batteryHealth : null,
    };
  });

  generatedVariants = newVariants;

  console.log(generatedVariants);

  renderVariantsTable(generatedVariants);
}
document.addEventListener("input", (e) => {
  const index = e.target.dataset.index;

  if (e.target.classList.contains("variant-price-input")) {
    generatedVariants[index].price = Number(e.target.value);
  }

  if (e.target.classList.contains("variant-stock-input")) {
    generatedVariants[index].stock = Number(e.target.value);
  }

  if (e.target.classList.contains("variant-battery-input")) {
    generatedVariants[index].batteryHealth = Number(e.target.value) || null;

    const cell = e.target.closest(".battery-cell");
    if (cell) {
      cell.dataset.batteryTier = batteryTier(e.target.value);

      const fill = cell.querySelector(".battery-gauge-fill");
      if (fill) {
        const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
        fill.style.width = `${pct}%`;
      }
    }
  }
});

// Column header text for each possible dimension, used to build the
// variant table's <thead> dynamically.
const VARIANT_COLUMN_LABELS = {
  storage: "Storage",
  ram: "RAM",
  size: "Size",
  color: "Color",
  condition: "Condition",
  batteryHealth: "Battery Health",
};
// NOTE: brand used to be a <select id="brand"> populated here from
// BRANDS. That element no longer exists in the HTML - brand is now the
// searchable picker (#brand-picker / #brand-search-input) set up above,
// backed by a hidden <input id="brand"> that still holds the selected
// value for the rest of this file. This population code is gone since
// there's no <select> left to append <option>s to.
// Renders one <td> for a given dimension on a given variant. Color gets
// its swatch dot; everything else (storage/ram/size/condition) is plain
// text, same as before.
function renderVariantCell(dim, variant) {
  if (dim === "color") {
    if (!variant.color)
      return `<td data-label="${VARIANT_COLUMN_LABELS.color}">-</td>`;

    // BUG FIX: this used to render class="table-color-dot ${color.toLowerCase()}"
    // and rely on separate global utility classes (.black, .white,
    // .blue, .green) to supply the actual background color. That only
    // ever covered 4 fixed names - now that colors come from the
    // searchable picker and can be anything, look the hex up the same
    // way the picker's own chips do and set it inline.
    return `<td data-label="${VARIANT_COLUMN_LABELS.color}"><span class="table-color-dot" style="background:${getColorHex(variant.color)}"></span> ${escapeHtml(variant.color)}</td>`;
  }

  return `<td data-label="${VARIANT_COLUMN_LABELS[dim]}">${variant[dim] || "-"}</td>`;
}

function renderVariantsTable(variants) {
  variantsTableContainer.classList.remove("table-show");

  // force browser to restart animation
  void variantsTableContainer.offsetWidth;

  variantsTableContainer.classList.add("table-show");

  // Header/columns depend on the current category - Phone/Tablet get
  // Storage + RAM, Watch gets Size, Accessory gets neither. Color and
  // Condition are always included.
  const dims = getVariantDimensions();
  const headerCells = dims
    .map((dim) => `<th>${VARIANT_COLUMN_LABELS[dim]}</th>`)
    .join("");

  variantsTableContainer.innerHTML = `

  <table class="variant-table">

    <thead>
      <tr>
        ${headerCells}
        ${batteryHealthApplies() ? "<th>Battery Health</th>" : ""}
        <th>Price</th>
        <th>Stock</th>
      </tr>
    </thead>

    <tbody>

      ${variants
        .map(
          (variant, index) => `
          
          <tr>

            ${dims.map((dim) => renderVariantCell(dim, variant)).join("")}

            ${
              batteryHealthApplies()
                ? `
                <td data-label="Battery Health">
                  <div class="battery-cell" data-battery-tier="${batteryTier(variant.batteryHealth)}">
                    <div class="battery-gauge">
                      <div
                        class="battery-gauge-fill"
                        style="width: ${Math.min(100, Math.max(0, Number(variant.batteryHealth) || 0))}%"
                      ></div>
                    </div>

                    <input
                      class="variant-battery-input"
                      type="number"
                      min="75"
                      max="100"
                      value="${variant.batteryHealth ?? ""}"
                      data-index="${index}"
                      placeholder="100"
                    >

                    <span class="battery-suffix">%</span>
                  </div>
                </td>
                `
                : ""
            }

            <td class="price-cell" data-label="Price">

              <span class="currency">$</span>

              <input
                class="variant-price-input"
                type="number"
                min="0"
                value="${variant.price}"
                data-index="${index}"
              >

            </td>

            <td data-label="Stock">

              <input
                class="variant-stock-input"
                type="number"
                min="0"
                value="${variant.stock}"
                data-index="${index}"
              >

            </td>

          </tr>

          `,
        )
        .join("")}

    </tbody>

  </table>

`;
}

// =========================================================
// BRAND LOGIC
// =========================================================

// Brand no longer decides which variant dimensions apply - category alone
// does that now (see CATEGORY_VARIANT_DIMENSIONS / getVariantDimensions).
// This used to hide the RAM section and force-clear selectedOptions.ram
// whenever brand was "Apple", which is incompatible with the new rule
// that every Phone/Tablet variant (regardless of brand) requires RAM -
// hiding it would make an Apple phone/tablet impossible to validate.
// Left as a no-op hook (rather than deleting its several call sites)
// in case brand-specific UI is needed again later.
function updateBrandFields() {}

function updateVariantsSections() {
  // BUG FIX: the HTML used to give both the wrapping <div> and its inner
  // .option-boxes grid the same id="storage-options" - a duplicate id,
  // which happened to "work" here only because getElementById returns the
  // first match (the wrapper) and nothing else queried it by id. Renamed
  // the wrapper to the singular "storage-option" (matching the
  // #ram-option/#size-option/#battery-option siblings) so the id is
  // unique; the inner grid keeps "storage-options" since that's what the
  // click-delegation handler below still checks against.
  const category = categoryOption.value;

  storageSection.style.display = "none";
  ramSection.style.display = "none";
  sizeSection.style.display = "none";

  if (category === "Phone" || category === "Tablet") {
    storageSection.style.display = "block";
    if (brandOption.value === "Apple") {
      ramSection.style.display = "none";
    } else {
      ramSection.style.display = "block";
    }
  }
  if (category === "Watch") {
    sizeSection.style.display = "block";
    if (brandOption.value === "Apple") {
    }
  }
}

// =========================================================
// VARIANT OPTION SELECTION
// =========================================================

document.addEventListener("click", (event) => {
  const optionBox = event.target.closest(".option-box");

  if (!optionBox) return;

  optionBox.classList.toggle("selected");
  let optionType;
  const value = optionBox.textContent.trim();
  if (optionBox.parentElement.id === "storage-options") {
    optionType = "storage";
  }

  if (optionBox.parentElement.id === "ram-options") {
    optionType = "ram";
  }

  if (optionBox.parentElement.id === "condition-options") {
    optionType = "condition";
  }
  if (optionBox.parentElement.id === "size-options") {
    optionType = "size";
  }

  // NOTE: colors used to be handled here too (option-box under
  // #color-options, toggled the same way as storage/ram/condition). Colors
  // are now added/removed exclusively through the searchable color picker
  // (see addColor/removeColor above), which no longer renders .option-box
  // elements - so that branch was dead code and has been removed.

  if (!optionType) return;

  updateSelectedOptions(
    optionType,
    value,
    optionBox.classList.contains("selected"),
  );

  generateVariants();
  renderColorImageUpload(selectedOptions.colors);
});

function updateSelectedOptions(type, value, isSelected) {
  if (isSelected) {
    if (!selectedOptions[type].includes(value)) {
      selectedOptions[type].push(value);
    }
  } else {
    // BUG FIX: this used to be
    //   .filter((item) => (item) => { ... })
    // which returns a function (always truthy) instead of a boolean, so
    // nothing was ever actually filtered out - deselecting an option box
    // never removed it from state. The extra arrow is gone below.
    selectedOptions[type] = selectedOptions[type].filter((item) => {
      if (type === "colors") {
        return item.name !== value.name;
      }

      return item !== value;
    });
  }
}

// =========================================================
// SPECIFICATIONS RENDERING
// =========================================================

function renderSpecifications(categoryValue) {
  if (categoryValue === "Phone" || categoryValue === "Tablet") {
    specificationsContainer.innerHTML = `

      <div class="spec-section">

        <h3>Phone Specifications</h3>


        <div class="form-grid">


          ${createInput("Processor", "processor", "e.g. Snapdragon 8 Elite")}

          ${createInput("RAM", "ram", "e.g. 12GB")}

          ${createInput("Screen Size", "screenSize", "e.g. 6.7 inch")}

          ${createInput("Refresh Rate", "refreshRate", "e.g. 120Hz")}

          ${createInput("Main Camera", "mainCamera", "e.g. 50MP")}

          ${createInput("Front Camera", "frontCamera", "e.g. 12MP")}

          ${createInput("Battery Capacity", "battery", "e.g. 5000mAh")}

          ${createInput("Charging Speed", "chargingSpeed", "e.g. 45W")}

          ${createInput("Operating System", "operatingSystem", "e.g. Android 15")}


        </div>

      </div>

    `;
  } else if (categoryValue === "Watch") {
    specificationsContainer.innerHTML = `

    <div class="spec-section">

      <h3>Watch Specifications</h3>


      <div class="form-grid">


        ${createInput("Case Size", "caseSize", "e.g. 45mm")}

        ${createInput("Case Material", "caseMaterial", "e.g. Titanium")}

        ${createInput("Band Material", "bandMaterial", "e.g. Sport Band")}

        ${createInput("Display Type", "displayType", "e.g. AMOLED")}

        ${createInput("Water Resistance", "waterResistance", "e.g. 50m")}

        ${createInput("Battery Life", "batteryLife", "e.g. 18 hours")}

        ${createInput("Connectivity", "connectivity", "e.g. GPS + Cellular")}

        ${createInput("Compatible OS", "compatibleOS", "e.g. watchOS 11")}


      </div>


    </div>

    `;
  } else if (categoryValue === "Accessory") {
    specificationsContainer.innerHTML = `

    <div class="spec-section">

      <h3>Accessory Specifications</h3>


      <div class="form-grid">


        ${createInput("Type", "accessoryType", "e.g. Charger")}

        ${createInput("Compatibility", "compatibility", "e.g. iPhone 16")}

        ${createInput("Material", "material", "e.g. Silicone")}

        ${createInput("Color", "color", "e.g. Black")}

        ${createInput("Connector Type", "connectorType", "e.g. USB-C")}

        ${createInput("Warranty", "warranty", "e.g. 1 Year")}


      </div>


    </div>

    `;
  } else {
    // Unknown/empty category: show nothing instead of recursively
    // re-calling renderSpecifications with the same value, which would
    // otherwise recurse forever and crash the tab.
    specificationsContainer.innerHTML = `
      <p class="spec-empty-message">Select a category to see its specifications.</p>
    `;
  }

  updateBrandFields();
}

function createInput(label, name, placeholder) {
  return `

<div class="form-group">

<label>${label}</label>

<input
type="text"
name="${name}"
placeholder="${placeholder}"
>

</div>

`;
}

categoryOption.addEventListener("change", () => {
  renderSpecifications(categoryOption.value);
  updateVariantsSections();
  generateVariants();
  // renderSpecifications() just rebuilt #specifications-container from
  // scratch, so any values autofillSpecs had already filled in are gone -
  // re-run the lookup/autofill for the new category.
  checkForPhoneSpecs();
});
brandOption.addEventListener("change", () => {
  updateVariantsSections();
  generateVariants();
});
// Keep already-generated variants' batteryHealth in sync as the admin types,
// without regenerating the whole table (which would be needed for
// storage/ram/color/condition, but battery health is just a shared value
// carried on every existing row).

// =========================================================
// CUSTOM SPECIFICATIONS
// =========================================================

// Builds one custom-spec-row element. Pulled out into its own function
// (rather than only existing inline in the button's click handler) so
// fillProductInformation() can reuse it to recreate rows - pre-filled
// with the saved name/value - when loading a product that has custom
// specs, instead of only ever being able to add blank ones.
function createCustomSpecRow(name = "", value = "") {
  const specRow = document.createElement("div");

  specRow.classList.add("custom-spec-row");

  specRow.innerHTML = `

      <input
      type="text"
      placeholder="Specification Name"
      name="customSpecName[]"
      value="${escapeHtml(name)}"
      >


      <input
      type="text"
      placeholder="Value"
      name="customSpecValue[]"
      value="${escapeHtml(value)}"
      >


      <button
      type="button"
      class="remove-spec-btn"
      >
      Remove
      </button>

    `;

  return specRow;
}

addSpecButton.addEventListener("click", () => {
  customSpecsContainer.appendChild(createCustomSpecRow());
});

customSpecsContainer.addEventListener("click", (event) => {
  if (event.target.classList.contains("remove-spec-btn")) {
    event.target.parentElement.remove();
  }
});

renderVariantsTable(generatedVariants);

function validateProduct() {
  const productName = productNameInput.value.trim();
  if (productName === "") {
    showToast("Product Name is required", "error");
    return false;
  }
  if (brandOption.value === "") {
    showToast("Product Brand is required", "error");
    return false;
  }
  if (descriptionInput.length > 1500) {
    showToast("Product Description Is Too Long", "error");
    return false;
  }
  // The category <select> previously had no blank option, so it always
  // held a real value ("Phone" by default) and this check could never
  // actually fire - the required "*" marker was misleading. Now that a
  // blank "Select category" option exists, this check does something.
  if (categoryOption.value === "") {
    showToast("Product Category is required", "error");
    return false;
  }

  const requiredSpecs = requiredSpecsByCategory[categoryOption.value] || [];

  for (const spec of requiredSpecs) {
    const input = document.querySelector(`[name="${spec}"]`);
    if (input && input.value.trim() === "") {
      showToast(`Product ${spec} is required`, "error");
      return false;
    }
  }
  // Every selected color needs at least one image before saving. Checks
  // colorImages[color.name] directly rather than the DOM, so it also
  // works for colors whose upload box hasn't been touched yet.
  const colorMissingImages = selectedOptions.colors.find(
    (color) => !(colorImages[color.name]?.length > 0),
  );

  if (colorMissingImages) {
    showToast(`${colorMissingImages.name} needs at least one image`, "error");
    return false;
  }
  // Which fields a "complete" variant needs depends on category now, not
  // brand - Phone/Tablet need storage+RAM, Watch needs size, Accessory
  // needs neither (see CATEGORY_VARIANT_DIMENSIONS).
  const dims = getVariantDimensions();
  const hasValidVariant = generatedVariants.some((variant) =>
    dims.every((dim) => !!variant[dim]),
  );

  if (!hasValidVariant) {
    const needed = dims.map((dim) => VARIANT_COLUMN_LABELS[dim]).join(", ");
    showToast(`Products need ${needed} selected`, "error");

    return false;
  }
  const invalidVariant = generatedVariants.some((variant) => {
    const hasPrice = variant.price > 0;

    if (!hasPrice) {
      return true;
    }

    return false;
  });

  if (invalidVariant) {
    showToast("Variant price and stock must both be filled", "error");

    return false;
  }
  return true;
}

async function loadProduct() {
  let response;
  let product;

  try {
    response = await fetch(`${API}/${productId}`, { credentials: "include" });
    product = await response.json();
  } catch (error) {
    console.error(error);
    showToast("Could not reach the server to load this product", "error");
    return;
  }

  // Previously this was never checked, so a 404 body like
  // { error: "Product not found" } got passed straight into
  // fillProductInformation() and crashed trying to read product.colors /
  // product.variants off it.
  if (!response.ok) {
    showToast(product.error || "Failed to load product", "error");
    return;
  }

  currentProduct = product;
  fillProductInformation(product);
}
function restoreSelectedOptionBoxes() {
  document
    .querySelectorAll(".option-box")
    .forEach((box) => box.classList.remove("selected"));
  restoreGroup("storage-options", selectedOptions.storage);
  restoreGroup("ram-options", selectedOptions.ram);
  renderSizeChips()
  restoreGroup("condition-options", selectedOptions.condition);

  // BUG FIX: this used to call restoreGroup("color-options", ...), which
  // looks for .option-box children inside #color-options and toggles a
  // "selected" class on them. Now that #color-options holds dynamically
  // rendered chips from the searchable color picker (not static
  // option-boxes), that call matched nothing - loading a product for edit
  // silently showed zero colors selected even though selectedOptions.colors
  // was populated correctly. Render the chips directly instead.
  renderColorChips();
}
function restoreGroup(containerId, values) {
  const container = document.getElementById(containerId);

  if (!container) return;

  container.querySelectorAll(".option-box").forEach((box) => {
    const text = box.textContent.trim();

    const exists = values.some((value) => {
      if (typeof value === "object") {
        return value.name === text;
      }

      return value === text;
    });

    if (exists) {
      box.classList.add("selected");
    }
  });
}
function syncVariantOptions() {
  generatedVariants.forEach((variant) => {
    // Storage
    if (variant.storage && !selectedOptions.storage.includes(variant.storage)) {
      selectedOptions.storage.push(variant.storage);
    }

    // RAM
    if (variant.ram && !selectedOptions.ram.includes(variant.ram)) {
      selectedOptions.ram.push(variant.ram);
    }

    // Size
    if (variant.size && !selectedOptions.size.includes(variant.size)) {
      selectedOptions.size.push(variant.size);
    }

    // Condition
    if (
      variant.condition &&
      !selectedOptions.condition.includes(variant.condition)
    ) {
      selectedOptions.condition.push(variant.condition);
    }

    // Colors
    if (
      variant.color &&
      !selectedOptions.colors.some((color) => color.name === variant.color)
    ) {
      selectedOptions.colors.push({
        id: null,
        name: variant.color,
      });
    }
  });
}
function fillProductInformation(product) {
  productNameInput.value = product.name || "";
  featuredCheckBox.checked = product.featured;
  categoryOption.value = product.category || "";
  warrantyInput.value = product.warranty || "";
  brandOption.value = product.brand || "";

  // BUG FIX: this set the hidden #brand input's value but never touched
  // the visible brand search input or selectedBrand, so an edited
  // product's brand was saved/validated correctly but the picker
  // displayed as empty on load - looked like the brand hadn't been set.
  selectedBrand = product.brand || "";
  if (brandSearchInput) brandSearchInput.value = product.brand || "";
  descriptionInput.value = product.description || "";
  renderSpecifications(product.category);
  updateBrandFields();
  updateVariantsSections();

  // Every variant of an Apple Phone/Tablet/Watch carries the same
  // batteryHealth value (see schema.prisma) - pull it from whichever
  // variant has one, since #battery-health is a single shared input, not
  // per-variant.

  if (product.optionSchema) {
    // optionSchema is a free-form Json column with nothing enforcing its
    // shape at the DB level, so a product created another way (script,
    // manual edit, future API version) could have a partial value here.
    // Default to an empty array instead of crashing on undefined.
    selectedOptions.storage = [...(product.optionSchema.storage || [])];
    selectedOptions.ram = [...(product.optionSchema.ram || [])];
    selectedOptions.size = [...(product.optionSchema.size || [])];
    selectedOptions.colors = (product.colors || []).map((color) => ({
      id: color.id,
      name: color.name,
    }));
    selectedOptions.condition = [...(product.optionSchema.condition || [])];

    restoreSelectedOptionBoxes();
    // Load images AFTER colors exist
    loadExistingImages(product.colors);
    // Create color upload boxes
    renderColorImageUpload(selectedOptions.colors);
  }
  // create the specification inputs first

  if (product.specifications) {
    console.log("Specifications from DB:", product.specifications);

    // Clear any stale custom-spec rows left over from a previous
    // fillProductInformation() call before rebuilding them below.
    customSpecsContainer.innerHTML = "";

    const fixedFields = FIXED_SPEC_FIELDS_BY_CATEGORY[product.category] || [];

    Object.entries(product.specifications).forEach(([key, value]) => {
      console.log("Trying to fill:", key, value);

      // BUG FIX: this used to look up `[name="${key}"]` for every saved
      // spec key, unconditionally. That only ever matches the fixed,
      // category-specific fields - a custom spec's key (e.g. "Warranty
      // Type") has no input anywhere in the DOM to match, so it just
      // silently failed to load and looked like custom specs were never
      // saved at all. Fixed fields still fill their existing input;
      // anything else gets its own custom-spec row rebuilt instead.
      if (fixedFields.includes(key)) {
        const input = document.querySelector(
          `#specifications-container [name="${key}"]`,
        );

        console.log("Found input:", input);

        if (input) {
          input.value = value;
        }
      } else {
        customSpecsContainer.appendChild(createCustomSpecRow(key, value));
      }
    });
  }

  // Only pull in the fields that actually apply to this product's
  // category (see CATEGORY_VARIANT_DIMENSIONS) - e.g. a Watch's loaded
  // variants only get a `size` field, never storage/ram, so they line up
  // with what generateVariants() builds going forward and can be matched
  // by variantKey(). Guards against a missing variants/options object the
  // same way the old code did (this used to call .map() unconditionally
  // and crash if `variants` was undefined).
  const dims = getVariantDimensions();

  generatedVariants = (product.variants || []).map((variant) => {
    const options = variant.options || {};
    const built = {};

    dims.forEach((dim) => {
      built[dim] = options[dim] || null;
    });

    return {
      ...built,
      price: variant.price ?? 0,
      stock: variant.stock ?? 0,
      sku: variant.sku || null,
      batteryHealth: variant.batteryHealth ?? null,
    };
  });
  syncVariantOptions();

  generateVariants();
}

function loadExistingImages(colors) {
  if (!colors) return;
  colors.forEach((color) => {
    colorImages[color.name] = color.images.map((image) => ({
      localId: makeLocalId(),
      id: image.id,
      url: image.url,
      existing: true,
      isCover: !!image.isCover,
    }));
  });
}

async function uploadColorImages(colors) {
  // BUG FIX: this used to `await` each color's upload inside the loop, so
  // color 2's images couldn't even start uploading until color 1's request
  // had fully round-tripped. With several colors each holding a few photos,
  // that serial chain is most of what made "Save" feel slow. The uploads
  // are independent (different color ids, separate form bodies), so fire
  // them all at once and wait for the whole batch together.
  const uploads = colors.map((color) => {
    const images = colorImages[color.name];

    if (!images?.length) return null;

    const formData = new FormData();

    // coverIndex is the position of the cover image WITHIN this batch of
    // new files specifically (not its index in `images`, which also
    // includes already-uploaded ones) - that's what the server expects,
    // since the new rows don't have ids yet when this request is built.
    let coverIndex = -1;

    images.forEach((image) => {
      if (!image.existing) {
        if (image.isCover) coverIndex = formData.getAll("images").length;
        formData.append("images", image.file);
      }
    });

    if ([...formData.entries()].length === 0) return null;

    if (coverIndex !== -1) {
      formData.append("coverIndex", coverIndex);
    }

    return fetch(
      `${API_BASE.replace("/products", "")}/upload/product-images/${color.id}`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    );
  });

  await Promise.all(uploads.filter(Boolean));
}

async function saveProduct() {
  // Always build the product from the current form state. Previously,
  // edit mode just re-sent the untouched product fetched from the server,
  // so any changes made in the form were silently discarded on update.
  console.log("SAVE START");
  const product = {
    name: productNameInput.value,

    category: categoryOption.value,

    brand: brandOption.value,
    warranty: warrantyInput?.value.trim() || null,
    featured: featuredCheckBox.checked,
    description: descriptionInput.value.trim(),

    specifications: collectSpecifications(),

    optionSchema: {
      storage: selectedOptions.storage,
      ram: selectedOptions.ram,
      size: selectedOptions.size,
      colors: selectedOptions.colors.map((color) => color.name),
      condition: selectedOptions.condition,
    },

    colors: selectedOptions.colors.map((color) => ({
      id: color.id,
      name: color.name,
    })),

    // Which fields count as "required" (for the filter below) and which
    // fields get sent (for each variant's `options`) both come from the
    // current category's dimension list now, not a hardcoded Apple/else
    // brand check - that never accounted for Watch (size) or Accessory
    // (neither storage nor RAM) at all, so e.g. a Watch variant could
    // never pass this filter no matter what was selected.
    variants: generatedVariants
      .filter((variant) =>
        getVariantDimensions().every((dim) => !!variant[dim]),
      )
      .map((variant) => {
        const options = {};
        getVariantDimensions().forEach((dim) => {
          options[dim] = variant[dim];
        });

        return {
          options,

          // BUG FIX: this used to call generateSKU(variant) unconditionally,
          // so every save - including a plain edit that changed nothing but
          // price/stock - minted a brand new random SKU for every variant,
          // even ones that already had a stable SKU from a previous save.
          // That churns the sku column pointlessly and risks collisions with
          // the @unique constraint across saves. Reuse variant.sku when this
          // combination already had one (set by loadProduct ->
          // fillProductInformation, and preserved across regenerateVariants
          // via the existingByKey lookup); only mint a fresh SKU when there
          // truly isn't one yet.
          sku: variant.sku || generateSKU(variant),

          // NOTE: removed the `colors: [variant.color]` field that used to
          // be sent here. Neither validateProductPayload nor the
          // create/update handlers in products.js ever read `variant.colors`
          // - it was dead data that just bloated the request body. The
          // variant's color already lives in `options.color`.
          price: variant.price,
          stock: variant.stock,

          // Lives on the Variant row directly (see schema.prisma), not
          // inside `options` - it isn't a cartesian-product dimension like
          // storage/ram/color/condition, just a single shared value.
          batteryHealth: variant.batteryHealth,
        };
      }),
  };

  const url = editMode ? `${API}/${productId}` : API;
  const method = editMode ? "PUT" : "POST";
  console.log(product);

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(product),
  });

  const data = await response.json();
  if (!response.ok) {
    // BUG FIX: this used to fire showToast() twice back-to-back (once with
    // data.message, once with data.error) - the API never sends a
    // `message` field on error responses (see handlePrismaError /
    // validateProductPayload in products.js, which always use `error`), so
    // the first toast was always the literal fallback text and the second
    // duplicated it with the real reason. A single toast is enough.
    showToast(data.error || "Saving failed", "error");
    console.log(data);
    return;
  }
  console.log("Created product:", data);
  try {
    if (data.colors?.length) {
      await uploadColorImages(data.colors);
    }

    // BUG FIX: colorImages entries were never marked existing:true (or
    // refreshed with real server ids) after a successful upload, so the
    // exact same File objects stayed flagged existing:false in memory.
    // Since nothing else reloads the product after saving, clicking
    // "Update" again later in the same session - to change the cover
    // image or anything else - re-ran uploadColorImages() over those same
    // stale "new" files and re-posted them, creating duplicate image rows
    // (most visible with multiple colors, since every color's just-added
    // images got re-uploaded at once). Re-fetching the product and
    // rebuilding colorImages from the server keeps local state in sync
    // with what's actually stored, so already-uploaded files are never
    // sent twice.
    if (editMode) {
      const refreshed = await fetch(`${API}/${productId}`, {
        credentials: "include",
      }).then((r) => r.json());

      loadExistingImages(refreshed.colors);
      renderColorImageUpload(selectedOptions.colors);
    }

    showToast("Product saved successfully!", "success");
  } catch (error) {
    console.error(error);
    showToast("Product saved but images failed", "error");
  }
  currentProduct = data;
  await deleteRemovedImages();
  // Keep currentProduct in sync so later actions in the same session
  // (e.g. re-saving) have fresh data to work from.
  console.log(generatedVariants.map((v) => v.options));
  console.log("SAVE END");

  // BUG FIX: editMode was computed once from the URL at page load and never
  // updated, so after a brand-new product's first successful save, the page
  // was still in "create" mode - a second Save click would POST a whole new
  // product (with the same locally-cached images re-uploaded under it)
  // instead of updating the one just created.
  //
  // This used to be fixed by a full `window.location.href` redirect into the
  // edit URL, but that forces a real page reload right after the save: the
  // success toast gets cut off almost immediately, and the browser has to
  // tear down and rebuild the entire form/page from a fresh network request
  // just to show the same data that's already sitting in the form. Updating
  // productId/editMode in memory and swapping the URL in via
  // history.replaceState gets the same "now in edit mode" result without
  // any of that - the toast stays on screen for its full duration and there's
  // no visible reload at all.
  if (!editMode && data.id) {
    productId = data.id;
    editMode = true;
    history.replaceState(null, "", `add-product.html?id=${data.id}`);
  }
}

function generateSKU(variant) {
  const random = Math.random().toString(36).substring(2, 8);

  const parts = ["storage", "ram", "size", "color", "condition"]
    .map((key) => variant[key])
    .filter(Boolean);

  return [...parts, random].join("-");
}
saveProductButton.addEventListener("click", async () => {
  if (!validateProduct()) return;

  // Previously nothing stopped a double-click (or an impatient re-click on
  // a slow connection) from firing two concurrent saves - either two
  // duplicate products, or two overlapping updates racing each other.
  saveProductButton.disabled = true;
  const originalText = saveProductButton.textContent;
  saveProductButton.textContent = editMode ? "Updating..." : "Saving...";

  try {
    await saveProduct();
  } finally {
    saveProductButton.disabled = false;
    saveProductButton.textContent = originalText;
  }
});
// Field names that belong to the fixed, category-specific specification
// form built by renderSpecifications() - these already have a matching
// [name="..."] input in #specifications-container. Any other key in a
// saved product's `specifications` is a custom spec (added via "+ Add
// Specification") and needs its own row rebuilt in
// #custom-specs-container instead - there's no fixed input for it to
// fill.
const FIXED_SPEC_FIELDS_BY_CATEGORY = {
  Phone: [
    "processor",
    "ram",
    "screenSize",
    "refreshRate",
    "mainCamera",
    "frontCamera",
    "battery",
    "chargingSpeed",
    "operatingSystem",
  ],
  Tablet: [
    "processor",
    "ram",
    "screenSize",
    "refreshRate",
    "mainCamera",
    "frontCamera",
    "battery",
    "chargingSpeed",
    "operatingSystem",
  ],
  Watch: [
    "caseSize",
    "caseMaterial",
    "bandMaterial",
    "displayType",
    "waterResistance",
    "batteryLife",
    "connectivity",
    "compatibleOS",
  ],
  Accessory: [
    "accessoryType",
    "compatibility",
    "material",
    "color",
    "connectorType",
    "warranty",
  ],
};

function collectSpecifications() {
  const specs = {};

  document
    .querySelectorAll("#specifications-container input")
    .forEach((input) => {
      specs[input.name] = input.value;
    });

  // BUG FIX: custom specification rows (added via "+ Add Specification")
  // were never read here at all, so whatever an admin typed into them
  // was silently dropped on save - "Custom Specifications" appeared to
  // do nothing. Every row's two inputs share the same name/value pair
  // attributes across every row (name="customSpecName[]" /
  // name="customSpecValue[]"), so they can't be told apart by .name -
  // read each row's own pair by position instead.
  document
    .querySelectorAll("#custom-specs-container .custom-spec-row")
    .forEach((row) => {
      const [nameInput, valueInput] = row.querySelectorAll("input");
      const specName = nameInput?.value.trim();

      if (specName) {
        specs[specName] = valueInput ? valueInput.value : "";
      }
    });

  return specs;
}

// =========================================================
// INITIAL LOAD
// =========================================================

renderSpecifications(categoryOption.value);
updateBrandFields();
updateVariantsSections();

// ensureAdminAccess() now runs automatically from shared.js as soon as it
// loads (see window.adminAccessCheck) and redirects to login.html if the
// user isn't authenticated. Wait for that result before fetching the
// existing product in edit mode - this page previously had no auth gate
// at all. Form setup above (specs/brand fields) doesn't touch the API, so
// it's left running immediately as before.
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  if (e.target.tagName === "TEXTAREA") return;
  e.preventDefault();
  const focusable = [
    ...document.querySelectorAll(
      "input:not([type='hidden']),select,button.option-box",
    ),
  ].filter((el) => !el.disabled);
  const currentIndex = focusable.indexOf(e.target);
  if (currentIndex !== -1 && focusable[currentIndex + 1]) {
    focusable[currentIndex + 1].focus();
  }
});

if (editMode) {
  window.adminAccessCheck.then((isAuthenticated) => {
    if (isAuthenticated) loadProduct();
  });
}

function checkForPhoneSpecs() {
  const brand = brandOption.value.trim();
  const model = productNameInput.value.trim();
  const category = categoryOption.value;

  if (!brand || !model || !category) return;

  const item = findPhoneSpecs( brand, model);

  if (!item) {
    console.log("No specs found for:", category, brand, model);
    return;
  }

  console.log("Found specs:", item);

  autofillSpecs(item, category);
}
productNameInput.addEventListener("change", checkForPhoneSpecs);

brandOption.addEventListener("change", checkForPhoneSpecs);
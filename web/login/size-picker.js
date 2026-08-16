// =========================================================
// SEARCHABLE SIZE PICKER
// =========================================================
// Same pattern as color-picker.js: typing filters SIZE_LIST, clicking a
// result - or a typed value with no match - adds it as a removable chip.
// #size-options holds JS-rendered chips instead of static option-boxes,
// same as #color-options.
//
// Depends on: state.js (selectedOptions, SIZE_LIST), utils.js (escapeHtml),
// generateVariants() (defined in variants.js, called here at event time
// once every script has loaded).

// Reuses the .color-chip / .color-chip-remove / .color-dropdown-item /
// .color-search-dropdown.open classes from add-product.css (the same
// ones color-picker.js relies on) instead of inventing parallel ones
// (.show, .chip-remove, .color-search-result) that the stylesheet has no
// rules for - that mismatch was why the dropdown/chips rendered with no
// styling (or didn't visibly show at all) even once the JS worked.
const SIZE_LIST = [
  // Extra-small / kids' / petite fashion
  "20mm",
  "22mm",
  "24mm",
  "26mm",

  // Standard range (already had these)
  "28mm",
  "30mm",
  "32mm",
  "34mm",
  "36mm",
  "38mm",
  "40mm",
  "41mm",
  "42mm",
  "44mm",
  "45mm",
  "46mm",
  "47mm",

  // Large / rugged sport / dive watches
  "48mm",
  "49mm",
  "50mm",
  "52mm",

  // Half-sizes some brands use
  "39mm",
  "43mm",

  // Fit sizing (circumference-based bands)
  "S/M",
  "M/L",
];
function renderSizeChips() {
  const container = document.getElementById("size-options");
  if (!container) return;

  container.innerHTML = selectedOptions.size
    .map(
      (size) => `
      <div class="color-chip" data-color-chip="${escapeHtml(size)}">
        ${escapeHtml(size)}
        <button
          type="button"
          class="color-chip-remove"
          data-size="${escapeHtml(size)}"
          aria-label="Remove ${escapeHtml(size)}"
        >&times;</button>
      </div>`,
    )
    .join("");
}

function addSize(size) {
  const value = String(size).trim();
  if (!value) return;

  const alreadySelected = selectedOptions.size.some(
    (s) => s.toLowerCase() === value.toLowerCase(),
  );
  if (alreadySelected) return;

  selectedOptions.size.push(value);
  renderSizeChips();
  generateVariants();

  const input = document.getElementById("size-search-input");
  if (input) input.value = "";
  closeSizeDropdown();
}

function removeSize(size) {
  selectedOptions.size = selectedOptions.size.filter(
    (s) => s.toLowerCase() !== String(size).toLowerCase(),
  );
  renderSizeChips();
  generateVariants();
}

function closeSizeDropdown() {
  const dropdown = document.getElementById("size-search-dropdown");
  if (!dropdown) return;
  dropdown.classList.remove("open");
  dropdown.innerHTML = "";
}

function renderSizeDropdown(query) {
  const dropdown = document.getElementById("size-search-dropdown");
  if (!dropdown) return;

  const trimmedQuery = query.trim();
  const q = trimmedQuery.toLowerCase();

  const alreadySelected = (size) =>
    selectedOptions.size.some((s) => s.toLowerCase() === size.toLowerCase());

  const matches = SIZE_LIST.filter(
    (s) => s.toLowerCase().includes(q) && !alreadySelected(s),
  ).slice(0, 8);

  let html = matches
    .map(
      (s) =>
        `<div class="color-dropdown-item" data-size="${escapeHtml(s)}">${escapeHtml(s)}</div>`,
    )
    .join("");

  // Offer "add as new size" whenever what's typed doesn't exactly match
  // an existing list entry or an already-selected size - same fallback
  // color-picker.js gives for custom colors, so a size like "39mm" that
  // isn't in SIZE_LIST can still be added.
  const exactMatch =
    SIZE_LIST.some((s) => s.toLowerCase() === q) ||
    alreadySelected(trimmedQuery);

  if (trimmedQuery && !exactMatch) {
    html += `
      <div class="color-dropdown-item color-dropdown-add" data-add-custom="${escapeHtml(trimmedQuery)}">
        + Add "${escapeHtml(trimmedQuery)}"
      </div>
    `;
  }

  if (!html) {
    html = `<div class="color-dropdown-empty">No sizes found</div>`;
  }

  dropdown.innerHTML = html;
  dropdown.classList.toggle("open", q.length > 0);
}

let sizeActiveIndex = -1;

function getSizeDropdownItems() {
  const dropdown = document.getElementById("size-search-dropdown");
  if (!dropdown) return [];
  return Array.from(dropdown.querySelectorAll(".color-dropdown-item"));
}

function setSizeActiveIndex(index) {
  const items = getSizeDropdownItems();
  if (!items.length) {
    sizeActiveIndex = -1;
    return;
  }

  sizeActiveIndex = ((index % items.length) + items.length) % items.length;

  items.forEach((item, i) => {
    item.classList.toggle("active", i === sizeActiveIndex);
  });

  items[sizeActiveIndex].scrollIntoView({ block: "nearest" });
}

// BUG FIX: the dropdown/input event listeners were missing entirely in an
// earlier pass - renderSizeDropdown existed but nothing ever called it on
// input, so the dropdown never appeared regardless of what was typed.
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("size-search-input");
  const dropdown = document.getElementById("size-search-dropdown");
  if (!input || !dropdown) return;

  input.addEventListener("input", () => {
    renderSizeDropdown(input.value);
  });

  input.addEventListener("focus", () => {
    renderSizeDropdown(input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!dropdown.classList.contains("open")) {
        renderSizeDropdown(input.value);
      }
      setSizeActiveIndex(sizeActiveIndex + 1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!dropdown.classList.contains("open")) {
        renderSizeDropdown(input.value);
      }
      setSizeActiveIndex(sizeActiveIndex === -1 ? -1 : sizeActiveIndex - 1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const items = getSizeDropdownItems();
      const targetItem =
        sizeActiveIndex !== -1 ? items[sizeActiveIndex] : items[0];

      if (targetItem?.dataset.addCustom) {
        addSize(targetItem.dataset.addCustom);
      } else if (targetItem?.dataset.size) {
        addSize(targetItem.dataset.size);
      } else if (input.value.trim()) {
        addSize(input.value);
      }
      return;
    }

    if (e.key === "Escape") {
      closeSizeDropdown();
    }
  });
});

document.addEventListener("click", (e) => {
  const dropdownItem = e.target.closest(".color-dropdown-item");
  if (dropdownItem) {
    if (dropdownItem.dataset.addCustom) {
      addSize(dropdownItem.dataset.addCustom);
    } else if (dropdownItem.dataset.size) {
      addSize(dropdownItem.dataset.size);
    }
    return;
  }

  const removeBtn = e.target.closest(".color-chip-remove[data-size]");
  if (removeBtn) {
    removeSize(removeBtn.dataset.size);
    return;
  }

  // Click-away closes the dropdown - was missing before, leaving the
  // size dropdown open after clicking elsewhere on the page.
  if (!e.target.closest("#size-picker")) {
    closeSizeDropdown();
  }
});

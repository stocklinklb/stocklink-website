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
//
// Depends on: state.js (BRANDS), dom.js (brandSearchInput,
// brandSearchDropdown, brandOption), utils.js (escapeHtml).

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

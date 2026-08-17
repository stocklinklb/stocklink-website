// =========================================================
// VARIANTS
// =========================================================
// Everything about turning selected storage/RAM/size/color/condition
// options into the cartesian-product variant table: option-box selection,
// generation, rendering, and the category/brand visibility rules that
// decide which option sections show up at all.
//
// Depends on: state.js (selectedOptions, generatedVariants,
// VARIANT_COLUMN_LABELS, getVariantDimensions), dom.js (storageSection,
// ramSection, sizeSection, variantsTableContainer, categoryOption,
// brandOption), utils.js (escapeHtml), color-picker.js (getColorHex),
// color-images.js (renderColorImageUpload).

// Battery health isn't a "pick one or more" dimension like storage/RAM/color -
// it's a single number typed once (see #battery-health) that applies to
// every variant of the product. It's kept out of getVariantDimensions()
// (which drives the cartesian-product combinations in generateVariants())
// on purpose - selectedOptions has no "batteryHealth" array, so treating it
// like the other dimensions used to throw when getOptionListForDimension()
// tried to read .length off undefined, which silently broke variant
// generation for every Apple Phone/Tablet/Watch. Whether the field applies
// mirrors the show/hide logic in updateVariantsSections().
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
  const existingByExactKey = {};
  generatedVariants.forEach((variant) => {
    existingByExactKey[variantKey(variant)] = variant;
  });
  const previousVariants = generatedVariants;

  // BUG FIX: the exact-key lookup above only matches when both sides have
  // the same fields set. That breaks the moment a dimension goes from "no
  // values selected" (so it's excluded from activeDims and never appears
  // on the old variant - variant[dim] is undefined, normalizing to "" in
  // variantKey) to "one value selected" (now active, so every new combo
  // has a real value there). E.g. an old variant only had storage set
  // ("128gb||||"); after checking the first RAM box, the matching new
  // combo's key is "128gb|8gb|||" - no exact match, so the row the admin
  // already priced silently reset to 0/blank even though nothing about
  // it conceptually changed.
  //
  // Falls back to a wildcard match: a field the OLD variant never had set
  // is treated as matching any value, so its price/stock/sku carries
  // forward into the row(s) it now fans out into. Once that dimension has
  // a second value added later, the old variant's field is no longer
  // empty, so this fallback naturally stops applying and a genuinely new
  // combination correctly defaults to 0/blank instead of inheriting an
  // unrelated price.
  function findExistingMatch(combo) {
    const exact = existingByExactKey[variantKey(combo)];
    if (exact) return exact;

    return previousVariants.find((existing) =>
      ["storage", "ram", "size", "color", "condition"].every((key) => {
        const oldVal = existing[key];
        if (oldVal === null || oldVal === undefined || oldVal === "")
          return true;
        return (
          String(oldVal).trim().toLowerCase() ===
          String(combo[key] ?? "")
            .trim()
            .toLowerCase()
        );
      }),
    );
  }

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
    const existing = findExistingMatch(combo);

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

// NOTE: brand used to be a <select id="brand"> populated here from
// BRANDS. That element no longer exists in the HTML - brand is now the
// searchable picker (#brand-picker / #brand-search-input) set up in
// brand-picker.js, backed by a hidden <input id="brand"> that still holds
// the selected value for the rest of this file. This population code is
// gone since there's no <select> left to append <option>s to.

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
        <th>Actions</th>
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
                placeholder="0"
                value="${variant.price === 0 ? "" : variant.price}"
                data-index="${index}"
              >

            </td>

            <td data-label="Stock">

              <input
                class="variant-stock-input"
                type="number"
                min="0"
                placeholder="0"
                value="${variant.stock === 0 ? "" : variant.stock}"
                data-index="${index}"
              >

            </td>
            <td data-label="Actions" class="variant-actions">
  <button
    type="button"
    class="duplicate-variant-button fa-regular fa-copy"
    data-index="${index}"
    aria-label="Duplicate variant"
    title="Duplicate variant"
  ></button>

  <button
    type="button"
    class="delete-variant-button fa-regular fa-trash-can"
    data-index="${index}"
    aria-label="Delete variant"
    title="Delete variant"
  ></button>
</td>

          </tr>

          `,
        )
        .join("")}

    </tbody>

  </table>

`;
}
document.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".delete-variant-button");
  const duplicateBtn = e.target.closest(".duplicate-variant-button");

  // =========================
  // DELETE
  // =========================
  if (deleteBtn) {
    const index = Number(deleteBtn.dataset.index);

    if (!generatedVariants[index]) return;

    // Capture the variant before removing it.
    const deleted = generatedVariants[index];

    generatedVariants.splice(index, 1);

    // Dimensions that can be represented in selectedOptions.
    const dimensions = ["storage", "ram", "size", "color", "condition"];

    dimensions.forEach((dim) => {
      const deletedValue = deleted[dim];

      // Nothing to clean up for this dimension.
      if (
        deletedValue === null ||
        deletedValue === undefined ||
        deletedValue === ""
      ) {
        return;
      }

      // Does another generated variant still use this value?
      const stillUsed = generatedVariants.some((variant) => {
        const value = variant[dim];

        if (value === null || value === undefined || value === "") {
          return false;
        }

        return (
          String(value).trim().toLowerCase() ===
          String(deletedValue).trim().toLowerCase()
        );
      });

      // If another variant still uses it, keep the option selected.
      if (stillUsed) return;

      if (dim === "color") {
        selectedOptions.colors = selectedOptions.colors.filter(
          (color) =>
            String(color.name).trim().toLowerCase() !==
            String(deletedValue).trim().toLowerCase(),
        );

        renderColorChips();

        // Color picker uses chips rather than .option-box elements.
        const colorChip = [...document.querySelectorAll(".color-chip")].find(
          (chip) =>
            chip.textContent.trim().toLowerCase() ===
            String(deletedValue).trim().toLowerCase(),
        );

        if (colorChip) {
          colorChip.remove();
        }
      } else {
        // Remove the value from the corresponding selectedOptions array.
        selectedOptions[dim] = selectedOptions[dim].filter(
          (value) =>
            String(value).trim().toLowerCase() !==
            String(deletedValue).trim().toLowerCase(),
        );

        // Un-toggle the matching option box.
        const optionBox = [...document.querySelectorAll(".option-box")].find(
          (box) =>
            box.textContent.trim().toLowerCase() ===
            String(deletedValue).trim().toLowerCase(),
        );

        if (optionBox) {
          optionBox.classList.remove("selected");
        }
      }
    });

    renderColorImageUpload(selectedOptions.colors);
    renderColorChips();
    renderVariantsTable(generatedVariants);
    return;
  }

  // =========================
  // DUPLICATE
  // =========================
  if (duplicateBtn) {
    const index = Number(duplicateBtn.dataset.index);
    const variantToDuplicate = generatedVariants[index];

    if (!variantToDuplicate) return;

    const duplicatedVariant = {
      ...variantToDuplicate,
      sku: null,
    };

    generatedVariants.splice(index + 1, 0, duplicatedVariant);

    renderVariantsTable(generatedVariants);
  }
});
document.addEventListener(
  "blur",
  (e) => {
    if (!e.target.classList.contains("variant-battery-input")) return;

    if (e.target.value === "") return;

    let value = Number(e.target.value);
    value = Math.max(75, Math.min(100, value));

    e.target.value = value;

    generatedVariants[e.target.dataset.index].batteryHealth = value;
  },
  true,
);

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

  // NOTE: colors used to be handled here too (option-box under
  // #color-options, toggled the same way as storage/ram/condition). Colors
  // are now added/removed exclusively through the searchable color picker
  // (see addColor/removeColor in color-picker.js), which no longer renders
  // .option-box elements - so that branch was dead code and has been
  // removed.

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

function restoreSelectedOptionBoxes() {
  document
    .querySelectorAll(".option-box")
    .forEach((box) => box.classList.remove("selected"));
  restoreGroup("storage-options", selectedOptions.storage);
  restoreGroup("ram-options", selectedOptions.ram);
  restoreGroup("size-options", selectedOptions.size);
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

function generateSKU(variant) {
  const random = Math.random().toString(36).substring(2, 8);

  const parts = ["storage", "ram", "size", "color", "condition"]
    .map((key) => variant[key])
    .filter(Boolean);

  return [...parts, random].join("-");
}

// Initial render so the variants table area isn't blank before a category
// is picked.
renderVariantsTable(generatedVariants);

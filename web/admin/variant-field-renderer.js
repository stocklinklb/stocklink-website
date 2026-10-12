function buildCategoryFields(category) {
  // clear first, so no old fields stay on screen when the category is cleared
  variantOptionsContainer.innerHTML = "";
  if (!category) return;

  getOrderedFields().forEach((field) => {
    const variantOption = document.createElement("div");
    variantOption.className = "variant-option";
    variantOption.setAttribute("data-field-id", field.id);

    const sectionTitle = document.createElement("div");
    sectionTitle.className = "section-title";

    const title = document.createElement("h4");
    title.textContent = field.name;
    sectionTitle.appendChild(title);
    variantOption.appendChild(sectionTitle);

    if (field.type === "SELECT") {
      const optionBoxes = document.createElement("div");
      optionBoxes.className = "option-boxes";

      field.values.forEach((value) => {
        const optionBox = document.createElement("div");
        optionBox.className = "option-box";
        optionBox.textContent = value;
        optionBox.setAttribute("data-option", value);
        optionBox.setAttribute("role", "button");
        optionBox.setAttribute("tabindex", "0");
        optionBox.setAttribute("aria-pressed", "false");
        optionBoxes.appendChild(optionBox);
      });

      variantOption.appendChild(optionBoxes);
    }

    if (field.type === "WRITABLE") {
      const variantPicker = document.createElement("div");
      variantPicker.className = "variant-picker";

      const variantSearchWrapper = document.createElement("div");
      variantSearchWrapper.className = "variant-search-wrapper";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "variant-search-input";
      input.placeholder = `Search or type a ${field.name.toLowerCase()}...`;
      input.setAttribute("autocomplete", "off");

      const variantSearchDropdown = document.createElement("div");
      variantSearchDropdown.className = "variant-search-dropdown";

      field.values.forEach((value) => {
        const item = document.createElement("div");
        item.className = "variant-search-dropdown-item";
        item.setAttribute("role", "option");
        item.setAttribute("data-option", value);

        const span = document.createElement("span");
        span.textContent = value;

        item.appendChild(span);
        variantSearchDropdown.appendChild(item);
      });

      const selectedChips = document.createElement("div");
      selectedChips.className = "selected-variant-chips";

      variantSearchWrapper.appendChild(input);
      variantSearchWrapper.appendChild(variantSearchDropdown);
      variantPicker.appendChild(variantSearchWrapper);
      variantPicker.appendChild(selectedChips);
      variantOption.appendChild(variantPicker);
    }

    variantOptionsContainer.appendChild(variantOption);
  });
}

/* ---------- helpers ---------- */

// The field id of the .variant-option an element sits in
function getFieldId(element) {
  return element.closest(".variant-option").dataset.fieldId;
}

// Draw the selected state of every field FROM formState.selections
function syncFieldSelections() {
  variantOptionsContainer
    .querySelectorAll(".variant-option")
    .forEach((variantOption) => {
      const selected = formState.selections[variantOption.dataset.fieldId] || [];

      variantOption.querySelectorAll(".option-box").forEach((optionBox) => {
        const isSelected = selected.includes(optionBox.dataset.option);
        optionBox.classList.toggle("selected", isSelected);
        optionBox.setAttribute("aria-pressed", String(isSelected));
      });

      const chipsContainer = variantOption.querySelector(".selected-variant-chips");
      if (chipsContainer) {
        chipsContainer.innerHTML = "";
        selected.forEach((value) => chipsContainer.appendChild(createChip(value)));
      }
    });
}

function filterDropdown(input) {
  const dropdown = input
    .closest(".variant-search-wrapper")
    .querySelector(".variant-search-dropdown");

  const search = input.value.toLowerCase().trim();

  dropdown.querySelector(".no-results")?.remove();

  let hasResult = false;

  dropdown
    .querySelectorAll(".variant-search-dropdown-item")
    .forEach((item) => {
      const match = item.dataset.option.toLowerCase().includes(search);
      item.style.display = match ? "" : "none";
      if (match) hasResult = true;
    });

  if (search && !hasResult) {
    const noResults = document.createElement("div");
    noResults.className = "no-results";
    noResults.textContent = `No match. Press Enter to add "${input.value.trim()}".`;
    dropdown.appendChild(noResults);
  }
}

function closePicker(wrapper) {
  const input = wrapper.querySelector(".variant-search-input");
  input.value = "";
  filterDropdown(input);
  wrapper
    .querySelector(".variant-search-dropdown")
    .classList.remove("open");
}

// Add a value to a WRITABLE field (never removes, unlike toggleValue)
function addWritableValue(fieldId, value) {
  const selected = formState.selections[fieldId] || [];
  const exists = selected.some(
    (option) => option.toLowerCase() === value.toLowerCase()
  );
  if (exists) return false;

  const valueOfToggleValue = toggleValue(fieldId, value);
  refresh(valueOfToggleValue);
  return true;
}

function createChip(value) {
  const chip = document.createElement("span");
  chip.className = "selected-variant-chip";
  chip.setAttribute("data-option", value);
  chip.textContent = value;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-variant";
  removeButton.setAttribute("aria-label", `Remove ${value}`);
  removeButton.textContent = "×";

  chip.appendChild(removeButton);
  return chip;
}

/* ---------- listeners (attached once) ---------- */
// Every change goes the same way: update formState → refresh()

variantOptionsContainer.addEventListener("click", (event) => {
  const optionBox = event.target.closest(".option-box");
  if (optionBox) {
    const valueOfToggleValue = toggleValue(getFieldId(optionBox), optionBox.dataset.option);
    refresh(valueOfToggleValue);
    return;
  }

  const dropdownItem = event.target.closest(".variant-search-dropdown-item");
  if (dropdownItem) {
    const wrapper = dropdownItem.closest(".variant-search-wrapper");
    addWritableValue(getFieldId(dropdownItem), dropdownItem.dataset.option);
    closePicker(wrapper);
    return;
  }

  const removeButton = event.target.closest(".remove-variant");
  if (removeButton) {
    const chip = removeButton.closest(".selected-variant-chip");
    // the value is selected, so toggling removes it
    toggleValue(getFieldId(chip), chip.dataset.option);
    refresh();
  }
});

variantOptionsContainer.addEventListener("keydown", (event) => {
  const optionBox = event.target.closest(".option-box");
  if (optionBox && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    const valueOfToggleValue = toggleValue(getFieldId(optionBox), optionBox.dataset.option);
    refresh(valueOfToggleValue);
    return;
  }

  const input = event.target.closest(".variant-search-input");
  if (!input) return;

  const wrapper = input.closest(".variant-search-wrapper");

  if (event.key === "Escape") {
    closePicker(wrapper);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    const typed = input.value.trim();
    if (!typed) return;

    // reuse the list's own casing when the typed value matches an existing one
    const match = Array.from(
      wrapper.querySelectorAll(".variant-search-dropdown-item")
    ).find((item) => item.dataset.option.toLowerCase() === typed.toLowerCase());

    addWritableValue(getFieldId(input), match ? match.dataset.option : typed);
    closePicker(wrapper);
  }
});

variantOptionsContainer.addEventListener("input", (event) => {
  const input = event.target.closest(".variant-search-input");
  if (!input) return;

  input
    .closest(".variant-search-wrapper")
    .querySelector(".variant-search-dropdown")
    .classList.add("open");

  filterDropdown(input);
});

variantOptionsContainer.addEventListener("focusin", (event) => {
  const input = event.target.closest(".variant-search-input");
  if (!input) return;

  input
    .closest(".variant-search-wrapper")
    .querySelector(".variant-search-dropdown")
    .classList.add("open");
});

document.addEventListener("click", (event) => {
  const wrapper = event.target.closest(".variant-search-wrapper");

  document
    .querySelectorAll(".variant-search-dropdown.open")
    .forEach((dropdown) => {
      if (!wrapper || !wrapper.contains(dropdown)) {
        dropdown.classList.remove("open");
      }
    });
});


function buildVariants(fields) {

  // `fields` is an array of [fieldId, values] pairs, already in the
  // category's field order (refresh() builds it from formState).
  // Example:
  // [
  //   [8, ["128GB", "256GB"]],
  //   [7, ["Black", "Blue"]]
  // ]

  // Nothing selected = no variants. Without this, reduce would return
  // [{}]: one empty combination, drawn as an empty table row.
  if (!fields.length) return [];

  // Go through each field one by one.
  //
  // `variants` = all the combinations we have built so far.
  // `[fieldId, values]` = the current field and all of its values.
  //
  // We start `variants` as [{}], meaning:
  // "We currently have one empty combination."
  return fields.reduce((variants, [fieldId, values]) => {

    // Go through every combination we have built so far.
    //
    // For every existing combination, we will create
    // a new combination for every value of the current field.
    //
    // flatMap is used because each variant can produce
    // multiple new variants.
    return variants.flatMap((variant) => {

      // Go through every possible value of the current field.
      return values.map((value) => ({

        // Copy everything that was already in the combination.
        //
        // Example:
        // { 8: "128GB" }
        //
        // gets copied into the new object.
        ...variant,

        // Add the current field and the current value.
        //
        // Example:
        // fieldId = 7
        // value = "Black"
        //
        // becomes:
        // 7: "Black"
        [fieldId]: value

      }));

    });

    // Start reduce with one empty object.
    // This gives us a starting combination to build from.
  }, [{}]);

}

// `fields` = the active fields, in order (they decide the columns).
// Field names and values are user text, so everything goes through escapeHtml().
// `removedCount` = deleted variants hidden from the table (shows the Restore bar).
function renderVariants(variants, fields, removedCount = 0) {
  if (!variants.size && !removedCount) {
    variantsTableContainer.innerHTML = "";
    variantsTableContainer.classList.remove("table-show");
    return;
  }

  // every row was deleted: only the Restore bar is left
  if (!variants.size) {
    variantsTableContainer.innerHTML = renderRestoreBar(removedCount);
    variantsTableContainer.classList.add("table-show");
    return;
  }

  let tableHTML = `
    <table class="variant-table">
      <thead>
        <tr>
  `;

  // Render one header for each selected field
  fields.forEach((field) => {
    tableHTML += `<th>${escapeHtml(field.name)}</th>`;
  });

  // Fixed columns
  tableHTML += `
          <th>Price</th>
          <th>Stock</th>
          <th>SKU</th>
  `;

  tableHTML += `
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  // Render one row for every combination
  variants.forEach((variant, key) => {
    tableHTML += `
      <tr data-variant-key="${escapeHtml(key)}">
    `;

    // Render the selected option values
    fields.forEach((field) => {
      tableHTML += `
        <td data-label="${escapeHtml(field.name)}">
          ${escapeHtml(variant.options[field.id])}
        </td>
      `;
    });

    // Price
    tableHTML += `
        <td data-label="Price">
          <div class="price-cell">
            <span class="currency">$</span>
            <input
              type="number"
              class="variant-price-input"
              min="0"
              step="0.01"
              data-prop = "price"
              value="${escapeHtml(variant.price)}"
            />
          </div>
        </td>
    `;

    // Stock
    tableHTML += `
        <td data-label="Stock">
          <input
            type="number"
            class="variant-stock-input"
            min="0"
            data-prop = "stock"
            value="${escapeHtml(variant.stock)}"
          />
        </td>
    `;

    tableHTML += `
        <td data-label="SKU">
          <input
            type="text"
            class="variant-sku-input"
            maxlength = 40
            placeholder="auto"
            data-prop = "sku"
            value="${escapeHtml(variant.sku)}"
          />
        </td>
    `;

    // Actions
    tableHTML += `
        <td data-label="Actions">
          <div class="variant-actions">
            <button
              type="button"
              class="delete-variant-button"
              aria-label="Delete variant"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  tableHTML += renderRestoreBar(removedCount);

  variantsTableContainer.innerHTML = tableHTML;
  variantsTableContainer.classList.add("table-show");
}

function renderRestoreBar(removedCount) {
  if (!removedCount) return "";

  const label = removedCount === 1 ? "1 variant removed" : `${removedCount} variants removed`;
  return `
    <div class="variants-removed-bar">
      <span>${label}</span>
      <button type="button" class="restore-variants-button">Restore</button>
    </div>
  `;
}


variantsTableContainer.addEventListener("input", (event) => {
  const input = event.target.closest("input[type='number'], input[type='text']");
  if (!input) return;

  const parent = input.closest("tr");

  const key = parent.dataset.variantKey;
  const variant = formState.variants.get(key)
  if (!variant) return;

  if (input.dataset.prop === "price") {
    variant.price = input.value;
  } else if (input.dataset.prop === "stock") {
    variant.stock = input.value;
  } else if (input.dataset.prop === "sku") {
    variant.sku = input.value; // raw text; trimmed and uppercased on save (Phase 7)
  }


  const skus = [...formState.variants.values()].map(v => v.sku?.trim().toUpperCase()).filter(Boolean);// just checking the skus for now 
  const duplicates = skus.filter((sku, index) => sku.indexOf(sku) !== index)
})


// Delete a row / restore deleted rows. Every typed value already lives in
// formState, so a full refresh() loses nothing and keeps one drawing path.
variantsTableContainer.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-variant-button");
  if (deleteButton) {
    removeVariant(deleteButton.closest("tr").dataset.variantKey);
    refresh();
    return;
  }

  if (event.target.closest(".restore-variants-button")) {
    restoreVariants();
    refresh();
  }
});


/*

<div class="variant-option" data-field="Color">
  <div class="section-title"><h4>Available colors</h4></div>
  <div class="variant-picker">
    <div class="variant-search-wrapper">
      <input type="text" class="variant-search-input" placeholder="Search or type a color..." autocomplete="off" />
      <div class="variant-search-dropdown">
        <div class="variant-search-dropdown-item" role="option" data-value="Black">
          <span class="color-circle" style="background:#111"></span>  <!-- optional: colors only -->
          <span>Black</span>
      </div>
      </div>
    </div>
    <div class="selected-variant-chips">
      <span class="selected-variant-chip">
        Black
        <button type="button" class="remove-variant" aria-label="Remove Black">&times;</button>
      </span>
    </div>
  </div>
</div>


<div class="variant-option" data-field="Storage">
  <div class="section-title"><h4>Available storage</h4></div>
  <div class="option-boxes">
    <div class="option-box" role="button" tabindex="0" aria-pressed="false">128GB</div>
    <div class="option-box selected" role="button" tabindex="0" aria-pressed="true">256GB</div>
    <div class="option-box" role="button" tabindex="0" aria-pressed="false">512GB</div>
  </div>
</div>

{
    "id": 3,
    "storeId": 2,
    "name": "Dfsafsda",
    "businessTypeId": null,
    "createdAt": "2026-10-05T15:46:13.341Z",
    "updatedAt": "2026-10-05T17:09:12.555Z",
    "fields": [
        {
            "id": 10,
            "categoryId": 3,
            "name": "dsfafdsa",
            "type": "WRITABLE",
            "values": [
                "asfdfads",
                "sxdfds"
            ],
            "position": 0,
            "createdAt": "2026-10-05T17:09:12.555Z",
            "updatedAt": "2026-10-05T17:09:12.555Z"
        }
    ]
}*/
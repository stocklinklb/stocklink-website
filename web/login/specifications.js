// =========================================================
// SPECIFICATIONS
// =========================================================
// Renders the category-specific specification form, handles custom
// (admin-added) specification rows, collects everything back out for
// saving, and wires up the auto-fill lookup that fills specs in from a
// known phone/tablet model.
//
// Depends on: state.js (FIXED_SPEC_FIELDS_BY_CATEGORY,
// requiredSpecsByCategory), dom.js (specificationsContainer,
// addSpecButton, customSpecsContainer, categoryOption, brandOption,
// productNameInput), utils.js (escapeHtml), variants.js
// (updateVariantsSections, generateVariants, updateBrandFields),
// csv-load/specsLookUp.js (findPhoneSpecs), csv-load/specsAutoFill.js
// (autofillSpecs).

function renderSpecifications(categoryValue) {
  // BUG FIX / FEATURE: createInput() previously had no way to show which
  // fields validateProduct() actually requires (see requiredSpecsByCategory
  // in product-form.js) - the required="*" marker only ever appeared on
  // Product Name/Brand/Category, so an admin had no visual cue that, say,
  // "Processor" was mandatory for a Phone until they tried to save and hit
  // the "Product processor is required" toast. Look up this category's
  // required list once and pass each field's own name into createInput()
  // so it can add the same <span class="required">*</span> markup used
  // elsewhere in the form.
  const requiredSpecs = requiredSpecsByCategory[categoryValue] || [];

  if (categoryValue === "Phone" || categoryValue === "Tablet") {
    specificationsContainer.innerHTML = `

      <div class="spec-section">

        <h3>Phone Specifications</h3>


        <div class="form-grid">


          ${createInput("Processor", "processor", "e.g. Snapdragon 8 Elite", requiredSpecs)}

          ${createInput("RAM", "ram", "e.g. 12GB", requiredSpecs)}

          ${createInput("Screen Size", "screenSize", "e.g. 6.7 inch", requiredSpecs)}

          ${createInput("Refresh Rate", "refreshRate", "e.g. 120Hz", requiredSpecs)}

          ${createInput("Main Camera", "mainCamera", "e.g. 50MP", requiredSpecs)}

          ${createInput("Front Camera", "frontCamera", "e.g. 12MP", requiredSpecs)}

          ${createInput("Battery Capacity", "battery", "e.g. 5000mAh", requiredSpecs)}

          ${createInput("Charging Speed", "chargingSpeed", "e.g. 45W", requiredSpecs)}

          ${createInput("Operating System", "operatingSystem", "e.g. Android 15", requiredSpecs)}


        </div>

      </div>

    `;
  } else if (categoryValue === "Watch") {
    specificationsContainer.innerHTML = `

    <div class="spec-section">

      <h3>Watch Specifications</h3>


      <div class="form-grid">


        ${createInput("Case Size", "caseSize", "e.g. 45mm", requiredSpecs)}

        ${createInput("Case Material", "caseMaterial", "e.g. Titanium", requiredSpecs)}

        ${createInput("Band Material", "bandMaterial", "e.g. Sport Band", requiredSpecs)}

        ${createInput("Display Type", "displayType", "e.g. AMOLED", requiredSpecs)}

        ${createInput("Water Resistance", "waterResistance", "e.g. 50m", requiredSpecs)}

        ${createInput("Battery Life", "batteryLife", "e.g. 18 hours", requiredSpecs)}

        ${createInput("Connectivity", "connectivity", "e.g. GPS + Cellular", requiredSpecs)}

        ${createInput("Compatible OS", "compatibleOS", "e.g. watchOS 11", requiredSpecs)}


      </div>


    </div>

    `;
  } else if (categoryValue === "Accessory") {
    specificationsContainer.innerHTML = `

    <div class="spec-section">

      <h3>Accessory Specifications</h3>


      <div class="form-grid">


        ${createInput("Type", "accessoryType", "e.g. Charger", requiredSpecs)}

        ${createInput("Compatibility", "compatibility", "e.g. iPhone 16", requiredSpecs)}

        ${createInput("Material", "material", "e.g. Silicone", requiredSpecs)}

        ${createInput("Color", "color", "e.g. Black", requiredSpecs)}

        ${createInput("Connector Type", "connectorType", "e.g. USB-C", requiredSpecs)}

        ${createInput("Warranty", "warranty", "e.g. 1 Year", requiredSpecs)}


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

function createInput(label, name, placeholder, requiredSpecs = []) {
  // Same required-field marker used for Product Name/Brand/Category in
  // add-product.html, so a required spec reads identically to the rest
  // of the form instead of looking like a separate, unmarked system.
  const isRequired = requiredSpecs.includes(name);
  const requiredMarker = isRequired ? ` <span class="required">*</span>` : "";

  return `

<div class="form-group">

<label>${label}${requiredMarker}</label>

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
// PHONE-SPEC AUTOFILL
// =========================================================

function checkForPhoneSpecs() {
  const brand = brandOption.value.trim();
  const model = productNameInput.value.trim();
  const category = categoryOption.value;

  if (!brand || !model || !category) return;

  const item = findPhoneSpecs(brand, model);

  if (!item) {
    console.log("No specs found for:", brand, model);
    return;
  }

  console.log("Found specs:", item);

  autofillSpecs(item, category);
}
productNameInput.addEventListener("change", checkForPhoneSpecs);

brandOption.addEventListener("change", checkForPhoneSpecs);

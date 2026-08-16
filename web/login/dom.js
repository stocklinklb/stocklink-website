// =========================================================
// DOM ELEMENT REFERENCES
// =========================================================
// Single source of truth for every *static* element this admin page
// reads from or writes to. Load this script before any file that uses
// these consts (currently: modelNameSearch.js, specsAutoFill.js,
// add-products.js).
//
// Elements that have to be looked up dynamically/parametrically at
// call-time - e.g. a spec input matched by `[name="${spec}"]`, a
// per-color image box matched by `[data-color-box="${color}"]`, or the
// "next focusable field" query on Enter - are NOT cached here, since
// their target depends on a runtime value or on elements that don't
// exist until later (custom spec rows, variant table rows, etc.).

// --- Product info ---
const featuredCheckBox = document.getElementById("featured-product");
const productNameInput = document.getElementById("product-name");
const dropdown = document.getElementById("product-name-dropdown"); // model-name search results
const categoryOption = document.getElementById("category");
const warrantyInput = document.getElementById("product-warranty");
const descriptionInput = document.getElementById("product-description");
const descriptionCount = document.getElementById("description-count");

// --- Brand picker ---
const brandSearchInput = document.getElementById("brand-search-input");
const brandSearchDropdown = document.getElementById("brand-search-dropdown");
// Hidden input holding the actual selected brand value. Everywhere else
// (save/validate/reset/edit-mode load/spec autofill) reads or writes the
// brand through this one reference.
const brandOption = document.getElementById("brand");

// --- Color picker ---
const colorSearchInput = document.getElementById("color-search-input");
const colorSearchDropdown = document.getElementById("color-search-dropdown");
const colorChipsContainer = document.getElementById("color-options");
const colorImagesContainer = document.getElementById("color-images-container");

// --- Specifications ---
const specificationsContainer = document.getElementById(
  "specifications-container",
);
const addSpecButton = document.getElementById("add-spec-btn");
const customSpecsContainer = document.getElementById("custom-specs-container");

// --- Variant sections ---
const storageSection = document.getElementById("storage-option");
const ramSection = document.getElementById("ram-option");
const sizeSection = document.getElementById("size-option");
const variantsTableContainer = document.getElementById(
  "variants-table-container",
);

// --- Actions ---
const resetProductButton = document.getElementById("reset-product-btn");
const saveProductButton = document.getElementById("save-product-btn");
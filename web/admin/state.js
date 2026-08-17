// =========================================================
// SHARED STATE & CONFIG
// =========================================================
// Single source of truth for page-wide state and static config that more
// than one feature file needs. Load this before brand-picker.js,
// color-picker.js, color-images.js, variants.js, specifications.js, and
// product-form.js - they all read/write these globals.

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
  "HollyLand",
  "ONEMUST",
  "SoundCore",
  "Moxom",
  "HAVIT",
  "BWOO",
  "VIDIVE",
  "Jmary",
  "Oraimo",
  "Anker",
  "DADU",
  "Ace Fast",
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

const selectedOptions = {
  storage: [],
  ram: [],
  size: [],
  colors: [],
  condition: [],
};
const colorImages = {};

// Variants generator state
let generatedVariants = [];

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

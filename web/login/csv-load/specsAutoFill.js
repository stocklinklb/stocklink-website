// Maps each category's CSV column names to the `name` attribute of the
// matching input rendered by renderSpecifications()/createInput() in
// add-products.js. Keep this in sync with FIXED_SPEC_FIELDS_BY_CATEGORY
// there - each key below must match one of those input names.
//
// Tablet intentionally uses the same columns as Phone: renderSpecifications
// builds the identical field set for both categories, so they can share
// one row shape in the CSV.
const SPEC_FIELD_MAPS = {
  Phone: {
    processor: "cpu",
    ram: "ram",
    screenSize: "screen_size",
    refreshRate: "refresh_rate",
    mainCamera: "main_camera",
    frontCamera: "front_camera",
    battery: "battery_capacity",
    chargingSpeed: "charging_speed",
    operatingSystem: "operating_system",
  },
  Tablet: {
    processor: "cpu",
    ram: "ram",
    screenSize: "screen_size",
    refreshRate: "refresh_rate",
    mainCamera: "main_camera",
    frontCamera: "front_camera",
    battery: "battery_capacity",
    chargingSpeed: "charging_speed",
    operatingSystem: "operating_system",
  },
  Watch: {
    caseSize: "case_size",
    caseMaterial: "case_material",
    bandMaterial: "band_material",
    displayType: "display_type",
    waterResistance: "water_resistance",
    batteryLife: "battery_life",
    connectivity: "connectivity",
    compatibleOS: "compatible_os",
  },
  Accessory: {
    accessoryType: "accessory_type",
    compatibility: "compatibility",
    material: "material",
    color: "color",
    connectorType: "connector_type",
    warranty: "warranty",
  },
};

// Fills the existing category-specific spec inputs (rendered by
// renderSpecifications()) with values looked up from the CSV, instead of
// rebuilding #specifications-container from scratch. `category` picks
// which column map to use, since Watch/Accessory have a completely
// different set of spec fields than Phone/Tablet.
function autofillSpecs(item, category) {
  if (!item || !category) return;

  if (!specificationsContainer) return;

  const fieldMap = SPEC_FIELD_MAPS[category];
  if (!fieldMap) return;

  Object.entries(fieldMap).forEach(([inputName, csvColumn]) => {
    const value = item[csvColumn];
    if (value === undefined) return;

    const input = specificationsContainer.querySelector(
      `input[name="${inputName}"]`,
    );

    // No matching input currently rendered for this field - skip it
    // rather than creating one.
    if (!input) return;

    input.value = value;
  });
}

function getSpecifications(item,category){
 
  if(!item || !category) return;
 
  const fieldMap = SPEC_FIELD_MAPS[category];
  if(!fieldMap) return;

  const specs = {};

  Object.entries(fieldMap).forEach(([inputName , csvColumn]) => {
    specs[inputName] = item[csvColumn] || "";
  })
  return specs;

}
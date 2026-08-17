// Trims, lowercases, and collapses repeated internal whitespace so
// "Galaxy  S23 " and "galaxy s23" both match "Galaxy S23" in the specs
// CSV. Without this, a single extra space anywhere in an Excel cell
// (a very easy mistake to make) causes an exact-match miss and the row
// gets flagged "Specifications not found" even though the phone is
// actually in the specs list.
function normalizeSpecValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
function findPhoneSpecs(brand, model) {
  const targetBrand = normalizeSpecValue(brand);
  const targetModel = normalizeSpecValue(model);

  return phoneSpecs.find(
    (item) =>
      normalizeSpecValue(item.brand) === targetBrand &&
      normalizeSpecValue(item.model) === targetModel,
  );
}

// ==================================
// DECLARATION IN AN OBJECTS < 
// BETTER WRITING SYNTAX , 
// READEBILTY AND STATES FROM ONE
//  SHARED PLACE.
// ==================================
const formState = {
  category: null,
  selections: {},
  variants: new Map(),
  removedVariants: new Map(), // key → the deleted variant, kept so Restore brings its price back
  images: [],
  deleteImagesId: [],
  viewMode: "table"
}

const MAX_COMBINATIONS = 200; // Q8

// =================================
//            FUNCTIONS
// =================================

// How many combinations there would be with one more value in fieldId.
// Combinations = the number of selected values of each field, multiplied.
function countWithOneMore(fieldId) {
  return Object.entries(formState.selections).reduce(
    (total, [id, values]) =>
      total * (id === String(fieldId) ? values.length + 1 : values.length),
    1
  );
}
function setCategory(category) {
  formState.category = category || null;
  formState.selections = {};
  formState.variants = new Map();
  formState.removedVariants = new Map();

  resetCategoryText();
  categoryInput.value = category ? category.id : "";

  // Fields are drawn only when the category changes, so a half-typed
  // search input isn't wiped on every refresh
  buildCategoryFields(formState.category);
  refresh();
}

function toggleValue(fieldId, value) {
  formState.selections ??= {};

  formState.selections[fieldId] ??= [];

  const selections = formState.selections[fieldId];

  if (!selections.includes(value)) {
    // Q8: refuse the click instead of building more than the limit
    if (countWithOneMore(fieldId) > MAX_COMBINATIONS) {
      showToast(
        `Too many combinations (max ${MAX_COMBINATIONS}). Deselect some values first.`,
        "error"
      );
    } else {
      const isFirstValue = selections.length === 0;
      selections.push(value);
      if (isFirstValue) {
        // it just got it's first value , we return it's fieldId.
        return fieldId;
      } else {
        return null;
      }

    }
  } else {
    formState.selections[fieldId] = selections.filter(
      (v) => v !== value
    );
  }

  if (!formState.selections[fieldId].length) {
    delete formState.selections[fieldId];
  }
}

// making a key for variants in the next form [[10,"BLK"] , [8,"WHITE"]] , as 10 is the id , and WHITE or BLK is the value selected

function makeVariantKey(options, fields) {
  return JSON.stringify(fields.map(field =>
    [field.id, options[field.id]]
  ))
}

// The selected category's fields, in the category's own order
function getOrderedFields() {
  if (!formState.category) return []; // if not category is se
  return [...formState.category.fields].filter(field => !field.archivedAt).sort((a, b) => a.position - b.position);
  // return the category fields sorted by position (small to high)
}

// Delete one variant: out of the table, into removedVariants (with its price)
function removeVariant(key) {
  const variant = formState.variants.get(key);
  if (!variant) return;

  formState.variants.delete(key);
  formState.removedVariants.set(key, variant);
}

// Put every deleted variant back. refresh() then keeps the ones whose
// combination is still selected (with their prices) and drops the rest.
function restoreVariants() {
  formState.removedVariants.forEach((variant, key) => {
    formState.variants.set(key, variant);
  });
  formState.removedVariants.clear();
}

function hasWork() {
  return Object.keys(formState.selections).length > 0;
}

// Show the current category's name in the search box (or empty if none)
function resetCategoryText() {
  categorySearch.value = formState.category ? capitalize(formState.category.name) : "";
}

// The one redraw. Every action updates formState, then calls this.
// The screen is only drawn FROM formState, never read back.
function refresh(newFieldId) {
  // fields with no selected values drop out of the combinations (Q7)
  const activeFields = getOrderedFields().filter(
    (field) => formState.selections[field.id]
  );

  // we fitler any selections field that is present in the active field

  const combinations = buildVariants(
    activeFields.map((field) => [field.id, formState.selections[field.id]])
  );
  const nextVariant = new Map();
  let removedCount = 0; // deleted variants that would otherwise be on screen

  combinations.forEach((options) => {
    const key = makeVariantKey(options, activeFields);

    if (formState.removedVariants.has(key)) {
      removedCount++;
      return;
    }

    // same combination as before: keep it as it is
    if (formState.variants.has(key)) {
      nextVariant.set(key, formState.variants.get(key));
      return;
    }

    // a new combination starts empty
    const variant = { key, options, id: null, sku: "", price: "", stock: "" };

    // First value of a new field: every key changed shape. The row this one
    // grew from has the same key without the new field; carry its price and
    // SKU over (never stock).
    if (newFieldId) {
      // newFieldId comes from data-field-id (a string), field.id is a number
      const oldFields = activeFields.filter(
        (field) => String(field.id) !== String(newFieldId)
      );
      const oldKey = makeVariantKey(options, oldFields);
      const old =
        formState.variants.get(oldKey) || formState.removedVariants.get(oldKey);

      if (old) {
        variant.price = old.price;
        variant.sku = old.sku;
      }

      // the old row was deleted, so the row it grew into stays deleted
      if (formState.removedVariants.has(oldKey)) {
        formState.removedVariants.set(key, variant);
        removedCount++;
        return;
      }
    }

    nextVariant.set(key, variant);
  })
  formState.variants = nextVariant;
  // building variants , as we are assisinging that for each field , it have an id , and a selection with that field id

  syncFieldSelections();
  renderVariants(formState.variants, activeFields, removedCount);
}


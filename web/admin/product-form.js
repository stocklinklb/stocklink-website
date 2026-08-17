// =========================================================
// PRODUCT FORM
// =========================================================
// Ties everything else together: edit-mode setup, the description
// character counter, reset/validate/save, loading an existing product for
// edit, and the page bootstrap at the bottom. Loaded last since its
// top-level init code calls into every other module.
//
// Depends on: state.js, dom.js, utils.js (escapeHtml), color-picker.js
// (renderColorChips, closeColorDropdown), color-images.js
// (renderColorImageUpload, loadExistingImages, uploadColorImages,
// deleteRemovedImages), variants.js (generateVariants, renderVariantsTable,
// updateBrandFields, updateVariantsSections, restoreSelectedOptionBoxes,
// syncVariantOptions, generateSKU, getVariantDimensions,
// VARIANT_COLUMN_LABELS), specifications.js (renderSpecifications,
// createCustomSpecRow, collectSpecifications).

// Live character counter
descriptionInput.addEventListener("input", () => {
  descriptionCount.textContent = `${descriptionInput.value.length} / 300`;
});

// Note: a "generateVariantsButton" reference to a #generate-variants-btn
// element used to live here but no such element exists in add-product.html
// and nothing ever attached a listener to it - removed as dead code. If a
// manual "Generate Variants" trigger is wanted, add the button to the HTML
// and wire it to generateVariants().

// =========================================================
// SKELETON LOADING (edit mode)
// =========================================================
// #product-form-content wraps the entire real form; #product-form-skeleton
// is an empty sibling placeholder (see add-product.html). Neither uses the
// data-loading/.skel-only/.real-only pattern from skeleton.js, since that
// pattern expects hand-authored skeleton markup next to each real field -
// impractical for a form this size. Instead the whole form is swapped for
// generic shimmer rows (Skeleton.listItems) while loadProduct() is in
// flight, then swapped back once fillProductInformation() has run - or the
// load failed, so it never gets stuck showing skeleton over a broken form.
const productFormContent = document.getElementById("product-form-content");
const productFormSkeleton = document.getElementById("product-form-skeleton");

function showFormSkeleton() {
  if (!productFormContent || !productFormSkeleton) return;
  Skeleton.listItems(productFormSkeleton, { rows: 10, height: 44 });
  productFormSkeleton.style.display = "";
  productFormContent.style.display = "none";
}

function hideFormSkeleton() {
  if (!productFormContent || !productFormSkeleton) return;
  productFormSkeleton.style.display = "none";
  productFormSkeleton.innerHTML = "";
  productFormContent.style.display = "";
}

// Transform Page to Edit Mode
if (editMode) {
  saveProductButton.textContent = "Update Product";
  resetProductButton.textContent = "Revert to previous state";
  // Mask the form immediately - loadProduct() (called later, once the
  // auth check resolves) is what will reveal it again. Without this, the
  // real form would sit there empty/default-valued for a beat before the
  // fetch finishes and fills it in.
  showFormSkeleton();
}

// =========================================================
// RESET
// =========================================================

function resetProductForm() {
  editMode = false;
  productId = null;

  history.replaceState(null, "", "/admin/add-product.html");
  saveProductButton.textContent = "Save Product";
  resetProductButton.textContent = "Reset Product";
  // clear normal inputs
  document.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });

  // reset selects
  // Now that add-product.html has a blank "Select category" default option
  // (Bug 20 fix), reset back to that blank state instead of silently
  // pre-picking "Phone" for the admin.
  categoryOption.value = "";
  brandOption.value = "";

  // BUG FIX: clearing the hidden #brand input alone left the visible
  // brand search input showing the old typed/selected brand name (and
  // selectedBrand still holding it), so the field looked untouched even
  // though the underlying value had actually been reset.
  selectedBrand = "";
  if (brandSearchInput) brandSearchInput.value = "";
  closeBrandDropdown();
  descriptionInput.value = "";
  descriptionCount.textContent = "0 / 300";
  // clear selected options
  selectedOptions.storage = [];
  selectedOptions.ram = [];
  selectedOptions.size = [];
  selectedOptions.colors = [];
  selectedOptions.condition = [];

  // remove selected styling
  document.querySelectorAll(".option-box.selected").forEach((option) => {
    option.classList.remove("selected");
  });

  // clear variants
  generatedVariants = [];
  renderVariantsTable([]);

  // regenerate specifications
  renderSpecifications(categoryOption.value);

  // clear custom specs
  customSpecsContainer.innerHTML = "";

  // Clear uploaded/selected image state and its DOM - previously reset
  // cleared every other piece of state but left colorImages and the color
  // upload boxes untouched, so old previews stayed on screen right under
  // the "Product form cleared" toast.
  Object.keys(colorImages).forEach((color) => {
    colorImages[color].forEach((image) => {
      if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    });
    delete colorImages[color];
  });
  colorImagesContainer.innerHTML = "";

  // BUG FIX: reset cleared selectedOptions.colors but never re-rendered
  // #color-options, so the old chips (and an open search dropdown, if the
  // admin happened to be mid-search) stayed on screen after "Product form
  // cleared" appeared.
  renderColorChips();
  closeColorDropdown();

  updateBrandFields();
  updateVariantsSections();

  showToast("Product form cleared", "success");
}

resetProductButton.addEventListener("click", () => {
  if (editMode) {
    // In edit mode, "Revert to previous state" means undo whatever the
    // admin has typed/changed and go back to what's actually saved for
    // this product - not wipe the form. reload() re-requests the exact
    // same URL, which still has ?id=... on it, so the page comes back up
    // in edit mode for the same product and loadProduct() re-fetches and
    // re-fills its real data.
    //
    // BUG FIX: window.scrollTo() used to be called right after reload(),
    // but reload() unloads the page immediately, so that scroll call never
    // had anything left to act on - it was dead code. Worse, browsers
    // restore the previous scroll position by default on reload, so the
    // admin would land back wherever they'd scrolled to instead of the
    // top. Setting scrollRestoration to "manual" tells the browser not to
    // do that, so the reloaded page opens at the top like a fresh
    // navigation would.
    history.scrollRestoration = "manual";
    window.location.reload();
    return;
  }
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
  resetProductForm();
});

// =========================================================
// VALIDATION
// =========================================================

function validateProduct() {
  const productName = productNameInput.value.trim();
  if (productName === "") {
    showToast("Product Name is required", "error");
    return false;
  }
  if (brandOption.value === "") {
    showToast("Product Brand is required", "error");
    return false;
  }
  if (descriptionInput.length > 1500) {
    showToast("Product Description Is Too Long", "error");
    return false;
  }
  // The category <select> previously had no blank option, so it always
  // held a real value ("Phone" by default) and this check could never
  // actually fire - the required "*" marker was misleading. Now that a
  // blank "Select category" option exists, this check does something.
  if (categoryOption.value === "") {
    showToast("Product Category is required", "error");
    return false;
  }

  const requiredSpecs = requiredSpecsByCategory[categoryOption.value] || [];

  for (const spec of requiredSpecs) {
    const input = document.querySelector(`[name="${spec}"]`);
    if (input && input.value.trim() === "") {
      showToast(`Product ${spec} is required`, "error");
      return false;
    }
  }
  // Every selected color needs at least one image before saving. Checks
  // colorImages[color.name] directly rather than the DOM, so it also
  // works for colors whose upload box hasn't been touched yet.
  const colorMissingImages = selectedOptions.colors.find(
    (color) => !(colorImages[color.name]?.length > 0),
  );

  if (colorMissingImages) {
    showToast(`${colorMissingImages.name} needs at least one image`, "error");
    return false;
  }
  // Which fields a "complete" variant needs depends on category now, not
  // brand - Phone/Tablet need storage+RAM, Watch needs size, Accessory
  // needs neither (see CATEGORY_VARIANT_DIMENSIONS).
  const dims = getVariantDimensions();
  const hasValidVariant = generatedVariants.some((variant) =>
    dims.every((dim) => !!variant[dim]),
  );

  if (!hasValidVariant) {
    const needed = dims.map((dim) => VARIANT_COLUMN_LABELS[dim]).join(", ");
    showToast(`Products need ${needed} selected`, "error");

    return false;
  }
  const invalidVariant = generatedVariants.some((variant) => {
    const hasPrice = variant.price > 0;

    if (!hasPrice) {
      return true;
    }

    return false;
  });

  if (invalidVariant) {
    showToast("Variant price and stock must both be filled", "error");

    return false;
  }
  return true;
}

// =========================================================
// LOAD (EDIT MODE)
// =========================================================

async function loadProduct() {
  let response;
  let product;

  try {
    response = await fetch(`${API}/${productId}`, { credentials: "include" });
    product = await response.json();
  } catch (error) {
    console.error(error);
    showToast("Could not reach the server to load this product", "error");
    // Reveal the (empty/default) form rather than leaving the skeleton up
    // forever - there's nothing left to wait for on a network failure.
    hideFormSkeleton();
    return;
  }

  // Previously this was never checked, so a 404 body like
  // { error: "Product not found" } got passed straight into
  // fillProductInformation() and crashed trying to read product.colors /
  // product.variants off it.
  if (!response.ok) {
    showToast(product.error || "Failed to load product", "error");
    hideFormSkeleton();
    return;
  }

  currentProduct = product;
  fillProductInformation(product);
  hideFormSkeleton();
}

function fillProductInformation(product) {
  productNameInput.value = product.name || "";
  featuredCheckBox.checked = product.featured;
  categoryOption.value = product.category || "";
  warrantyInput.value = product.warranty || "";
  brandOption.value = product.brand || "";

  // BUG FIX: this set the hidden #brand input's value but never touched
  // the visible brand search input or selectedBrand, so an edited
  // product's brand was saved/validated correctly but the picker
  // displayed as empty on load - looked like the brand hadn't been set.
  selectedBrand = product.brand || "";
  if (brandSearchInput) brandSearchInput.value = product.brand || "";
  descriptionInput.value = product.description || "";
  renderSpecifications(product.category);
  updateBrandFields();
  updateVariantsSections();

  // Every variant of an Apple Phone/Tablet/Watch carries the same
  // batteryHealth value (see schema.prisma) - pull it from whichever
  // variant has one, since #battery-health is a single shared input, not
  // per-variant.

  if (product.optionSchema) {
    // optionSchema is a free-form Json column with nothing enforcing its
    // shape at the DB level, so a product created another way (script,
    // manual edit, future API version) could have a partial value here.
    // Default to an empty array instead of crashing on undefined.
    selectedOptions.storage = [...(product.optionSchema.storage || [])];
    selectedOptions.ram = [...(product.optionSchema.ram || [])];
    selectedOptions.size = [...(product.optionSchema.size || [])];
    selectedOptions.colors = (product.colors || []).map((color) => ({
      id: color.id,
      name: color.name,
    }));
    selectedOptions.condition = [...(product.optionSchema.condition || [])];

    restoreSelectedOptionBoxes();

    // BUG FIX: restoreSelectedOptionBoxes() only re-applies the .selected
    // class to the fixed storage/RAM/condition .option-box elements -
    // size and color use the separate searchable-chip picker (same
    // pattern as color-picker.js), which has its own render function and
    // was never called here. selectedOptions.size/.colors were being set
    // correctly above, but nothing painted the chips into #size-options /
    // #color-options, so an edited Watch's saved size (e.g. "40mm")
    // silently didn't show until the admin re-typed and re-selected it.
    renderSizeChips();
    renderColorChips();

    // Load images AFTER colors exist
    loadExistingImages(product.colors);
    // Create color upload boxes
    renderColorImageUpload(selectedOptions.colors);
  }
  // create the specification inputs first

  if (product.specifications) {
    console.log("Specifications from DB:", product.specifications);

    // Clear any stale custom-spec rows left over from a previous
    // fillProductInformation() call before rebuilding them below.
    customSpecsContainer.innerHTML = "";

    const fixedFields = FIXED_SPEC_FIELDS_BY_CATEGORY[product.category] || [];

    Object.entries(product.specifications).forEach(([key, value]) => {
      console.log("Trying to fill:", key, value);

      // BUG FIX: this used to look up `[name="${key}"]` for every saved
      // spec key, unconditionally. That only ever matches the fixed,
      // category-specific fields - a custom spec's key (e.g. "Warranty
      // Type") has no input anywhere in the DOM to match, so it just
      // silently failed to load and looked like custom specs were never
      // saved at all. Fixed fields still fill their existing input;
      // anything else gets its own custom-spec row rebuilt instead.
      if (fixedFields.includes(key)) {
        const input = document.querySelector(
          `#specifications-container [name="${key}"]`,
        );

        console.log("Found input:", input);

        if (input) {
          input.value = value;
        }
      } else {
        customSpecsContainer.appendChild(createCustomSpecRow(key, value));
      }
    });
  }

  // Only pull in the fields that actually apply to this product's
  // category (see CATEGORY_VARIANT_DIMENSIONS) - e.g. a Watch's loaded
  // variants only get a `size` field, never storage/ram, so they line up
  // with what generateVariants() builds going forward and can be matched
  // by variantKey(). Guards against a missing variants/options object the
  // same way the old code did (this used to call .map() unconditionally
  // and crash if `variants` was undefined).
  const dims = getVariantDimensions();

  generatedVariants = (product.variants || []).map((variant) => {
    const options = variant.options || {};
    const built = {};

    dims.forEach((dim) => {
      built[dim] = options[dim] || null;
    });

    return {
      ...built,
      price: variant.price ?? 0,
      stock: variant.stock ?? 0,
      sku: variant.sku || null,
      batteryHealth: variant.batteryHealth ?? null,
    };
  });
  syncVariantOptions();

  generateVariants();
}

// =========================================================
// SAVE
// =========================================================

async function saveProduct() {
  // Always build the product from the current form state. Previously,
  // edit mode just re-sent the untouched product fetched from the server,
  // so any changes made in the form were silently discarded on update.
  console.log("SAVE START");
  const product = {
    name: productNameInput.value,

    category: categoryOption.value,

    brand: brandOption.value,
    warranty: warrantyInput?.value.trim() || null,
    featured: featuredCheckBox.checked,
    description: descriptionInput.value.trim(),

    specifications: collectSpecifications(),

    optionSchema: {
      storage: selectedOptions.storage,
      ram: selectedOptions.ram,
      size: selectedOptions.size,
      colors: selectedOptions.colors.map((color) => color.name),
      condition: selectedOptions.condition,
    },

    colors: selectedOptions.colors.map((color) => ({
      id: color.id,
      name: color.name,
    })),

    // Which fields count as "required" (for the filter below) and which
    // fields get sent (for each variant's `options`) both come from the
    // current category's dimension list now, not a hardcoded Apple/else
    // brand check - that never accounted for Watch (size) or Accessory
    // (neither storage nor RAM) at all, so e.g. a Watch variant could
    // never pass this filter no matter what was selected.
    variants: generatedVariants
      .filter((variant) =>
        getVariantDimensions().every((dim) => !!variant[dim]),
      )
      .map((variant) => {
        const options = {};
        getVariantDimensions().forEach((dim) => {
          options[dim] = variant[dim];
        });

        return {
          options,

          // BUG FIX: this used to call generateSKU(variant) unconditionally,
          // so every save - including a plain edit that changed nothing but
          // price/stock - minted a brand new random SKU for every variant,
          // even ones that already had a stable SKU from a previous save.
          // That churns the sku column pointlessly and risks collisions with
          // the @unique constraint across saves. Reuse variant.sku when this
          // combination already had one (set by loadProduct ->
          // fillProductInformation, and preserved across regenerateVariants
          // via the existingByKey lookup); only mint a fresh SKU when there
          // truly isn't one yet.
          sku: variant.sku || generateSKU(variant),

          // NOTE: removed the `colors: [variant.color]` field that used to
          // be sent here. Neither validateProductPayload nor the
          // create/update handlers in products.js ever read `variant.colors`
          // - it was dead data that just bloated the request body. The
          // variant's color already lives in `options.color`.
          price: variant.price,
          stock: variant.stock,

          // Lives on the Variant row directly (see schema.prisma), not
          // inside `options` - it isn't a cartesian-product dimension like
          // storage/ram/color/condition, just a single shared value.
          batteryHealth: variant.batteryHealth,
        };
      }),
  };

  const url = editMode ? `${API}/${productId}` : API;
  const method = editMode ? "PUT" : "POST";
  console.log(product);

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(product),
  });

  const data = await response.json();
  if (!response.ok) {
    // BUG FIX: this used to fire showToast() twice back-to-back (once with
    // data.message, once with data.error) - the API never sends a
    // `message` field on error responses (see handlePrismaError /
    // validateProductPayload in products.js, which always use `error`), so
    // the first toast was always the literal fallback text and the second
    // duplicated it with the real reason. A single toast is enough.
    showToast(data.error || "Saving failed", "error");
    console.log(data);
    return;
  }
  console.log("Created product:", data);
  try {
    if (data.colors?.length) {
      await uploadColorImages(data.colors);
      data.colors.forEach((color) => {
        saveImageOrder(color.name)
      })
    }

    // BUG FIX: colorImages entries were never marked existing:true (or
    // refreshed with real server ids) after a successful upload, so the
    // exact same File objects stayed flagged existing:false in memory.
    // Since nothing else reloads the product after saving, clicking
    // "Update" again later in the same session - to change the cover
    // image or anything else - re-ran uploadColorImages() over those same
    // stale "new" files and re-posted them, creating duplicate image rows
    // (most visible with multiple colors, since every color's just-added
    // images got re-uploaded at once). Re-fetching the product and
    // rebuilding colorImages from the server keeps local state in sync
    // with what's actually stored, so already-uploaded files are never
    // sent twice.
    if (editMode) {
      const refreshed = await fetch(`${API}/${productId}`, {
        credentials: "include",
      }).then((r) => r.json());

      loadExistingImages(refreshed.colors);
      renderColorImageUpload(selectedOptions.colors);
    }

    showToast("Product saved successfully!", "success");
  } catch (error) {
    console.error(error);
    showToast("Product saved but images failed", "error");
  }
  currentProduct = data;
  await deleteRemovedImages();
  // Keep currentProduct in sync so later actions in the same session
  // (e.g. re-saving) have fresh data to work from.
  console.log(generatedVariants.map((v) => v.options));
  console.log("SAVE END");

  // BUG FIX: editMode was computed once from the URL at page load and never
  // updated, so after a brand-new product's first successful save, the page
  // was still in "create" mode - a second Save click would POST a whole new
  // product (with the same locally-cached images re-uploaded under it)
  // instead of updating the one just created.
  //
  // This used to be fixed by a full `window.location.href` redirect into the
  // edit URL, but that forces a real page reload right after the save: the
  // success toast gets cut off almost immediately, and the browser has to
  // tear down and rebuild the entire form/page from a fresh network request
  // just to show the same data that's already sitting in the form. Updating
  // productId/editMode in memory and swapping the URL in via
  // history.replaceState gets the same "now in edit mode" result without
  // any of that - the toast stays on screen for its full duration and there's
  // no visible reload at all.
  if (!editMode && data.id) {
    productId = data.id;
    editMode = true;
    history.replaceState(null, "", `add-product.html?id=${data.id}`);
  }
}

saveProductButton.addEventListener("click", async () => {
  if (!validateProduct()) return;

  // Previously nothing stopped a double-click (or an impatient re-click on
  // a slow connection) from firing two concurrent saves - either two
  // duplicate products, or two overlapping updates racing each other.
  saveProductButton.disabled = true;
  const originalText = saveProductButton.textContent;
  saveProductButton.textContent = editMode ? "Updating..." : "Saving...";

  try {
    await saveProduct();
  } finally {
    saveProductButton.disabled = false;
    saveProductButton.textContent = originalText;
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    resetProductForm();
  }
});

// =========================================================
// INITIAL LOAD
// =========================================================

renderSpecifications(categoryOption.value);
updateBrandFields();
updateVariantsSections();

// ensureAdminAccess() now runs automatically from shared.js as soon as it
// loads (see window.adminAccessCheck) and redirects to login.html if the
// user isn't authenticated. Wait for that result before fetching the
// existing product in edit mode - this page previously had no auth gate
// at all. Form setup above (specs/brand fields) doesn't touch the API, so
// it's left running immediately as before.
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  if (e.target.tagName === "TEXTAREA") return;
  e.preventDefault();
  const focusable = [
    ...document.querySelectorAll(
      "input:not([type='hidden']),select,button.option-box",
    ),
  ].filter((el) => !el.disabled);
  const currentIndex = focusable.indexOf(e.target);
  if (currentIndex !== -1 && focusable[currentIndex + 1]) {
    focusable[currentIndex + 1].focus();
  }
});

if (editMode) {
  window.adminAccessCheck.then((isAuthenticated) => {
    if (isAuthenticated) loadProduct();
  });
}

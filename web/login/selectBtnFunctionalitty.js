const selectBtn = document.getElementById("selectProductBtn");
const selectHeader = document.querySelector(".select-header");
const productsSummary = document.getElementById("productsSummary");
const bulkDelete = document.getElementById("blkDelete");
const actionsHeader = document.querySelector(".actions-header");
const modalTitle = document.getElementById("modal-title");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");

const blkEdit = document.getElementById("blkEdit");
const editOverlay = document.getElementById("bulkedit-modal");
const cancelBlkBtn = document.getElementById("cancel-bulkedit-btn");
const confirmBlkBtn = document.getElementById("confirm-bulkedit-btn");
const priceCheckbox = document.getElementById("modal-price");
const stockCheckbox = document.getElementById("modal-stock");
const categoryCheckbox = document.getElementById("modal-category");
const priceSetMode = document.getElementById("price-set-mode");
const priceAdjustMode = document.getElementById("price-adjust-mode");
const stockSetMode = document.getElementById("stock-set-mode");
const stockAdjustMode = document.getElementById("stock-adjust-mode");
const priceInput = document.getElementById("price-input");
const stockInput = document.getElementById("stock-input");
const modalDropDown = document.getElementById("modal-dropdown");
const blkEditModal = document.getElementById("bulkedit-modal");
let selectionMode = false;

// Hidden by default. updateProductsSummary() only runs in response to a
// click/change event, so without this the button would show its default
// (visible) state on first page load, before any such event has fired.
function resetBulkEditModal() {
  stockCheckbox.checked = false;
  priceCheckbox.checked = false;
  stockSetMode.checked = true;
  priceSetMode.checked = true;
  categoryCheckbox.checked = false;
  stockAdjustMode.checked = false;
  priceAdjustMode.checked = false;
  priceInput.value = "";
  stockInput.value = "";
  priceInput.min = 1;
  stockInput.min = 0;
  modalDropDown.value = "Phone";
}
bulkDelete.style.display = "none";
selectAllCheckbox.addEventListener("click", () => {
  const checked = selectAllCheckbox.checked;

  document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
    const row = checkbox.closest("tr");
    const rowId = row.dataset.rowId;
    checkbox.checked = checked;

    if (checked) {
      selectedProducts.add(rowId);
    } else {
      selectedProducts.delete(rowId);
    }
    row.classList.toggle("selected-row", checked);
  });
  updateProductsSummary();
});
// Applies the current selectionMode to whatever rows are in the table
// right now. Pulled out into its own function (instead of living only
// inside the click handler) so products.js can call it again after
// renderTable() rebuilds the tbody - otherwise freshly rendered rows
// always come back with checkboxes hidden and the Actions column shown,
// regardless of whether selection mode is on.
function applySelectionModeToTable() {
  document.querySelectorAll(".select-cell").forEach((cell) => {
    cell.style.display = selectionMode ? "table-cell" : "none";
  });

  document.querySelectorAll(".actions-cell").forEach((cell) => {
    cell.style.display = selectionMode ? "none" : "table-cell";
  });

  selectHeader.style.display = selectionMode ? "table-cell" : "none";
  actionsHeader.style.display = selectionMode ? "none" : "table-cell";
}
window.applySelectionModeToTable = applySelectionModeToTable;

// Select Button styles toggle
selectBtn.addEventListener("click", () => {
  selectionMode = !selectionMode;

  selectBtn.textContent = selectionMode ? "Cancel" : "Select Products";

  applySelectionModeToTable();

  if (!selectionMode) {
    document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
      checkbox.checked = false;
      checkbox.closest("tr").classList.remove("selected-row");
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    });
  }
  updateProductsSummary();
});

// Bulk Edit button
blkEdit.addEventListener("click", () => {
  blkEditModal.classList.toggle("active");
});
cancelBlkBtn.addEventListener("click", () => {
  blkEditModal.classList.remove("active");
  resetBulkEditModal();
});
document.addEventListener("click", (e) => {
  if (!selectionMode) return;

  if (e.target.closest(".row-checkbox")) return;

  if (e.target.closest("button")) return;
  const row = e.target.closest("tr[data-row-id");
  if (!row) return;

  const checkbox = row.querySelector(".row-checkbox");
  if (!checkbox) return;
  checkbox.checked = !checkbox.checked;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
});
function updateConfirmBtnState() {
  confirmBlkBtn.disabled =
    !priceCheckbox.checked &&
    !stockCheckbox.checked &&
    !categoryCheckbox.checked;
}
priceCheckbox.addEventListener("change", updateConfirmBtnState);
stockCheckbox.addEventListener("change", updateConfirmBtnState);
categoryCheckbox.addEventListener("change", updateConfirmBtnState);
priceInput.addEventListener("input", () => {
  if (priceSetMode.checked) {
    if (priceInput.value < 1) {
      priceInput.value = 1;
      return;
    }
    return;
  }
});
stockInput.addEventListener("input", () => {
  if (stockSetMode.checked) {
    if (stockInput.value < 0) {
      stockInput.value = 0;
      return;
    }
    return;
  }
});
priceSetMode.addEventListener("change", () => {
  priceInput.min = 1;
});
priceAdjustMode.addEventListener("change", () => {
  priceInput.removeAttribute("min");
});
stockSetMode.addEventListener("change", () => {
  stockInput.min = 0;
});
stockAdjustMode.addEventListener("change", () => {
  stockInput.removeAttribute("min");
});
confirmBlkBtn.addEventListener("click", async () => {
  confirmBlkBtn.disabled = true;
  confirmBlkBtn.textContent = "Updating...";
  const productsToEdit = tableRows.filter((row) =>
    selectedProducts.has(row.rowId),
  );

  // STEP 1: dedupe
  const seenProductIds = new Set();
  const uniqueProductsToEdit = productsToEdit.filter((row) => {
    if (seenProductIds.has(row.productId)) return false;
    seenProductIds.add(row.productId);
    return true;
  });

  // STEP 2: build copies (before any mutation happens)
  const productCopies = new Map();
  uniqueProductsToEdit.forEach((row) => {
    const original = allProducts.find((p) => p.id === row.productId);
    productCopies.set(row.productId, structuredClone(original));
  });
  let hasValidationError = false;
  // STEP 3: mutate the copies only
  productsToEdit.forEach((row) => {
    const product = productCopies.get(row.productId);
    const variant = product.variants.find((v) => v.id === row.variantId);

    if (priceCheckbox.checked) {
      if (priceSetMode.checked) {
        const newPrice = Number(priceInput.value);
        if (newPrice < 0) {
          showToast("Price cannot be negative", "error");
          hasValidationError = true;
          return;
        }
        variant.price = newPrice;
      } else if (priceAdjustMode.checked) {
        const changeBy = Number(priceInput.value);
        const newPrice = variant.price + changeBy;
        if (newPrice <= 0) {
          showToast("Adjustment would make price zero or negative", "error");
          hasValidationError = true;
          return;
        }
        variant.price = newPrice;
      }
    }

    if (stockCheckbox.checked) {
      if (stockSetMode.checked) {
        const newStock = Number(stockInput.value);
        if (newStock < 0) {
          showToast("Stock cannot be negative", "error");
          hasValidationError = true;
          return;
        }
        variant.stock = newStock;
      } else if (stockAdjustMode.checked) {
        const changeBy = Number(stockInput.value);
        const newStock = variant.stock + changeBy;
        if (newStock < 0) {
          showToast("Adjustment would make stock negative", "error");
          hasValidationError = true;
          return;
        }
        variant.stock = newStock;
      }
    }
    if (categoryCheckbox.checked) {
      const newCategoryValue = modalDropDown.value;
      product.category = newCategoryValue;
    }
  });
  if (hasValidationError) {
    confirmBlkBtn.disabled = false;
    confirmBlkBtn.textContent = "Update";
    return;
  }
  // STEP 4: send the copies
  const variantUpdate = [];
  if (priceCheckbox.checked || stockCheckbox.checked) {
    productsToEdit.forEach((row) => {
      const product = productCopies.get(row.productId);
      const variant = product.variants.find((v) => v.id === row.variantId);
      variantUpdate.push({
        variantId: variant.id,
        price: variant.price,
        stock: variant.stock,
      });
    });
  }
  const categoryUpdate = [];
  if (categoryCheckbox.checked) {
    uniqueProductsToEdit.forEach((row) => {
      const product = productCopies.get(row.productId);
      categoryUpdate.push({
        productId: product.id,
        category: product.category,
      });
    });
  }
  try {
    const response = await fetch(`${API}/bulk`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantUpdate, categoryUpdate }),
    });
    if (!response.ok) {
      throw new Error("Failed to update selected products");
    }
    blkEditModal.classList.remove("active");
    confirmBlkBtn.textContent = "Update";
    if (selectionMode) selectBtn.click();
    tableRows = flattenVariants(allProducts);
    applyFilters();
    showToast(
      uniqueProductsToEdit.length === 1
        ? "Product updated successfully"
        : `${uniqueProductsToEdit.length} products updated successfully`,
      "success",
    );
    resetBulkEditModal();
  } catch (error) {
    console.error(error);
    showToast("Could not update selected products", "error");
    confirmBlkBtn.textContent = "Update";
    confirmBlkBtn.disabled = false;
  }
});
confirmBlkBtn.disabled = true;
// give each selected row styling
document.addEventListener("change", (e) => {
  if (!e.target.classList.contains("row-checkbox")) return;

  const row = e.target.closest("tr");
  const rowId = row.dataset.rowId;

  if (e.target.checked) {
    selectedProducts.add(rowId);
  } else {
    selectedProducts.delete(rowId);
  }
  row.classList.toggle("selected-row", e.target.checked);
  updateProductsSummary();
});

// change showing to selected + count
function updateProductsSummary() {
  if (!selectionMode) {
    selectedProducts.clear();

    document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
      checkbox.checked = false;
      checkbox.closest("tr").classList.remove("selected-row");
    });

    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }

  if (selectionMode) {
    productsSummary.innerHTML = `<strong>${selectedProducts.size}</strong> selected`;
    bulkDelete.style.display =
      selectedProducts.size > 0 ? "inline-flex" : "none";
    blkEdit.style.display = selectedProducts.size > 0 ? "inline-flex" : "none";
    blkEdit.innerHTML =
      selectedProducts.size > 1
        ? '<i class="fa-solid fa-pen-to-square"></i> Bulk Edit'
        : '<i class="fa-solid fa-pen"></i> Edit This Product';
  } else {
    productsSummary.innerHTML = `Showing <strong>${currentFiltered.length}</strong> products`;
    bulkDelete.style.display = "none";
    blkEdit.style.display = "none";
  }
  const rowCheckboxes = document.querySelectorAll(".row-checkbox");
  const checkedCheckboxes = document.querySelectorAll(".row-checkbox:checked");
  if (rowCheckboxes.length) {
    selectAllCheckbox.checked =
      checkedCheckboxes.length === rowCheckboxes.length;
  } else {
    selectAllCheckbox.checked = false;
  }
}


// Open the delete modal on click

bulkDelete.addEventListener("click", () => {
  const deleteProductName = document.getElementById("delete-product-name");

  // Computed here, not at page load - the table's checkboxes don't exist
  // yet when the script first runs, so this must be read fresh on every
  // click to reflect whatever is actually checked right now.
  const checkedRows = [...selectedProducts];
  if (!checkedRows.length) return;

  productsToDelete = tableRows.filter((row) => selectedProducts.has(row.rowId));

  // Rows are per-variant, but DELETE operates per-product. If two checked
  // rows are variants of the same product, keep only one entry - otherwise
  // that product gets two DELETE requests fired in parallel, and whichever
  // one lands second 404s because the first already removed it.
  const seenProductIds = new Set();
  productsToDelete = productsToDelete.filter((product) => {
    if (seenProductIds.has(product.productId)) return false;
    seenProductIds.add(product.productId);
    return true;
  });

  deleteModal.classList.add("active");

  if (productsToDelete.length === 1) {
    modalTitle.textContent = "Delete Product";
    deleteProductName.textContent =
      "Are you sure you want to delete this product?";
  } else {
    modalTitle.textContent = `Delete ${productsToDelete.length} Products`;
    deleteProductName.textContent = `Are you sure you want to delete these ${productsToDelete.length} products? This action cannot be undone.`;
  }
});

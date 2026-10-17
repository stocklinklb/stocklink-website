// =========================================================
// DOM REFERENCES
// =========================================================

const categorySearch = document.getElementById("category-search-input");
const categorySearchDropDown = document.getElementById("category-search-dropdown");
const categoryInput = document.getElementById("category"); // hidden input
const categoryNameInput = document.getElementById("category-name-input");

const categoryList = document.getElementById("category-values-list");
const categoryValues = document.getElementById("category-value-input");
const categoryAddBtn = document.getElementById("category-value-add");
const categoryModal = document.getElementById("category-modal");
const categoryModalSubmit = document.getElementById("category-modal-submit");
const categoryModalCancel = document.getElementById("category-modal-cancel");
const closeModal = document.getElementById("category-modal-close");
const modalTitle = document.getElementById("category-modal-title");
const fieldSaveBtn = document.getElementById("field-save-btn");
const fieldNameInput = document.getElementById("field-name-input");
const deleteModal = document.getElementById("category-delete-modal");
const deleteModalName = document.getElementById("category-delete-name");
const deleteModalConfirm = document.getElementById("category-delete-confirm");
const deleteModalCancel = document.getElementById("category-delete-cancel");
const categoryFieldList = document.getElementById("category-fields-list");
const fieldCancel = document.getElementById("field-cancel-btn");
const switchModal = document.getElementById("category-switch-modal");
const switchModalName = document.getElementById("category-switch-name");
const switchModalConfirm = document.getElementById("category-switch-confirm");
const switchModalCancel = document.getElementById("category-switch-cancel");


// =========================================================
// STATE
// =========================================================

let categories = [];
let values = [];
let fields = [];
let activeIndex = -1;
let editingFieldIndex = null; // null = adding a new field, number = editing fields[number]
let editingCategoryId = null; // null = creating a new category, number = editing that one
let categoryToDeleteId = null;
let pendingCategory = null; // the category waiting for the switch confirmation

// =========================================================
// HELPERS
// =========================================================

// Show names with a capital first letter (the backend already stores them this way)
function capitalize(text) {
  const str = String(text ?? "");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =========================================================
// FIELDS (inside the modal)
// =========================================================

// Returns true when the field was saved, false when validation failed
function addField() {
  const fieldName = fieldNameInput.value.trim();
  const fieldTypeInput = document.querySelector(`input[name="field-type"]:checked`);

  if (fieldName.length === 0) {
    showToast("Field name cannot be empty", "error");
    return false;
  }

  if (!fieldTypeInput) {
    showToast("At least one option should be selected.", "error");
    return false;
  }

  if (values.length === 0) {
    showToast("You should have at least one value to create a category.", "error");
    return false;
  }

  // Field names must be unique inside one category (ignore the field being edited)
  const duplicate = fields.some(
    (f, i) => i !== editingFieldIndex && f.name.toLowerCase() === fieldName.toLowerCase(),
  );
  if (duplicate) {
    showToast("This category already has a field with that name.", "error");
    return false;
  }

  const field = {
    name: fieldName,
    type: fieldTypeInput.value,
    id: fields[editingFieldIndex]?.id || null,
    values: [...values],
  };

  if (editingFieldIndex !== null) {
    fields[editingFieldIndex] = field;
  } else {
    fields.push(field);
  }

  renderList(fields);
  return true;
}

// Only clear the field form when the save actually worked
fieldSaveBtn.addEventListener("click", () => {
  if (addField()) {
    resetFieldSelection();
  }
});

function openDropdown() {
  categorySearchDropDown.classList.add("open");
}

function closeModalDropdown() {
  categorySearchDropDown.classList.remove("open");
}

function openCategoryModal() {
  categoryModal.classList.add("active");
}

function renderList(fields) {
  categoryFieldList.innerHTML = "";

  fields.forEach((field, index) => {
    const row = document.createElement("div");
    row.className = "category-fields-list";
    row.setAttribute("data-field", field.name);
    row.dataset.index = index;

    const name = document.createElement("span");
    name.textContent = field.name;

    const buttonEdit = document.createElement("button");
    const buttonDelete = document.createElement("button");

    buttonEdit.type = "button";
    buttonDelete.type = "button";

    buttonEdit.innerHTML = `<i class="fa-solid fa-pen"></i>`;
    buttonDelete.innerHTML = `<i class="fa-solid fa-trash"></i>`;

    buttonEdit.className = "category-edit-btn";
    buttonDelete.className = "category-delete-btn";

    row.append(name, buttonEdit, buttonDelete);
    categoryFieldList.appendChild(row);
  });
}

categoryFieldList.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".category-edit-btn");
  const deleteBtn = e.target.closest(".category-delete-btn");

  if (editBtn) {
    const listParent = e.target.closest(".category-fields-list");
    const index = Number(listParent.dataset.index);

    const field = fields[index];
    if (!field) return;

    editingFieldIndex = index;

    fieldNameInput.value = field.name;

    const fieldTypeInputByEdit = document.querySelector(
      `input[name="field-type"][value="${field.type}"]`,
    );

    if (fieldTypeInputByEdit) {
      fieldTypeInputByEdit.checked = true;
    }

    values = [...field.values];
    renderValues();
  }

  if (deleteBtn) {
    const listParent = e.target.closest(".category-fields-list");
    const index = Number(listParent.dataset.index);

    if (!fields[index]) return;

    fields.splice(index, 1);

    // Keep the "currently editing" pointer correct after the removal
    if (editingFieldIndex !== null) {
      if (editingFieldIndex === index) {
        resetFieldSelection(); // the field being edited was deleted: cancel the edit
      } else if (index < editingFieldIndex) {
        editingFieldIndex--; // rows after the deleted one shifted up by one
      }
    }

    renderList(fields);
  }
});

// Resets the form AND puts the modal back into "create" mode
function resetCategoryForm() {
  editingCategoryId = null;
  categoryNameInput.value = "";

  // Clear the fields list too, otherwise old fields leak into the next category
  fields = [];
  renderList(fields);
  resetFieldSelection(); // clears the field name, the values input, the chips and the edit pointer

  modalTitle.textContent = "Create category";
  categoryModalSubmit.textContent = "Create category";
}

function resetFieldSelection() {
  fieldNameInput.value = "";
  categoryValues.value = "";
  values = [];
  editingFieldIndex = null;
  renderValues();
}

fieldCancel.addEventListener("click", resetFieldSelection);

function closeCategoryModal() {
  categoryModal.classList.remove("active");
  resetCategoryForm();
}

// =========================================================
// VALUE CHIPS (inside the modal)
// =========================================================

function renderValues() {
  categoryList.replaceChildren(); // clear ONCE, before the loop

  values.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "category-chip";
    chip.textContent = value;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-chip-remove";
    button.setAttribute("aria-label", `Remove ${value}`);
    button.innerHTML = "&times;";
    button.addEventListener("click", () => {
      values = values.filter((v) => v !== value);
      renderValues();
    });

    chip.appendChild(button);
    categoryList.appendChild(chip);
  });
}

categoryAddBtn.addEventListener("click", () => {
  const newValues = categoryValues.value
    .split(",")
    .map((v) => v.trim()) // trims the edges, keeps "Dark Blue" intact
    .filter((v) => v !== ""); // drops empty entries

  newValues.forEach((v) => {
    const exists = values.some((x) => x.toLowerCase() === v.toLowerCase());
    if (!exists) values.push(v);
  });

  categoryValues.value = ""; // clear the input
  renderValues();
});

// =========================================================
//  ARROWS FUNCTION
// =========================================================

function getItems() {
  return [...categorySearchDropDown.querySelectorAll(".category-dropdown-item")];
}

function setActiveIndex(index) {
  const items = getItems();
  if (items.length === 0) {
    activeIndex = -1;
    return;
  }

  if (index < 0) {
    index = items.length - 1;
  }
  if (index >= items.length) {
    index = 0;
  }
  items.forEach((item) => item.classList.remove("active"));
  items[index].classList.add("active");
  items[index].scrollIntoView({ block: "nearest" }); // keeps it visible in a scrolling list

  activeIndex = index;
}

// =========================================================
// RENDER
// =========================================================

function renderCategoryDropDown(list) {
  activeIndex = -1;
  categorySearchDropDown.innerHTML = "";

  if (list.length === 0) {
    const addItem = document.createElement("div");
    addItem.className = "category-dropdown-item category-dropdown-add";
    addItem.textContent = "+ Add new Category";
    categorySearchDropDown.appendChild(addItem);
    return;
  }

  list.forEach((category) => {
    const item = document.createElement("div");
    item.className = "category-dropdown-item";
    item.dataset.id = category.id;

    // The list is redrawn on every open, so marking the current category
    // here is enough: no old mark to remove
    const isCurrent = formState.category && formState.category.id === category.id;
    item.classList.toggle("is-current", Boolean(isCurrent));
    item.setAttribute("aria-selected", String(Boolean(isCurrent)));

    const name = document.createElement("span");
    name.className = "category-dropdown-name";
    name.textContent = capitalize(category.name);

    const actions = document.createElement("span");
    actions.className = "category-dropdown-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "category-edit-btn";
    editButton.setAttribute("aria-label", `Edit ${capitalize(category.name)}`);
    editButton.innerHTML = `<i class="fa-solid fa-pen"></i>`;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "category-delete-btn";
    deleteButton.setAttribute("aria-label", `Delete ${capitalize(category.name)}`);
    deleteButton.innerHTML = `<i class="fa-solid fa-trash"></i>`;

    actions.append(editButton, deleteButton);
    item.append(name, actions);
    categorySearchDropDown.appendChild(item);
  });
}

function filterCategories() {
  const searchValue = categorySearch.value.trim().toLowerCase();

  const filtered = categories.filter((category) =>
    category.name.toLowerCase().includes(searchValue),
  );

  renderCategoryDropDown(filtered);
  openDropdown();
}



// =========================================================
// EDIT
// =========================================================

function startEditCategory(category) {
  editingCategoryId = category.id;

  categoryNameInput.value = capitalize(category.name);

  modalTitle.textContent = "Update category";
  categoryModalSubmit.textContent = "Update category";

  // Clear any leftover typing in the field form (name, values input, chips, edit pointer)
  resetFieldSelection();

  // Load the category's fields into the editable state
  fields = category.fields.map((field) => ({
    name: field.name,
    type: field.type,
    id: field.id,
    values: [...field.values],
  }));

  renderList(fields);

  closeModalDropdown();
  openCategoryModal();
}

// =========================================================
// DELETE (modal)
// =========================================================

function openDeleteModal(categoryId) {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return;

  categoryToDeleteId = categoryId;
  deleteModalName.textContent = capitalize(category.name);
  deleteModal.classList.add("active");
  closeModalDropdown();
}

function closeDeleteModal() {
  deleteModal.classList.remove("active");
  categoryToDeleteId = null;
}

// =========================================================
// SWITCH CATEGORY (modal, Q9)
// =========================================================

function openSwitchModal(category) {
  pendingCategory = category;
  switchModalName.textContent = capitalize(category.name);
  switchModal.classList.add("active");
  closeModalDropdown();
}

// Cancel: keep the current category and show its name again
function closeSwitchModal() {
  switchModal.classList.remove("active");
  pendingCategory = null;
  resetCategoryText();
}

function confirmSwitchCategory() {
  const category = pendingCategory;
  closeSwitchModal();
  if (category) setCategory(category);
}

async function confirmDeleteCategory() {
  if (categoryToDeleteId === null) return;
  const categoryId = categoryToDeleteId;

  deleteModalConfirm.disabled = true;
  try {
    const response = await fetch(`${API_ROOT}/categories/${categoryId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || "Couldn't delete the category", "error");
      return;
    }

    categories = categories.filter((c) => c.id !== categoryId);
    /* if (formState.category && formState.category.id === categoryId) {
      setCategory(null);
    } */
    renderCategoryDropDown(categories);
    showToast("Category deleted successfully", "success");
  } catch (error) {
    console.error(error);
    showToast("Server connection failed.", "error");
  } finally {
    deleteModalConfirm.disabled = false;
    closeDeleteModal();
  }
}

// =========================================================
// EVENTS
// =========================================================

// On focus: select the text (typing replaces it) and show every category
categorySearch.addEventListener("focus", () => {
  categorySearch.select();
  renderCategoryDropDown(categories);
  openDropdown();
});

// Filter while typing; the category only changes when a row is picked
categorySearch.addEventListener("input", () => {
  filterCategories();
});

// Pick an item (or click its edit / delete button)
categorySearchDropDown.addEventListener("click", (event) => {
  const item = event.target.closest(".category-dropdown-item");
  if (!item) return;

  // "+ Add new Category" row
  if (item.classList.contains("category-dropdown-add")) {
    resetCategoryForm();
    openCategoryModal();
    closeModalDropdown();
    return;
  }

  const categoryId = Number(item.dataset.id);

  // Delete button
  if (event.target.closest(".category-delete-btn")) {
    openDeleteModal(categoryId);
    return;
  }

  // Edit button
  if (event.target.closest(".category-edit-btn")) {
    const categoryToEdit = categories.find((c) => c.id === categoryId);
    if (categoryToEdit) startEditCategory(categoryToEdit);
    return;
  }

  // Normal row click = select
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return;

  // Same category again: keep the selections, just show its name
  if (formState.category && formState.category.id === category.id) {
    categorySearch.value = capitalize(category.name);
    closeModalDropdown();
    return;
  }

  // A different category would wipe the selections, so ask first (Q9)
  if (hasWork()) {
    openSwitchModal(category);
    return;
  }

  setCategory(category);
  closeModalDropdown();
});

// Category modal: cancel + X both close and reset
categoryModalCancel.addEventListener("click", closeCategoryModal);
closeModal.addEventListener("click", closeCategoryModal);

// Handles BOTH create (POST) and edit (PUT)
async function buildCategoryFetch() {
  const categoryName = categoryNameInput.value;

  if (!categoryName || categoryName.trim().length === 0) {
    showToast("Category name cannot be empty", "error");
    return; // stop here, don't send the request
  }

  if (fields.length === 0) {
    showToast("Add at least one field to this category.", "error");
    return;
  }

  const isEditing = editingCategoryId !== null;
  const url = isEditing
    ? `${API_ROOT}/categories/${editingCategoryId}`
    : `${API_ROOT}/categories`;

  try {
    const response = await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: categoryName,
        fields,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      showToast(
        data.message ||
        (isEditing ? "Couldn't update the category" : "Couldn't create a new category"),
        "error",
      );
      return;
    }

    if (isEditing) {
      categories = categories.map((c) => (c.id === data.category.id ? data.category : c));
      if (formState.category && formState.category.id === data.category.id) {
        setCategory(data.category);
      }
    } else {
      categories.push(data.category);
      setCategory(data.category);
    }

    renderCategoryDropDown(categories);
    closeCategoryModal(); // also resets the form, fields, title and button text
    showToast(
      isEditing ? "Category updated successfully" : "Category created successfully",
      "success",
    );
  } catch (error) {
    console.error(error);
    showToast("Server connection failed.", "error");
  }
}
categoryValues.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    categoryAddBtn.click();
  }
})
// No loadCategories() here: buildCategoryFetch already updates the local state,
// and an un-awaited reload could overwrite it with stale data.
categoryModalSubmit.addEventListener("click", (event) => {
  event.preventDefault();
  buildCategoryFetch();
});

// Delete modal events
deleteModalConfirm.addEventListener("click", confirmDeleteCategory);
deleteModalCancel.addEventListener("click", closeDeleteModal);

// click on the dark overlay closes it
deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) closeDeleteModal();
});

// Switch modal events (overlay click = cancel)
switchModalConfirm.addEventListener("click", confirmSwitchCategory);
switchModalCancel.addEventListener("click", closeSwitchModal);
switchModal.addEventListener("click", (event) => {
  if (event.target === switchModal) closeSwitchModal();
});

// Escape closes the delete or switch modal
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (deleteModal.classList.contains("active")) closeDeleteModal();
  if (switchModal.classList.contains("active")) closeSwitchModal();
});

// Close dropdown on outside click
document.addEventListener("click", (event) => {
  if (
    !categorySearch.contains(event.target) &&
    !categorySearchDropDown.contains(event.target)
  ) {
    resetCategoryText();
    closeModalDropdown();
  }
});

// Keyboard navigation
categorySearch.addEventListener("keydown", (event) => {
  const isOpen = categorySearchDropDown.classList.contains("open");
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (!isOpen) filterCategories();
      setActiveIndex(activeIndex + 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      if (!isOpen) filterCategories();
      setActiveIndex(activeIndex - 1);
      break;

    case "Enter":
      if (isOpen && activeIndex >= 0) {
        event.preventDefault();
        getItems()[activeIndex].click();
      }
      break;
    case "Escape":
    case "Tab":
      resetCategoryText();
      closeModalDropdown();
      break;
  }
});

// =========================================================
// LOAD
// =========================================================

async function loadCategories() {
  try {
    const response = await fetch(`${API_ROOT}/categories`, {
      credentials: "include",
    });

    if (!response.ok) {
      showToast("Couldn't load categories.", "error");
      return;
    }

    const data = await response.json();
    categories = Array.isArray(data) ? data : data.categories ?? [];
    renderCategoryDropDown(categories); // rendered, but stays closed until focus
  } catch (error) {
    console.error(error);
    showToast("Server connection failed.", "error");
  }
}

loadCategories();
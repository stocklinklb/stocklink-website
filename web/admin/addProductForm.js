async function productsFetching() {
  const response = await fetch(`${API_BASE}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    return showToast("Failed to add this product.", "error")
  };

  return showToast("Product Added successfully.", "success");

}

function buildFetchBody() {
  if (!validateProductField(productNameInput.value)) {
    return showToast(`The product name is missing.`, "error")
  }
  if (!validateProductField(brandSearchInput.value)) {
    return showToast(`This product brand is missing.`, "error")
  }
  if (!formState.category) {
    return showToast(`This product category is missing.`, "error")
  }
  return {
    name: productNameInput.value,
    brand: brandSearchInput.value,
    category: formState.category,
    description: descriptionInput.value,
    warranty: warrantyInput.value,
    featured: featuredCheckBox.checked,
  }
}

function validateProductField(field) {
  if (typeof field !== "string" || field.trim().length === 0) {
    return false;
  }
  return true;

}
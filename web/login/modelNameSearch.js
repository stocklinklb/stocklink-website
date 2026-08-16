function getMatchingModels(search) {
  const query = search.trim().toLowerCase();
  if (!query) return [];

  return [
    ...new Set(
      phoneSpecs
        .filter(
          (product) =>
            product.model && product.model.toLowerCase().includes(query),
        )
        .map((product) => product.model),
    ),
  ].slice(0, 20);
}

let selectedIndex = -1;
let suggestions = [];

productNameInput.addEventListener("input", () => {
  const matches = getMatchingModels(productNameInput.value);
  updateSuggestions(matches);
});

function updateSuggestions(matches) {
  suggestions = matches;
  selectedIndex = -1;
  renderModelDropdown(matches);
}

function renderModelDropdown(models) {
  dropdown.innerHTML = "";
  if (models.length === 0) {
    dropdown.style.display = "none";
    return;
  }
  dropdown.style.display = "block";

  models.forEach((model) => {
    const option = document.createElement("div");
    option.className = "brand-dropdown-item";
    option.textContent = model;

    option.onclick = () => {
      productNameInput.value = model;
      closeDropdown();
    };
    dropdown.appendChild(option);
  });
}

productNameInput.addEventListener("keydown", (e) => {
  // Scoped to this dropdown's own container - the brand picker renders
  // items with the same "brand-dropdown-item" class in its own dropdown,
  // so a document-wide query here would mix the two lists together
  // whenever both happened to have content.
  const items = dropdown.querySelectorAll(".brand-dropdown-item");

  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex++;
    if (selectedIndex >= items.length) {
      selectedIndex = 0;
    }
    updateActiveItem(items);
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex--;
    if (selectedIndex < 0) {
      selectedIndex = items.length - 1;
    }
    updateActiveItem(items);
  }
  if (e.key === "Enter") {
    e.preventDefault();

    if (selectedIndex >= 0) {
      productNameInput.value = items[selectedIndex].textContent;
      closeDropdown();
    }
  }
});

function updateActiveItem(items) {
  items.forEach((item) => {
    item.classList.remove("active");
  });

  items[selectedIndex].classList.add("active");

  items[selectedIndex].scrollIntoView({
    block: "nearest",
  });
}

function closeDropdown() {
  dropdown.innerHTML = "";
  dropdown.style.display = "none";
  selectedIndex = -1;
} 
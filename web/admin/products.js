// API_BASE comes from config.js (included on the page before shared.js
// and this script).
const API = API_BASE;
const params = new URLSearchParams(window.location.search);

const filter = params.get("filter");
console.log(filter);
// Used only if the API can't be reached, so the page still demonstrates
// real filtering/sorting/pagination behaviour instead of showing nothing.

const FALLBACK_PRODUCTS = [
  {
    id: "p1",
    name: "iPhone 17 Pro Max",
    brand: "Apple",
    category: "Phone",
    image: "/phone-photos/ip17-front.jpg",
    createdAt: "2026-07-08T10:00:00Z",
    variants: [
      {
        sku: "IP17PM-256-BLK",
        price: 1199,
        stock: 12,
        options: "256GB • Black",
      },
    ],
  },
  {
    id: "p2",
    name: "iPhone 15 Pro",
    brand: "Apple",
    category: "Phone",
    image: "/phone-photos/ip15-front.jpg",
    createdAt: "2026-06-20T10:00:00Z",
    variants: [
      { sku: "IP15P-128-BLU", price: 899, stock: 3, options: "128GB • Blue" },
    ],
  },
  {
    id: "p3",
    name: "Galaxy S25",
    brand: "Samsung",
    category: "Phone",
    image: "/phone-photos/s25-front.jpg",
    createdAt: "2026-07-01T10:00:00Z",
    variants: [
      { sku: "GS25-256-BLK", price: 849, stock: 18, options: "256GB • Black" },
    ],
  },
  {
    id: "p4",
    name: "iPad Air",
    brand: "Apple",
    category: "Tablet",
    image: "/phone-photos/ipad-air.jpg",
    createdAt: "2026-05-15T10:00:00Z",
    variants: [
      { sku: "IPADAIR-64-SLV", price: 599, stock: 9, options: "64GB • Silver" },
    ],
  },
  {
    id: "p5",
    name: "Galaxy Watch 7",
    brand: "Samsung",
    category: "Wearable",
    image: "/phone-photos/watch7.jpg",
    createdAt: "2026-06-02T10:00:00Z",
    variants: [
      { sku: "GW7-44-GPH", price: 329, stock: 0, options: "44mm • Graphite" },
    ],
  },
  {
    id: "p6",
    name: "AirPods Pro 2",
    brand: "Apple",
    category: "Accessory",
    image: "/phone-photos/airpods-pro-2.jpg",
    createdAt: "2026-04-11T10:00:00Z",
    variants: [{ sku: "APP2-WHT", price: 249, stock: 2, options: "White" }],
  },
  {
    id: "p7",
    name: "Pixel 9",
    brand: "Google",
    category: "Phone",
    image: "/phone-photos/pixel9.jpg",
    createdAt: "2026-03-28T10:00:00Z",
    variants: [
      {
        sku: "PX9-128-OBS",
        price: 699,
        stock: 22,
        options: "128GB • Obsidian",
      },
    ],
  },
];

const specificationSchemas = {
  Phone: ["Processor", "Display", "RAM", "Battery", "Refresh Rate"],

  Tablet: ["Processor", "Display", "RAM", "Battery"],

  Watch: ["Case Material", "Size", "Connectivity", "Water Resistance"],

  Accessory: ["Material", "Compatibility"],
};

const LOW_STOCK_MAX = 5;

let allProducts = [];
let tableRows = []; // flattened, one entry per variant
let selectedProducts = new Set();

let filters = {
  brands: [],
  categories: [],
  search: "",
  stock: [],
  // No price bound yet — the real bound is set once createPriceSlider()
  // computes it from actual data. Using +/-Infinity here (instead of a
  // hardcoded guess like 0-2000) means applyFilters() can safely run
  // before the slider exists without incorrectly hiding any product.
  price: { min: -Infinity, max: Infinity },
};
if (filter === "low-stock") {
  filters.stock = ["low-stock"];
}
let sortKey = "newest";
let pagination = { page: 1, rowsPerPage: 10 };

// ---------- DOM refs ----------
const searchInput = document.getElementById("searchInput");

const brandDropdown = document.getElementById("brand-dropdown");
const brandButton = document.getElementById("filter-btn");
const brandMenu = document.getElementById("brand-menu");

const categoryDropdown = document.getElementById("category-dropdown");
const categoryButton = document.getElementById("category-btn");
const categoryMenu = document.getElementById("category-menu");

const priceDropdown = document.getElementById("price-dropdown");
const stockDropdown = document.getElementById("stock-dropdown");
const priceButton = document.getElementById("price-btn");
const stockButton = document.getElementById("stock-btn");
const priceMenu = document.getElementById("price-menu");

const maxPriceLabel = document.getElementById("max-price");
const minPriceLabel = document.getElementById("min-price");

const sortDropdown = document.getElementById("sort-dropdown");
const sortButton = document.getElementById("sort-btn");
const sortLabel = document.getElementById("sort-label");
const sortOptions = document.querySelectorAll(".sort-option");
const resetFiltersBtn = document.querySelector(".reset-filters-btn");

const rowsDropdown = document.getElementById("rows-dropdown");
const rowsButton = document.getElementById("rows-btn");
const rowsLabel = document.getElementById("rows-label");
const rowsOptions = document.querySelectorAll(".rows-option");

const tbody = document.getElementById("products-tbody");
const resultCount = document.getElementById("resultCount");
const paginationSummary = document.getElementById("pagination-summary");
const paginationControls = document.getElementById("pagination-controls");

const addProductBtn = document.getElementById("addProductBtn");

const ALL_DROPDOWNS = [
  brandDropdown,
  categoryDropdown,
  priceDropdown,
  sortDropdown,
  stockDropdown,
  rowsDropdown,
];

const deleteModal = document.getElementById("delete-modal");
const deleteProductName = document.getElementById("delete-product-name");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

let toastTimer;

let productToDelete = null;
let productsToDelete = [];
// ---------- Skeleton loading state ----------
// Shown immediately (doesn't wait on auth or the fetch) so the page never
// flashes an empty table/menus. createBrandFilter()/createCategoryFilter()/
// renderTable() below all fully overwrite these via innerHTML once real
// data is ready, so there's nothing to "clear" afterwards.
Skeleton.tableRows(tbody, { cols: 7, rows: 6 });
Skeleton.listItems(brandMenu, { rows: 4 });
Skeleton.listItems(categoryMenu, { rows: 4 });

// ---------- Data loading ----------
async function loadProducts() {
  try {
    // The backend's GET /products is now paginated (default 20/page) and
    // returns { data, page, limit, total, totalPages } instead of a bare
    // array. This page does its own client-side filtering/sorting/
    // pagination over the *whole* catalog, so it needs the full list, not
    // one server-side page of it - request a high limit and unwrap `.data`
    // instead of treating the response itself as the array.
    //
    // NOTE: if your catalog can exceed MAX_PRODUCTS_TO_LOAD, this will
    // silently only load the first page's worth. At that point this page
    // should switch to requesting one server-side page at a time instead
    // of "all of them" - a quick fix for now, not the final answer forever.
    const MAX_PRODUCTS_TO_LOAD = 1000;
    const response = await fetch(`${API}?limit=${MAX_PRODUCTS_TO_LOAD}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch products");

    const result = await response.json();
    allProducts = Array.isArray(result) ? result : result.data;
  } catch (error) {
    console.warn("Falling back to demo data:", error.message);
    allProducts = FALLBACK_PRODUCTS;
  }

  tableRows = flattenVariants(allProducts);

  createBrandFilter();
  createCategoryFilter();
  createPriceSlider();
  applyInitialStockFilter();
  applyFilters();
}
function applyInitialStockFilter() {
  if (!filter) return;

  const checkbox = stockMenu.querySelector(`input[value="${filter}"]`);

  if (checkbox) {
    checkbox.checked = true;
  }
}
const BACKEND_URL = "https://stocklink-demo-production.up.railway.app";

function getMainImage(product) {
  const images = product.colors?.flatMap((color) => color.images || []) || [];

  const cover = images.find((image) => image.isCover);

  const image = cover || images[0];

  if (!image?.url) {
    return "/default.jpg";
  }

  if (image.url.startsWith("http")) {
    return image.url;
  }

  return `${BACKEND_URL}${image.url}`;
}
// A product counts as "missing specifications" if the field is absent,
// not an object, has no keys at all, or every value in it is blank -
// covers both the old `specifications: {}` bug and rows where the CSV
// lookup found no match and every mapped field came back as "".
function hasMissingSpecs(specifications) {
  if (!specifications || typeof specifications !== "object") return true;
  const values = Object.values(specifications);
  if (values.length === 0) return true;
  return values.every(
    (value) => value === "" || value === null || value === undefined,
  );
}

function flattenVariants(products) {
  return products.flatMap((product) =>
    (product.variants || []).map((variant, i) => ({
      rowId: `${product.id ?? product.name}-${i}`,
      productId: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      image: getMainImage(product),
      createdAt: product.createdAt,
      sku: variant.sku,
      variantId: variant.id,
      price: variant.price,
      stock: variant.stock ?? 0,
      options: describeVariantOptions(variant),
      missingSpecs: hasMissingSpecs(product.specifications),
    })),
  );
}

// Builds the "256GB • Black" style summary shown under the product name.
// Handles two shapes: the real API's { options: { storage, ram, condition },
// colors: [...] } and the flat demo-data shape { options: "256GB • Black" }.
function describeVariantOptions(variant) {
  if (typeof variant.options === "string") {
    return variant.options;
  }

  return [
    variant.options?.storage,
    variant.options?.ram,
    variant.options?.condition,
    ...(variant.colors || []),
  ]
    .filter(Boolean)
    .join(" • ");
}

function statusOf(stock) {
  if (stock <= 0) return { cls: "out-stock", label: "Out of Stock" };
  if (stock <= LOW_STOCK_MAX) return { cls: "low-stock", label: "Low Stock" };
  return { cls: "in-stock", label: "In Stock" };
}
const stockMenu = document.getElementById("stock-menu");
if (stockMenu) {
  stockMenu.addEventListener("change", () => {
    filters.stock = [...stockMenu.querySelectorAll("input:checked")].map(
      (input) => input.value,
    );

    applyFilters();
  });
}

// ---------- Filtering, sorting, pagination ----------
function applyFilters() {
  let filtered = tableRows.filter((row) => {
    const brandMatch =
      filters.brands.length === 0 || filters.brands.includes(row.brand);

    const categoryMatch =
      filters.categories.length === 0 ||
      filters.categories.includes(row.category);
    const stockMatches =
      filters.stock.length === 0 ||
      filters.stock.some((status) => {
        if (status === "in-stock") {
          return row.stock > LOW_STOCK_MAX;
        }
        if (status === "low-stock") {
          return row.stock > 0 && row.stock <= LOW_STOCK_MAX;
        }
        if (status === "out-stock") {
          return row.stock <= 0;
        }
        return false;
      });
    const priceMatch =
      row.price >= filters.price.min && row.price <= filters.price.max;

    const search = filters.search.trim();
    const searchMatch =
      search === "" ||
      row.name.toLowerCase().includes(search) ||
      (row.brand || "").toLowerCase().includes(search) ||
      (row.sku || "").toLowerCase().includes(search);

    return (
      brandMatch && categoryMatch && priceMatch && searchMatch && stockMatches
    );
  });

  filtered = sortRows(filtered, sortKey);

  pagination.page = 1;
  renderResults(filtered);
}

function sortRows(rows, key) {
  const sorted = [...rows];
  switch (key) {
    case "oldest":
      return sorted.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "stock-desc":
      return sorted.sort((a, b) => b.stock - a.stock);
    case "stock-asc":
      return sorted.sort((a, b) => a.stock - b.stock);
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
  }
}

let currentFiltered = [];

function getPriceRange() {
  const prices = tableRows
    .map((row) => Number(row.price))
    .filter((price) => !isNaN(price));

  if (prices.length === 0) {
    return { min: 0, max: 2000 };
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

function renderResults(filtered) {
  currentFiltered = filtered;
  resultCount.textContent = filtered.length;

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pagination.rowsPerPage),
  );
  if (pagination.page > totalPages) pagination.page = totalPages;

  const start = (pagination.page - 1) * pagination.rowsPerPage;
  const pageRows = filtered.slice(start, start + pagination.rowsPerPage);

  renderTable(pageRows);
  renderPaginationSummary(filtered.length, start, pageRows.length);
  renderPaginationControls(totalPages);

  // renderTable() just rebuilt the tbody from scratch, so any new rows
  // default back to their CSS state (checkboxes hidden, actions shown).
  // Reapply whatever selection mode is currently active so Select mode
  // survives sorting, filtering, searching, and paging.
  window.applySelectionModeToTable?.();
  updateProductsSummary();
}

function renderTable(rows) {
  if (rows.length === 0) {
    tbody.innerHTML = `
<tr class="empty-row">
  <td colspan="8">
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fa-solid fa-box-open"></i>
      </div>

      <h3>No products found</h3>

      <p>
        We couldn't find any products matching your current filters.
      </p>

      <button class="reset-filters-btn" id="resetFiltersBtn" type="button">
            <svg
              class="reset-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7"></path>
              <path d="M3 4v5h5"></path>
            </svg>
            Reset Filters
          </button>
    </div>
  </td>
</tr>
`;
    return;
  }

  tbody.innerHTML = rows
    .map((row) => {
      const status = statusOf(row.stock);
      return `
        <tr data-row-id="${row.rowId}" class="${row.missingSpecs ? "row-missing-specs" : ""}">
        <td class="select-cell"><input type="checkbox" class = "row-checkbox" ${selectedProducts.has(row.rowId) ? "checked" : ""}></td>
          <td class="product-info" data-label="Product">
            <img src="${row.image || "/default.jpg"}" alt="${row.name || ""}" />
            <div>
              <h4>${row.name}${row.missingSpecs ? ' <i class="fa-solid fa-triangle-exclamation missing-specs-icon" title="Missing specifications"></i>' : ""}</h4>
              <span>${row.options || ""}</span>
            </div>
          </td>
          <td data-label="Brand">${row.brand || "—"}</td>
          <td data-label="Category">${row.category || "—"}</td>
          <td data-label="Price">$${row.price}</td>
          <td data-label="Stock">${row.stock}</td>
          <td data-label="Status"><span class="status ${status.cls}">${status.label}</span></td>
          <td data-label="Actions" class="actions-cell">
            <button class="action-btn" data-action="edit" data-row-id="${row.rowId}">Edit</button>
            <button class="delete-btn" data-action="delete" data-row-id="${row.rowId}">Delete</button>
          </td>
        </tr>`;
    })
    .join("");
}

function renderPaginationSummary(total, start, pageCount) {
  if (total === 0) {
    paginationSummary.innerHTML = `Showing <strong>0</strong> of <strong>0</strong> products`;
    return;
  }
  const from = start + 1;
  const to = start + pageCount;
  paginationSummary.innerHTML = `Showing <strong>${from}–${to}</strong> of <strong>${total}</strong> products`;
}

function renderPaginationControls(totalPages) {
  const page = pagination.page;
  let buttons = "";

  buttons += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>←</button>`;

  const pages = getPageList(page, totalPages);
  pages.forEach((p) => {
    if (p === "...") {
      buttons += `<span class="dots">...</span>`;
    } else {
      buttons += `<button class="page-btn ${p === page ? "active" : ""}" data-page="${p}">${p}</button>`;
    }
  });

  buttons += `<button class="page-btn" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>→</button>`;

  paginationControls.innerHTML = buttons;
}

function getPageList(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [1];
  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");
  pages.push(total);

  return pages;
}

// ---------- Filter menus ----------
function createBrandFilter() {
  const brands = [...new Set(tableRows.map((row) => row.brand))].filter(
    Boolean,
  );
  brandMenu.innerHTML = brands.length
    ? brands
        .map(
          (brand) => `
            <label>
                <input type="checkbox" value="${brand}">
                ${brand}
            </label>`,
        )
        .join("")
    : `<p class="empty-note">No brands found.</p>`;
}

function createCategoryFilter() {
  const categories = [...new Set(tableRows.map((row) => row.category))].filter(
    Boolean,
  );
  categoryMenu.innerHTML = categories.length
    ? categories
        .map(
          (category) => `
            <label>
                <input type="checkbox" value="${category}">
                ${category}
            </label>`,
        )
        .join("")
    : `<p class="empty-note">No categories found.</p>`;
}

// ---------- Dropdown open/close ----------
function closeAllDropdowns(except) {
  ALL_DROPDOWNS.forEach((dropdown) => {
    if (dropdown && dropdown !== except) dropdown.classList.remove("open");
  });
}

function toggleDropdown(dropdown) {
  const isOpen = dropdown.classList.contains("open");
  closeAllDropdowns();
  dropdown.classList.toggle("open", !isOpen);
}

brandButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDropdown(brandDropdown);
});

categoryButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDropdown(categoryDropdown);
});

priceButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDropdown(priceDropdown);
});

sortButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDropdown(sortDropdown);
});
stockButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDropdown(stockDropdown);
});
rowsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDropdown(rowsDropdown);
});

[brandMenu, categoryMenu, priceMenu, stockMenu].forEach((menu) =>
  menu.addEventListener("click", (event) => event.stopPropagation()),
);

document.addEventListener("click", () => closeAllDropdowns());

// ---------- Filter inputs ----------
searchInput.addEventListener("input", () => {
  filters.search = searchInput.value.toLowerCase();
  applyFilters();
});

brandMenu.addEventListener("change", () => {
  filters.brands = [...brandMenu.querySelectorAll("input:checked")].map(
    (input) => input.value,
  );
  applyFilters();
});

categoryMenu.addEventListener("change", () => {
  filters.categories = [...categoryMenu.querySelectorAll("input:checked")].map(
    (input) => input.value,
  );
  applyFilters();
});

// ---------- Price slider ----------
function createPriceSlider() {
  const slider = document.getElementById("price-slider");

  let { min, max } = getPriceRange();

  // noUiSlider requires min < max. A single product, or several products
  // all priced the same, would otherwise make min === max and throw,
  // breaking the whole page. Pad the range artificially in that case so
  // the slider can still render (with a single meaningful position).
  if (min === max) {
    max = min + 10;
  }

  noUiSlider.create(slider, {
    start: [min, max],
    connect: true,
    range: { min, max },
    step: 10,
  });

  slider.noUiSlider.on("update", (values) => {
    const minPrice = Math.round(values[0]);
    const maxPrice = Math.round(values[1]);

    minPriceLabel.textContent = `$${minPrice}`;
    maxPriceLabel.textContent = `$${maxPrice}`;

    filters.price = { min: minPrice, max: maxPrice };

    applyFilters();
  });
}

// ---------- Reset filters ----------
document.addEventListener("click", (e) => {
  // Search
  const button = e.target.closest(".reset-filters-btn");
  if (!button) return;

  if (button) {
    searchInput.value = "";
    filters.search = "";

    // Brand / category checkboxes
    brandMenu
      .querySelectorAll("input:checked")
      .forEach((input) => (input.checked = false));
    filters.brands = [];

    categoryMenu
      .querySelectorAll("input:checked")
      .forEach((input) => (input.checked = false));
    filters.categories = [];

    // Stock checkboxes
    stockMenu
      .querySelectorAll("input:checked")
      .forEach((input) => (input.checked = false));
    filters.stock = [];

    // Price slider back to the full data range
    const slider = document.getElementById("price-slider");
    if (slider && slider.noUiSlider) {
      const { min, max } = getPriceRange();
      slider.noUiSlider.set([min, max]);
    }

    // Sort back to default
    sortKey = "newest";
    sortLabel.textContent = "Newest Added";
    sortOptions.forEach((option) =>
      option.classList.toggle("active", option.dataset.sort === "newest"),
    );

    // Rows per page / pagination back to default
    pagination = { page: 1, rowsPerPage: 10 };
    rowsLabel.textContent = "10";

    closeAllDropdowns();
    applyFilters();
  }
});

// ---------- Sorting ----------
sortOptions.forEach((option) => {
  option.addEventListener("click", () => {
    sortKey = option.dataset.sort;
    sortLabel.textContent = option.textContent;
    sortOptions.forEach((o) => o.classList.toggle("active", o === option));
    closeAllDropdowns();
    applyFilters();
  });
});

// ---------- Rows per page ----------
rowsOptions.forEach((option) => {
  option.addEventListener("click", () => {
    pagination.rowsPerPage = Number(option.dataset.rows);
    pagination.page = 1;
    rowsLabel.textContent = option.dataset.rows;
    closeAllDropdowns();
    renderResults(currentFiltered);
  });
});

// ---------- Pagination controls ----------
paginationControls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;

  const targetPage = Number(button.dataset.page);
  const totalPages = Math.max(
    1,
    Math.ceil(currentFiltered.length / pagination.rowsPerPage),
  );
  if (targetPage < 1 || targetPage > totalPages) return;

  pagination.page = targetPage;
  renderResults(currentFiltered);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- Row actions ----------
// Single click listener on tbody handles both edit (navigate) and delete
// (open the confirmation modal). The actual delete request happens once
// the user confirms, in confirmDeleteBtn's handler below.
tbody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const rowId = button.dataset.rowId;
  const row = tableRows.find((r) => r.rowId === rowId);
  if (!row) return;

  if (button.dataset.action === "edit") {
    window.location.href = `/login/add-product.html?id=${row.productId}`;
    return;
  }

  if (button.dataset.action === "delete") {
    productToDelete = row;
    productsToDelete = [];
    modalTitle.textContent = "Delete Product";
    deleteProductName.textContent = row.name;
    deleteModal.classList.add("active");
  }
});

cancelDeleteBtn.addEventListener("click", () => {
  deleteModal.classList.remove("active");
  productToDelete = null;
  productsToDelete = [];
});

confirmDeleteBtn.addEventListener("click", async () => {
  // Bulk path: productsToDelete is populated by the "Delete Selected"
  // button in selectBtnFunctionalitty.js. Handle it first and return,
  // since it needs a different request shape than the single-product path.
  if (productsToDelete.length) {
    try {
      const productIds = productsToDelete.map((product) => product.productId);

      const response = await fetch(`${API}/bulk`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete selected products");
      }

      const deletedIds = new Set(
        productsToDelete.map((product) => product.productId),
      );
      allProducts = allProducts.filter(
        (product) => !deletedIds.has(product.id),
      );
      tableRows = flattenVariants(allProducts);

      applyFilters();

      deleteModal.classList.remove("active");
      const deletedCount = productsToDelete.length;
      productsToDelete = [];

      // Selection no longer refers to anything real - drop back out of
      // selection mode rather than leaving Select active over a table
      // that no longer has any of the previously-checked rows.
      if (selectionMode) selectBtn.click();

      showToast(
        deletedCount === 1
          ? "Product deleted successfully"
          : `${deletedCount} products deleted successfully`,
        "success",
      );
    } catch (error) {
      console.error(error);
      showToast("Could not delete selected products", "error");
    }
    return;
  }

  // ...single-product path unchanged below...

  if (!productToDelete) return;

  try {
    const response = await fetch(`${API}/${productToDelete.productId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete product");
    }

    allProducts = allProducts.filter(
      (product) => product.id !== productToDelete.productId,
    );

    tableRows = flattenVariants(allProducts);

    applyFilters();

    deleteModal.classList.remove("active");
    productToDelete = null;

    showToast("Product deleted successfully", "success");
  } catch (error) {
    console.error(error);
    showToast("Could not delete product", "error");
  }
});

// ---------- Add product ----------
addProductBtn.addEventListener("click", () => {
  window.location.href = "/login/add-product.html";
});

// ensureAdminAccess() now runs automatically from shared.js as soon as it
// loads (see window.adminAccessCheck) and redirects to login.html if the
// user isn't authenticated. Wait for that result before loading product
// data, instead of loading unconditionally like before - this page
// previously had no auth gate at all.
window.adminAccessCheck.then((isAuthenticated) => {
  if (isAuthenticated) loadProducts();
});

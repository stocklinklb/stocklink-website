// API_BASE (from config.js) IS the products resource base already
// (".../products") — don't append "/products" again here, or every
// request doubles up to ".../products/products". Same convention as
// products.js / add-products.js.
const API = API_BASE;

// Thresholds that decide a variant's stock status.
// Mirrors the status pills used on the Products page.
const LOW_STOCK_MAX = 5;
const username = document.getElementById("user-name");
const CATEGORY_ICONS = {
  Phone: "fa-solid fa-mobile-screen-button",
  Phones: "fa-solid fa-mobile-screen-button",

  Tablet: "fa-solid fa-tablet-screen-button",
  Tablets: "fa-solid fa-tablet-screen-button",

  Wearable: "fa-solid fa-clock",
  Wearables: "fa-solid fa-clock",

  Accessory: "fa-solid fa-headphones",
  Accessories: "fa-solid fa-headphones",
};

// Used only if the API can't be reached, so the dashboard still
// demonstrates real behaviour instead of showing an empty page.
const FALLBACK_PRODUCTS = [
  {
    name: "iPhone 17 Pro Max",
    brand: "Apple",
    category: "Phones",
    createdAt: "2026-07-08T10:00:00Z",
    variants: [{ price: 1199, stock: 12, options: "256GB • Black" }],
  },
  {
    name: "iPhone 15 Pro",
    brand: "Apple",
    category: "Phones",
    createdAt: "2026-07-08T09:40:00Z",
    variants: [{ price: 899, stock: 3, options: "128GB • Blue" }],
  },
  {
    name: "Galaxy S25",
    brand: "Samsung",
    category: "Phones",
    createdAt: "2026-07-08T09:20:00Z",
    variants: [{ price: 849, stock: 18, options: "256GB • Black" }],
  },
  {
    name: "iPad Air",
    brand: "Apple",
    category: "Tablets",
    createdAt: "2026-07-07T14:00:00Z",
    variants: [{ price: 599, stock: 9, options: "64GB • Silver" }],
  },
  {
    name: "Galaxy Watch 7",
    brand: "Samsung",
    category: "Wearables",
    createdAt: "2026-07-07T11:00:00Z",
    variants: [{ price: 329, stock: 0, options: "44mm • Graphite" }],
  },
  {
    name: "AirPods Pro 2",
    brand: "Apple",
    category: "Accessories",
    createdAt: "2026-07-06T16:00:00Z",
    variants: [{ price: 249, stock: 2, options: "White" }],
  },
];
document.getElementById("view-low-stock").addEventListener("click", () => {
  window.location.href = "/login/products.html?filter=low-stock";
});
function flattenVariants(products) {
  if (!Array.isArray(products)) return [];
  return products.flatMap((product) =>
    (product.variants || []).map((variant) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      createdAt: product.createdAt,
      price: variant.price,
      stock: variant.stock ?? 0,
      options: variant.options,
    })),
  );
}

function statusOf(stock) {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_MAX) return "low";
  return "in";
}
MAX_PRODUCTS_TO_LOAD = 10000;
async function loadDashboard() {
  let products = [];

  try {
    const response = await fetch(`${API}?limit=${MAX_PRODUCTS_TO_LOAD}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch products");
    const result = await response.json();
    products = Array.isArray(result) ? result : result.data;
  } catch (error) {
    console.warn("Falling back to demo data:", error.message);
    products = FALLBACK_PRODUCTS;
  }

  const rows = flattenVariants(products);
  renderStatCards(rows);
  renderLowStock(rows);
  renderInventoryOverview(rows);
}

function renderStatCards(rows) {
  const counts = { all: rows.length, in: 0, low: 0, out: 0 };

  rows.forEach((row) => {
    counts[statusOf(row.stock)]++;
  });

  document.getElementById("allProducts").textContent = counts.all;
  document.getElementById("inStock").textContent = counts.in;
  document.getElementById("lowStock").textContent = counts.low;
  document.getElementById("outOfStock").textContent = counts.out;
}

function renderLowStock(rows) {
  const list = document.getElementById("lowStockList");

  const lowItems = rows
    .filter((row) => row.stock > 0 && row.stock <= LOW_STOCK_MAX)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  if (lowItems.length === 0) {
    list.innerHTML = `<p class="empty-note">Nothing running low right now.</p>`;
    return;
  }

  list.innerHTML = lowItems
    .map(
      (row) => `
        <div class="stock-item">
          <p>${row.name}</p>
          <span>${row.stock} left</span>
        </div>`,
    )
    .join("");
}

function renderInventoryOverview(rows) {
  const container = document.getElementById("inventoryCards");
  const totalUnits = rows.reduce((sum, row) => sum + row.stock, 0);

  const byCategory = {};
  rows.forEach((row) => {
    const category = row.category || "Other";
    byCategory[category] = (byCategory[category] || 0) + row.stock;
  });

  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    container.innerHTML = `<p class="empty-note">No inventory data yet.</p>`;
    return;
  }

  container.innerHTML = categories
    .map(([category, units]) => {
      const pct = totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0;
      const icon = CATEGORY_ICONS[category] || "fa-solid fa-box";

      return `
  <div class="inventory-card">
    <div class="inventory-icon">
      <i class="${icon}"></i>
    </div>
    <h3>${category}</h3>
    <strong>${units}</strong>
    <p>${pct}% of inventory</p>
  </div>`;
    })
    .join("");
}
let currentUsername = "Admin";

async function loadCurrentUser() {
  try {
    const response = await fetch(`${API_ROOT}/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) return;

    const store = await response.json();

    currentUsername = store.name;

    const usernameElement = document.getElementById("user-name");

    if (usernameElement) {
      usernameElement.textContent = store.name;
    }
  } catch (error) {
    console.error(error);
  }
}
async function loadRecentActivity() {
  try {
    const res = await fetch(`${API}/activity-log?limit=5`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch activity log");
    const result = await res.json();
    renderRecentActivity(result.data);
  } catch (error) {
    console.error(error);
  }
}
function renderRecentActivity(logs) {
  const list = document.getElementById("activityList");

  if (!logs || logs.length === 0) return;

  list.innerHTML = logs
    .map((log) => {
      const minsAgo = Math.max(
        1,
        Math.round((Date.now() - new Date(log.createdAt)) / 60000),
      );
      const timeLabel =
        minsAgo < 60
          ? `${minsAgo} minute${minsAgo === 1 ? "" : "s"} ago`
          : `${Math.round(minsAgo / 60)} hour${Math.round(minsAgo / 60) === 1 ? "" : "s"} ago`;

      const icon =
        log.action === "product_created"
          ? "+"
          : log.action === "product_deleted"
            ? "−"
            : "✎";

      return `
        <div class="activity-item">
          <div class="activity-icon">${icon}</div>
          <div>
            <p><b>${currentUsername || "Admin"}</b> ${log.summary}</p>
            <span>${timeLabel}</span>
          </div>
        </div>`;
    })
    .join("");
}
// ---------- Quick actions ----------
// ensureAdminAccess(), updateProfile(), setLogOutModal() and the login
// redirect now live in shared.js and run automatically as soon as it loads
// (see window.adminAccessCheck). This just awaits that same result instead
// of running its own auth check, so the gating behavior is unchanged.
async function initAdminPage() {
  const isAuthenticated = await window.adminAccessCheck;

  if (!isAuthenticated) {
    return;
  }

  document.querySelectorAll(".quick-card[data-href]").forEach((card) => {
    card.addEventListener("click", () => {
      window.location.href = card.dataset.href;
    });
  });

  const excelImportBtn = document.getElementById("excelImportBtn");
  const excelImportInput = document.getElementById("excelImportInput");

  //if (excelImportBtn && excelImportInput) {
  //   excelImportBtn.addEventListener("click", () => excelImportInput.click());

  // excelImportInput.addEventListener("change", () => {
  //   const file = excelImportInput.files[0];
  //  if (!file) return;
  //   console.log("Importing file:", file.name);
  //   alert(
  //   `"${file.name}" selected. Upload it from the Add Product page to import.`,
  //  );
  //  excelImportInput.value = "";
  //   });
  // }
  await loadCurrentUser();
  loadDashboard();
  loadRecentActivity();
}

initAdminPage();

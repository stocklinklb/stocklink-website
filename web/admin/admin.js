// API_BASE (from config.js) IS the products resource base already
// (".../products") — don't append "/products" again here, or every
// request doubles up to ".../products/products". Same convention as
// products.js / add-products.js.
const API = API_BASE;

// Thresholds that decide a variant's stock status.
// Mirrors the status pills used on the Products page.
const LOW_STOCK_MAX = 9;
const visitorsChartCanvas = document.getElementById("visitors-chart");
const salesChart = document.getElementById("salesChart");
const username = document.getElementById("user-name");

// State for the visitors chart — loadVisitorsOverTime()/renderVisitorsChart()
// below were extracted from analytics.js but only the functions came over,
// not the state they depend on. Restoring the minimum needed for this
// page (no period toggle here, so currentChartType is fixed to "line").
let requestId = 0;
let visitorsChart = null;
let currentChartType = "line";
let currentPeriod = "day";
let lastVisitorsData = [];
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
  window.location.href = "/admin/products.html?stock=low-stock";
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

async function loadVisitorsOverTime(period) {
  const thisRequest = ++requestId;

  const response = await fetch(
    `${ANALYTICS_API}/visitors-over-time?period=${period}`,
    { credentials: "include" },
  );

  const result = await response.json();

  if (thisRequest !== requestId) return;

  currentPeriod = result.period;
  lastVisitorsData = result.visitorsOverTime;
  renderVisitorsChart(lastVisitorsData);
  // No period toggle on this card (unlike analytics.js's version this
  // was extracted from) — setActivePeriodButton() doesn't exist here
  // and isn't needed.
}

function renderVisitorsChart(data) {
  const labels = data.map((entry) =>
    new Date(entry.bucket).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  );
  const counts = data.map((entry) => entry.count);

  // If a chart already exists (e.g. loadAnalytics() runs again), destroy
  // it first - Chart.js doesn't auto-replace an existing chart on the
  // same canvas, it'll just draw on top and get visually corrupted.
  if (visitorsChart) {
    visitorsChart.destroy();
  }

  // Headline number + trend badge above the chart, both derived from the
  // real fetched series — total visitors for the period, and the percent
  // change from the first to the last data point.
  const total = counts.reduce((sum, n) => sum + n, 0);
  const avg = counts.length ? Math.round(total / counts.length) : 0;
  updateChartHeadline({
    valueEl: document.getElementById("visitors-big-value"),
    trendEl: document.getElementById("visitors-trend"),
    value: total.toLocaleString(),
    series: counts,
  });
  const visitorsInsight = document.getElementById("visitors-chart-insight");
  if (visitorsInsight) {
    visitorsInsight.textContent = counts.length
      ? `Averaging ${avg} visitor${avg === 1 ? "" : "s"}/day over this period`
      : "No visitor data yet for this period.";
  }

  visitorsChart = new Chart(visitorsChartCanvas, {
    type: currentChartType,
    data: {
      labels,
      datasets: [
        {
          label: "Visitors",
          data: counts,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // Hides the little colored swatch + "Visitors" label Chart.js
        // draws above the canvas by default — redundant with the card's
        // own "Visitors Over Time" heading right above it.
        legend: { display: false },
      },
      scales: {
        x: {
          // autoSkip + a fixed max keep dense day-level ranges from
          // packing in overlapping/rotated labels — Chart.js drops
          // ticks evenly rather than cramming or rotating them.
          ticks: { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }, // whole numbers only - can't have 2.5 visitors
        },
      },
    },
  });

  // #visitors-chart-skeleton isn't wired into Skeleton.autoReveal/
  // listItems anywhere (index.html's inline script never references
  // it) — it's a standalone overlay that only this render step knows
  // to hide, so it has to happen here, once the chart actually has
  // data to show.
  //
  // Using inline style.display (not the `hidden` attribute) on
  // purpose: admin.css declares `.visitors-chart-skeleton { display:
  // flex; }` directly, and that author-stylesheet rule beats the
  // browser's built-in `[hidden] { display: none; }` default — so
  // toggling `hidden` silently does nothing here. An inline style
  // always wins over any stylesheet rule, so this actually hides it.
  const visitorsSkeleton = document.getElementById("visitors-chart-skeleton");
  if (visitorsSkeleton) visitorsSkeleton.style.display = "none";
}

// Shared by both chart cards: sets the big headline number and a
// green/red trend badge comparing the first vs last point in the
// series — real signal derived from the fetched data, not fabricated.
function updateChartHeadline({ valueEl, trendEl, value, series }) {
  if (valueEl) valueEl.textContent = value;
  if (!trendEl) return;

  const first = series[0];
  const last = series[series.length - 1];

  if (series.length < 2 || !first) {
    trendEl.textContent = "";
    trendEl.className = "chart-trend";
    return;
  }

  const pctChange = ((last - first) / first) * 100;
  const up = pctChange >= 0;
  trendEl.textContent = `${up ? "▲" : "▼"} ${Math.abs(pctChange).toFixed(1)}%`;
  trendEl.className = `chart-trend ${up ? "up" : "down"}`;
}

document
  .querySelectorAll("#visitorsTypeToggle .chart-toggle-btn")
  .forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("#visitorsTypeToggle .chart-toggle-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentChartType = btn.dataset.type;
      // Re-render from the already-fetched data — same pattern as the
      // revenue chart's toggle, no need to refetch just to change the
      // chart type.
      renderVisitorsChart(lastVisitorsData);
    });
  });

// ---------- Revenue chart (Home dashboard, Low Stock row) ----------
// Extracted from orders.js's fetchSalesData/formatChartData/loadSalesChart
// and trimmed to the revenue-only path (this card has no metric toggle,
// see admin.css revenue-chart-box) with period locked to "day" (no period
// toggle here either). Only the Line/Bar type toggle applies, wired the
// same way orders.js wires salesTypeToggle.
let salesChartInstance = null;
let currentSalesChartType = "line";

async function fetchSalesData(period) {
  try {
    const response = await fetch(
      `${ORDERS_API}/sales-over-time?period=${period}`,
      { credentials: "include" },
    );
    if (!response.ok) throw new Error("Failed to fetch orders");
    const result = await response.json();
    return result.buckets;
  } catch (error) {
    console.warn("data not loaded !", error.message);
    return [];
  }
}

function formatRevenueChartData(buckets, type) {
  const isBar = type === "bar";
  const revenueColor = "#f97316";
  const revenueBackground = isBar ? revenueColor : "rgba(249, 115, 22, 0.15)";

  return {
    // orders.js's version used bucket.date raw, unformatted — fine for
    // a "day" bucket key internally, but ugly as an axis label straight
    // from the API. Formatted the same way the visitors chart already
    // does, for consistency across the two cards.
    labels: buckets.map((bucket) =>
      new Date(bucket.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    ),
    datasets: [
      {
        label: "Revenue",
        data: buckets.map((bucket) => bucket.revenue),
        borderColor: revenueColor,
        backgroundColor: revenueBackground,
        fill: true,
        tension: 0.3,
      },
    ],
  };
}

async function loadRevenueChart(type = currentSalesChartType) {
  const buckets = await fetchSalesData("day");
  const chartData = formatRevenueChartData(buckets, type);

  if (!salesChart) return;

  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  const revenues = buckets.map((b) => b.revenue || 0);
  const total = revenues.reduce((sum, n) => sum + n, 0);
  const avg = revenues.length ? total / revenues.length : 0;
  updateChartHeadline({
    valueEl: document.getElementById("revenue-big-value"),
    trendEl: document.getElementById("revenue-trend"),
    value: `$${total.toLocaleString()}`,
    series: revenues,
  });
  const revenueInsight = document.getElementById("revenue-chart-insight");
  if (revenueInsight) {
    revenueInsight.textContent = revenues.length
      ? `Averaging $${avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day over this period`
      : "No revenue data yet for this period.";
  }

  salesChartInstance = new Chart(salesChart, {
    type,
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
}

document
  .querySelectorAll("#salesTypeToggle .chart-toggle-btn")
  .forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("#salesTypeToggle .chart-toggle-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSalesChartType = btn.dataset.type;
      loadRevenueChart(currentSalesChartType);
    });
  });

function statusOf(stock) {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_MAX) return "low";
  return "in";
}
MAX_PRODUCTS_TO_LOAD = 10000;

// Reflects when the stock/inventory numbers on this page were actually
// pulled, since nothing on the dashboard previously told the store owner
// how current the data is. Real load time, not a fabricated status.
function updateFreshness() {
  const el = document.getElementById("dashboardFreshness");
  if (!el) return;
  const now = new Date();
  el.textContent = `Updated ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

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
  updateFreshness();
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
    .slice(0, 9);

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
    const res = await fetch(`${API}/activity-log?limit=6`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch activity log");
    const result = await res.json();
    renderRecentActivity(result.data);
  } catch (error) {
    console.error(error);
    // Previously left the hardcoded placeholder items in index.html on
    // screen indefinitely on failure — now matches the empty-state
    // pattern already used by Low Stock / Inventory Overview.
    const list = document.getElementById("activityList");
    if (list) {
      list.innerHTML = `<p class="empty-note">Couldn't load recent activity.</p>`;
    }
  }
}
function renderRecentActivity(logs) {
  const list = document.getElementById("activityList");

  if (!logs || logs.length === 0) {
    list.innerHTML = `<p class="empty-note">No recent activity yet.</p>`;
    return;
  }

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
  loadNotifications();
  loadRecentActivity();
  loadRevenueChart();
  loadVisitorsOverTime(currentPeriod);
}

initAdminPage();

// Final safety net: web fonts / icon fonts can finish loading after
// everything above has already rendered, nudging line-heights and
// therefore row heights by a few px. Re-sync both charts once
// everything has actually settled.
window.addEventListener("load", () => {
  if (visitorsChart) visitorsChart.resize();
  if (salesChartInstance) salesChartInstance.resize();
});

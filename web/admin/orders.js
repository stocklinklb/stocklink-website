// API
const API = API_BASE;
const searchUrl = new URLSearchParams(window.location.search).get("search");
// Buttons
const newOrder = document.getElementById("newOrderBtn");
const closeModal = document.getElementById("orderFormCloseBtn");
const cancelModal = document.getElementById("orderFormCancelBtn");
const addItemBtn = document.getElementById("addItemBtn");
const confirmDeleteBtn = document.getElementById("confirmActionBtn");
const cancelDeleteBtn = document.getElementById("confirmCancelBtn");
const orderFormTitle = document.getElementById("orderFormTitle");
const orderFormSubmitBtn = document.getElementById("orderFormSubmitBtn");

// spans
const totalOrders = document.getElementById("totalOrders");
const pendingOrders = document.getElementById("pendingOrders");
const soldOrders = document.getElementById("soldOrders");
const totalRevenue = document.getElementById("totalRevenue");

// Modal || Containers
const modalOverlay = document.getElementById("orderFormModal");
const itemsEmptyNote = document.getElementById("itemsEmptyNote");
const emptyState = document.getElementById("ordersEmpty");
const ordersTable = document.getElementById("ordersTableBody");
const confirmDeleteModal = document.getElementById("confirmModal");
const orderDetailModal = document.getElementById("orderDetailModal");
const orderDetailCloseBtn = document.getElementById("orderDetailCloseBtn");
const orderDetailCloseBtn2 = document.getElementById("orderDetailCloseBtn2");
const detailMarkSoldBtn = document.getElementById("detailMarkSoldBtn");
const detailEditBtn = document.getElementById("detailEditBtn");
const printReceiptBtn = document.getElementById("printReceiptBtn");
const downloadReceiptBtn = document.getElementById("downloadReceiptBtn");
const receiptPrintArea = document.getElementById("receiptPrintArea");

// Pagination controls
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const paginationInfo = document.getElementById("paginationInfo");
const pageCurrent = document.getElementById("pageCurrent");

// Inputs
const nameInput = document.getElementById("buyerName");
const phoneInput = document.getElementById("buyerPhone");
const addressInput = document.getElementById("buyerAddress");
const noteInput = document.getElementById("buyerNote");
const sourceInput = document.getElementById("source");
const discountInput = document.getElementById("discount");
const orderSearchInput = document.getElementById("orderSearch");
const statusFilter = document.getElementById("statusFilter");
const orderItemsList = document.getElementById("orderItemsList");
const orderForm = document.getElementById("orderForm");
const salesMetricToggle = document.getElementById("salesMetricToggle");
let salesPeriodtoggle = document.getElementById("salesPeriodToggle");
const salesTypeToggle = document.getElementById("salesTypeToggle");
// State
let allProducts = [];
let allVariants = []; // Flattened list for quick searching
let orders = [];
let ordersPagination = null;
let currentSearch = "";
currentSearch = searchUrl || "";
orderSearchInput.value = searchUrl || "";
const newUrl = currentSearch
  ? `?search=${encodeURIComponent(currentSearch)}`
  : window.location.pathname;

history.replaceState({ search: currentSearch }, "", newUrl);

let currentStatus = "";
let currentMetric = "revenue";
let currentPeriod = "day";
let currentType = "line";
let currentPage = 1;
let currentDetailOrder = null; // full order object for whichever order is open in #orderDetailModal, used by printReceiptBtn
let salesChart = null;

// ============================================
// Shared body-scroll lock for modals.
// Uses a counter (not a plain boolean) so that if two modals were ever
// open at once, closing one wouldn't prematurely re-enable scrolling
// while the other is still up.
// ============================================
let openModalCount = 0;
const scrollableMain = document.querySelector("main");
function lockBodyScroll() {
  openModalCount += 1;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  if (scrollableMain) scrollableMain.style.overflow = "hidden";
}
function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    if (scrollableMain) scrollableMain.style.overflow = "";
  }
}

function buildOrdersUrl() {
  const params = new URLSearchParams();
  params.set("page", currentPage);
  if (currentStatus) params.set("status", currentStatus);
  if (currentSearch) params.set("search", currentSearch);

  return `${ORDERS_API}?${params.toString()}`;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatOptions(options) {
  if (!options) return "";
  return Object.values(options).filter(Boolean).join(" · ");
}

// ============================================
// Modal open/close + form reset
// ============================================
function openModal() {
  modalOverlay.classList.add("active");
  lockBodyScroll();
}
function closeModal_() {
  modalOverlay.classList.remove("active");
  unlockBodyScroll();
}

function resetOrderForm() {
  orderForm.reset();
  delete orderForm.dataset.orderId;
  orderFormTitle.textContent = "New Order";
  orderFormSubmitBtn.textContent = "Create Order";
  orderItemsList.innerHTML = "";
  itemsEmptyNote.hidden = false;
  orderItemsList.appendChild(itemsEmptyNote);
  calculateSubtotal();
}

newOrder.addEventListener("click", () => {
  resetOrderForm(); // always start a fresh "New Order" form, even after a cancelled edit
  openModal();
});
function openOrderDetailModal() {
  orderDetailModal.classList.add("active");
  lockBodyScroll();
}

function closeOrderDetailModal() {
  orderDetailModal.classList.remove("active");
  unlockBodyScroll();
  currentDetailOrder = null;
}
closeModal.addEventListener("click", closeModal_);
cancelModal.addEventListener("click", closeModal_);

// Click outside the modal card closes it — same behavior the detail
// modal already had, added here for the order form and confirm-delete
// modals too. Guarded on e.target === overlay so clicks inside the card
// itself (which bubble up to the overlay) don't close it.
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    closeModal_();
  }
});

confirmDeleteModal.addEventListener("click", (e) => {
  if (e.target === confirmDeleteModal) {
    confirmDeleteModal.classList.remove("active");
    unlockBodyScroll();
    delete confirmDeleteBtn.dataset.orderId;
  }
});

// ============================================
// Create / Edit submit (single handler, branches on dataset.orderId)
// ============================================
orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const orderInfo = gatherOrderInformations();
  const items = collectOrderItems();

  if (!items.length) {
    showToast("Add at least one item to the order.", "error");
    return;
  }

  const orderSubmission = { ...orderInfo, items };
  const editingId = orderForm.dataset.orderId;
  const isEditing = Boolean(editingId);

  orderFormSubmitBtn.disabled = true;
  try {
    const response = await fetch(
      isEditing ? `${ORDERS_API}/${editingId}` : `${ORDERS_API}`,
      {
        credentials: "include",
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderSubmission),
      },
    );

    if (!response.ok) {
      const message = await getErrorMessage(
        response,
        isEditing ? "Failed to update order" : "Failed to create order",
      );
      showToast(message, "error");
      return;
    }

    closeModal_();
    resetOrderForm();
    showToast(isEditing ? "Order updated" : "Order created", "success");
    loadOrders();
    loadQuickStats();
  } catch (error) {
    showToast("Something went wrong", "error");
  } finally {
    orderFormSubmitBtn.disabled = false;
  }
});

function gatherOrderInformations() {
  return {
    buyerName: nameInput.value.trim(),
    buyerPhone: phoneInput.value.trim(),
    buyerAddress: addressInput.value.trim(),
    buyerNote: noteInput.value.trim(),
    source: sourceInput.value,
    discount: Number(discountInput.value || 0),
  };
}

// ============================================
// Products / variants
// ============================================
async function loadProducts() {
  try {
    const MAX_PRODUCTS_TO_LOAD = 1000;
    const response = await fetch(`${API}?limit=${MAX_PRODUCTS_TO_LOAD}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch products");

    const result = await response.json();
    allProducts = Array.isArray(result) ? result : result.data;

    allVariants = allProducts.flatMap((product) =>
      (product.variants || []).map((variant) => ({
        variantId: variant.id,
        productId: product.id,
        status: product.status,
        price: variant.price,
        stock: variant.stock,
        displayName: `${product.name} - ${variant.options?.color || "Variant"} - ${variant.options?.storage || "Variant"} - ${variant.options?.condition || "Variant"} - ($${variant.price})`,
      })),
    );
  } catch (error) {
    console.warn("Falling back to demo data:", error.message);
  }
}

async function fetchSalesData(period) {
  try {
    const response = await fetch(
      `${ORDERS_API}/sales-over-time?period=${period}`,
      {
        credentials: "include",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }

    const result = await response.json();

    return result.buckets;
  } catch (error) {
    console.warn("data not loaded !", error.message);
    return [];
  }
}
async function loadSalesChart(
  period = "day",
  metric = "revenue",
  type = "line",
) {
  const buckets = await fetchSalesData(period);
  const chartData = formatChartData(buckets, metric, type);

  const canvas = document.getElementById("salesChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (salesChart) {
    salesChart.destroy();
  }

  salesChart = new Chart(ctx, {
    type: type,

    data: chartData,

    options: {
      responsive: true,
      maintainAspectRatio: false,

      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

loadSalesChart();

function formatChartData(buckets, metric, type) {
  const isBar = type === "bar";
  const rootStyles = getComputedStyle(document.documentElement);

  // Original orders-chart colors
  const countColor = "#fa8b8b";
  const revenueColor = rootStyles.getPropertyValue("--accent").trim();
  const revenueBackground = isBar ? revenueColor : "rgba(39, 147, 236, 0.10)";

  const countBackground = isBar ? countColor : "rgba(250, 139, 139, 0.10)";

  const labels = buckets.map((bucket) => bucket.date);

  // ------------------------------------------
  // Revenue
  // ------------------------------------------

  if (metric === "revenue") {
    return {
      labels,

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

  // ------------------------------------------
  // Orders
  // ------------------------------------------

  if (metric === "count") {
    return {
      labels,

      datasets: [
        {
          label: "Orders",

          data: buckets.map((bucket) => bucket.count),

          borderColor: countColor,

          backgroundColor: countBackground,

          fill: true,

          tension: 0.3,
        },
      ],
    };
  }

  // ------------------------------------------
  // Both
  // ------------------------------------------

  if (metric === "both") {
    return {
      labels,

      datasets: [
        {
          label: "Revenue",

          data: buckets.map((bucket) => bucket.revenue),

          borderColor: revenueColor,

          backgroundColor: revenueBackground,

          fill: true,

          tension: 0.3,

          yAxisID: "y-revenue",
        },

        {
          label: "Orders",

          data: buckets.map((bucket) => bucket.count),

          borderColor: countColor,

          backgroundColor: countBackground,

          fill: true,

          tension: 0.3,

          yAxisID: "y-count",
        },
      ],
    };
  }

  return {
    labels: [],
    datasets: [],
  };
}
// formatChartData(Array , string {"revenue " , "count", "both"})
function checkRowStock(itemRow) {
  const variantId = Number(itemRow.dataset.selectedVariantId);
  const variant = allVariants.find((v) => v.variantId === variantId);
  const qty = Number(itemRow.querySelector(".item-qty-input")?.value || 0);

  const overStock =
    variant && Number.isFinite(variant.stock) && qty > variant.stock;
  itemRow.classList.toggle("stock-exceeded", Boolean(overStock));
}

// ============================================
// Quick stats (always unfiltered/global)
// ============================================
async function loadQuickStats() {
  try {
    const response = await fetch(`${ORDERS_API}/stats`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch stats");
    const result = await response.json();
    console.log(result);
    renderQuickStats(result);
  } catch (error) {
    console.log(error.message);
  }
}

function renderQuickStats(orders) {
  const formatted = orders.revenue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  totalRevenue.textContent = formatted;
  pendingOrders.textContent = orders.pending;
  soldOrders.textContent = orders.sold;
  totalOrders.textContent = orders.total;
}

// ============================================
// Status filter pills
// ============================================
statusFilter.addEventListener("click", (e) => {
  const pill = e.target.closest(".status-pill");
  if (!pill) return;

  statusFilter.querySelectorAll(".status-pill").forEach((p) => {
    p.classList.remove("active");
    p.setAttribute("aria-selected", "false");
  });

  pill.classList.add("active");
  pill.setAttribute("aria-selected", "true");
  currentStatus = pill.dataset.status;
  currentPage = 1;
  loadOrders();
});

salesMetricToggle.addEventListener("click", (e) => {
  const pill = e.target.closest(".chart-toggle-btn");
  if (!pill) return;

  salesMetricToggle.querySelectorAll(".chart-toggle-btn").forEach((p) => {
    p.classList.remove("active");
    p.setAttribute("aria-selected", "false");
  });

  pill.classList.add("active");
  pill.setAttribute("aria-selected", "true");
  currentMetric = pill.dataset.metric;
  loadSalesChart(currentPeriod, currentMetric, currentType);
});

salesPeriodtoggle.addEventListener("click", (e) => {
  const pill = e.target.closest(".chart-toggle-btn");
  if (!pill) return;

  salesPeriodtoggle.querySelectorAll(".chart-toggle-btn").forEach((p) => {
    p.classList.remove("active");
  });
  pill.classList.add("active");
  currentPeriod = pill.dataset.period;
  loadSalesChart(currentPeriod, currentMetric, currentType);
});

salesTypeToggle.addEventListener("click", (e) => {
  const pill = e.target.closest(".chart-toggle-btn");
  if (!pill) return;

  salesTypeToggle.querySelectorAll(".chart-toggle-btn").forEach((p) => {
    p.classList.remove("active");
  });
  pill.classList.add("active");
  currentType = pill.dataset.type;
  loadSalesChart(currentPeriod, currentMetric, currentType);
});

// ============================================
// Search
// ============================================
let searchDebounceTimer;
orderSearchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);

  searchDebounceTimer = setTimeout(() => {
    currentSearch = orderSearchInput.value.trim();

    const newUrl = currentSearch
      ? `${window.location.pathname}?search=${encodeURIComponent(currentSearch)}`
      : window.location.pathname;

    history.replaceState({ search: currentSearch }, "", newUrl);

    currentPage = 1;
    loadOrders();
  }, 300);
});
// ============================================
// Load + render orders
// ============================================
async function loadOrders() {
  try {
    const response = await fetch(buildOrdersUrl(), { credentials: "include" });
    if (!response.ok) throw new Error("Failed to fetch orders");
    const result = await response.json();
    orders = result.orders;
    ordersPagination = result.pagination;
    renderOrders(orders);
    renderPagination(ordersPagination);
  } catch (error) {
    console.log(error.message);
    showToast("Failed to load orders", "error");
  }
}

function renderOrders(orders) {
  emptyState.classList.toggle("active", orders.length === 0);

  ordersTable.innerHTML = orders
    .map((order) => {
      const isSold = order.status === "sold";
      return `
    <tr data-order-id="${order.id}">
                  <td class="order-number" data-label="Order">${escapeHTML(order.orderNumber)}</td>
                  <td data-label="Buyer">
                    <span class="order-buyer-name">${escapeHTML(order.buyerName)}</span>
                    <span class="order-buyer-phone">${escapeHTML(order.buyerPhone)}</span>
                  </td>
                  <td data-label="Source"><span class="source-tag">${escapeHTML(order.source)}</span></td>
                  <td class="order-item-count" data-label="Items">${order.items?.length ?? 0} items</td>
                  <td class="order-total" data-label="Total">$${Number(order.total || 0).toFixed(2)}</td>
                  <td data-label="Status"><span class="status-badge ${escapeHTML(order.status)}">${escapeHTML(order.status)}</span></td>
                  <td class="order-date" data-label="Date">${formatDate(order.startDate)}</td>
                  <td class="col-actions" data-label="">
                    <div class="row-actions">
                      <button class="icon-btn view-order-btn" title="View"><i class="fa-solid fa-eye"></i></button>
                      <button class="icon-btn success mark-sold-btn" title="${isSold ? "Already sold" : "Mark as sold"}" ${isSold ? "disabled" : ""}><i class="fa-solid fa-check"></i></button>
                      <button class="icon-btn edit-order-btn" title="${isSold ? "Sold orders can't be edited" : "Edit"}" ${isSold ? "disabled" : ""}><i class="fa-solid fa-pen"></i></button>
                      <button class="icon-btn danger delete-order-btn" title="${isSold ? "Sold orders can't be deleted" : "Delete"}" ${isSold ? "disabled" : ""}><i class="fa-solid fa-trash"></i></button>
                    </div>
                  </td>
                </tr>`;
    })
    .join("");
}

function renderPagination(pagination) {
  if (!pagination) return;
  const { page, total, totalPages } = pagination;

  paginationInfo.textContent = `Showing ${orders.length} of ${total} orders`;
  pageCurrent.textContent = page;
  prevPageBtn.disabled = page <= 1;
  nextPageBtn.disabled = page >= totalPages;
}

prevPageBtn.addEventListener("click", () => {
  if (currentPage <= 1) return;
  currentPage -= 1;
  loadOrders();
});
nextPageBtn.addEventListener("click", () => {
  if (!ordersPagination || currentPage >= ordersPagination.totalPages) return;
  currentPage += 1;
  loadOrders();
});

// ============================================
// Order detail modal
// ============================================
orderDetailCloseBtn.addEventListener("click", () => {
  closeOrderDetailModal();
});

orderDetailCloseBtn2.addEventListener("click", () => {
  closeOrderDetailModal();
});
async function openOrderDetail(orderId) {
  try {
    const response = await fetch(`${ORDERS_API}/${orderId}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch order");
    const { order } = await response.json();

    orderDetailModal.dataset.orderId = order.id;

    document.getElementById("detailOrderNumber").textContent =
      order.orderNumber;
    const statusBadge = document.getElementById("detailStatusBadge");
    statusBadge.textContent = order.status;
    statusBadge.className = `status-badge ${order.status}`;

    document.getElementById("detailBuyerName").textContent =
      order.buyerName || "—";
    document.getElementById("detailBuyerPhone").textContent =
      order.buyerPhone || "—";
    document.getElementById("detailBuyerAddress").textContent =
      order.buyerAddress || "—";
    document.getElementById("detailSource").textContent = order.source || "—";
    document.getElementById("detailNote").textContent = order.buyerNote || "—";
    document.getElementById("detailStartDate").textContent = formatDate(
      order.startDate,
    );
    document.getElementById("detailCompletedDate").textContent = formatDate(
      order.completedAt,
    );

    document.getElementById("detailItemsBody").innerHTML = order.items
      .map((item) => {
        const variant = allVariants.find((v) => v.variantId === item.variantId);
        const overStock =
          variant &&
          Number.isFinite(variant.stock) &&
          item.quantity > variant.stock;

        return `
        <tr class="${overStock ? "stock-exceeded" : ""}">
          <td>
            <span class="detail-item-name">${escapeHTML(item.productName)}</span>
            <span class="detail-item-options">${escapeHTML(formatOptions(item.variantOptions))}</span>
          </td>
          <td>${item.quantity}</td>
          <td>$${Number(item.unitPrice * item.quantity).toFixed(2)}</td>
        </tr>`;
      })
      .join("");

    document.getElementById("detailSubtotal").textContent =
      `$${Number(order.subtotal).toFixed(2)}`;
    document.getElementById("detailDiscount").textContent =
      `$${Number(order.discount).toFixed(2)}`;
    document.getElementById("detailTotal").textContent =
      `$${Number(order.total).toFixed(2)}`;

    const isSold = order.status === "sold";
    detailEditBtn.style.display = isSold ? "none" : "";
    detailMarkSoldBtn.style.display = isSold ? "none" : "";

    currentDetailOrder = order;
    openOrderDetailModal();
  } catch (error) {
    showToast("Failed to load order details", "error");
  }
}

detailMarkSoldBtn.addEventListener("click", async () => {
  const orderId = orderDetailModal.dataset.orderId;
  if (!orderId) return;
  await markOrderSold(orderId, detailMarkSoldBtn);
  closeOrderDetailModal();
});

detailEditBtn.addEventListener("click", async () => {
  const orderId = orderDetailModal.dataset.orderId;
  if (!orderId) return;
  closeOrderDetailModal();
  await openOrderForEdit(orderId);
});
orderDetailModal.addEventListener("click", (e) => {
  if (e.target === orderDetailModal) {
    closeOrderDetailModal();
  }
});
// ============================================
// Print receipt — fills #receiptPrintArea from
// currentDetailOrder, reveals it, prints, then
// hides it again once the print dialog closes.
// ============================================
function fillReceipt(order) {
  document.getElementById("receiptOrderNumber").textContent =
    `#${order.orderNumber}`;
  document.getElementById("receiptDate").textContent = formatDate(
    order.startDate,
  );

  const statusEl = document.getElementById("receiptStatus");
  statusEl.textContent = order.status === "sold" ? "Paid" : "Pending";
  statusEl.className = `receipt-status-pill ${order.status === "sold" ? "is-sold" : "is-pending"}`;

  document.getElementById("receiptBuyerName").textContent =
    order.buyerName || "—";
  document.getElementById("receiptBuyerPhone").textContent =
    order.buyerPhone || "—";
  document.getElementById("receiptBuyerAddress").textContent =
    order.buyerAddress || "—";
  document.getElementById("receiptSource").textContent = order.source || "—";

  document.getElementById("receiptItemsBody").innerHTML = order.items
    .map((item) => {
      const options = formatOptions(item.variantOptions);
      return `
      <tr>
        <td>
          ${escapeHTML(item.productName)}${options ? `<br><small>${escapeHTML(options)}</small>` : ""}
        </td>
        <td>${item.quantity}</td>
        <td>$${Number(item.unitPrice).toFixed(2)}</td>
        <td>$${Number(item.unitPrice * item.quantity).toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  const noteRow = document.getElementById("receiptNoteRow");
  if (order.buyerNote) {
    document.getElementById("receiptNote").textContent = order.buyerNote;
    noteRow.hidden = false;
  } else {
    noteRow.hidden = true;
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("receiptItemCount").textContent =
    `Items (${itemCount})`;

  document.getElementById("receiptSubtotal").textContent =
    `$${Number(order.subtotal).toFixed(2)}`;
  document.getElementById("receiptDiscount").textContent =
    `-$${Number(order.discount).toFixed(2)}`;
  document.getElementById("receiptTotal").textContent =
    `$${Number(order.total).toFixed(2)}`;

  // Faux barcode number — just the order number's digits,
  // padded/grouped so it reads like a real barcode caption.
  const digits = String(order.orderNumber || "").replace(/\D/g, "");
  const padded = digits.padStart(12, "0").slice(-12);
  document.getElementById("receiptBarcodeLabel").textContent = padded
    .match(/.{1,4}/g)
    .join(" ");
}

printReceiptBtn.addEventListener("click", () => {
  if (!currentDetailOrder) {
    showToast("No order loaded to print", "error");
    return;
  }

  fillReceipt(currentDetailOrder);
  receiptPrintArea.hidden = false;

  window.print();

  // Fallback for browsers (older Safari) that don't fire
  // "afterprint" reliably — hides the receipt after a generous
  // delay regardless. Harmless no-op if afterprint already did it.
  setTimeout(() => {
    receiptPrintArea.hidden = true;
  }, 60000);
});

// Re-hide the receipt once the print dialog closes (works in
// Chrome/Firefox/Edge). Safari doesn't reliably fire afterprint,
// so a short fallback timeout hides it regardless — if afterprint
// already fired first, this is just a harmless no-op re-hide.
window.addEventListener("afterprint", () => {
  receiptPrintArea.hidden = true;
});

// ============================================
// Download receipt — renders #receiptPrintArea to a
// canvas (html2canvas) and drops it into a single-page
// PDF (jsPDF) sized to the ticket itself, then triggers
// a browser download named after the order number.
// ============================================
downloadReceiptBtn.addEventListener("click", async () => {
  if (!currentDetailOrder) {
    showToast("No order loaded to download", "error");
    return;
  }

  if (
    typeof html2canvas === "undefined" ||
    typeof window.jspdf === "undefined"
  ) {
    showToast("Download tools failed to load — check your connection", "error");
    return;
  }

  fillReceipt(currentDetailOrder);
  receiptPrintArea.hidden = false;
  // Force the classic light paper palette for the snapshot,
  // regardless of the dashboard's current light/dark theme —
  // see the matching @media print rule for why.
  receiptPrintArea.classList.add("receipt-force-light");
  downloadReceiptBtn.classList.add("is-loading");
  downloadReceiptBtn.disabled = true;

  try {
    // Slight delay lets fonts/layout settle before the snapshot.
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const canvas = await html2canvas(receiptPrintArea, {
      backgroundColor: "#fdfbf3",
      scale: 1.5, // crisp output for a small, text-heavy ticket
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.75);
    const { jsPDF } = window.jspdf;

    // Convert the captured pixel size to PDF points (72pt/in
    // at the same 96dpi:scale ratio html2canvas rendered at)
    // so the PDF page matches the receipt's own proportions
    // instead of being dropped onto a generic A4 sheet.
    const pxToPt = 72 / (96 * 3);
    const pdfWidth = canvas.width * pxToPt;
    const pdfHeight = canvas.height * pxToPt;

    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
      unit: "pt",
      format: [pdfWidth, pdfHeight],
    });

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`receipt-${currentDetailOrder.orderNumber || "order"}.pdf`);
  } catch (err) {
    console.error("Receipt download failed:", err);
    showToast("Couldn't generate the receipt PDF", "error");
  } finally {
    receiptPrintArea.hidden = true;
    receiptPrintArea.classList.remove("receipt-force-light");
    downloadReceiptBtn.classList.remove("is-loading");
    downloadReceiptBtn.disabled = false;
  }
});

// ============================================
// Shared "mark as sold" logic (used by row button + detail modal button)
// ============================================
async function markOrderSold(orderId, triggerBtn) {
  if (triggerBtn) triggerBtn.disabled = true;
  try {
    const response = await fetch(`${ORDERS_API}/${orderId}/sold`, {
      credentials: "include",
      method: "PUT",
    });

    if (!response.ok) {
      const message = await getErrorMessage(
        response,
        "Failed to mark order as sold",
      );
      showToast(message, "error");
      return;
    }

    showToast("Order marked as sold", "success");
    loadOrders();
    loadQuickStats();
  } catch (error) {
    showToast("Something went wrong", "error");
  } finally {
    if (triggerBtn) triggerBtn.disabled = false;
  }
}

// ============================================
// Edit order — reuses #orderFormModal
// ============================================
async function openOrderForEdit(orderId) {
  try {
    const response = await fetch(`${ORDERS_API}/${orderId}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch order");
    const { order } = await response.json();

    if (order.status === "sold") {
      showToast("Sold orders can't be edited", "error");
      return;
    }

    resetOrderForm(); // clear any stale state before filling
    orderForm.dataset.orderId = order.id;
    orderFormTitle.textContent = "Edit Order";
    orderFormSubmitBtn.textContent = "Save Changes";

    nameInput.value = order.buyerName || "";
    phoneInput.value = order.buyerPhone || "";
    addressInput.value = order.buyerAddress || "";
    noteInput.value = order.buyerNote || "";
    sourceInput.value = order.source || "";
    discountInput.value = order.discount || 0;

    order.items.forEach((item) => addItemRowFromOrderItem(item));

    calculateSubtotal();
    openModal();
  } catch (error) {
    showToast("Failed to load order for editing", "error");
  }
}

function addItemRowFromOrderItem(item) {
  itemsEmptyNote.hidden = true;

  const itemRow = document.createElement("div");
  itemRow.classList.add("order-item-row");
  itemRow.dataset.selectedVariantId = item.variantId;
  itemRow.dataset.unitPrice = item.unitPrice;

  const lineTotal = (item.unitPrice * item.quantity).toFixed(2);
  const displayName = `${item.productName} - ${formatOptions(item.variantOptions)}`;

  itemRow.innerHTML = `
    <div class="variant-search">
      <input type="text" class="variant-search-input" placeholder="Search product" value="${escapeHTML(displayName)}" />
      <div class="variant-search-results"></div>
    </div>
    <input type="number" class="item-qty-input" min="1" value="${item.quantity}" />
    <div class="item-line-total">$${lineTotal}</div>
    <button type="button" class="remove-item-btn" aria-label="Remove item">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  itemRow.querySelector(".remove-item-btn").addEventListener("click", () => {
    itemRow.remove();
    calculateSubtotal();
    if (orderItemsList.children.length === 0) {
      itemsEmptyNote.hidden = false;
    }
  });

  orderItemsList.appendChild(itemRow);
  checkRowStock(itemRow);
}

// ============================================
// Row actions: view / edit / delete / mark sold
// ============================================
ordersTable.addEventListener("click", async (e) => {
  const viewBtn = e.target.closest(".view-order-btn");
  const editBtn = e.target.closest(".edit-order-btn");
  const deleteBtn = e.target.closest(".delete-order-btn");
  const soldBtn = e.target.closest(".mark-sold-btn");

  if (viewBtn) {
    const orderId = viewBtn.closest("tr").dataset.orderId;
    await openOrderDetail(orderId);
    return;
  }
  if (editBtn) {
    const orderId = editBtn.closest("tr").dataset.orderId;
    await openOrderForEdit(orderId);
    return;
  }
  if (deleteBtn) {
    const orderId = deleteBtn.closest("tr").dataset.orderId;
    confirmDeleteBtn.dataset.orderId = orderId;
    confirmDeleteModal.classList.add("active");
    lockBodyScroll();
    return;
  }
  if (soldBtn) {
    const orderId = soldBtn.closest("tr").dataset.orderId;
    await markOrderSold(orderId, soldBtn);
  }
});

confirmDeleteBtn.addEventListener("click", async () => {
  const orderId = confirmDeleteBtn.dataset.orderId;
  if (!orderId) return;

  confirmDeleteBtn.disabled = true;
  try {
    const response = await fetch(`${ORDERS_API}/${orderId}`, {
      credentials: "include",
      method: "DELETE",
    });

    if (!response.ok) {
      const message = await getErrorMessage(response, "Failed to delete order");
      showToast(message, "error");
      return;
    }

    showToast("Order deleted", "success");
    confirmDeleteModal.classList.remove("active");
    unlockBodyScroll();
    loadOrders();
    loadQuickStats();
  } catch (error) {
    showToast("Something went wrong", "error");
  } finally {
    confirmDeleteBtn.disabled = false;
    delete confirmDeleteBtn.dataset.orderId;
  }
});

cancelDeleteBtn?.addEventListener("click", () => {
  confirmDeleteModal.classList.remove("active");
  unlockBodyScroll();
  delete confirmDeleteBtn.dataset.orderId;
});

// ============================================
// Variant search inside item rows
// ============================================
orderItemsList.addEventListener("input", (e) => {
  const variantSearchInput = e.target.closest(".variant-search-input");
  if (!variantSearchInput) return;

  const itemRow = variantSearchInput.closest(".order-item-row");
  const resultsContainer = itemRow.querySelector(".variant-search-results");

  const searchTerm = variantSearchInput.value.trim().toLowerCase();
  if (!searchTerm) {
    resultsContainer.classList.remove("active");
    resultsContainer.innerHTML = "";
    return;
  }

  const matchingVariants = allVariants
    .filter(
      (item) =>
        item.status !== "ARCHIVED" &&
        item.displayName.toLowerCase().includes(searchTerm),
    )
    .slice(0, 20); // cap results so a broad term doesn't render hundreds of rows

  resultsContainer.classList.add("active");
  resultsContainer.innerHTML = matchingVariants
    .map(
      (item) => `
      <div class="variant-result" data-variant-id="${item.variantId}">
        <div class="variant-name">${escapeHTML(item.displayName)}</div>
      </div>
    `,
    )
    .join("");
});

// close variant search dropdown when clicking outside it
document.addEventListener("click", (e) => {
  if (e.target.closest(".variant-search")) return;
  document.querySelectorAll(".variant-search-results.active").forEach((el) => {
    el.classList.remove("active");
    el.innerHTML = "";
  });
});

function collectOrderItems() {
  const itemRows = document.querySelectorAll(".order-item-row");
  return Array.from(itemRows)
    .filter((row) => Number.isFinite(Number(row.dataset.selectedVariantId)))
    .map((row) => ({
      variantId: Number(row.dataset.selectedVariantId),
      quantity: Number(row.querySelector(".item-qty-input")?.value),
    }));
}

orderItemsList.addEventListener("click", (e) => {
  const result = e.target.closest(".variant-result");
  if (!result) return;

  const variantId = Number(result.dataset.variantId);
  const selectedVariant = allVariants.find((v) => v.variantId === variantId);
  if (!selectedVariant) return;

  const itemRow = result.closest(".order-item-row");
  const variantSearchInput = itemRow.querySelector(".variant-search-input");
  const variantPriceTotal = itemRow.querySelector(".item-line-total");
  const itemQuantity = itemRow.querySelector(".item-qty-input");

  itemRow.dataset.selectedVariantId = selectedVariant.variantId;
  itemRow.dataset.unitPrice = selectedVariant.price;

  variantSearchInput.value = selectedVariant.displayName;
  const total = selectedVariant.price * Number(itemQuantity.value);
  variantPriceTotal.textContent = `$${total.toFixed(2)}`;
  calculateSubtotal();
  checkRowStock(itemRow);
  result.closest(".variant-search-results").classList.remove("active");
});

orderItemsList.addEventListener("change", (e) => {
  if (!e.target.classList.contains("item-qty-input")) return;

  const itemRow = e.target.closest(".order-item-row");
  const unitPrice = Number(itemRow.dataset.unitPrice || 0);
  const qty = Number(e.target.value || 1);
  const variantPriceTotal = itemRow.querySelector(".item-line-total");

  variantPriceTotal.textContent = `$${(unitPrice * qty).toFixed(2)}`;
  checkRowStock(itemRow);
  calculateSubtotal();
});

if (discountInput) {
  discountInput.addEventListener("input", calculateSubtotal);
}

function calculateSubtotal() {
  const itemRows = document.querySelectorAll(".order-item-row");
  let subtotal = 0;

  itemRows.forEach((row) => {
    const unitPrice = Number(row.dataset.unitPrice || 0);
    const quantity = Number(row.querySelector(".item-qty-input")?.value || 0);
    subtotal += unitPrice * quantity;
  });

  const subtotalElement = document.getElementById("summarySubtotal");
  const summaryTotal = document.getElementById("summaryTotal");
  if (subtotalElement) subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  if (summaryTotal) {
    const discountVal = Math.max(0, Number(discountInput?.value || 0));
    summaryTotal.textContent = `$${Math.max(0, subtotal - discountVal).toFixed(2)}`;
  }
  return subtotal;
}

addItemBtn.addEventListener("click", () => {
  itemsEmptyNote.hidden = true;

  const itemRow = document.createElement("div");
  itemRow.classList.add("order-item-row");

  itemRow.innerHTML = `
    <div class="variant-search">
      <input type="text" class="variant-search-input" placeholder="Search product" />
      <div class="variant-search-results"></div>
    </div>
    <input type="number" class="item-qty-input" min="1" value="1" />
    <div class="item-line-total">$0.00</div>
    <button type="button" class="remove-item-btn" aria-label="Remove item">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  itemRow.querySelector(".remove-item-btn").addEventListener("click", () => {
    itemRow.remove();
    calculateSubtotal();
    if (orderItemsList.children.length === 0) {
      itemsEmptyNote.hidden = false;
    }
  });

  orderItemsList.appendChild(itemRow);
  checkRowStock(itemRow);
});

loadProducts();
loadOrders();
loadQuickStats();

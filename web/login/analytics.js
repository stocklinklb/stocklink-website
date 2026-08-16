const API = API_BASE;
const totalVisitors = document.getElementById("total-visitors");
const topProducts = document.getElementById("top-products");
const topSearchedQuery = document.getElementById("top-searched-query");
const zeroSearchResult = document.getElementById("zero-search-result");
const avgSessionTime = document.getElementById("avg-session-time");
const activityLogList = document.getElementById("activityLogList");
const activityLogPager = document.getElementById("activity-log-pager");
const filteredList = document.getElementById("filters-list");
let allActivityLogs = [];
const highDemandOutOfStock = document.getElementById(
  "high-demand-out-of-stock",
);
const activityIcons = {
  product_created: "fa-solid fa-plus",
  product_deleted: "fa-solid fa-minus",
  product_updated: "fa-solid fa-pen",
  bulk_edit: "fa-solid fa-pen-to-square",
  bulk_import: "fa-solid fa-file-import",
  bulk_delete: "fa-solid fa-trash-can",
};
const limitList = document.getElementById("limit-list");
let currentLimit = 20;



limitList.addEventListener("change", () => {
  currentLimit = Number(limitList.value);
  loadActivityLogs(1);
});
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
const activityLogSummary = document.getElementById("activity-log-summary");

function renderActivityLogSummary(page, limit, total, shown) {
  if (total === 0) {
    activityLogSummary.innerHTML = `Showing <strong>0</strong> of <strong>0</strong>`;
    return;
  }
  const start = (page - 1) * limit + 1;
  const end = start + shown - 1;
  activityLogSummary.innerHTML = `Showing <strong>${start}–${end}</strong> of <strong>${total}</strong>`;
}
function formatTimeAgo(createdAt) {
  const elapsed = Date.now() - new Date(createdAt).getTime();

  const minute = 1000 * 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;
  const year = day * 365;

  if (elapsed < minute) {
    return `${Math.floor(elapsed / 1000)}s ago`;
  }

  if (elapsed < hour) {
    return `${Math.floor(elapsed / minute)}m ago`;
  }

  if (elapsed < day) {
    return `${Math.floor(elapsed / hour)}h ago`;
  }

  if (elapsed < week) {
    return `${Math.floor(elapsed / day)}d ago`;
  }

  if (elapsed < month) {
    return `${Math.floor(elapsed / week)}w ago`;
  }

  if (elapsed < year) {
    return `${Math.floor(elapsed / month)}mo ago`;
  }

  return `${Math.floor(elapsed / year)}y ago`;
}

function checkIcons(action) {
  return activityIcons[action];
}
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

let currentChartType = "line";
let lastVisitorsData = [];
let currentPeriod = "day";
let requestId = 0;
let summaryRequestId = 0; // same race-guard pattern as loadVisitorsOverTime, applied to loadAnalytics()
const visitorsChartCanvas = document.getElementById("visitors-chart");
let visitorsChart = null; // keep a reference so we can destroy/redraw later
let currentPage = 1;
let currentActionFilter = "all";
// Render pager function
function renderPager(page, totalPages) {
  activityLogPager.textContent = "";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "prev";
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener("click", () => loadActivityLogs(page - 1));
  activityLogPager.appendChild(prevBtn);

  const pages = getPageList(page, totalPages);

  pages.forEach((p) => {
    if (p === "...") {
      const dots = document.createElement("span");
      dots.textContent = "...";
      dots.classList.add("dots");
      activityLogPager.appendChild(dots);
    } else {
      const pageBtn = document.createElement("button");
      pageBtn.textContent = p;
      pageBtn.classList.toggle("active", p === page);
      pageBtn.addEventListener("click", () => loadActivityLogs(p));
      activityLogPager.appendChild(pageBtn);
    }
  });

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "next";
  nextBtn.disabled = page >= totalPages;
  nextBtn.addEventListener("click", () => loadActivityLogs(page + 1));
  activityLogPager.appendChild(nextBtn);
}
async function loadVisitorsOverTime(period = currentPeriod) {
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
  setActivePeriodButton(currentPeriod);
}

filteredList.addEventListener("change", () => {
  currentActionFilter = filteredList.value;
  loadActivityLogs(1);
});
let currentUsername = "admin";
function renderLogsTable(logs) {
  activityLogList.innerHTML = "";
  logs.forEach((log) => {
    console.log(log);
    const arrow = document.createElement("i");
    arrow.classList.add("fa-solid", "fa-chevron-down", "activity-log-arrow");
    const row = document.createElement("div");
    row.classList = "activity-log-row";
    const icon = document.createElement("div");
    icon.classList = "activity-log-icon";
    const content = document.createElement("div");
    content.classList = "activity-log-content";
    const summary = document.createElement("div");
    summary.classList = "activity-log-summary";
    const time = document.createElement("div");
    time.classList = "activity-log-time";
    const details = document.createElement("div");
    details.classList.add("activity-log-details");

    summary.innerHTML = `<p>${currentUsername}</p> ${log.summary}`;
    time.textContent = formatTimeAgo(log.createdAt);

    const iconElement = document.createElement("i");
    iconElement.classList.add(...checkIcons(log.action).split(" "));
    icon.appendChild(iconElement);

    const lines = [];
    log.entries.forEach((entry) => {
      entry.changes?.forEach((change) => {
        lines.push({ entry, change });
      });
    });

    if (lines.length === 0) {
      details.textContent = "";
    } else {
      row.classList.add("has-details");
      row.addEventListener("click", () => {
        details.classList.toggle("open");
        arrow.classList.toggle("open");
      });

      lines.forEach((line) => {
        const detailLine = document.createElement("div");
        const fieldLabel =
          line.change.field.charAt(0).toUpperCase() +
          line.change.field.slice(1);

        if (line.change.from === undefined) {
          detailLine.innerHTML = `${line.entry.productName} - <strong>${fieldLabel} ${line.change.to}</strong>`;
        } else {
          detailLine.innerHTML = `${line.entry.productName} - <strong>${fieldLabel} edited from ${line.change.from} to ${line.change.to}</strong>`;
        }

        details.append(detailLine);
      });

      time.append(arrow);
    }

    console.log(lines);
    content.appendChild(summary);
    content.appendChild(time);

    row.appendChild(icon);
    row.appendChild(content);

    activityLogList.appendChild(row);
    activityLogList.appendChild(details);
  });
}
async function loadActivityLogs(page = 1) {
  currentPage = page;

  try {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", currentLimit);
    if (currentActionFilter !== "all") {
      params.set("action", currentActionFilter);
    }
    const url = `${API}/activity-log?${params.toString()}`;
    const response = await fetch(`${url}`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to fetch activity logs");
    const result = await response.json();
    allActivityLogs = result.data;
    renderLogsTable(allActivityLogs);
    renderPager(result.page, result.totalPages);
  } catch (error) {
    console.error(error);
  }
}
// Keeps the period toggle's .active styling in sync with whatever period
// is actually driving the chart right now - called both after a manual
// period switch and once on initial load, so the default ("day") shows
// as selected before the user has clicked anything.
function setActivePeriodButton(period) {
  document.querySelectorAll(".period-toggle button").forEach((button) => {
    button.classList.toggle("active", button.dataset.period === period);
  });
}

function toggleChartType() {
  currentChartType = currentChartType === "line" ? "bar" : "line";
  renderVisitorsChart(lastVisitorsData);

  const button = document.getElementById("chart-type-toggle");
  button.textContent =
    currentChartType === "line" ? "Switch to Bar" : "Switch to Line";
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

  visitorsChart = new Chart(visitorsChartCanvas, {
    type: currentChartType,
    data: {
      labels,
      datasets: [
        {
          label: "Visitors",
          data: counts,
          borderColor: "#2793ec75",
          backgroundColor: "rgba(13, 0, 255, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }, // whole numbers only - can't have 2.5 visitors
        },
      },
    },
  });
}

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0s";

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (minutes === 0) {
    return `${secs}s`;
  }

  return `${minutes}m ${secs}s`;
}

// Renders a list of pre-formatted line strings as real DOM elements
// instead of textContent + "\n" (which silently collapses to one run-on
// line unless the container has white-space: pre-line in CSS). Each row
// gets its own element so it can be styled/targeted individually later.
function renderLines(container, lines) {
  container.innerHTML = "";

  if (lines.length === 0) {
    const empty = document.createElement("p");
    empty.className = "analytics-empty-line";
    empty.textContent = "No data yet";
    container.appendChild(empty);
    return;
  }

  lines.forEach((line) => {
    const row = document.createElement("p");
    row.className = "analytics-line";
    row.textContent = line;
    container.appendChild(row);
  });
}

async function loadAnalytics() {
  const thisRequest = ++summaryRequestId;

  try {
    const response = await fetch(`${ANALYTICS_API}/summary`, {
      credentials: "include",
    });
    const analytics = await response.json();

    if (thisRequest !== summaryRequestId) return;

    if (!response.ok) {
      showToast(analytics.error || "Loading failed", "error");
      console.log(analytics);
      return;
    }

    console.log(analytics);

    totalVisitors.textContent = analytics.totalVisitors;

    const lines = analytics.topProductWithDetails.map(
      (product) => `${product.name} — ${product.viewCount} views`,
    );
    renderLines(topProducts, lines);

    const searchLines = analytics.topSearchQuery.map(
      (item) => `${item.query} - ${item._count.query} searches`,
    );
    renderLines(topSearchedQuery, searchLines);

    const zeroLines = analytics.zeroResultSearches.map(
      (zero) => `${zero.query} - ${zero._count.query} empty searches`,
    );
    renderLines(zeroSearchResult, zeroLines);

    // High-demand-but-out-of-stock: products with real view traffic where
    // every variant currently has 0 stock. Expects the backend to expose
    // this as analytics.outOfStockHighView (array of {name, viewCount}),
    // e.g. products with viewCount > 0 joined against variants where
    // stock <= 0 for all variants of that product. If that field doesn't
    // exist on the response yet, this just renders the empty state.
    if (highDemandOutOfStock) {
      const demandLines = (analytics.outOfStockHighView || []).map(
        (product) => `${product.name} — ${product.viewCount} views, 0 in stock`,
      );
      renderLines(highDemandOutOfStock, demandLines);
    }

    avgSessionTime.textContent = ` ${formatTime(analytics.averageSessionTime)} `;

    // Only seed the chart from the summary endpoint on first load, when
    // nothing has set a period yet. If the user has already picked a
    // period via loadVisitorsOverTime (chart toggle / period selector),
    // currentPeriod no longer matches this endpoint's implicit default -
    // re-rendering here would silently revert the chart out from under
    // whatever period they selected, while currentPeriod itself stayed
    // unchanged, leaving the label/button out of sync with what's drawn.
    if (!visitorsChart) {
      lastVisitorsData = analytics.visitorsOverTime;
      renderVisitorsChart(lastVisitorsData);
      setActivePeriodButton(currentPeriod);
    }
  } catch (error) {
    showToast("Couldn't Load Analytics", "error");
    console.error(error);
  }
}

loadAnalytics();
loadActivityLogs();

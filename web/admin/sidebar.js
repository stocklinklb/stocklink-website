const sidebarItems = [
  {
    name: "Home",
    icon: "fa-solid fa-house",
    href: "/admin/index.html",
    permission: "",
    group: "main",
    feature: "home",
  },
  {
    name: "Orders",
    icon: "fa-solid fa-cart-shopping",
    href: "/admin/order.html",
    permission: "",
    group: "main",
    feature: "orders",
  },
  {
    name: "Analytics",
    icon: "fa-solid fa-chart-pie",
    href: "/admin/analytics.html",
    permission: "canViewAnalytics",
    group: "main",
    feature: "analytics",
  },
  {
    name: "Products",
    icon: "fa-solid fa-boxes-stacked",
    href: "/admin/products.html",
    permission: "",
    group: "inventory",
    feature: "products",
  },
  {
    name: "Add Product",
    icon: "fa-solid fa-circle-plus",
    href: "/admin/add-product.html",
    permission: "canModifyProducts",
    group: "inventory",
    feature: "addProducts",
  },
  {
    name: "Excel Import",
    icon: "fa-solid fa-table",
    href: "/admin/excel-import.html",
    permission: "canBulkImport",
    group: "inventory",
    feature: "excelImport",
  },
  {
    name: "Incompleted Products",
    icon: "fa-solid fa-circle-exclamation",
    href: "/admin/missing-infos.html",
    permission: "canFillMissingProducts",
    group: "inventory",
    feature: "missingInfos",
  },
  {
    name: "Staff",
    icon: "fa-solid fa-users",
    href: "/admin/staff.html",
    permission: "canManageStaff",
    group: "admin",
    feature: "staff",
  },
  {
    name: "Settings",
    icon: "fa-solid fa-gear",
    href: "/admin/settings.html",
    permission: "canModifySettings",
    group: "admin",
    feature: "settings",
  },
];

// Display labels for each group, in the order they should render.
// A group with zero visible items (all filtered out by permission)
// is simply skipped — no empty label renders.
const sidebarGroups = [
  { key: "main", label: "Overview" },
  { key: "inventory", label: "Inventory" },
  { key: "admin", label: "Admin" },
];
function applyPermission(data, tier) {
  const sidebar = document.getElementById("sidebar-links");

  if (!sidebar) return;

  const lastSegment = window.location.pathname.split("/").pop();
  const currentPage =
    !lastSegment || lastSegment === "admin"
      ? "index"
      : lastSegment.replace(/\.html$/, "");
  const currentItem = sidebarItems.find(
    (item) =>
      item.href
        .split("/")
        .pop()
        .replace(/\.html$/, "") === currentPage,
  );
  if (
    currentItem &&
    currentItem.permission &&
    !checkPermission(currentItem.permission, data.isOwner, data.permissions)
  ) {
    window.location.href = "/admin/index.html";
    return;
  }

  if (tier) {
    if (
      currentItem &&
      currentItem.feature &&
      !hasFeature(tier, currentItem.feature) && currentPage !== "index"
    ) {
      window.location.href = "/admin/index.html";
      return;

    }
  }
  const filteredSidebarItems = sidebarItems.filter((item) =>
    item.permission
      ? checkPermission(item.permission, data.isOwner, data.permissions)
      : true,
  );
  const linkHTML = (item) => {
    const locked = item.feature && tier && !hasFeature(tier, item.feature);

    if (locked) {
      return `
      <span class="sidebar-locked" title="Upgrade your plan to unlock this feature.">
        <i class="${item.icon}"></i>
        <span>${item.name}</span>
        <i class="fa-solid fa-lock sidebar-lock-icon"></i>
      </span>
    `;
    }

    // On clean-URL hosts (Vercel, `vercel dev`) "/admin/x.html" answers with a
    // redirect, and a redirect makes the browser skip the page transition, so the
    // whole page (sidebar included) blinks. Link straight to the URL the host uses.
    // ("/admin/index" itself redirects to "/admin" there.)
    const path = window.location.pathname;
    const href = path.endsWith(".html") || path.endsWith("/")
      ? item.href
      : item.href.replace(/\.html$/, "").replace(/\/index$/, "");

    return `
    <a href="${href}" class="pressable">
      <i class="${item.icon}"></i>
      <span>${item.name}</span>
    </a>
  `;
  };

  const html = sidebarGroups
    .map((group) => {
      const itemsInGroup = filteredSidebarItems.filter(
        (item) => item.group === group.key,
      );
      if (!itemsInGroup.length) return ""; // skip empty groups (e.g. no admin perms)

      const label = group.label
        ? `<span class="sidebar-section-label">${group.label}</span>`
        : "";

      return `<div class="sidebar-section">${label}${itemsInGroup.map(linkHTML).join("")}</div>`;
    })
    .join("");

  // The sidebar is drawn up to 4 times per page load (cached + fresh staff
  // and subscription data). Only touch the DOM when the result changed,
  // otherwise every redraw rebuilds the links and they flicker.
  // The HTML is the same on every page (the active link is marked separately),
  // so it's also cached for the inline restore script in each page's HTML.
  if (html !== lastSidebarHTML) {
    lastSidebarHTML = html;
    sidebar.innerHTML = html;
    sessionStorage.setItem("sidebarHTML", html);
  }
  markActiveSidebarLink(sidebar, currentPage);
}

// The inline script after #sidebar-links may have already drawn the cached
// HTML before this file loaded; if so, there's nothing to redraw.
let lastSidebarHTML = window.__sidebarRestored
  ? sessionStorage.getItem("sidebarHTML")
  : null;

function markActiveSidebarLink(sidebar, currentPage) {
  sidebar.querySelectorAll("a[href]").forEach((link) => {
    const page = link.getAttribute("href").split("/").pop().replace(/\.html$/, "");
    link.classList.toggle("active", page === currentPage);
  });
}

// Placeholder rows while nothing is cached yet (first load in a new tab),
// so the sidebar is never an empty column.
function renderSidebarSkeleton() {
  const sidebar = document.getElementById("sidebar-links");
  if (!sidebar) return;
  sidebar.innerHTML = `<div class="sidebar-section">${Array.from({ length: 6 })
    .map(() => `<div class="sidebar-skeleton-row"><span class="skeleton skeleton-text"></span></div>`)
    .join("")}</div>`;
}

async function renderSideBar() {
  const rawData = sessionStorage.getItem("staffMe");
  const cachedSub = sessionStorage.getItem("subscriptionInfo");
  const cachedTier = cachedSub ? JSON.parse(cachedSub).subscriptionTier : null;

  if (rawData) {
    const parsedData = JSON.parse(rawData);
    applyPermission(parsedData, cachedTier);
  } else if (!window.__sidebarRestored) {
    renderSidebarSkeleton();
  }
  const response = await fetch(`${API_ROOT}/staff/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    window.location.href = "/admin/login.html"; // or wherever unauthenticated users should land
    return;
  }

  const { data } = await response.json();
  sessionStorage.setItem("staffMe", JSON.stringify(data));
  // Re-read the tier: /subscription may have answered while /staff/me was in flight
  const latestSub = sessionStorage.getItem("subscriptionInfo");
  applyPermission(data, latestSub ? JSON.parse(latestSub).subscriptionTier : cachedTier);
}

const TIER_META = {
  FLOW: { icon: "fa-solid fa-leaf", className: "tier-flow" },
  PRIME: { icon: "fa-solid fa-bolt", className: "tier-prime" },
  ELITE: { icon: "fa-solid fa-crown", className: "tier-elite" },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysRemaining(endStr) {
  if (!endStr) return null;
  const diffMs = new Date(endStr).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function renderSubscriptionPanel(sub) {
  const panel = document.getElementById("subscription-panel");
  if (!panel || !sub) return;

  const tierMeta = TIER_META[sub.subscriptionTier] || TIER_META.FLOW;
  const remaining = daysRemaining(sub.subscriptionEnd);

  const btnIcon = document.querySelector("#subscription-btn i");
  if (btnIcon) btnIcon.className = tierMeta.icon;

  panel.innerHTML = `
    <div class="subscription-header ${tierMeta.className}">
      <i class="${tierMeta.icon}"></i>
      <span>${sub.subscriptionTier}</span>
      <span class="sub-status sub-status-${sub.subscriptionStatus.toLowerCase()}">
        ${sub.subscriptionStatus}
      </span>
    </div>
    <div class="subscription-row">
      <span>Started</span>
      <span>${formatDate(sub.subscriptionStart)}</span>
    </div>
    <div class="subscription-row">
      <span>Renews / Ends</span>
      <span>${formatDate(sub.subscriptionEnd)}</span>
    </div>
    ${remaining !== null
      ? `<div class="subscription-row">
             <span>Days left</span>
             <span>${remaining >= 0 ? remaining : "Expired"}</span>
           </div>`
      : ""
    }
    <div class="subscription-row">
      <span>Monthly rate</span>
      <span>${sub.monthlyRate != null ? `$${sub.monthlyRate.toFixed(2)}` : "—"}</span>
    </div>
    <div class="subscription-row">
      <span>Auto-renew</span>
      <span class="${sub.autoRenew ? "sub-on" : "sub-off"}">
        ${sub.autoRenew ? "On" : "Off"}
      </span>
    </div>
  `;
}

function injectSubscriptionWidget() {
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions || document.getElementById("subscription-btn")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "subscription-wrapper";
  wrapper.innerHTML = `
    <button class="subscription-btn" id="subscription-btn" aria-label="Subscription details">
      <i class="fa-solid fa-bolt"></i>
    </button>
    <div class="subscription-dropdown" id="subscription-panel"></div>
  `;
  headerActions.prepend(wrapper);
}

const subscriptionButton = document.getElementById("subscription-btn");

async function loadSubscription() {
  const cached = sessionStorage.getItem("subscriptionInfo");
  if (cached) {
    const parsedSub = JSON.parse(cached);
    renderSubscriptionPanel(parsedSub);

    const rawStaff = sessionStorage.getItem("staffMe");
    if (rawStaff)
      applyPermission(JSON.parse(rawStaff), parsedSub.subscriptionTier);
  }

  try {
    const response = await fetch(`${API_ROOT}/subscription`, {
      credentials: "include",
    });
    if (!response.ok) return;
    const data = await response.json();
    sessionStorage.setItem("subscriptionInfo", JSON.stringify(data));
    renderSubscriptionPanel(data);

    const rawStaff = sessionStorage.getItem("staffMe");
    if (rawStaff) applyPermission(JSON.parse(rawStaff), data.subscriptionTier);
  } catch (err) {
    console.error("Failed to load subscription info", err);
  }
}

injectSubscriptionWidget();
loadSubscription();

document.getElementById("subscription-btn")?.addEventListener("click", () => {
  document.querySelector(".subscription-dropdown").classList.toggle("active");
});

document.addEventListener("click", (e) => {
  const dropdown = document.querySelector(".subscription-dropdown");
  const btn = document.getElementById("subscription-btn");
  if (!dropdown || !btn) return;
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove("active");
  }
});
renderSideBar();

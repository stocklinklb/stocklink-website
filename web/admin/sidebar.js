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
  if (
    currentItem &&
    currentItem.feature &&
    !hasFeature(tier, currentItem.feature)
  ) {
    window.location.href = "/admin/index.html";
    return;
  }
  const filteredSidebarItems = sidebarItems.filter((item) =>
    item.permission
      ? checkPermission(item.permission, data.isOwner, data.permissions)
      : true,
  );

  const linkHTML = (item) => {
    const locked = item.feature && !hasFeature(tier, item.feature);
    const isActive =
      currentPage ===
      item.href
        .split("/")
        .pop()
        .replace(/\.html$/, "");

    if (locked) {
      return `
      <span class="sidebar-locked" title="Upgrade your plan to unlock this feature.">
        <i class="${item.icon}"></i>
        <span>${item.name}</span>
        <i class="fa-solid fa-lock sidebar-lock-icon"></i>
      </span>
    `;
    }

    return `
    <a href="${item.href}" class="${isActive ? "active" : ""}">
      <i class="${item.icon}"></i>
      <span>${item.name}</span>
    </a>
  `;
  };

  sidebar.innerHTML = sidebarGroups
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
}
async function renderSideBar() {
  const rawData = sessionStorage.getItem("staffMe");
  const cachedSub = sessionStorage.getItem("subscriptionInfo");
  const cachedTier = cachedSub ? JSON.parse(cachedSub).subscriptionTier : null;

  if (rawData) {
    const parsedData = JSON.parse(rawData);
    applyPermission(parsedData, cachedTier);
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
  applyPermission(data, cachedTier);
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
    ${
      remaining !== null
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

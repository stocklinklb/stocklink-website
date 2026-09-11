const sidebarItems = [
  {
    name: "Home",
    icon: "fa-solid fa-house",
    href: "/admin/index.html",
    permission: "",
    group: "main",
  },
  {
    name: "Orders",
    icon: "fa-solid fa-cart-shopping",
    href: "/admin/order.html",
    permission: "",
    group: "main",
  },
  {
    name: "Analytics",
    icon: "fa-solid fa-chart-pie",
    href: "/admin/analytics.html",
    permission: "canViewAnalytics",
    group: "main",
  },
  {
    name: "Products",
    icon: "fa-solid fa-boxes-stacked",
    href: "/admin/products.html",
    permission: "",
    group: "inventory",
  },
  {
    name: "Add Product",
    icon: "fa-solid fa-circle-plus",
    href: "/admin/add-product.html",
    permission: "canModifyProducts",
    group: "inventory",
  },
  {
    name: "Excel Import",
    icon: "fa-solid fa-table",
    href: "/admin/excel-import.html",
    permission: "canBulkImport",
    group: "inventory",
  },
  {
    name: "Incompleted Products",
    icon: "fa-solid fa-circle-exclamation",
    href: "/admin/missing-infos.html",
    permission: "canFillMissingProducts",
    group: "inventory",
  },
  {
    name: "Staff",
    icon: "fa-solid fa-users",
    href: "/admin/staff.html",
    permission: "canManageStaff",
    group: "admin",
  },
  {
    name: "Settings",
    icon: "fa-solid fa-gear",
    href: "/admin/settings.html",
    permission: "canModifySettings",
    group: "admin",
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
function applyPermission(data) {
  const sidebar = document.getElementById("sidebar-links");

  if (!sidebar) return;

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const currentItem = sidebarItems.find(
    (item) => item.href.split("/").pop() === currentPage,
  );

  if (
    currentItem &&
    currentItem.permission &&
    !checkPermission(currentItem.permission, data.isOwner, data.permissions)
  ) {
    window.location.href = "/admin/index.html";
    return;
  }
  const filteredSidebarItems = sidebarItems.filter((item) =>
    item.permission
      ? checkPermission(item.permission, data.isOwner, data.permissions)
      : true,
  );

  const linkHTML = (item) => `
        <a href="${item.href}"
           class="${currentPage === item.href.split("/").pop() ? "active" : ""}">
          <i class="${item.icon}"></i>
          <span>${item.name}</span>
        </a>
      `;

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

  if (rawData) {
    const parsedData = JSON.parse(rawData);
    applyPermission(parsedData);
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
  applyPermission(data);
}

renderSideBar();
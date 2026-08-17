const sidebarItems = [
  {
    name: "Home",
    icon: "fa-solid fa-house",
    href: "/admin/index.html",
  },
  {
    name:"Analytics",
    icon:"fa-solid fa-chart-pie",
    href: "/admin/analytics.html",
  },
  {
    name: "Products",
    icon: "fa-solid fa-boxes-stacked",
    href: "/admin/products.html",
  },
  {
    name: "Add Product",
    icon: "fa-solid fa-circle-plus",
    href: "/admin/add-product.html",
  },
  {
    name: "Excel Import",
    icon: "fa-solid fa-table",
    href: "/admin/excel-import.html",
  },
  {
    name: "Incompleted Products",
    icon: "fa-solid fa-circle-exclamation",
    href: "/admin/missing-infos.html",
  },
  {
    name: "Settings",
    icon: "fa-solid fa-gear",
    href: "/admin/settings.html",
  },
];

function renderSideBar(){
  const sidebar = document.getElementById("sidebar-links");

  if(!sidebar) return;

  const rawSegment = window.location.pathname.split("/").pop();
  // Homepage URLs (/admin or /admin/) have no filename segment at all,
  // or it's empty after a trailing slash - treat both as "index" so
  // they match the Home item's href (/admin/index.html).
  const currentPage = rawSegment === "" || rawSegment === "admin"
    ? "index"
    : rawSegment.replace(/\.html$/, "");

  sidebar.innerHTML = sidebarItems.map(
    (item) => {
      const itemPage = item.href.split("/").pop().replace(/\.html$/, "");
      return `
        <a href="${item.href}" 
           class="${currentPage === itemPage ? "active" : ""}">
          <i class="${item.icon}"></i>
          <span>${item.name}</span>
        </a>
      `;
    },
    )
    .join("");
  
}

renderSideBar();
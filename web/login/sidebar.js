const sidebarItems = [
  {
    name: "Home",
    icon: "fa-solid fa-house",
    href: "/login/index.html",
  },
  {
    name:"Analytics",
    icon:"fa-solid fa-chart-pie",
    href: "/login/analytics.html",
  },
  {
    name: "Products",
    icon: "fa-solid fa-boxes-stacked",
    href: "/login/products.html",
  },
  {
    name: "Add Product",
    icon: "fa-solid fa-circle-plus",
    href: "/login/add-product.html",
  },
  {
    name: "Excel Import",
    icon: "fa-solid fa-table",
    href: "/login/excel-import.html",
  },
  {
    name: "Incompleted Products",
    icon: "fa-solid fa-circle-exclamation",
    href: "/login/missing-infos.html",
  },
  {
    name: "Settings",
    icon: "fa-solid fa-gear",
    href: "/login/settings.html",
  },
];


function renderSideBar(){
  const sidebar = document.getElementById("sidebar-links");

  if(!sidebar) return;

  // Compare base filenames without extension, since cleanUrls strips
  // .html from the browsed URL and item.href now includes the /login/
  // prefix — a full-path or full-string match would never succeed.
  const currentPage = window.location.pathname.split("/").pop().replace(/\.html$/, "");

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
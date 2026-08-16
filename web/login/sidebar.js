const sidebarItems = [
  {
    name: "Home",
    icon: "fa-solid fa-house",
    href: "index.html",
  },
  {
    name:"Analytics",
    icon:"fa-solid fa-chart-pie",
    href:"analytics.html",
  },
  {
    name: "Products",
    icon: "fa-solid fa-boxes-stacked",
    href: "products.html",
  },
  {
    name: "Add Product",
    icon: "fa-solid fa-circle-plus",
    href: "add-product.html",
  },
  {
    name: "Excel Import",
    icon: "fa-solid fa-table",
    href: "excel-import.html",
  },
  {
    name: "Incompleted Products",
    icon: "fa-solid fa-circle-exclamation",
    href: "missing-infos.html",
  },
  {
    name: "Settings",
    icon: "fa-solid fa-gear",
    href: "settings.html",
  },
];


function renderSideBar(){
  const sidebar = document.getElementById("sidebar-links");

  if(!sidebar) return;

  const currentPage = window.location.pathname.split("/").pop();

  sidebar.innerHTML = sidebarItems.map(
    (item) => `
        <a href="${item.href}" 
           class="${currentPage === item.href ? "active" : ""}">
          <i class="${item.icon}"></i>
          <span>${item.name}</span>
        </a>
      `,
    )
    .join("");
  
}

renderSideBar();
/* =========================================================
   SITE CONFIG — single source of truth for API URLs.
   Include this file FIRST, before any other script, on every
   page (storefront pages like home/shop/search/product, AND
   admin pages like login/products/add-product/settings).

   <script src="config.js"></script>
   <script src="shared.js"></script>   (admin pages only)
   <script src="home.js"></script>     (or shop.js / search.js / etc.)
========================================================= */

// Root of the deployed API — change this one line when moving
// between environments (local/staging/production).
const API_ROOT = "https://stocklink-demo-production.up.railway.app";

// Products resource base. Product list/detail/create/update/delete
// and product-image upload all hang off this.
//   GET    API_BASE                -> list products
//   GET    API_BASE/:id             -> single product
//   POST   API_BASE                 -> create product
//   PUT    API_BASE/:id             -> update product
//   DELETE API_BASE/:id             -> delete product
//   POST   API_BASE/upload/product-images/:colorId
const API_BASE = `${API_ROOT}/products`;

const ANALYTICS_API = `${API_ROOT}/admin-analytics`;   


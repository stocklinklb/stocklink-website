// Shared behaviour included on every admin page before the page-specific
// script: mobile navigation (hamburger + off-canvas sidebar), the logout
// confirmation modal, and the login/profile check that gates access to
// every admin page.
//
// API_ROOT / API_BASE now come from config.js, which must be included
// on the page BEFORE this file:
//   <script src="config.js"></script>
//   <script src="shared.js"></script>

// ---------- Mobile sidebar ----------
const themeToggle = document.getElementById("themeToggle");
const markAllRead = document.getElementById("notif-mark-all-read");
const notificationsButton = document.getElementById("notif-bell-btn");
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}
// Get show toast error messages
async function getErrorMessage(response, fallback) {
  let message = fallback;
  try {
    const data = await response.json();
    if (data.message) message = data.message;
  } catch (err) {}

  return message;
}

function checkPermission(name, isOwner, permissions) {
  if (isOwner) {
    return true;
  }
  return permissions[name] === true;

}

const savedTheme = localStorage.getItem("theme");

applyTheme(savedTheme || "light");

themeToggle?.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || "light";

  const newTheme = currentTheme === "dark" ? "light" : "dark";

  applyTheme(newTheme);
});
(function () {
  const toggle = document.getElementById("menu-toggle");
  const sidebar = document.querySelector("aside");
  const overlay = document.getElementById("sidebar-overlay");

  if (!toggle || !sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("active");
    document.body.classList.add("no-scroll");
    toggle.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    if (sidebar.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay.addEventListener("click", closeSidebar);

  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
})();

// ----------- Notifications ------------------

async function loadNotifications() {
  let notifications = [];
  try {
    const response = await fetch(`${API_ROOT}/notifications`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch products");
    const result = await response.json();
    notifications = result.data;
    renderNotifications(notifications);
    //console.log(notifications);
  } catch (error) {
    console.error("Failed to load notifications", error);
  }
}

notificationsButton.addEventListener("click", () => {
  const notificationsDropDown = document.querySelector(".notif-dropdown");
  notificationsDropDown.classList.toggle("active");
});
const notificationsList = document.getElementById("notif-list");
const notificationsBadge = document.getElementById("notif-badge");
const notifEmpty = document.getElementById("notif-empty");

function renderNotifications(notifications) {
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  notificationsBadge.textContent = unreadCount;
  notificationsBadge.hidden = unreadCount === 0;

  if (notifications.length === 0) {
    notificationsList.innerHTML = "";
    notificationsList.hidden = true;
    notifEmpty.hidden = false;
    return;
  }

  notifEmpty.hidden = true;
  notificationsList.hidden = false;

  notificationsList.innerHTML = notifications
    .map((notification) => {
      return `
    <div class = "notif-item ${notification.isRead ? "" : "unread"}" data-id = ${notification.id}>
      <p class = "notif-item-title">${notification.title}: ${notification.content.productName} (${notification.content.stock} left)</p>
      <span class = "notif-item-time">${timeAgo(notification.createdAt)}</span>
    </div>
    `;
    })
    .join("");
}
function timeAgo(dateString) {
  const minsAgo = Math.max(
    1,
    Math.round((Date.now() - new Date(dateString)) / 60000),
  );

  if (minsAgo < 60) {
    return `${minsAgo} minute${minsAgo === 1 ? "" : "s"} ago`;
  }

  const hoursAgo = Math.round(minsAgo / 60);
  return `${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
}
notificationsList.addEventListener("click", async (e) => {
  const item = e.target.closest(".notif-item");
  if (!item) return;
  if (!item.classList.contains("unread")) return;
  const itemId = item.dataset.id;
  try {
    const response = await fetch(`${API_ROOT}/notifications/${itemId}/read`, {
      method: "PUT",
      credentials: "include",
    });
    if (!response.ok)
      throw new Error("Failed to mark the notification as read");
    loadNotifications();
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    showToast("Failed to mark notification as read:", "error");
  }
});
markAllRead.addEventListener("click", async () => {
  try {
    const response = await fetch(`${API_ROOT}/notifications/read-all`, {
      method: "PUT",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to mark all as read");
    showToast("All notifications marked as read", "success");
    loadNotifications();
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    showToast("Failed to mark all notifications as read:", "error");
  }
});
document.addEventListener("click", (e) => {
  const notificationsDropDown = document.querySelector(".notif-dropdown");

  const clickedInsideDropdown = notificationsDropDown.contains(e.target);
  const clickedBell = notificationsButton.contains(e.target);

  if (!clickedInsideDropdown && !clickedBell) {
    notificationsDropDown.classList.remove("active");
  }
});
// ---------- Logout ----------
async function logout() {
  try {
    const response = await fetch(`${API_ROOT}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      sessionStorage.removeItem("staffMe")
      window.location.replace("login.html");
      
    }
  } catch (error) {
    console.error("Logout error:", error);
  }
}

function setLogOutModal() {
  const logoutButton = document.querySelector(".logout-btn");
  const modal = document.getElementById("logoutModal");
  const cancelButton = document.querySelector(".cancel-logout");
  const confirmButton = document.querySelector(".confirm-logout");

  if (!logoutButton || !modal || !cancelButton || !confirmButton) {
    return;
  }

  logoutButton.addEventListener("click", () => {
    modal.classList.add("active");
  });

  cancelButton.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  confirmButton.addEventListener("click", () => {
    logout();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.classList.remove("active");
    }
  });
}

// ---------- Auth / profile ----------
// Moved here from admin.js: identical logic is needed on every admin page
// (products.html and add-product.html have the exact same sidebar/profile
// markup and logout button, but previously had no auth check at all).
function updateProfile(user) {
  const name = user.name || "User";
  const role = user.role || "Admin";

  const profileName = document.querySelector(".profile-info h4");
  const profileRole = document.querySelector(".profile-info span");
  const headerName = document.querySelector(".header-admin-name");
  const greetings = document.getElementById("greeting");

  if (profileName) {
    profileName.textContent = name;
  }

  if (profileRole) {
    profileRole.textContent = role;
  }

  if (headerName) {
    headerName.textContent = name;
  }

  if (greetings) {
    greetings.textContent = `Hello, ${name}`;
  }
}

// Same idea as the store logo below: paint instantly from the
// last-known name/role cached in localStorage so the sidebar doesn't
// blank out and refill on every page navigation while /auth/me is in
// flight, then re-cache whatever the real check returns.
function paintCachedProfile() {
  try {
    const cached = JSON.parse(localStorage.getItem("adminProfile"));
    if (cached) updateProfile(cached);
  } catch (error) {
    // Corrupt/old cache value - ignore, real fetch will fix it.
  }
}

function cacheProfile(user) {
  try {
    localStorage.setItem(
      "adminProfile",
      JSON.stringify({ name: user.name, role: user.role }),
    );
  } catch (error) {
    // Storage unavailable (private browsing, quota, etc.) - not fatal,
    // just means no instant-paint next time.
  }
}

paintCachedProfile();

async function ensureAdminAccess(retries = 2) {
  const authUrl = `${API_ROOT}/auth/me`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(authUrl, {
        credentials: "include",
      });

      if (response.ok) {
        const user = await response.json();
        updateProfile(user);
        cacheProfile(user);
        return true;
      }

      const errorText = await response.text();
      console.warn("Admin auth check failed:", response.status, errorText);
    } catch (error) {
      console.warn("Admin auth check error:", error.message);
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (window.location.pathname.endsWith("login.html")) {
    return false;
  }

  window.location.replace("login.html");
  return false;
}

// ---------- Store logo ----------
// The sidebar profile-box avatar (".sidebar-profile img") is present on
// every admin page, but only settings.html has a form to change it. To
// keep it in sync everywhere:
//   1. Paint instantly from the last-known logo cached in localStorage,
//      so other pages don't flash the hardcoded placeholder while the
//      network request below is in flight.
//   2. Fetch the current value from the settings API in the background
//      and re-apply/re-cache it, so it's still correct on a fresh
//      browser (empty cache) or after the logo changed in another tab.
function resolveLogoUrl(logo) {
  return logo.startsWith("http") ? logo : API_ROOT + logo;
}

// Exposed on window so settings.js can call this directly after a
// successful upload, instead of duplicating the "write it everywhere"
// logic.
function applyStoreLogo(logo) {
  const resolvedUrl = resolveLogoUrl(logo);

  document.querySelectorAll(".sidebar-profile img").forEach((img) => {
    img.src = resolvedUrl;
  });

  const preview = document.querySelector("#logo-preview-image");
  if (preview) preview.src = resolvedUrl;

  localStorage.setItem("storeLogo", resolvedUrl);
}
window.applyStoreLogo = applyStoreLogo;

async function loadStoreLogo() {
  const cached = localStorage.getItem("storeLogo");
  if (cached) {
    document.querySelectorAll(".sidebar-profile img").forEach((img) => {
      img.src = cached;
    });
    const preview = document.querySelector("#logo-preview-image");
    if (preview) preview.src = cached;
  }

  try {
    const response = await fetch(`${API_ROOT}/settings`, {
      credentials: "include",
    });

    if (!response.ok) return;

    const store = await response.json();
    if (store.logo) {
      applyStoreLogo(store.logo);
    }
  } catch (error) {
    console.warn("Could not load store logo:", error.message);
  }
}

// Toast
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let toastTimeout;

function showToast(message, type) {
  const container = document.getElementById("toast-container");

  // Remove existing toast
  const existingToast = container.querySelector(".toast");

  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");

  toast.classList.add("toast", type);

  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.add("hide");

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
// ---------- Shared init ----------
// Wires the logout modal immediately and kicks off the auth check right
// away, so it runs concurrently with whatever the page-specific script
// (admin.js / products.js / add-products.js) is doing rather than after it.
// Page scripts that need to gate their own data loading on the result
// (e.g. don't fetch products before we know the user is authenticated)
// can `await window.adminAccessCheck` - it resolves to the same boolean
// ensureAdminAccess() always returned.
document.addEventListener("DOMContentLoaded", () => {
  setLogOutModal();
});
window.adminAccessCheck = ensureAdminAccess();
loadStoreLogo();
loadNotifications();

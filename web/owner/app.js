const BACKEND_ORIGIN =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:4000"
    : "https://stocklink-demo-production.up.railway.app"; // your existing Railway backend URL

const API_BASE = `${BACKEND_ORIGIN}/accounts`;
const LOGIN_ENDPOINT = `${BACKEND_ORIGIN}/auth/login`;
const state = {
  accounts: [],
  currentAccount: null,
  sortKey: "name",
  sortDirection: "asc",
  filters: {
    search: "",
    tier: "",
    status: "",
  },
};

const els = {
  loginView: document.querySelector("#loginView"),
  mainView: document.querySelector("#mainView"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  loginButton: document.querySelector("#loginButton"),
  refreshButton: document.querySelector("#refreshButton"),
  accountCount: document.querySelector("#accountCount"),
  globalMessage: document.querySelector("#globalMessage"),
  searchInput: document.querySelector("#searchInput"),
  tierFilter: document.querySelector("#tierFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  accountsBody: document.querySelector("#accountsBody"),
  emptyState: document.querySelector("#emptyState"),
  detailView: document.querySelector("#detailView"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSubtitle: document.querySelector("#detailSubtitle"),
  detailMessage: document.querySelector("#detailMessage"),
  detailLoading: document.querySelector("#detailLoading"),
  detailContent: document.querySelector("#detailContent"),
  statsGrid: document.querySelector("#statsGrid"),
  accountForm: document.querySelector("#accountForm"),
  saveButton: document.querySelector("#saveButton"),
  metadataList: document.querySelector("#metadataList"),
  openDeleteButton: document.querySelector("#openDeleteButton"),
  deleteModal: document.querySelector("#deleteModal"),
  deleteStoreName: document.querySelector("#deleteStoreName"),
  deleteConfirmationInput: document.querySelector("#deleteConfirmationInput"),
  confirmDeleteButton: document.querySelector("#confirmDeleteButton"),
  deleteMessage: document.querySelector("#deleteMessage"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  await loadAccounts({ initial: true });
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.refreshButton.addEventListener("click", () => loadAccounts());

  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderAccounts();
  });

  els.tierFilter.addEventListener("change", (event) => {
    state.filters.tier = event.target.value;
    renderAccounts();
  });

  els.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    renderAccounts();
  });

  document.querySelectorAll(".sort-button").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDirection = "asc";
      }
      renderAccounts();
    });
  });

  els.accountsBody.addEventListener("click", handleTableClick);
  els.accountsBody.addEventListener("change", handleTableChange);

  document.querySelectorAll("[data-close-detail]").forEach((node) => {
    node.addEventListener("click", closeDetail);
  });

  els.accountForm.addEventListener("submit", handleSaveAccount);
  els.openDeleteButton.addEventListener("click", openDeleteModal);

  document.querySelectorAll("[data-close-delete]").forEach((node) => {
    node.addEventListener("click", closeDeleteModal);
  });

  els.deleteConfirmationInput.addEventListener(
    "input",
    updateDeleteButtonState,
  );
  els.confirmDeleteButton.addEventListener("click", handleDeleteAccount);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!els.deleteModal.classList.contains("hidden")) {
      closeDeleteModal();
    } else if (!els.detailView.classList.contains("hidden")) {
      closeDetail();
    }
  });
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (networkError) {
    throw new Error(
      "Could not reach the server. Check that the admin backend is running.",
    );
  }

  let data = null;
  const contentType = response.headers.get("content-type") || "";

  try {
    data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && data.message
        ? data.message
        : typeof data === "string" && data.trim()
          ? data
          : `Request failed with status ${response.status}.`;

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function loadAccounts({ initial = false } = {}) {
  clearMessage(els.globalMessage);
  els.refreshButton.disabled = true;

  try {
    const accounts = await apiFetch(API_BASE);
    state.accounts = Array.isArray(accounts) ? accounts : [];
    showMainView();
    renderAccounts();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      showLoginView();
      if (!initial) showMessage(els.globalMessage, error.message);
    } else {
      showMainView();
      showMessage(els.globalMessage, error.message);
    }
  } finally {
    els.refreshButton.disabled = false;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearMessage(els.globalMessage);

  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  els.loginButton.disabled = true;
  els.loginButton.textContent = "Signing in…";

  try {
    await apiFetch(LOGIN_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    els.loginPassword.value = "";
    await loadAccounts();
  } catch (error) {
    showMessageInlineLogin(error.message);
  } finally {
    els.loginButton.disabled = false;
    els.loginButton.textContent = "Sign in";
  }
}

function showMessageInlineLogin(message) {
  let loginMessage = document.querySelector("#loginMessage");
  if (!loginMessage) {
    loginMessage = document.createElement("div");
    loginMessage.id = "loginMessage";
    loginMessage.className = "message";
    els.loginForm.insertAdjacentElement("beforebegin", loginMessage);
  }
  loginMessage.textContent = message;
  loginMessage.classList.remove("hidden");
}

function showLoginView() {
  els.loginView.classList.remove("hidden");
  els.mainView.classList.add("hidden");
}

function showMainView() {
  els.loginView.classList.add("hidden");
  els.mainView.classList.remove("hidden");

  const loginMessage = document.querySelector("#loginMessage");
  if (loginMessage) loginMessage.classList.add("hidden");
}

function getVisibleAccounts() {
  const filtered = state.accounts.filter((account) => {
    const matchesSearch =
      !state.filters.search ||
      (account.name || "").toLowerCase().includes(state.filters.search);

    const matchesTier =
      !state.filters.tier || account.subscriptionTier === state.filters.tier;

    const matchesStatus =
      !state.filters.status ||
      account.subscriptionStatus === state.filters.status;

    return matchesSearch && matchesTier && matchesStatus;
  });

  return filtered.sort((a, b) => {
    const direction = state.sortDirection === "asc" ? 1 : -1;
    const aValue = normalizeSortValue(a[state.sortKey], state.sortKey);
    const bValue = normalizeSortValue(b[state.sortKey], state.sortKey);

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });
}

function normalizeSortValue(value, key) {
  if (key === "subscriptionEnd") {
    if (!value) return Number.POSITIVE_INFINITY;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
  }

  return String(value ?? "").toLowerCase();
}

function renderAccounts() {
  const accounts = getVisibleAccounts();

  els.accountCount.textContent = `${accounts.length} of ${state.accounts.length} accounts`;
  els.emptyState.classList.toggle("hidden", accounts.length > 0);

  els.accountsBody.innerHTML = accounts
    .map((account) => {
      const expiring = isExpiringSoon(account.subscriptionEnd);

      return `
        <tr data-account-id="${escapeHtml(String(account.id))}">
          <td>
            <div class="account-cell">
              <span class="account-name">${escapeHtml(account.name || "Unnamed account")}</span>
              ${expiring ? '<span class="expiring-flag">Expiring soon</span>' : ""}
            </div>
          </td>
          <td><span class="badge tier">${escapeHtml(account.subscriptionTier || "—")}</span></td>
          <td>
            <span class="badge ${statusClass(account.subscriptionStatus)}">
              ${escapeHtml(account.subscriptionStatus || "—")}
            </span>
          </td>
          <td>
            <label class="toggle" title="${account.isActive ? "Deactivate account" : "Activate account"}">
              <input
                class="active-toggle"
                type="checkbox"
                ${account.isActive ? "checked" : ""}
                aria-label="Toggle active state for ${escapeHtml(account.name || "account")}"
              />
              <span class="toggle-track"></span>
            </label>
          </td>
          <td>${formatDate(account.subscriptionEnd)}</td>
          <td>
            <button type="button" class="button secondary view-account">View</button>
          </td>
        </tr>
      `;
    })
    .join("");

  renderSortIndicators();
}

function renderSortIndicators() {
  document.querySelectorAll("[data-sort-icon]").forEach((span) => {
    const key = span.dataset.sortIcon;
    span.textContent =
      key === state.sortKey ? (state.sortDirection === "asc" ? "↑" : "↓") : "";
  });
}

function handleTableClick(event) {
  const button = event.target.closest(".view-account");
  if (!button) return;

  const row = button.closest("tr");
  if (!row) return;

  openDetail(row.dataset.accountId);
}

async function handleTableChange(event) {
  const toggle = event.target.closest(".active-toggle");
  if (!toggle) return;

  const row = toggle.closest("tr");
  const accountId = row?.dataset.accountId;
  if (!accountId) return;

  const account = state.accounts.find(
    (item) => String(item.id) === String(accountId),
  );
  if (!account) return;

  const previousValue = account.isActive;
  const nextValue = toggle.checked;
  toggle.disabled = true;

  try {
    const updated = await apiFetch(
      `${API_BASE}/${encodeURIComponent(accountId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextValue }),
      },
    );

    updateAccountInList(updated);
    showMessage(
      els.globalMessage,
      `${updated.name || "Account"} updated.`,
      "success",
    );
  } catch (error) {
    account.isActive = previousValue;
    toggle.checked = previousValue;
    showMessage(els.globalMessage, error.message);
  } finally {
    toggle.disabled = false;
    renderAccounts();
  }
}

async function openDetail(accountId) {
  state.currentAccount = null;
  clearMessage(els.detailMessage);

  els.detailView.classList.remove("hidden");
  els.detailView.setAttribute("aria-hidden", "false");
  els.detailLoading.classList.remove("hidden");
  els.detailContent.classList.add("hidden");
  els.detailTitle.textContent = "Loading…";
  els.detailSubtitle.textContent = "";

  try {
    const account = await apiFetch(
      `${API_BASE}/${encodeURIComponent(accountId)}`,
    );
    state.currentAccount = account;
    populateDetail(account);
    els.detailLoading.classList.add("hidden");
    els.detailContent.classList.remove("hidden");
  } catch (error) {
    els.detailLoading.classList.add("hidden");
    showMessage(els.detailMessage, error.message);
  }
}

function closeDetail() {
  els.detailView.classList.add("hidden");
  els.detailView.setAttribute("aria-hidden", "true");
  state.currentAccount = null;
  closeDeleteModal();
}

function populateDetail(account) {
  els.detailTitle.textContent = account.name || "Unnamed account";
  els.detailSubtitle.textContent = [
    account.publicId ? `Public ID: ${account.publicId}` : null,
    account.email || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const counts = account._count || {};
  const stats = [
    ["Products", counts.products],
    ["Orders", counts.orders],
    ["Staff accounts", counts.staffAccounts],
    ["Product views", counts.productViews],
    ["Search events", counts.searchEvents],
    ["Visitor sessions", counts.visitorSessions],
  ];

  els.statsGrid.innerHTML = stats
    .map(
      ([label, value]) => `
    <div class="stat-card">
      <span class="stat-value">${formatNumber(value)}</span>
      <span class="stat-label">${escapeHtml(label)}</span>
    </div>
  `,
    )
    .join("");

  setFormValue("publicId", account.publicId);
  setFormValue("name", account.name);
  setFormValue("email", account.email);
  setFormValue("ownerName", account.ownerName);
  setFormValue("ownerPhone", account.ownerPhone);
  setFormValue("subscriptionTier", account.subscriptionTier || "FLOW");
  setFormValue("subscriptionStatus", account.subscriptionStatus || "ACTIVE");
  setFormValue(
    "subscriptionStart",
    toDateInputValue(account.subscriptionStart),
  );
  setFormValue("subscriptionEnd", toDateInputValue(account.subscriptionEnd));

  els.accountForm.elements.isActive.checked = Boolean(account.isActive);

  const metadata = [
    ["ID", account.id],
    ["Role", account.role],
    ["Phone", account.phone],
    ["WhatsApp", account.whatsapp],
    ["Address", account.address],
    ["Logo", account.logo],
    ["Social links", stringifyValue(account.socialLinks)],
    [
      "Auto renew",
      account.autoRenew == null ? "—" : account.autoRenew ? "Yes" : "No",
    ],
    ["Created", formatDateTime(account.createdAt)],
    ["Updated", formatDateTime(account.updatedAt)],
  ];

  els.metadataList.innerHTML = metadata
    .map(
      ([term, value]) => `
    <dt>${escapeHtml(term)}</dt>
    <dd>${escapeHtml(value == null || value === "" ? "—" : String(value))}</dd>
  `,
    )
    .join("");
}

async function handleSaveAccount(event) {
  event.preventDefault();
  if (!state.currentAccount) return;

  clearMessage(els.detailMessage);

  const payload = {
    publicId: readText("publicId"),
    name: readText("name"),
    email: readText("email"),
    ownerName: readText("ownerName"),
    ownerPhone: readText("ownerPhone"),
    subscriptionTier: els.accountForm.elements.subscriptionTier.value,
    subscriptionStart: nullableDate("subscriptionStart"),
    subscriptionEnd: nullableDate("subscriptionEnd"),
    isActive: els.accountForm.elements.isActive.checked,
    subscriptionStatus: els.accountForm.elements.subscriptionStatus.value,
  };

  els.saveButton.disabled = true;
  els.saveButton.textContent = "Saving…";

  try {
    const updated = await apiFetch(
      `${API_BASE}/${encodeURIComponent(state.currentAccount.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    state.currentAccount = { ...state.currentAccount, ...updated };
    updateAccountInList(updated);
    populateDetail(state.currentAccount);
    renderAccounts();
    showMessage(els.detailMessage, "Changes saved.", "success");
  } catch (error) {
    showMessage(els.detailMessage, error.message);
  } finally {
    els.saveButton.disabled = false;
    els.saveButton.textContent = "Save changes";
  }
}

function openDeleteModal() {
  if (!state.currentAccount) return;

  clearMessage(els.deleteMessage);
  els.deleteStoreName.textContent = state.currentAccount.name || "";
  els.deleteConfirmationInput.value = "";
  els.confirmDeleteButton.disabled = true;
  els.deleteModal.classList.remove("hidden");
  els.deleteModal.setAttribute("aria-hidden", "false");
  els.deleteConfirmationInput.focus();
}

function closeDeleteModal() {
  els.deleteModal.classList.add("hidden");
  els.deleteModal.setAttribute("aria-hidden", "true");
  els.deleteConfirmationInput.value = "";
  els.confirmDeleteButton.disabled = true;
  clearMessage(els.deleteMessage);
}

function updateDeleteButtonState() {
  const expected = state.currentAccount?.name || "";
  els.confirmDeleteButton.disabled =
    !expected || els.deleteConfirmationInput.value !== expected;
}

async function handleDeleteAccount() {
  if (!state.currentAccount) return;

  const expected = state.currentAccount.name || "";
  if (!expected || els.deleteConfirmationInput.value !== expected) {
    showMessage(
      els.deleteMessage,
      "Type the account name exactly before deleting.",
    );
    return;
  }

  els.confirmDeleteButton.disabled = true;
  els.confirmDeleteButton.textContent = "Deleting…";
  clearMessage(els.deleteMessage);

  try {
    const deletedId = state.currentAccount.id;
    const result = await apiFetch(
      `${API_BASE}/${encodeURIComponent(deletedId)}`,
      {
        method: "DELETE",
      },
    );

    state.accounts = state.accounts.filter(
      (account) => String(account.id) !== String(deletedId),
    );

    closeDeleteModal();
    closeDetail();
    renderAccounts();

    showMessage(
      els.globalMessage,
      result?.message || `${expected} was permanently deleted.`,
      "success",
    );
  } catch (error) {
    showMessage(els.deleteMessage, error.message);
  } finally {
    els.confirmDeleteButton.textContent = "Delete permanently";
    updateDeleteButtonState();
  }
}

function updateAccountInList(updated) {
  const index = state.accounts.findIndex(
    (account) => String(account.id) === String(updated.id),
  );

  if (index >= 0) {
    state.accounts[index] = { ...state.accounts[index], ...updated };
  }
}

function setFormValue(name, value) {
  const input = els.accountForm.elements[name];
  if (!input) return;
  input.value = value ?? "";
}

function readText(name) {
  const value = els.accountForm.elements[name].value.trim();
  return value === "" ? null : value;
}

function nullableDate(name) {
  const value = els.accountForm.elements[name].value;
  return value ? value : null;
}

function isExpiringSoon(dateValue) {
  if (!dateValue) return false;

  const end = new Date(dateValue);
  if (Number.isNaN(end.getTime())) return false;

  const now = new Date();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  const sevenDaysFromToday = new Date(endOfToday);
  sevenDaysFromToday.setDate(sevenDaysFromToday.getDate() + 7);

  return end > now && end <= sevenDaysFromToday;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function stringifyValue(value) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function statusClass(status) {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "EXPIRED":
      return "expired";
    case "SUSPENDED":
      return "suspended";
    case "CANCELLED":
      return "cancelled";
    default:
      return "";
  }
}

function showMessage(element, message, type = "error") {
  element.textContent = message;
  element.classList.remove("hidden", "success");
  if (type === "success") element.classList.add("success");
}

function clearMessage(element) {
  element.textContent = "";
  element.classList.add("hidden");
  element.classList.remove("success");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

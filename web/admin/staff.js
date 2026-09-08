// Elements
const createStaffCancel = document.getElementById("create-staff-cancel");
const createStaffBtn = document.querySelector(".create-staff-btn");
const createStaffForm = document.getElementById("create-staff-form");
const createStaffClose = document.getElementById("create-staff-close");
const createStaffButton = document.getElementById("create-staff-submit");
const editStaffForm = document.getElementById("edit-staff-form");
const usernameInput = document.getElementById("create-staff-username");
const passwordInput = document.getElementById("create-staff-password");
const editStaffClose = document.getElementById("edit-staff-close");
const editStafffCancel = document.getElementById("edit-staff-cancel");
const editUsernameInput = document.getElementById("edit-staff-username");
const editPasswordInput = document.getElementById("edit-staff-password");
const editStaffSubmit = document.getElementById("edit-staff-submit");
const editPermissionsCheckboxes = document.querySelectorAll(
  ".edit-staff-permission input[type = 'checkbox']",
);
const staffList = document.querySelector(".staff-list");
const permissionCheckboxes = document.querySelectorAll(
  ".create-staff-permission input[type='checkbox']",
);
const deleteStaffName = document.getElementById("delete-staff-name");
const createModalOverlay = document.querySelector(
  ".create-staff-modal-overlay",
);

const deleteModalOverlay = document.getElementById("delete-modal");
const cancelDeleteModal = document.getElementById("cancel-delete-btn");
const editModalOverlay = document.querySelector(".edit-staff-modal-overlay");
const editStaffInput = document.getElementById("edit-staff-id");
const comfirmDeleteModal = document.getElementById("confirm-delete-btn");

cancelDeleteModal.addEventListener("click", deleteModalToggle);

// Accounts that are going to get stored
let staffAccountInformation = {};
let staffAccounts = [];
let editId = null;
let pendingDeleteId = null;
// Eye toggle for the password input
const passwordToggle = document.getElementById("password-toggle");
const editPasswordToggle = document.getElementById("edit-password-toggle");
passwordInput.addEventListener("input", () => {
  passwordInput.value = passwordInput.value.replace(/\s/g, "");
});
passwordToggle.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";

  passwordInput.type = isPassword ? "text" : "password";

  passwordToggle.innerHTML = isPassword
    ? '<i class="fa-solid fa-eye-slash"></i>'
    : '<i class="fa-solid fa-eye"></i>';

  passwordToggle.setAttribute(
    "aria-label",
    isPassword ? "Hide password" : "Show password",
  );
});
editPasswordToggle.addEventListener("click", () => {
  const isPassword = editPasswordInput.type === "password";
  editPasswordInput.type = isPassword ? "text" : "password";

  editPasswordToggle.innerHTML = isPassword
    ? '<i class="fa-solid fa-eye-slash"></i>'
    : '<i class="fa-solid fa-eye"></i>';
  editPasswordToggle.setAttribute(
    "aria-label",
    isPassword ? "Hide password" : "Show password",
  );
});
// Event listeners for menu toggling
createStaffBtn.addEventListener("click", menuToggle);
createStaffCancel.addEventListener("click", menuToggle);
createStaffClose.addEventListener("click", menuToggle);
// Edit menu event listeners for menu toggling
editStaffClose.addEventListener("click", editMenuToggle);
editStafffCancel.addEventListener("click", editMenuToggle);
// Toggle menu function
function menuToggle() {
  createModalOverlay.classList.toggle("is-open");
  usernameInput.value = "";
  passwordInput.value = "";
  permissionCheckboxes.forEach((checkbox) => {
    checkbox.checked = checkbox.defaultChecked;
  });
}
// Edit staff menu toggle
function editMenuToggle() {
  editModalOverlay.classList.toggle("is-open");
}
function deleteModalToggle() {
  deleteModalOverlay.classList.toggle("active");
}
// Fetch staffs accounts

// Shown immediately (before the fetch even starts) so the page never shows
// a blank .staff-list between page-load and the request resolving.
function renderStaffListSkeleton(rows = 3) {
  const skeletonRow = () => `
    <div class="staff-list-row staff-list-row-skeleton" aria-hidden="true">
      <div class="staff-identity">
        <div class="staff-avatar skeleton-block"></div>
        <div class="staff-identity-info">
          <div class="skeleton-line skeleton-line-name"></div>
        </div>
      </div>
      <div class="staff-status">
        <div class="skeleton-line skeleton-line-status"></div>
      </div>
      <div class="staff-permissions">
        <div class="skeleton-line skeleton-line-perms"></div>
      </div>
      <div class="staff-actions">
        <div class="skeleton-block skeleton-btn"></div>
      </div>
    </div>
  `;

  staffList.innerHTML = `
    <div class="staff-list-header">
      <p>Your current staff</p>
      <span>Loading…</span>
    </div>
    ${Array.from({ length: rows }, skeletonRow).join("")}
  `;
}

function renderStaffListError() {
  staffList.innerHTML = `
    <div class="staff-error-state">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>Couldn't load staff accounts. Check your connection and try again.</p>
      <button type="button" class="staff-error-retry-btn" id="staff-retry-btn">
        Retry
      </button>
    </div>
  `;

  document
    .getElementById("staff-retry-btn")
    ?.addEventListener("click", fetchStaffAcounts);
}

async function fetchStaffAcounts() {
  renderStaffListSkeleton();

  let response;
  try {
    response = await fetch(`${API_ROOT}/staff`, {
      credentials: "include",
    });
  } catch (error) {
    showToast("Could Not Load Staff Account", "error");
    renderStaffListError();
    return;
  }

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Could Not Load Staff Account",
    );
    showToast(message, "error");
    renderStaffListError();
    return;
  }
  const data = await response.json();

  staffAccounts = data.data;
  renderStaffList();
}

// Gather selected informations when clicking create account
async function gatherStaffAccountInforamtions(event) {
  event.preventDefault();
  // using reduce to return objects like this {canEdit : true , canBulkEdit: false}

  const permissions = [...permissionCheckboxes].reduce(
    (accumulator, currentItem) => {
      accumulator[currentItem.name] = currentItem.checked;
      return accumulator;
    },
    {},
  );

  staffAccountInformation = {
    username: usernameInput.value,
    password: passwordInput.value,
    permissions: permissions,
  };
  console.log(staffAccountInformation);
  // close the menu when the submit have gone through
  const response = await fetch(`${API_ROOT}/staff/`, {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(staffAccountInformation),
  });

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to Create Staff Account",
    );
    showToast(message, "error");
    return;
  }

  menuToggle();
  fetchStaffAcounts();
}

async function gatherEditStaffAccountInformations(event) {
  event.preventDefault();

  const permissions = [...editPermissionsCheckboxes].reduce(
    (accumulator, currentItem) => {
      accumulator[currentItem.name] = currentItem.checked;
      return accumulator;
    },
    {},
  );

  staffAccountInformation = {
    username: editUsernameInput.value,
    password: editPasswordInput.value,
    permissions: permissions,
  };

  const response = await fetch(`${API_ROOT}/staff/${editId}`, {
    credentials: "include",
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(staffAccountInformation),
  });

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to Update Staff Account",
    );
    showToast(message, "error");
    return;
  }

  editMenuToggle();
  fetchStaffAcounts();
}
// Deactivate account butotn

async function setAccountActive(id, isActive) {
  const updateData = {
    isActive,
  };

  const response = await fetch(`${API_ROOT}/staff/${id}`, {
    credentials: "include",
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to Change Staff Account Status",
    );
    showToast(message, "error");
    return;
  }

  fetchStaffAcounts();
  console.log(id);
}
async function deleteAccount(id) {
  const response = await fetch(`${API_ROOT}/staff/${id}`, {
    credentials: "include",
    method: "DELETE",
  });
  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to Update Staff Account",
    );
    showToast(message, "error");
    return;
  }
  fetchStaffAcounts();
  console.log(id);
}
// rendering the staff's list from the staffAccountInformation
staffList.addEventListener("click", (event) => {
  const editButton = event.target.closest(".staff-edit-btn");
  const moreButton = event.target.closest(".staff-more-btn");
  const moreOption = event.target.closest(".staff-more-option");
  const creaetFirstButton = event.target.closest(".staff-empty-btn");
  if (moreOption) {
    const action = moreOption.dataset.action;
    const id = Number(moreOption.dataset.id);
    const staffAccount = staffAccounts.find((account) => account.id === id);
    if (action === "deactivate") {
      setAccountActive(staffAccount.id, !staffAccount.isActive);
    }
    if (action === "delete") {
      deleteStaffName.innerText = staffAccount.username;
      pendingDeleteId = id;
      deleteModalToggle();
    }
    return;
  }
  if (creaetFirstButton) {
    menuToggle();
  }
  if (moreButton) {
    const wrapper = moreButton.closest(".staff-more-wrapper");

    document
      .querySelectorAll(".staff-more-wrapper.is-open")
      .forEach((openWrapper) => {
        if (openWrapper !== wrapper) {
          openWrapper.classList.remove("is-open");
        }
      });

    wrapper.classList.toggle("is-open");
    return;
  }
  if (editButton) {
    editMenuToggle();
    editId = editButton.dataset.id;

    const staffAccount = staffAccounts.find(
      (account) => account.id === Number(editId),
    );
    const staffPermissions = staffAccount.permissions;
    editStaffInput.value = staffAccount.id;
    editPermissionsCheckboxes.forEach((checbox) => {
      checbox.checked = staffPermissions[checbox.name] === true;
    });
    console.log(staffPermissions);
    editUsernameInput.value = staffAccount.username;
  }
});
document.addEventListener("click", (event) => {
  const openMenu = document.querySelector(".staff-more-wrapper.is-open");

  if (!openMenu) return;

  if (!openMenu.contains(event.target)) {
    openMenu.classList.remove("is-open");
  }
});
function renderStaffList() {
  if (staffAccounts.length === 0) {
    staffList.innerHTML = `
      

      <div class="staff-empty-state">
        <div class="staff-empty-icon">
          <i class="fa-solid fa-users"></i>
        </div>

        <h2>No staff accounts yet</h2>

        <p>
          Add staff members to help manage your store while keeping
          control over what they can access.
        </p>

        <button class="staff-empty-btn" type="button">
          <i class="fa-solid fa-plus"></i>
          Add your first staff member
        </button>
      </div>
    `;

    return;
  }

  const rowsHtml = staffAccounts
    .map((staffAccount) => {
      return `
        <div class="staff-list-row">
          <div class="staff-identity">
            <div class="staff-avatar">
              ${staffAccount.username.slice(0, 2).toUpperCase()}
            </div>

            <div class="staff-identity-info">
              <h2>${staffAccount.username}</h2>
            </div>
          </div>

          <div class="staff-status ${staffAccount.isActive ? "" : "is-inactive"}">
            <span class="status-dot"></span>
            <span>
              ${staffAccount.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div class="staff-permissions">
            <strong>
              ${
                Object.values(staffAccount.permissions).filter(
                  (value) => value === true,
                ).length
              }
            </strong>
            <span>permissions</span>
          </div>

          <div class="staff-actions">
            <button
              class="staff-edit-btn"
              data-id="${staffAccount.id}"
            >
              Edit
            </button>

            <div class="staff-more-wrapper">
              <button
                class="staff-more-btn"
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded="false"
                data-id="${staffAccount.id}"
              >
                <i class="fa-solid fa-ellipsis"></i>
              </button>

              <div class="staff-more-menu" role="menu">
                <button
                  class="staff-more-option"
                  role="menuitem"
                  data-action="deactivate"
                  data-id="${staffAccount.id}"
                >
                  ${staffAccount.isActive ? "Deactivate" : "Activate"}
                </button>

                <button
                  class="staff-more-option is-danger"
                  role="menuitem"
                  data-action="delete"
                  data-id="${staffAccount.id}"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  staffList.innerHTML = `
    <div class="staff-list-header">
      <p>Your current staff</p>
      <span>${staffAccounts.length} accounts</span>
    </div>

    ${rowsHtml}
  `;
}
comfirmDeleteModal.addEventListener("click", () => {
  if (pendingDeleteId === null) return;
  deleteAccount(pendingDeleteId);
  deleteModalToggle();
  pendingDeleteId = null;
});
// create account event listener
createStaffForm.addEventListener("submit", gatherStaffAccountInforamtions);
editStaffForm.addEventListener("submit", gatherEditStaffAccountInformations);

fetchStaffAcounts();

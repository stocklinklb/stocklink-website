// API_ROOT comes from config.js — make sure it is included on
// login.html BEFORE this script:
//   <script src="config.js"></script>
//   <script src="login.js"></script>

// =========================================================
// ELEMENTS
// =========================================================
const tabList = document.querySelector(".login-tabs");
const tabOwner = document.getElementById("tab-owner");
const tabStaff = document.getElementById("tab-staff");

const ownerForm = document.getElementById("owner-login-form");
const staffForm = document.getElementById("staff-login-form");

const ownerErrorMessage = document.getElementById("owner-error");
const staffErrorMessage = document.getElementById("staff-error");

const ownerEmailInput = document.getElementById("owner-email");
const ownerPasswordInput = document.getElementById("owner-password");

const staffUsernameInput = document.getElementById("staff-username");
const staffPasswordInput = document.getElementById("staff-password");

// =========================================================
// TAB SWITCHING (sliding line indicator + form swap)
// =========================================================
function switchTab(targetFormId) {
  const isOwner = targetFormId === "owner-login-form";

  tabOwner.setAttribute("aria-selected", String(isOwner));
  tabStaff.setAttribute("aria-selected", String(!isOwner));

  tabList.dataset.active = isOwner ? "owner" : "staff";

  ownerForm.classList.toggle("is-hidden", !isOwner);
  staffForm.classList.toggle("is-hidden", isOwner);

  clearErrors();
}

tabOwner.addEventListener("click", () => switchTab("owner-login-form"));
tabStaff.addEventListener("click", () => switchTab("staff-login-form"));

// =========================================================
// SHOW/HIDE PASSWORD
// (one handler for both forms — matched by data-target-input)
// =========================================================
document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.targetInput);
    const isVisible = input.type === "text";

    input.type = isVisible ? "password" : "text";

    button.setAttribute("aria-pressed", String(!isVisible));
    button.setAttribute(
      "aria-label",
      isVisible ? "Show password" : "Hide password",
    );
  });
});

// =========================================================
// ERROR STATE HELPERS
// =========================================================
function clearErrors() {
  ownerErrorMessage.textContent = "";
  staffErrorMessage.textContent = "";
  document
    .querySelectorAll(".input-error")
    .forEach((el) => el.classList.remove("input-error"));
}

function showError(targetErrorEl, message, fieldsToFlag = []) {
  targetErrorEl.textContent = message;
  fieldsToFlag.forEach((el) => el && el.classList.add("input-error"));
}

// =========================================================
// SUBMIT HANDLING (shared logic, per-form config)
// =========================================================
async function handleLogin({ form, endpoint, payload, fieldsToFlag, errorEl }) {
  const submitButton = form.querySelector('button[type="submit"]');

  clearErrors();
  submitButton.classList.add("is-loading");
  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_ROOT}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Login successful", data);
      window.location.href = "index.html";
      return;
    }

    showError(errorEl, data.message || "Invalid credentials", fieldsToFlag);
  } catch (error) {
    console.error(error);
    showError(errorEl, "Server connection failed");
  } finally {
    submitButton.classList.remove("is-loading");
    submitButton.disabled = false;
  }
}

ownerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  handleLogin({
    form: ownerForm,
    endpoint: "/auth/login",
    payload: {
      email: ownerEmailInput.value,
      password: ownerPasswordInput.value,
    },
    fieldsToFlag: [
      ownerEmailInput,
      ownerPasswordInput.closest(".password-field"),
    ],
    errorEl: ownerErrorMessage,
  });
});

staffForm.addEventListener("submit", (event) => {
  event.preventDefault();

  handleLogin({
    form: staffForm,
    // Adjust this endpoint to whatever the API actually exposes for
    // staff auth — placeholder path, mirrors /auth/login.
    endpoint: "/staff/login",
    payload: {
      username: staffUsernameInput.value,
      password: staffPasswordInput.value,
    },
    fieldsToFlag: [
      staffUsernameInput,
      staffPasswordInput.closest(".password-field"),
    ],
    errorEl: staffErrorMessage,
  });
});

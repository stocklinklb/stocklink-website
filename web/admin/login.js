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
const signupForm = document.getElementById("signup-form");
const staffForm = document.getElementById("staff-login-form");

const ownerErrorMessage = document.getElementById("owner-error");
const signupErrorMessage = document.getElementById("signup-error");
const staffErrorMessage = document.getElementById("staff-error");

const ownerEmailInput = document.getElementById("owner-email");
const ownerPasswordInput = document.getElementById("owner-password");

const signupNameInput = document.getElementById("signup-name");
const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const passwordRulesList = document.getElementById("password-rules");

const staffUsernameInput = document.getElementById("staff-username");
const staffPasswordInput = document.getElementById("staff-password");

const authDescription = document.getElementById("auth-description");
const authSwitch = document.getElementById("auth-switch");
const authSwitchText = document.getElementById("auth-switch-text");
const authSwitchButton = document.getElementById("show-signup");

const LOGIN_REDIRECT_URL = "/admin/index.html";
// Point this at the onboarding screens once they exist.
const SIGNUP_REDIRECT_URL = "/admin/onboarding.html";

// =========================================================
// VIEW STATE
//   "login"  -> owner login   (Store Owner tab)
//   "signup" -> owner signup  (Store Owner tab)
//   "staff"  -> staff login   (Staff tab)
// Signup is intentionally only reachable from the Store Owner
// tab; the switch row is hidden while the Staff tab is active.
// =========================================================
const VIEW_COPY = {
  login: {
    description: "Sign in to manage stock and orders quickly.",
    switchText: "Don't have a store yet?",
    switchButton: "Create one",
  },
  signup: {
    description: "Create your store and start managing stock in minutes.",
    switchText: "Already have a store?",
    switchButton: "Log in",
  },
  staff: {
    description: "Sign in with the details your store owner gave you.",
  },
};

let currentView = "login";

function setView(view) {
  currentView = view;
  document.querySelector(".login-card").dataset.view = view;

  const isStaff = view === "staff";
  const isSignup = view === "signup";

  // tabs (signup lives under the Store Owner tab)
  tabOwner.setAttribute("aria-selected", String(!isStaff));
  tabStaff.setAttribute("aria-selected", String(isStaff));
  tabList.dataset.active = isStaff ? "staff" : "owner";

  // forms
  ownerForm.classList.toggle("is-hidden", view !== "login");
  signupForm.classList.toggle("is-hidden", !isSignup);
  staffForm.classList.toggle("is-hidden", !isStaff);

  // header copy + login/signup switch (owner only)
  authDescription.textContent = VIEW_COPY[view].description;
  authSwitch.hidden = isStaff;

  if (!isStaff) {
    authSwitchText.textContent = VIEW_COPY[view].switchText;
    authSwitchButton.textContent = VIEW_COPY[view].switchButton;
  }

  clearErrors();
}

tabOwner.addEventListener("click", () => {
  // Clicking Store Owner from Staff returns to owner login;
  // if already on an owner view, keep whichever one is open.
  if (currentView === "staff") setView("login");
});
tabStaff.addEventListener("click", () => setView("staff"));

authSwitchButton.addEventListener("click", () => {
  setView(currentView === "signup" ? "login" : "signup");
});

// =========================================================
// SHOW/HIDE PASSWORD
// (one handler for all forms — matched by data-target-input)
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
// GOOGLE SIGN-IN
// Google draws its button inside a cross-origin iframe, so its
// look can't be changed with CSS. Instead we style our own button
// (.google-button-face) and lay Google's real button on top of it,
// invisible, so clicks still go to Google. The iframe needs a pixel
// width, so we re-render it whenever the container size changes.
// =========================================================
const googleButtons = document.querySelectorAll(".google-button");

// Swaps a Google button into / out of its "Logging you in…" state.
// Each button says something different ("Continue with…", "Sign up
// with…"), so the original text is saved the first time and restored later.
function setGoogleLoading(wrap, isLoading) {
  if (!wrap) return;

  const label = wrap.querySelector(".google-button-face span");
  if (!label) return;

  if (wrap.dataset.label === undefined) {
    wrap.dataset.label = label.textContent;
  }

  label.textContent = isLoading ? "Logging you in…" : wrap.dataset.label;
  wrap.classList.toggle("is-loading", isLoading);
}

// Back button after the redirect: some browsers restore the page from the
// back/forward cache still frozen in the loading state, so reset it.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    document
      .querySelectorAll(".google-button")
      .forEach((wrap) => setGoogleLoading(wrap, false));
  }
});

function renderGoogleButtons() {
  googleButtons.forEach((wrap) => {
    const overlay = wrap.querySelector(".google-button-overlay");
    const width = Math.round(wrap.getBoundingClientRect().width);
    if (!overlay || !width) return;

    overlay.innerHTML = "";
    google.accounts.id.renderButton(overlay, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: wrap.dataset.googleText || "continue_with",
      shape: "rectangular",
      // Google accepts 200-400px
      width: Math.min(400, Math.max(200, width)),
    });
  });
}

if (window.google && google.accounts && google.accounts.id) {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
  });

  renderGoogleButtons();

  let googleResizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(googleResizeTimer);
    googleResizeTimer = setTimeout(renderGoogleButtons, 150);
  });
} else {
  // Google script blocked/offline: hide the sections instead of
  // breaking the rest of the login page.
  document
    .querySelectorAll(".google-auth")
    .forEach((el) => el.setAttribute("hidden", ""));
}

// =========================================================
// PASSWORD RULES (must mirror the server exactly)
//   at least 8 characters, one uppercase letter,
//   one digit, one symbol (any non-letter, non-digit char)
// =========================================================
const PASSWORD_RULES = {
  length: (pw) => pw.length >= 8,
  upper: (pw) => /[A-Z]/.test(pw),
  number: (pw) => /[0-9]/.test(pw),
  symbol: (pw) => /[^A-Za-z0-9]/.test(pw),
};

function checkPassword(pw) {
  const results = {};
  for (const [rule, test] of Object.entries(PASSWORD_RULES)) {
    results[rule] = test(pw);
  }
  return results;
}

function renderPasswordRules() {
  const results = checkPassword(signupPasswordInput.value);

  passwordRulesList.querySelectorAll("li").forEach((li) => {
    li.classList.toggle("is-met", results[li.dataset.rule]);
  });

  // once the rules are all met, drop any leftover error styling
  if (Object.values(results).every(Boolean)) {
    passwordRulesList.classList.remove("has-error");
    signupPasswordInput
      .closest(".password-field")
      .classList.remove("input-error");
  }
}
async function handleGoogleCredential(response) {
  // One Google callback serves every form, so pick the endpoint and
  // error box from whichever view is open.
  const isStaff = currentView === "staff";
  const endpoint = isStaff ? "/staff/google" : "/auth/google";
  const errorEl = isStaff
    ? staffErrorMessage
    : currentView === "signup"
      ? signupErrorMessage
      : ownerErrorMessage;
  const thatForm = isStaff
    ? staffForm
    : currentView === "signup"
      ? signupForm
      : ownerForm;
  const wrap = thatForm.querySelector(".google-button");

  // Declared out here so `finally` can see it.
  let redirecting = false;

  try {
    clearErrors();
    setGoogleLoading(wrap, true);
    const res = await fetch(`${API_ROOT}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 429) {
      showError(errorEl, buildRateLimitMessage(res.headers.get("Retry-After")));
      return;
    }

    if (!res.ok) {
      showError(errorEl, data.message || "Google sign-in failed");
      return;
    }

    // Staff never go through onboarding; only brand-new owner stores do.
    // Stay in the loading state until the page actually changes.
    redirecting = true;
    window.location.href =
      !isStaff && data.isNewStore ? SIGNUP_REDIRECT_URL : LOGIN_REDIRECT_URL;
  } catch (error) {
    console.error(error);
    showError(errorEl, "Server connection failed.");
  } finally {
    if (!redirecting) setGoogleLoading(wrap, false);
  }
}
signupPasswordInput.addEventListener("input", renderPasswordRules);

// =========================================================
// ERROR STATE HELPERS
// =========================================================
function clearErrors() {
  ownerErrorMessage.textContent = "";
  signupErrorMessage.textContent = "";
  staffErrorMessage.textContent = "";

  passwordRulesList.classList.remove("has-error");

  document
    .querySelectorAll(".input-error")
    .forEach((el) => el.classList.remove("input-error"));
}

function showError(targetErrorEl, message, fieldsToFlag = []) {
  targetErrorEl.textContent = message;
  fieldsToFlag.forEach((el) => el && el.classList.add("input-error"));
}

// Builds the whole 429 message ourselves (the server's text already says
// "try again later", so we don't reuse it). Retry-After is only readable
// cross-origin if the API sends `exposedHeaders: ["Retry-After"]`; when it
// isn't available we fall back to a generic wait message.
function buildRateLimitMessage(retryAfterHeader) {
  const seconds = parseInt(retryAfterHeader, 10);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Too many attempts. Please wait a little while and try again.";
  }

  if (seconds < 60) {
    return `Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

// =========================================================
// SUBMIT HANDLING (shared logic, per-form config)
// =========================================================
async function handleAuth({
  form,
  endpoint,
  payload,
  errorEl,
  fieldsToFlag = [],
  onSuccess,
  onFailure,
  // optional: (status, message) => array of extra elements to flag
  pickFieldsForError,
  fallbackError = "Invalid credentials",
  redirectTo = LOGIN_REDIRECT_URL,
}) {
  const submitButton = form.querySelector('button[type="submit"]');

  clearErrors();
  submitButton.classList.add("is-loading");
  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_ROOT}${endpoint}`, {
      method: "POST",
      // required so the session cookie is saved (user is logged in after
      // signup / login)
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // errors from limiters / proxies may not be JSON — don't let that throw
    const data = await response.json().catch(() => ({}));

    if (response.ok) {

      console.log("Auth successful", data);
      if (onSuccess) {
        onSuccess(data);
        return;
      }
      window.location.href = redirectTo;
      return;
    }

    if (response.status === 429) {
      showError(
        errorEl,
        buildRateLimitMessage(response.headers.get("Retry-After")),
      );

      return;
    }
    if (onFailure) {
      onFailure?.(response.status, data);
      return;
    }
    const flagged = pickFieldsForError
      ? pickFieldsForError(response.status, data.message || "")
      : fieldsToFlag;

    showError(errorEl, data.message || fallbackError, flagged);
  } catch (error) {
    console.error(error);
    showError(errorEl, "Server connection failed");
  } finally {
    submitButton.classList.remove("is-loading");
    submitButton.disabled = false;
  }
}
const emailVerificationPanel = document.getElementById("email-verification-panel")
const brand = document.querySelector(".brand")
const resendButton = document.getElementById("resend-verification");
function showVerifyPanel(email, mode) {
  if (mode === "sent") {
    showVerificationPanel();
    return true;
  }
  if (mode === "failed") {

    showVerificationPanel();
  }
}

resendButton.addEventListener("click", async () => {
  let secondsLeft = 5;
  resendButton.disabled = true;
  resendButton.innerHTML = `<i class="fa-solid fa-rotate-right"></i>
              Resend verification email in ${secondsLeft}s`

  const countDown = setInterval(() => {
    secondsLeft--;
    resendButton.innerHTML = `<i class="fa-solid fa-rotate-right"></i>
              Resend verification email in ${secondsLeft}s`

    if (secondsLeft < 0) {
      clearInterval(countDown);
      resendButton.disabled = false;
      resendButton.innerHTML = `<i class="fa-solid fa-rotate-right"></i>
              Resend verification email`
    }
  }, 1000)
})




function showVerificationPanel() {
  authSwitch.classList.add("is-hidden")
  brand.classList.add("is-hidden")
  signupForm.classList.add("is-hidden");
  authDescription.classList.add("is-hidden");
  emailVerificationPanel.classList.remove("is-hidden");
}
function hideVerificationPanel() {
  authSwitch.classList.remove("is-hidden")
  brand.classList.remove("is-hidden")
  signupForm.classList.remove("is-hidden");
  authDescription.classList.remove("is-hidden");
  emailVerificationPanel.classList.add("is-hidden");
}

// ---------------------------------------------------------
// Owner login
// ---------------------------------------------------------
ownerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  handleAuth({
    form: ownerForm,
    endpoint: "/auth/login",
    payload: {
      email: ownerEmailInput.value.trim(),
      password: ownerPasswordInput.value,
    },
    fieldsToFlag: [
      ownerEmailInput,
      ownerPasswordInput.closest(".password-field"),
    ],
    errorEl: ownerErrorMessage,
  });
});

// ---------------------------------------------------------
// Owner signup  ->  POST /auth/signup { name, email, password }
// ---------------------------------------------------------
signupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = signupNameInput.value.trim();
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;
  const passwordField = signupPasswordInput.closest(".password-field");

  // Client-side check: the server only says "too weak", so we enforce
  // the same rule here and tell the user exactly what's missing.
  clearErrors();

  if (!name) {
    showError(signupErrorMessage, "Please enter your store name.", [
      signupNameInput,
    ]);
    return;
  }

  const results = checkPassword(password);
  if (!Object.values(results).every(Boolean)) {
    passwordRulesList.classList.add("has-error");
    renderPasswordRules();
    showError(
      signupErrorMessage,
      "Password doesn't meet all the requirements below.",
      [passwordField],
    );
    return;
  }


  handleAuth({
    form: signupForm,
    endpoint: "/auth/signup",
    payload: { name, email, password },
    errorEl: signupErrorMessage,
    fallbackError: "Could not create your store. Please try again.",
    onSuccess: () => showVerificationPanel(),
    // 422 missing field / 400 weak password, invalid email, or taken email
    pickFieldsForError: (status, message) => {
      const msg = message.toLowerCase();
      const flagged = [];

      if (msg.includes("email")) flagged.push(signupEmailInput);
      if (msg.includes("password") || msg.includes("weak")) {
        flagged.push(passwordField);
        passwordRulesList.classList.add("has-error");
      }
      if (msg.includes("name")) flagged.push(signupNameInput);

      return flagged;
    },
  });


});

// ---------------------------------------------------------
// Staff login
// ---------------------------------------------------------
staffForm.addEventListener("submit", (event) => {
  event.preventDefault();

  handleAuth({
    form: staffForm,
    // Adjust this endpoint to whatever the API actually exposes for
    // staff auth — placeholder path, mirrors /auth/login.
    endpoint: "/staff/login",
    payload: {
      username: staffUsernameInput.value.trim(),
      password: staffPasswordInput.value,
    },
    fieldsToFlag: [
      staffUsernameInput,
      staffPasswordInput.closest(".password-field"),
    ],
    errorEl: staffErrorMessage,
  });
});

// initial state
setView("login");
renderPasswordRules();

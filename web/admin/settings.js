// Settings is its own resource, not nested under /products, so it
// hangs off API_ROOT rather than API_BASE. Both come from config.js,
// which must be included on the page before this script and before
// shared.js.
const API = `${API_ROOT}/settings`;
let storeNameInput;
let phoneInput;
let whatsappInput;
let addressInput;
let instagramInput;
let facebookInput;
let tiktokInput;
let uploadLogoBtn;
let logoInput;
let googleLinkTitle;
let googleLinkDescription;
let googleLinkBtn;
let unlinkModal;

// Google section state
let isGoogleLinked = false;
let googleHasPassword = true;
// "link" or "unlink" - set when the Google modal opens, read when Google
// hands back the credential.
let googleAction = "link";

// Elements of the Google modal (built once in buildGoogleModal)
let googleModal;
let googleModalTitle;
let googleModalText;
let googleModalButton;
let googleModalCancel;

document.addEventListener("DOMContentLoaded", () => {
  googleLinkTitle = document.getElementById("google-link-title");
  googleLinkDescription = document.getElementById("google-link-description");
  googleLinkBtn = document.getElementById("link-google-btn");
  storeNameInput = document.querySelector("#store-name");
  phoneInput = document.querySelector("#phone");
  whatsappInput = document.querySelector("#whatsapp");
  addressInput = document.querySelector("#address");
  instagramInput = document.querySelector("#instagram");
  facebookInput = document.querySelector("#facebook");
  tiktokInput = document.querySelector("#tiktok");
  uploadLogoBtn = document.getElementById("upload-logo-btn");
  logoInput = document.getElementById("logo-upload");

  uploadLogoBtn.addEventListener("click", () => {
    logoInput.click();
  });

  logoInput.addEventListener("change", handleLogoChange);

  initGoogle();
  buildGoogleModal();
  googleLinkBtn.addEventListener("click", handleGoogleButtonClick);

  unlinkModal = document.getElementById("unlink-modal");
  document
    .getElementById("unlink-cancel")
    .addEventListener("click", closeUnlinkModal);
  document
    .getElementById("unlink-confirm")
    .addEventListener("click", confirmUnlink);
  // Click on the dark backdrop (not the card) closes it
  unlinkModal.addEventListener("click", (e) => {
    if (e.target === unlinkModal) closeUnlinkModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!unlinkModal.hidden) closeUnlinkModal();
    if (googleModal.style.display !== "none") closeGoogleModal();
  });

  loadSettings();

  document.getElementById("save-btn").addEventListener("click", saveSettings);
});

async function handleLogoChange() {
  const file = logoInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("logo", file);

  try {
    const response = await fetch(`${API}/logo`, {
      method: "PUT",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to upload logo");
    }

    const data = await response.json();

    if (data.logo) {
      applyStoreLogo(data.logo);
    }

    showToast("Logo updated successfully", "success");
  } catch (error) {
    console.error(error);
    showToast("Failed to update logo", "error");
  } finally {
    // Reset so choosing the same file again still fires "change"
    logoInput.value = "";
  }
}

/* =========================
   Google link / unlink
========================= */

function initGoogle() {
  if (typeof google === "undefined" || !google.accounts?.id) {
    console.warn("Google Identity Services failed to load");
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
  });
}

// Unlink stays disabled when Google is the account's only way to sign in.
function setGoogleBusy(busy) {
  googleLinkBtn.disabled = busy || (isGoogleLinked && !googleHasPassword);
}

// Asks the server what the real state is (for the owner or for the staff
// member who is logged in) and redraws the section from it.
async function refreshGoogleStatus() {
  try {
    const res = await fetch(`${API_ROOT}/auth/google/status`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Status request failed");

    const data = await res.json();
    googleHasPassword = Boolean(data.hasPassword);
    renderGoogleState(Boolean(data.googleLinked));
  } catch (error) {
    console.error(error);
    googleLinkDescription.textContent =
      "Couldn't load your Google account status.";
    googleLinkBtn.disabled = true;
  }
}

// Single place that draws the Google section for either state.
function renderGoogleState(linked) {
  isGoogleLinked = linked;
  googleLinkTitle.textContent = "Google Account";

  if (linked) {
    googleLinkDescription.textContent = googleHasPassword
      ? "Your Google account is linked for easier sign in."
      : "Your Google account is linked and is your only way to sign in, so it can't be unlinked yet.";
    googleLinkBtn.innerHTML = `
      <i class="fa-solid fa-link-slash"></i>
      <span>Unlink Google Account</span>
    `;
    googleLinkBtn.classList.add("unlink");
  } else {
    googleLinkDescription.textContent =
      "Link your Google account for easier sign in.";
    googleLinkBtn.innerHTML = `
      <i class="fa-brands fa-google"></i>
      <span>Link Google Account</span>
    `;
    googleLinkBtn.classList.remove("unlink");
  }

  setGoogleBusy(false);
}

function handleGoogleButtonClick() {
  if (typeof google === "undefined" || !google.accounts?.id) {
    showToast("Google sign-in is unavailable right now.", "error");
    return;
  }

  if (isGoogleLinked) {
    openUnlinkModal();
    return;
  }

  openGoogleModal("link");
}

function openUnlinkModal() {
  unlinkModal.hidden = false;
  document.getElementById("unlink-cancel").focus();
}

function closeUnlinkModal() {
  unlinkModal.hidden = true;
  googleLinkBtn.focus();
}

// Confirmed in the modal -> ask Google to re-verify. The credential
// callback then posts to /auth/google/unlink.
function confirmUnlink() {
  unlinkModal.hidden = true;
  openGoogleModal("unlink");
}

/* -------------------------
   Google modal

   Google's One Tap prompt (google.accounts.id.prompt) can be silently
   suppressed after a user dismisses it once, which would make the Link
   and Unlink buttons do nothing. A rendered Google button always works,
   so it lives in this small modal. It is built here (with inline styles
   and fallback colours) so no HTML or CSS changes are needed.
------------------------- */

function buildGoogleModal() {
  googleModal = document.createElement("div");
  googleModal.setAttribute("role", "dialog");
  googleModal.setAttribute("aria-modal", "true");
  googleModal.setAttribute("aria-labelledby", "google-modal-title");
  googleModal.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:1100",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "padding:16px",
    "background:rgba(15,23,42,0.45)",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "width:min(92vw,360px)",
    "padding:24px 20px",
    "text-align:center",
    "background:var(--surface,#fff)",
    "color:var(--ink,#111827)",
    "border:1px solid var(--border,#e2e8f0)",
    "border-radius:var(--radius-lg,16px)",
    "box-shadow:var(--shadow-lg,0 20px 40px rgba(15,23,42,0.12))",
    "font-family:inherit",
  ].join(";");

  googleModalTitle = document.createElement("h3");
  googleModalTitle.id = "google-modal-title";
  googleModalTitle.style.cssText = "margin:0 0 8px;font-size:17px;";

  googleModalText = document.createElement("p");
  googleModalText.style.cssText = [
    "margin:0 0 18px",
    "font-size:13px",
    "line-height:1.5",
    "color:var(--ink-soft,#475569)",
  ].join(";");

  // Google draws its real button in here
  googleModalButton = document.createElement("div");
  googleModalButton.style.cssText =
    "display:flex;justify-content:center;min-height:44px;";

  googleModalCancel = document.createElement("button");
  googleModalCancel.type = "button";
  googleModalCancel.textContent = "Cancel";
  googleModalCancel.style.cssText = [
    "margin-top:14px",
    "padding:8px 16px",
    "border:1px solid var(--border,#e2e8f0)",
    "border-radius:var(--radius-md,12px)",
    "background:transparent",
    "color:inherit",
    "font:inherit",
    "font-size:13px",
    "cursor:pointer",
  ].join(";");

  googleModalCancel.addEventListener("click", closeGoogleModal);
  // Click on the dark backdrop (not the card) closes it
  googleModal.addEventListener("click", (e) => {
    if (e.target === googleModal) closeGoogleModal();
  });

  card.append(
    googleModalTitle,
    googleModalText,
    googleModalButton,
    googleModalCancel,
  );
  googleModal.appendChild(card);
  document.body.appendChild(googleModal);
}

function openGoogleModal(action) {
  googleAction = action;

  googleModalTitle.textContent =
    action === "link" ? "Link your Google account" : "Confirm with Google";
  googleModalText.textContent =
    action === "link"
      ? "Choose the Google account you want to use to sign in."
      : "Choose the Google account that is linked to this profile to confirm the unlink.";

  googleModalButton.innerHTML = "";
  google.accounts.id.renderButton(googleModalButton, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: action === "link" ? "continue_with" : "signin_with",
    shape: "rectangular",
    // Google accepts 200-400px; 240 fits the card on small phones
    width: 240,
  });

  googleModal.style.display = "flex";
  googleModalCancel.focus();
}

// Hides without moving focus (used right after Google returns a credential,
// because the button is about to be disabled).
function hideGoogleModal() {
  googleModal.style.display = "none";
}

function closeGoogleModal() {
  hideGoogleModal();
  googleLinkBtn.focus();
}

async function handleGoogleCredential(response) {
  const action = googleAction;
  hideGoogleModal();
  setGoogleBusy(true);

  try {
    const res = await fetch(`${API_ROOT}/auth/google/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 429) {
      showToast("Too many attempts. Please try again later.", "error");
      setGoogleBusy(false);
      return;
    }
    if (!res.ok) {
      showToast(data.message || `Google ${action} failed`, "error");
      setGoogleBusy(false);
      return;
    }

    // Show what the server says, not what we assume happened
    await refreshGoogleStatus();
    showToast(
      data.message ||
        (action === "link"
          ? "Google account linked"
          : "Google account unlinked"),
      "success",
    );
  } catch (error) {
    console.error(`GOOGLE ${action.toUpperCase()} FETCH ERROR:`, error);
    showToast("Server connection failed.", "error");
    setGoogleBusy(false);
  }
}

/* =========================
   Load / save settings
========================= */

// applyStoreLogo is defined in shared.js (loaded before this file) and
// handles writing the logo to the settings preview, every sidebar
// avatar, and localStorage.
async function loadSettings() {
  try {
    const response = await fetch(API, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to load settings");
    }

    const store = await response.json();
    storeNameInput.value = store.name || "";
    phoneInput.value = store.phone || "";
    whatsappInput.value = store.whatsapp || "";
    addressInput.value = store.address || "";

    if (store.socialLinks) {
      instagramInput.value = store.socialLinks.instagram || "";
      tiktokInput.value = store.socialLinks.tiktok || "";
      facebookInput.value = store.socialLinks.facebook || "";
    }

    if (store.logo) {
      applyStoreLogo(store.logo);
    }

    // The Google state comes from its own route, which looks at the account
    // that is actually logged in (the owner's store, or the staff member's
    // own account). Never read store.googleId here: for a staff member that
    // would be the OWNER's Google link, not theirs.
    await refreshGoogleStatus();
  } catch (error) {
    console.error(error);
  } finally {
    // Reveal the form exactly when data is ready (see note in settings.html)
    Skeleton.clear(".settings-card");
  }
}

async function saveSettings() {
  const name = storeNameInput.value.trim();

  if (!name) {
    showToast("Name cannot be empty", "error");
    return;
  }
  const store = {
    name,
    phone: phoneInput.value,
    whatsapp: whatsappInput.value,
    address: addressInput.value,
    socialLinks: {
      instagram: instagramInput.value,
      facebook: facebookInput.value,
      tiktok: tiktokInput.value,
    },
  };
  try {
    const response = await fetch(API, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      showToast(json.message || "Failed to save settings", "error");
      return;
    }

    showToast(json.message || "Settings saved", "success");
  } catch (error) {
    console.error(error);
    showToast("Server connection failed.", "error");
  }
}

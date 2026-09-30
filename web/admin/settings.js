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
let isGoogleLinked = false;
let unlinkModal;

document.addEventListener("DOMContentLoaded", () => {
  // FIX: id in the HTML is "google-link-title" (was "googleLinkTitle" -> null)
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

  // FIX: this used to run at top level, before the DOM existed, so
  // googleLinkBtn was undefined and the script threw.
  initGoogle();
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
    if (e.key === "Escape" && !unlinkModal.hidden) closeUnlinkModal();
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

// Single place that draws the Google section for either state.
function renderGoogleState(linked) {
  isGoogleLinked = linked;
  googleLinkTitle.textContent = "Google Account";

  if (linked) {
    googleLinkDescription.textContent =
      "Your Google account is linked for easier sign in.";
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

  googleLinkBtn.disabled = false;
}

// "link" or "unlink" - decided when the button is clicked, used when
// Google hands back the credential.
let googleAction = "link";

function handleGoogleButtonClick() {
  if (typeof google === "undefined" || !google.accounts?.id) {
    showToast("Google sign-in is unavailable right now.", "error");
    return;
  }

  if (isGoogleLinked) {
    openUnlinkModal();
    return;
  }

  googleAction = "link";
  google.accounts.id.prompt();
}

function openUnlinkModal() {
  unlinkModal.hidden = false;
  document.getElementById("unlink-cancel").focus();
}

function closeUnlinkModal() {
  unlinkModal.hidden = true;
  googleLinkBtn.focus();
}

// Confirmed in the modal -> re-verify with Google, then the credential
// callback posts to /auth/google/unlink.
function confirmUnlink() {
  unlinkModal.hidden = true;
  googleAction = "unlink";
  google.accounts.id.prompt();
}

async function handleGoogleCredential(response) {
  const action = googleAction;
  googleLinkBtn.disabled = true;
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
      googleLinkBtn.disabled = false;
      return;
    }
    if (!res.ok) {
      showToast(data.message || `Google ${action} failed`, "error");
      googleLinkBtn.disabled = false;
      return;
    }

    renderGoogleState(action === "link");
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
    googleLinkBtn.disabled = false;
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

    // The API scopes this to the logged-in account (store for owners,
    // staffAccount by staffId for staff). Never read store.googleId here:
    // for a staff member that is the OWNER's Google link, not theirs.
    if (typeof store.googleLinked !== "boolean") {
      console.warn(
        "GET /settings did not return googleLinked; falling back to store.googleId",
      );
    }
    const linked =
      typeof store.googleLinked === "boolean"
        ? store.googleLinked
        : Boolean(store.googleId);

    // linked -> button becomes "Unlink", otherwise "Link"
    renderGoogleState(linked);
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

    // FIX: the old code threw before reaching showToast (and referenced
    // `json` before it was defined, and passed `error` as the type).
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

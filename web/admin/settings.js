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

document.addEventListener("DOMContentLoaded", () => {
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
  } catch (error) {
    console.error(error);
  }
}

async function saveSettings() {
  const name = storeNameInput.value.trim();

  if (!name) {
    showToast("Name cannot be empty", "error");
    return;
  }
  const store = {
    name: storeNameInput.value,
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

    if (!response.ok) {
      throw new Error("failed");
      showToast(json.message, error);
    }

    const json = await response.json();
    showToast(json.message, "success");
    console.log(json);
  } catch (error) {
    console.error(error);
  }
}

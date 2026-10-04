// =========================================================
// CONSTANTS
// =========================================================

const STEP_STORE_NAME = 1;
const STEP_BUSINESS_TYPE = 2;
const STEP_CHOICE = 3;

// What each choice card does when "Continue" is pressed on the last step.
const FLOW_CONFIG = {
  import: { eventType: "STEP_CHOICE", path: "IMPORT", page: "excel-import" },
  manual: { eventType: "STEP_CHOICE", path: "MANUAL", page: "add-product" },
  explore: { eventType: "PATH_CHOSEN", path: "EXPLORE", page: "" },
};

// =========================================================
// DOM REFERENCES
// =========================================================

const storeName = document.getElementById("store-name");
const storeNameError = document.getElementById("store-name-error");

const onboardingSteps = document.querySelectorAll(".onboarding-step");
const onboardingContent = document.querySelector(".onboarding-content");
const progressItems = document.querySelectorAll(".progress-item");
const progressLines = document.querySelectorAll(".progress-line");

const step1Continue = document.getElementById("step-1-continue");
const step2Continue = document.getElementById("step-2-continue");
const step3Continue = document.getElementById("step-3-continue");

const choiceCards = document.querySelectorAll(".choice-card");

const globalSkip = document.getElementById("global-skip");
const skipButtons = document.querySelectorAll("[data-skip-step]");
const backButtons = document.querySelectorAll("[data-back-step]");

const businessSearch = document.getElementById("business-type-search");
const businessTypeList = document.getElementById("business-type-list");

// Error message element for the business type step.
// Uses #business-type-error if it exists in the HTML, otherwise creates it.
let businessTypeError = document.getElementById("business-type-error");

if (!businessTypeError) {
  businessTypeError = document.createElement("p");
  businessTypeError.id = "business-type-error";
  businessTypeError.className = storeNameError.className;
  businessTypeList.insertAdjacentElement("afterend", businessTypeError);
}

// =========================================================
// STATE
// =========================================================

let selectedFlow = null;
let originalName = null;

let businessTypes = [];
let selectedBusinessType = null; // what the user has highlighted
let savedBusinessType = null; // what has already been saved on the server

// =========================================================
// STORE NAME — PREFILL
// =========================================================

async function loadStore() {
  try {
    const response = await fetch(`${API_ROOT}/auth/me`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      window.location.href = "/admin/login.html";
      return;
    }

    const result = await response.json();

    originalName = result.name;
    storeName.value = result.name ?? "";
    step1Continue.disabled = storeName.value.trim() === "";
  } catch (error) {
    console.error(error);
    storeNameError.textContent = "Server connection failed";
  }
}

// =========================================================
// STORE NAME — INPUT
// =========================================================

storeName.addEventListener("input", () => {
  step1Continue.disabled = storeName.value.trim() === "";
  storeNameError.textContent = "";
});

// =========================================================
// BUSINESS TYPE — LOAD + RENDER
// =========================================================

async function loadBusinessTypes() {
  try {
    const response = await fetch(`${API_ROOT}/onboarding/business-types`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      businessTypeError.textContent = "Couldn't load business types.";
      return;
    }

    const data = await response.json();

    businessTypes = data.businessTypes || [];
    buildSearchList(businessTypes);
  } catch (error) {
    console.error(error);
    businessTypeError.textContent = "Server connection failed";
  }
}

function buildSearchList(list) {
  businessTypeList.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "business-type-empty";
    empty.textContent = "No matching business types.";
    businessTypeList.appendChild(empty);
    return;
  }

  list.forEach((business) => {
    const button = document.createElement("button");
    button.className = "business-type-item";
    button.type = "button";
    button.dataset.businessType = business.id;

    // Keep the selection visible after searching / re-rendering.
    if (business.id === selectedBusinessType) {
      button.classList.add("is-selected");
    }

    const icon = document.createElement("div");
    icon.className = "business-type-icon";
    icon.innerHTML = '<i class="fa-solid fa-store"></i>';

    const name = document.createElement("span");
    name.className = "business-type-name";
    name.textContent = business.name;

    const check = document.createElement("span");
    check.className = "business-type-check";
    check.innerHTML = '<i class="fa-solid fa-check"></i>';

    button.append(icon, name, check);
    businessTypeList.appendChild(button);
  });
}

// =========================================================
// BUSINESS TYPE — SELECTION
// =========================================================

businessTypeList.addEventListener("click", (event) => {
  const item = event.target.closest(".business-type-item");

  if (!item) return;

  businessTypeList
    .querySelectorAll(".business-type-item")
    .forEach((b) => b.classList.remove("is-selected"));

  item.classList.add("is-selected");

  selectedBusinessType = item.dataset.businessType;
  step2Continue.disabled = false;
  businessTypeError.textContent = "";
});

// =========================================================
// BUSINESS TYPE — SEARCH
// =========================================================

businessSearch.addEventListener("input", (event) => {
  const searchValue = event.target.value.toLowerCase().trim();

  const filtered = businessTypes.filter((business) =>
    business.name.toLowerCase().includes(searchValue),
  );

  buildSearchList(filtered);
});

// =========================================================
// BUSINESS TYPE — CONTINUE (save, then go to the next step)
// =========================================================


const generalStoreButton = document.getElementById("business-type-general");

generalStoreButton.addEventListener("click", () => {
  selectedBusinessType = "GENERAL_STORE";
  businessSearch.value = "";
  buildSearchList(businessTypes); // re-render so the item shows as selected

  step2Continue.disabled = false;
  businessTypeError.textContent = "";

  businessTypeList
    .querySelector(".is-selected")
    ?.scrollIntoView({ block: "nearest" });
});

step2Continue.addEventListener("click", async () => {
  if (!selectedBusinessType) return;

  // Already saved (e.g. user went back and forward): no request needed.
  if (selectedBusinessType === savedBusinessType) {
    showNextStep(getCurrentStep());
    return;
  }

  step2Continue.disabled = true;
  businessTypeError.textContent = "";

  try {
    const response = await fetch(`${API_ROOT}/onboarding/business`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessType: selectedBusinessType }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      businessTypeError.textContent =
        data.message || "Couldn't save your business type.";

      return;
    }

    savedBusinessType = selectedBusinessType;
    showNextStep(getCurrentStep());
  } catch (error) {
    console.error(error);
    businessTypeError.textContent = "Server connection failed";
  } finally {
    step2Continue.disabled = !selectedBusinessType;
  }
});

// =========================================================
// GET CURRENT STEP
// =========================================================

function getCurrentStep() {
  const currentStep = document.querySelector(
    ".onboarding-step:not(.is-hidden)",
  );

  return currentStep ? Number(currentStep.dataset.step) : null;
}

// =========================================================
// UPDATE PROGRESS
// =========================================================

function updateProgress(stepNumber) {
  progressItems.forEach((item, index) => {
    item.classList.remove("is-active");
    item.classList.remove("is-complete");

    if (index + 1 < stepNumber) {
      item.classList.add("is-complete");
    }

    if (index + 1 === stepNumber) {
      item.classList.add("is-active");
    }
  });

  progressLines.forEach((line, index) => {
    line.classList.remove("is-complete");

    if (index + 1 < stepNumber) {
      line.classList.add("is-complete");
    }
  });
}

// =========================================================
// SHOW A SPECIFIC STEP
// =========================================================

function showStep(stepNumber) {
  const targetStep = document.querySelector(
    `.onboarding-step[data-step="${stepNumber}"]`,
  );

  if (!targetStep) {
    console.error(`Onboarding step ${stepNumber} was not found.`);
    return;
  }

  onboardingContent.classList.add("is-changing");

  setTimeout(() => {
    onboardingSteps.forEach((step) => {
      step.classList.add("is-hidden");
    });

    targetStep.classList.remove("is-hidden");

    updateProgress(stepNumber);

    onboardingContent.classList.remove("is-changing");
  }, 220);
}

// =========================================================
// SHOW NEXT STEP
// =========================================================

function showNextStep(stepNumber) {
  showStep(Number(stepNumber) + 1);
}

// =========================================================
// BACK BUTTONS
// =========================================================

function resetFlowSelection() {
  choiceCards.forEach((card) => {
    card.classList.remove("is-selected");
  });

  selectedFlow = null;
  step3Continue.disabled = true;
}

backButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const currentStep = getCurrentStep();

    // Only the choice step has a selection that needs resetting.
    if (currentStep === STEP_CHOICE) {
      resetFlowSelection();
    }

    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  });
});

// =========================================================
// STEP 1 — CONTINUE (save the name only if it changed)
// =========================================================

step1Continue.addEventListener("click", async () => {
  const name = storeName.value.trim();

  if (name === "") {
    return;
  }

  // Unchanged: no request needed.
  if (name === originalName) {
    showNextStep(getCurrentStep());
    return;
  }

  step1Continue.disabled = true;
  storeNameError.textContent = "";

  try {
    const response = await fetch(`${API_ROOT}/settings`, {
      // TODO: replace with the real settings route path
      method: "PUT", // TODO: replace with the real method
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }), // TODO: replace with the real field name
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      storeNameError.textContent =
        data.message || "Couldn't save your store name.";

      return;
    }

    originalName = name;
    showNextStep(getCurrentStep());
  } catch (error) {
    console.error(error);
    storeNameError.textContent = "Server connection failed";
  } finally {
    step1Continue.disabled = storeName.value.trim() === "";
  }
});

// =========================================================
// ONBOARDING EVENTS
// =========================================================

async function recordOnBoard(eventType, metadata) {
  try {
    const response = await fetch(`${API_ROOT}/onboarding`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      keepalive: true, // lets the request finish even if we redirect right after
      body: JSON.stringify({ eventType, metadata }),
    });

    if (!response.ok) {
      console.error("Failed to record onboarding event:", response.status);
    }
  } catch (error) {
    console.error("Failed to record onboarding event:", error);
  }
}

// =========================================================
// STEP 3 — CHOICE SELECTION (import / manual / explore)
// =========================================================

choiceCards.forEach((card) => {
  card.addEventListener("click", () => {
    choiceCards.forEach((otherCard) => {
      otherCard.classList.remove("is-selected");
    });

    card.classList.add("is-selected");

    selectedFlow = card.dataset.choice;
    step3Continue.disabled = false;
  });
});

// =========================================================
// STEP 3 — CONTINUE
// =========================================================

step3Continue.addEventListener("click", () => {
  const flow = FLOW_CONFIG[selectedFlow];

  if (!flow) {
    return;
  }

  recordOnBoard(flow.eventType, { path: flow.path });
  goToDashboardPage(flow.page);
});

// =========================================================
// SKIP BUTTONS
// =========================================================

skipButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.dataset.skipStep);

    // Steps before the last one skip to the next step.
    // Skipping the last step leaves onboarding.
    if (step < STEP_CHOICE) {
      showStep(step + 1);
      return;
    }

    goToDashboardPage("");
  });
});

// =========================================================
// GLOBAL SKIP
// =========================================================

globalSkip.addEventListener("click", () => {
  goToDashboardPage("");
});

// =========================================================
// GO TO DASHBOARD
// =========================================================

function goToDashboardPage(page) {
  window.location.href = `/admin/${page}?from=onboarding`;
}

// =========================================================
// INITIAL STATE
// =========================================================

showStep(STEP_STORE_NAME);

step1Continue.disabled = true;
step2Continue.disabled = true;
step3Continue.disabled = true;

// Runs last so the prefill can enable Continue after the
// initial disabled state above has been applied.
loadStore();
loadBusinessTypes();
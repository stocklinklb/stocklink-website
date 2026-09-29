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

const choiceCards = document.querySelectorAll(".choice-card");

const globalSkip = document.getElementById("global-skip");

const skipButtons = document.querySelectorAll("[data-skip-step]");

// =========================================================
// STATE
// =========================================================

let selectedFlow = null;
let originalName = null;

// =========================================================
// STORE NAME — PREFILL
// =========================================================

async function loadStore() {
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
  storeName.value = result.name;
  step1Continue.disabled = storeName.value.trim() === "";
}

// =========================================================
// STORE NAME — INPUT
// =========================================================

storeName.addEventListener("input", () => {
  step1Continue.disabled = storeName.value.trim() === "";
  storeNameError.textContent = "";
});

const backButtons = document.querySelectorAll("[data-back-step]");

backButtons.forEach((button) => {
  button.addEventListener("click", () => {
    choiceCards.forEach((card) => {
      card.classList.remove("is-selected");
    });

    // Reset the selection state
    selectedFlow = null;
    step2Continue.disabled = true;

    const currentStep = getCurrentStep();

    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  });
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

    updateProgress(stepNumber === 2 && selectedFlow ? 3 : stepNumber);

    onboardingContent.classList.remove("is-changing");

    console.log("Current onboarding step:", getCurrentStep());
  }, 220);
}

// =========================================================
// SHOW NEXT STEP
// =========================================================

function showNextStep(stepNumber) {
  const nextStepNumber = Number(stepNumber) + 1;

  showStep(nextStepNumber);
}

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

async function recordOnBoard(eventType, metadata) {
  try {
    const response = await fetch(`${API_ROOT}/onboarding`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
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
// STEP 2 — CHOICE SELECTION
// =========================================================

choiceCards.forEach((card) => {
  card.addEventListener("click", () => {
    choiceCards.forEach((otherCard) => {
      otherCard.classList.remove("is-selected");
    });

    card.classList.add("is-selected");

    selectedFlow = card.dataset.choice;

    step2Continue.disabled = false;
    updateProgress(3);

    console.log("Selected flow:", selectedFlow.toUpperCase());
  });
});

// =========================================================
// STEP 2 — CONTINUE
// =========================================================

step2Continue.addEventListener("click", async () => {
  if (!selectedFlow) {
    return;
  }

  if (selectedFlow === "import") {
    recordOnBoard("STEP_CHOICE", {
      path: "IMPORT",
    });
    goToDashboardPage("excel-import");
    return;
  }

  if (selectedFlow === "manual") {
    recordOnBoard("STEP_CHOICE", {
      path: "MANUAL",
    });
    goToDashboardPage("add-product");

    return;
  }

  if (selectedFlow === "explore") {
    recordOnBoard("PATH_CHOSEN", {
      path: "EXPLORE",
    });
    goToDashboardPage("");

    return;
  }
});

// =========================================================
// SKIP BUTTONS
// =========================================================

skipButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.dataset.skipStep);

    console.log(`Skipping onboarding step ${step}`);

    if (step === 1) {
      showNextStep(getCurrentStep());

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

showStep(1);

step1Continue.disabled = true;
step2Continue.disabled = true;

// Runs last so the prefill can enable Continue after the
// initial disabled state above has been applied.
loadStore();

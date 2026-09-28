// =========================================================
// DOM REFERENCES
// =========================================================

const storeName = document.getElementById("store-name");

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
// STEP 3 — IMPORT
// =========================================================

const importer = document.querySelector(".importer");

const chooseFileButton = document.getElementById("choose-file-button");

const inventoryFile = document.getElementById("inventory-file");

const selectedFileContainer = document.getElementById("selected-file");

const selectedFileName = document.getElementById("selected-file-name");

const selectedFileSize = document.getElementById("selected-file-size");

const removeFileButton = document.getElementById("remove-file");

const importButton = document.getElementById("import-button");

// =========================================================
// STEP 3 — MANUAL
// =========================================================

const manualProductName = document.getElementById("manual-product-name");

const manualProductPrice = document.getElementById("manual-product-price");

const manualProductStock = document.getElementById("manual-product-stock");

const manualProductCategory = document.getElementById(
  "manual-product-category",
);

const manualProductButton = document.getElementById("manual-product-button");

// =========================================================
// STEP 4
// =========================================================

const dashboardButton = document.getElementById("dashboard-button");

const readyDescription = document.getElementById("ready-description");

const statProducts = document.getElementById("stat-products");

const statCategories = document.getElementById("stat-categories");

const statVariants = document.getElementById("stat-variants");

const statLowStock = document.getElementById("stat-low-stock");

// =========================================================
// STATE
// =========================================================

let selectedFlow = null;
let selectedFile = null;

// =========================================================
// STORE NAME
// =========================================================

storeName.addEventListener("input", () => {
  const hasStoreName = storeName.value.trim() !== "";

  step1Continue.disabled = !hasStoreName;
});

const backButtons = document.querySelectorAll("[data-back-step]");

backButtons.forEach((button) => {
  button.addEventListener("click", () => {
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

    updateProgress(stepNumber);

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
// STEP 1 — CONTINUE
// =========================================================

step1Continue.addEventListener("click", () => {
  const name = storeName.value.trim();

  if (name === "") {
    return;
  }

  console.log("Store name:", name);

  showNextStep(getCurrentStep());
});

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

    console.log("Selected flow:", selectedFlow);
  });
});

// =========================================================
// SHOW STEP 3 FLOW
// =========================================================

function showFlowContent(flow) {
  const flowContents = document.querySelectorAll("[data-flow-content]");

  flowContents.forEach((content) => {
    content.classList.add("is-hidden");
  });

  const targetContent = document.querySelector(`[data-flow-content="${flow}"]`);

  if (!targetContent) {
    console.error(`No onboarding content found for flow: ${flow}`);

    return;
  }

  targetContent.classList.remove("is-hidden");
}

// =========================================================
// STEP 2 — CONTINUE
// =========================================================

step2Continue.addEventListener("click", () => {
  if (!selectedFlow) {
    return;
  }

  if (selectedFlow === "import") {
    showFlowContent("import");
    showNextStep(getCurrentStep());

    return;
  }

  if (selectedFlow === "manual") {
    showFlowContent("manual");
    showNextStep(getCurrentStep());

    return;
  }

  if (selectedFlow === "explore") {
    goToDashboard();

    return;
  }
});

// =========================================================
// FILE PICKER
// =========================================================

chooseFileButton.addEventListener("click", () => {
  inventoryFile.click();
});

// =========================================================
// FILE SELECTED
// =========================================================

inventoryFile.addEventListener("change", () => {
  const file = inventoryFile.files[0];

  if (!file) {
    return;
  }

  setSelectedFile(file);
});

// =========================================================
// SET SELECTED FILE
// =========================================================

function setSelectedFile(file) {
  selectedFile = file;

  selectedFileName.textContent = file.name;

  selectedFileSize.textContent = formatFileSize(file.size);

  selectedFileContainer.classList.remove("is-hidden");

  importButton.disabled = false;

  console.log("Selected file:", selectedFile);
}

// =========================================================
// FORMAT FILE SIZE
// =========================================================

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =========================================================
// REMOVE FILE
// =========================================================

removeFileButton.addEventListener("click", () => {
  selectedFile = null;

  inventoryFile.value = "";

  selectedFileContainer.classList.add("is-hidden");

  importButton.disabled = true;

  console.log("File removed");
});

// =========================================================
// DRAG & DROP
// =========================================================

if (importer) {
  importer.addEventListener("dragover", (event) => {
    event.preventDefault();

    importer.classList.add("is-dragging");
  });

  importer.addEventListener("dragleave", () => {
    importer.classList.remove("is-dragging");
  });

  importer.addEventListener("drop", (event) => {
    event.preventDefault();

    importer.classList.remove("is-dragging");

    const file = event.dataTransfer.files[0];

    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    const validExtensions = ["xlsx", "xls"];

    if (!validExtensions.includes(extension)) {
      console.error("Invalid file type.");

      return;
    }

    setSelectedFile(file);
  });
}

// =========================================================
// IMPORT PRODUCTS
// =========================================================

importButton.addEventListener("click", async () => {
  if (!selectedFile) {
    return;
  }

  importButton.disabled = true;
  importButton.classList.add("is-loading");

  try {
    /*
        Your real importer API call goes here.

        Example:

        const formData = new FormData();

        formData.append(
          "file",
          selectedFile,
        );

        const response = await fetch(
          `${API_ROOT}/products/import`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Import failed",
          );
        }

        setReadyStats(data.stats);

        readyDescription.textContent =
          "Your inventory is now in StockLink.";

        showStep(4);
      */

    console.log("Ready to import:", selectedFile);
  } catch (error) {
    console.error("Import failed:", error);
  } finally {
    importButton.classList.remove("is-loading");

    importButton.disabled = selectedFile === null;
  }
});

// =========================================================
// MANUAL PRODUCT
// =========================================================

manualProductButton.addEventListener("click", async () => {
  const name = manualProductName.value.trim();

  const price = manualProductPrice.value;

  const stock = manualProductStock.value;

  const category = manualProductCategory.value;

  if (!name) {
    manualProductName.focus();
    return;
  }

  if (price === "") {
    manualProductPrice.focus();
    return;
  }

  if (stock === "") {
    manualProductStock.focus();
    return;
  }

  if (!category) {
    manualProductCategory.focus();
    return;
  }

  const productData = {
    name,
    price: Number(price),
    stock: Number(stock),
    category,
  };

  console.log("Manual product:", productData);

  /*
      Your real create-product API call goes here.

      After success:

      setReadyStats(data.stats);

      readyDescription.textContent =
        "Your first product is in. You can keep building your inventory from your dashboard.";

      showStep(4);
    */
});

// =========================================================
// READY PAGE — STATS
// =========================================================

function setReadyStats({
  products = 0,
  categories = 0,
  variants = 0,
  lowStock = 0,
}) {
  statProducts.textContent = products;
  statCategories.textContent = categories;
  statVariants.textContent = variants;
  statLowStock.textContent = lowStock;
}

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

    goToDashboard();
  });
});

// =========================================================
// GLOBAL SKIP
// =========================================================

globalSkip.addEventListener("click", () => {
  goToDashboard();
});

// =========================================================
// GO TO DASHBOARD
// =========================================================

function goToDashboard() {
  window.location.href = "/admin/index.html";
}

// =========================================================
// DASHBOARD BUTTON
// =========================================================

dashboardButton.addEventListener("click", () => {
  goToDashboard();
});

// =========================================================
// INITIAL STATE
// =========================================================

showStep(1);

step1Continue.disabled = true;
step2Continue.disabled = true;
importButton.disabled = true;

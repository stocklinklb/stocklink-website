const excelFile = document.getElementById("excel-file");
const validationBody = document.getElementById("validation-body");
const reviewSection = document.getElementById("review-section");

const uploadEmptyState = document.getElementById("upload-empty-state");
const selectedFile = document.getElementById("selected-file");
const reviewActionsBar = document.getElementById("review-actions-bar");

const fileName = document.getElementById("file-name");
const fileSize = document.getElementById("file-size");
const totalCount = document.querySelector(".total-count");
const validCount = document.querySelector(".valid-count");
const invalidCount = document.querySelector(".invalid-count");
const uploadBtn = document.querySelector(".upload-btn");
const continueBtn = document.getElementById("continue-btn");
const removeFileBtn = document.getElementById("remove-file");
const backBtn = document.getElementById("back-btn");
const importBtn = document.getElementById("import-btn");
const parsingLoader = document.getElementById("parsing-loader");
const uploadCard = document.querySelector(".upload-card");
const steps = document.querySelectorAll(".step");
let excelHeaders = [];
let importedProducts = [];
const ROW_HEIGHT = 48;
const BUFFER = 5;
const scrollContainer = document.querySelector(".review-card");
excelFile.addEventListener("change", handleFileSelect);

continueBtn.addEventListener("click", readExcelFile);

removeFileBtn.addEventListener("click", removeSelectedFile);
backBtn.addEventListener("click", removeSelectedFile);
function removeSelectedFile() {
  // Clear the actual file input
  excelFile.value = "";

  // Clear displayed info
  fileName.innerText = "";
  fileSize.innerText = "";

  // Reset UI
  selectedFile.style.display = "none";
  uploadEmptyState.style.display = "flex";
  reviewActionsBar.style.display = "none";
  // Clear stored data
  excelHeaders = [];
  importedProducts = [];

  // Optional: clear review table if user removes file after review
  validationBody.innerHTML = "";
  reviewSection.classList.remove("visible");
  setActiveSteps(1);
}

const REQUIRED_FIELDS = [
  "brand",
  "model",
  "storage",
  "color",
  "condition",
  "price",
  "stock",
  "category",
];

const COLUMN_ALIASES = {
  brand: ["brand", "manufacturer", "make"],
  model: ["model", "phone name", "device name", "name"],
  storage: ["storage", "memory", "capacity"],
  color: ["color", "colour"],
  condition: ["condition", "state"],
  price: ["price", "selling price", "cost"],
  stock: ["stock", "qty", "quantity"],
  category: ["category", "type", "product category"],
};

const DEFAULT_CATEGORY = "Accessory";

function readExcelFile() {
  const file = excelFile.files[0];
  const reader = new FileReader();

  parsingLoader.classList.add("visible");

  reader.onload = function (e) {
    const data = e.target.result;
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    parsingLoader.classList.remove("visible");

    if (jsonData.length === 0) {
      showToast("The selected file is empty", "error");
      return;
    }

    excelHeaders = Object.keys(jsonData[0]);

    const mapping = generateMapping(excelHeaders);
    const results = processExcelRows(jsonData, mapping);

    importedProducts = results;
    renderResultsTable(results);
    console.log("Mapping:", mapping);
    console.log("Row results:", results);
    updateCount();
    continueToImport();
    reviewActionsBar.style.display = "flex";
    setActiveSteps(2);
  };

  reader.onerror = function () {
    parsingLoader.classList.remove("visible");
    showToast(
      "Something went wrong reading that file. Please try again.",
      "error",
    );
  };

  reader.readAsArrayBuffer(file);
}

const VALID_EXCEL_EXTENSIONS = [".xlsx", ".xls"];

function isValidExcelFile(file) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return VALID_EXCEL_EXTENSIONS.some((ext) => name.endsWith(ext));
}

// dragenter/dragleave fire on every child element the pointer crosses
// (the icon, the instructions text, the button...), not just on
// uploadCard itself. Listening for those directly meant "leaving" a
// child briefly cleared the active state and made the animation
// flicker on and off while a file was still hovering the card. A
// counter fixes it: increment on enter, decrement on leave, only
// clear the state once the count returns to zero.
let dragCounter = 0;

uploadCard.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});

uploadCard.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  uploadCard.classList.remove("drag-invalid");
  uploadCard.classList.add("drag-active");
});

uploadCard.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) {
    uploadCard.classList.remove("drag-active");
  }
});

uploadCard.addEventListener("drop", (e) => {
  e.preventDefault();

  // The previous version never cleared this class here, so if a
  // person actually dropped a file (rather than dragging away) the
  // card was left permanently mid-animation.
  dragCounter = 0;
  uploadCard.classList.remove("drag-active");

  const file = e.dataTransfer.files && e.dataTransfer.files[0];

  if (!isValidExcelFile(file)) {
    uploadCard.classList.add("drag-invalid");
    showToast("Please drop a .xlsx or .xls file", "error");
    setTimeout(() => uploadCard.classList.remove("drag-invalid"), 450);
    return;
  }

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  excelFile.files = dataTransfer.files;

  uploadCard.classList.add("drop-success");
  setTimeout(() => uploadCard.classList.remove("drop-success"), 500);

  handleFileSelect();
});

// Safety net: if the file is dragged off the browser window entirely
// (or the OS cancels the drag), no dragleave ever reaches the card
// and it would otherwise stay stuck mid-animation.
window.addEventListener("dragend", () => {
  dragCounter = 0;
  uploadCard.classList.remove("drag-active");
});
function updateCount() {
  totalCount.textContent = `${importedProducts.length}`;
  const validCountLen = importedProducts.filter((p) => p.valid).length;
  const invalidCountLen = importedProducts.filter((p) => !p.valid).length;
  validCount.textContent = `${validCountLen}`;
  invalidCount.textContent = `${invalidCountLen}`;
}
validationBody.addEventListener("input", function (e) {
  if (!e.target.matches("input")) return;

  const index = e.target.dataset.index;
  const field = e.target.dataset.field;

  importedProducts[index].data[field] = e.target.value;
  e.target.title = e.target.value;
  revalidateRow(index);
});
function normalizeHeader(header) {
  return header.toLowerCase().trim().replace(/[_-]/g, " ");
}

function generateMapping(headers) {
  const mapping = {};

  for (const header of headers) {
    const cleanHeader = normalizeHeader(header);
    for (const field in COLUMN_ALIASES) {
      const aliases = COLUMN_ALIASES[field].map(normalizeHeader);
      if (aliases.includes(cleanHeader)) {
        mapping[field] = header;
      }
    }
  }

  return mapping;
}

function extractRowData(row, mapping) {
  const data = {};
  for (const field in mapping) {
    data[field] = row[mapping[field]];
  }
  return data;
}

function validateRow(data) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === "") {
      errors.push(`Missing ${field}`);
    }
  }

  if (data.price !== undefined && isNaN(parseFloat(data.price))) {
    errors.push("Price must be a number");
  }

  if (data.stock !== undefined && isNaN(parseInt(data.stock, 10))) {
    errors.push("Stock must be a whole number");
  }

  return errors;
}

function evaluateRow(data) {
  const rawSpecRow = findPhoneSpecs(data.brand, data.model);
  const category =
    rawSpecRow?.category || data.category?.trim() || DEFAULT_CATEGORY;
  const specifications = getSpecifications(rawSpecRow, category) || {};

  if (data.brand?.trim().toLowerCase() === "apple") {
    specifications.ram = null;
  }
  const errors = validateRow(data);
  const warnings = [];
  if (!rawSpecRow) {
    warnings.push("Specifications not found - will import without them");
  }

  return {
    category,
    specifications,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

function processExcelRows(jsonData, mapping) {
  return jsonData.map((row) => {
    const data = extractRowData(row, mapping);
    const { category, specifications, errors, warnings, valid } =
      evaluateRow(data);

    return {
      raw: row,
      data,
      category,
      specifications,
      valid,
      errors,
      warnings,
    };
  });
}

function fieldsWithIssues(errors) {
  const flagged = new Set();
  errors.forEach((err) => {
    const match = err.match(/^Missing (\w+)$/);
    if (match) flagged.add(match[1]);
    if (err === "Price must be a number") flagged.add("price");
    if (err === "Stock must be a whole number") flagged.add("stock");
  });
  return flagged;
}

function handleFileSelect() {
  const file = excelFile.files[0];

  if (!file) return;

  uploadEmptyState.style.display = "none";
  selectedFile.style.display = "flex";

  document.querySelector(".cards-stats").style.display = "flex";

  fileName.innerText = file.name;
  fileSize.innerText = `${Math.floor(file.size / 1024)} KB`;
  setActiveSteps(1);
}
function fieldCell(product, index, field, options = {}) {
  const flagged = fieldsWithIssues(product.errors);
  const invalidClass = flagged.has(field) ? " field-invalid" : "";
  const tdClass = options.numeric ? ' class="numeric"' : "";
  const value = product.data[field] || "";
  const escaped = String(value).replace(/"/g, "&quot;");

  return `
      <td${tdClass}>
        <input
          value="${escaped}"
          title="${escaped}"
          data-index="${index}"
          data-field="${field}"
          class="${invalidClass.trim()}"
        >
      </td>`;
}

function statusBadgeHtml(valid) {
  return `<span class="status-badge ${valid ? "valid" : "invalid"}"><i class="fa-solid fa-${valid ? "check" : "xmark"}"></i></span>`;
}

function issuesHtml(errors, warnings = []) {
  if (errors.length) {
    return `<i class="fa-solid fa-triangle-exclamation"></i>${errors.join(", ")}`;
  }
  if (warnings.length) {
    return `<i class="fa-solid fa-circle-info"></i>${warnings.join(", ")}`;
  }
  return `<span class="none"><i class="fa-solid fa-check"></i>No issues</span>`;
}

function buildRowElement(product, index) {
  const tr = document.createElement("tr");
  tr.dataset.index = `${index}`;
  tr.classList.toggle("row-invalid", !product.valid);
  tr.innerHTML = `
      <td>${statusBadgeHtml(product.valid)}</td>
      ${fieldCell(product, index, "brand")}
      ${fieldCell(product, index, "model")}
      ${fieldCell(product, index, "storage")}
      ${fieldCell(product, index, "color")}
      ${fieldCell(product, index, "condition")}
      ${fieldCell(product, index, "price", { numeric: true })}
      ${fieldCell(product, index, "stock", { numeric: true })}
      <td class="issues-cell">${issuesHtml(product.errors, product.warnings)}</td>
    `;
  return tr;
}

// Builds a single spacer <tr> that stands in for `rowCount` rows
// that aren't being rendered. colspan=9 matches your real columns
// so it doesn't distort table layout; height is rowCount * ROW_HEIGHT.
function buildSpacerRow(rowCount) {
  const tr = document.createElement("tr");
  tr.className = "spacer-row";
  const td = document.createElement("td");
  td.colSpan = 9;
  td.style.height = `${rowCount * ROW_HEIGHT}px`;
  td.style.padding = "0";
  td.style.border = "none";
  tr.appendChild(td);
  return tr;
}

// Renders only the rows visible in the scroll window (+ buffer),
// with two spacer rows standing in for everything above/below so
// the scrollbar's size/position stays correct.
function renderVisibleRows(startIndex) {
  const visibleRow = Math.ceil(scrollContainer.clientHeight / ROW_HEIGHT);

  const renderStart = Math.max(startIndex - BUFFER, 0);
  const renderEnd = Math.min(
    startIndex + visibleRow + BUFFER,
    importedProducts.length,
  );

  const sliceToRender = importedProducts.slice(renderStart, renderEnd);
  const rowElements = [];

  sliceToRender.forEach((product, sliceIndex) => {
    const realIndex = renderStart + sliceIndex;
    rowElements.push(buildRowElement(product, realIndex));
  });

  const fragment = document.createDocumentFragment();

  if (renderStart > 0) {
    fragment.appendChild(buildSpacerRow(renderStart));
  }

  rowElements.forEach((tr) => fragment.appendChild(tr));

  if (renderEnd < importedProducts.length) {
    fragment.appendChild(buildSpacerRow(importedProducts.length - renderEnd));
  }

  validationBody.innerHTML = "";
  validationBody.appendChild(fragment);
}

// Registered ONCE, at setup time - not inside renderVisibleRows,
// which would stack a new listener on every render.
scrollContainer.addEventListener("scroll", () => {
  const startIndex = Math.floor(scrollContainer.scrollTop / ROW_HEIGHT);
  renderVisibleRows(startIndex);
});

// Shrunk down to: reset scroll, kick off the first render. All the
// actual row-building now lives in renderVisibleRows/buildRowElement.
function renderResultsTable(results) {
  scrollContainer.scrollTop = 0;
  renderVisibleRows(0);
  reviewSection.classList.add("visible");
}

function validRows() {
  return importedProducts.filter((product) => product.valid);
}

// Re-runs validation for a single row after an edit and patches just
// that row's badge, flagged inputs, and issues text - no full
// re-render, so the input the person is typing in never loses focus.
function revalidateRow(index) {
  const product = importedProducts[index];
  const { category, specifications, errors, warnings, valid } = evaluateRow(
    product.data,
  );
  product.category = category;
  product.specifications = specifications;
  product.errors = errors;
  product.warnings = warnings;
  product.valid = valid;

  // Look up by data-index rather than DOM position - once virtualized,
  // the Nth child of validationBody is no longer necessarily
  // importedProducts[N]. If this row isn't currently mounted (scrolled
  // out of view), this returns null and we just bail - importedProducts
  // is already updated, so it'll render correctly next time it scrolls
  // into view.
  const tr = validationBody.querySelector(`tr[data-index="${index}"]`);
  if (!tr) return;

  tr.classList.toggle("row-invalid", !product.valid);

  const statusCell = tr.querySelector("td:first-child");
  statusCell.innerHTML = statusBadgeHtml(product.valid);

  const flagged = fieldsWithIssues(errors);
  tr.querySelectorAll("input[data-field]").forEach((input) => {
    input.classList.toggle("field-invalid", flagged.has(input.dataset.field));
  });

  tr.querySelector(".issues-cell").innerHTML = issuesHtml(errors, warnings);
  updateCount();
  continueToImport();
}
function setActiveSteps(stepNumber) {
  steps.forEach((step) => {
    const current = Number(step.dataset.step);
    step.classList.remove("active", "completed");
    if (current < stepNumber) {
      step.classList.add("completed");
    } else if (current === stepNumber) {
      step.classList.add("active");
    }
  });
}

function markAllStepsCompleted() {
  steps.forEach((step) => {
    step.classList.remove("active");
    step.classList.add("completed");
  });
}
function continueToImport() {
  const products = validRows();

  if (products.length === 0) {
    importBtn.innerHTML = `No Valid Products To Import <i class="fa-solid fa-xmark"></i>`;
    importBtn.style.backgroundColor = "#ef4444";
    importBtn.disabled = true;
  } else {
    importBtn.innerHTML = `Import ${products.length} Products <i class="fa-solid fa-arrow-right"></i>`;
    importBtn.style.backgroundColor = "";
    importBtn.disabled = false;
  }
}
importBtn.addEventListener("click", importProducts);

const IMPORTING_MESSAGES = [
  "Importing...",
  "Finishing things up...",
  "Setting it up for you...",
  "Almost there...",
];

function startImportingAnimation() {
  let i = 0;
  importBtn.disabled = true;
  importBtn.style.backgroundColor = "";
  importBtn.innerHTML = `${IMPORTING_MESSAGES[i]} <i class="fa-solid fa-spinner fa-spin"></i>`;

  const intervalId = setInterval(() => {
    i = (i + 1) % IMPORTING_MESSAGES.length;
    importBtn.innerHTML = `${IMPORTING_MESSAGES[i]} <i class="fa-solid fa-spinner fa-spin"></i>`;
  }, 1500);

  return () => clearInterval(intervalId);
}

async function importProducts() {
  setActiveSteps(3);
  const stockMode =
    document.querySelector('input[name="stock-mode"]:checked')?.value ||
    "replace";

  const products = validRows().map((product) => ({
    model: product.data.model,
    brand: product.data.brand,
    category: product.category,
    storage: product.data.storage,
    color: product.data.color,
    condition: product.data.condition,
    price: product.data.price,
    stock: product.data.stock,
    specifications: product.specifications,
  }));

  const stopAnimation = startImportingAnimation();

  try {
    const response = await fetch(`${API_BASE}/import`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ products, stockMode }),
    });

    const data = await response.json();

    stopAnimation();

    if (!response.ok) {
      importBtn.disabled = false;
      importBtn.innerHTML = `Import ${products.length} Products <i class="fa-solid fa-arrow-right"></i>`;
      showToast(data.error || "Import failed", "error");
      return;
    }

    console.log(data);

    showToast(
      `Imported ${data.imported} product${data.imported !== 1 ? "s" : ""}!`,
      "success",
    );

    importBtn.innerHTML = `Imported <i class="fa-solid fa-check"></i>`;

    markAllStepsCompleted();
  } catch (err) {
    stopAnimation();
    importBtn.disabled = false;
    importBtn.innerHTML = `Import ${products.length} Products <i class="fa-solid fa-arrow-right"></i>`;
    console.error(err);
    showToast("Could not reach the server.", "error");
  }
}

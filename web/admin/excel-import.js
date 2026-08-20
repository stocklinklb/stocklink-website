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

const continueBtn = document.getElementById("continue-btn");
const removeFileBtn = document.getElementById("remove-file");
const backBtn = document.getElementById("back-btn");
const importBtn = document.getElementById("import-btn");
const parsingLoader = document.getElementById("parsing-loader");
const steps = document.querySelectorAll(".step");
let excelHeaders = [];
let importedProducts = [];
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
  // NEW: lets a sheet supply its own category when there's no specs-CSV
  // match (accessories, non-phone items). Not in REQUIRED_FIELDS - it's
  // optional on the sheet because evaluateRow() falls back to
  // DEFAULT_CATEGORY when nobody provides one.
  category: ["category", "type", "product category"],
};

// Used whenever a row has no specs-CSV match (findPhoneSpecs returns
// undefined) AND the sheet didn't supply its own Category column.
// Keeps `category` from ever reaching the backend as undefined, which
// Prisma's `product.create()` rejects with "Argument `category` is
// missing."
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
    // next step: render `results` into your pass/fail table
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

// fixed: was using undefined `headers`, now uses the actual parameter
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

// Runs both checks a row needs: field validation (required fields,
// price/stock format) AND the specs lookup against the master specs CSV.
// These are kept SEPARATE on purpose:
//   - `errors` are blocking - brand/model/storage/color/condition/price/
//     stock are things the row literally cannot be imported without.
//   - `warnings` are non-blocking - missing specs means the product will
//     just import with empty `specifications` (fillable later, same idea
//     as the missing-photos workflow) instead of being silently dropped
//     from the import entirely.
// `valid` is based on `errors` only, so a product with no specs match
// still shows up as importable.
function evaluateRow(data) {
  // findPhoneSpecs() returns the raw CSV row (or undefined) - it uses
  // CSV column names like `cpu`, `screen_size`, etc. That's not the
  // shape the backend/product object expects. getSpecifications()
  // (from specsAutoFill.js) runs that raw row through SPEC_FIELD_MAPS
  // to produce the proper {processor, ram, screenSize, ...} shape,
  // the same field names the Manual Add Product page uses. Falls back
  // to {} rather than undefined so downstream code can always safely
  // spread/access it.
  const rawSpecRow = findPhoneSpecs(data.brand, data.model);
  // Priority: specs-CSV match > sheet's own Category column > default.
  // Previously this was just `rawSpecRow?.category`, which left
  // `category` undefined for any product not found in the phone specs
  // CSV - Prisma then rejects the create() call outright.
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

// Fields a given error message points at, so the exact input can be
// flagged instead of just the row
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

function renderResultsTable(results) {
  validationBody.innerHTML = "";

  results.forEach((product, index) => {
    const tr = document.createElement("tr");
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

    validationBody.appendChild(tr);
  });

  reviewSection.classList.add("visible");
}
function validRows() {
  return importedProducts.filter((product) => product.valid);
}

// Re-runs validation for a single row after an edit and patches just
// that row's badge, flagged inputs, and issues text — no full
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

  const tr = validationBody.children[index];
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

// Marks every step (Upload, Review, Import) as completed/green. Only
// called after a successful import response - a failed import should
// leave Import as "active" (still pending), not green, since the work
// isn't actually done.
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

// Cycles the import button's label through a sequence of messages while
// the import request is in flight, so it doesn't look frozen on long
// imports. Cleared as soon as the fetch settles (success or failure).
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

// Sends one flat object per valid row - the backend groups rows by
// brand+model into a single Product (creating it fresh, or appending new
// colors/variants/optionSchema entries to an existing one), so no
// grouping is needed on this end.
//
// `stockMode` comes from the radio group next to the Import button:
// "replace" (default) overwrites a matched variant's stock with the
// imported number; "add" adds the imported number on top of whatever
// stock that variant already has. Only affects rows that match an
// existing variant - brand-new variants always just start at the
// imported stock regardless of this setting.
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

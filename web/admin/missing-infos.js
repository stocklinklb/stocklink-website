const productImage = new Map();
let currentProductId = null;
const modifiedProducts = new Map();
// Tracks every blob URL currently shown in the modal so we can
// revoke them all when the modal is closed/re-rendered, instead of
// leaking a URL every time openImageModal runs.
let modalObjectUrls = [];
const saveAllBtn = document.getElementById("save-all-btn");
const imageModal = document.querySelector("#image-modal");
const closeModal = document.querySelector(".close-modal");
const modalImages = document.querySelector(".modal-images");
const modalProductName = document.querySelector(".modal-product-name");

// Holds the in-flight bulk-upload xhr so the Cancel button can abort
// it. Also tracks when the upload started (for the ETA display) and
// the per-file byte manifest built in saveAllProducts, used to
// approximate "current file" / "N of M images" from the aggregate
// byte progress a single multipart POST gives us.
let activeUploadXhr = null;
let uploadStartTime = null;
let uploadFileManifest = [];

let draggedImageLocalId = null;
function makeLocalId() {
  return crypto.randomUUID();
}
document.addEventListener("pointerdown", (e) => {
  const draggedElement = e.target.closest(".modal-image");

  if (!draggedElement) return;

  // Don't start dragging when clicking the delete button
  if (e.target.closest(".delete-image")) return;

  // Prevent the native HTML5 image drag from hijacking this gesture -
  // without this, the browser starts dragging the <img> itself as soon
  // as the pointer moves, which cancels our pointermove/pointerup
  // sequence before the reorder logic below ever runs.
  e.preventDefault();

  draggedImageLocalId = draggedElement.dataset.localId;

  draggedElement.setPointerCapture?.(e.pointerId);
  draggedElement.classList.add("dragging");
});

document.addEventListener("pointermove", (e) => {
  if (!draggedImageLocalId) return;

  const cardUnderPointer = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".modal-image");

  // Clear any previous drop-target highlight before deciding the new one.
  document
    .querySelectorAll(".modal-image.drag-over")
    .forEach((el) => el.classList.remove("drag-over"));

  if (!cardUnderPointer) return;

  if (cardUnderPointer.dataset.localId === draggedImageLocalId) return;

  // Simple visual feedback while dragging - highlight the card
  // currently under the pointer as the prospective drop target.
  cardUnderPointer.classList.add("drag-over");
});

document.addEventListener("pointerup", (e) => {
  if (!draggedImageLocalId) return;

  const draggedElement = document.querySelector(
    `.modal-image[data-local-id="${draggedImageLocalId}"]`,
  );

  draggedElement?.classList.remove("dragging");
  document
    .querySelectorAll(".modal-image.drag-over")
    .forEach((el) => el.classList.remove("drag-over"));

  const targetElement = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".modal-image");

  if (!draggedElement || !targetElement) {
    draggedImageLocalId = null;
    return;
  }

  const targetLocalId = targetElement.dataset.localId;

  if (targetLocalId === draggedImageLocalId) {
    draggedImageLocalId = null;
    return;
  }

  const files = productImage.get(currentProductId);

  if (!files) {
    draggedImageLocalId = null;
    return;
  }

  const fromIndex = files.findIndex(
    (image) => image.localId === draggedImageLocalId,
  );

  const toIndex = files.findIndex((image) => image.localId === targetLocalId);

  if (fromIndex === -1 || toIndex === -1) {
    draggedImageLocalId = null;
    return;
  }

  // Remove dragged image
  const [draggedImage] = files.splice(fromIndex, 1);

  // toIndex was computed against the array *before* the removal above.
  // When moving forward (fromIndex < toIndex), everything after
  // fromIndex has now shifted left by one, so we need to insert one
  // slot earlier than toIndex or the item lands one position too far
  // right. Moving backward isn't affected, since indices before
  // fromIndex are untouched by the splice.
  const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;

  // Insert it at the corrected target position
  files.splice(insertIndex, 0, draggedImage);

  // Save reordered array
  productImage.set(currentProductId, files);

  // Mark product as modified
  const card = document.querySelector(
    `.card[data-product-id="${currentProductId}"]`,
  );

  modifiedProducts.set(currentProductId, {
    colorId: card.dataset.colorId,
    files,
  });

  syncSaveAllBtn();

  // Re-render modal
  openImageModal(currentProductId);

  // Re-render card preview
  displayImages(card, files);

  draggedImageLocalId = null;
});

function formatEta(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "Calculating...";
  if (seconds < 1) return "Almost done...";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s left`;
}

const UploadManager = {
  modal: document.querySelector(".upload-modal-overlay"),
  fill: document.querySelector(".progress-fill"),
  percent: document.querySelector(".progress-percent"),
  data: document.querySelector(".progress-files"),
  status: document.querySelector(".upload-status"),
  currentFile: document.querySelector(".current-file"),
  time: document.querySelector(".upload-time"),
  cancelBtn: document.querySelector(".upload-cancel"),
  closeBtn: document.querySelector(".upload-close"),

  open() {
    // Reset everything - otherwise a retry after a previous
    // error/cancel briefly shows the last run's stale text/percent
    // before the first progress event of the new run arrives.
    this.status.textContent = "Preparing upload...";
    this.currentFile.textContent = "Waiting...";
    this.time.textContent = "Calculating...";
    this.update(0, 0, 0);
    this.closeBtn.classList.add("hidden");
    this.cancelBtn.disabled = false;
    this.cancelBtn.textContent = "Cancel";
    this.modal.classList.remove("closing");
    this.modal.classList.remove("hidden");
  },

  // Fades the modal out instead of snapping straight to display:none,
  // so success/error/cancel all get a moment to actually be read
  // before the modal is gone.
  close() {
    this.modal.classList.add("closing");
    setTimeout(() => {
      this.modal.classList.add("hidden");
      this.modal.classList.remove("closing");
    }, 300);
  },

  update(percent, uploaded, total) {
    this.fill.style.width = `${percent}%`;
    this.percent.textContent = `${percent}%`;

    const uploadedMB = (uploaded / 1024 / 1024).toFixed(1);
    const totalMb = (total / 1024 / 1024).toFixed(1);

    this.data.textContent = `${uploadedMB} MB / ${totalMb} MB`;
  },

  // Approximates which file is "currently" uploading and how many
  // are done, from the aggregate bytes-sent figure the browser gives
  // us for the whole multipart request. Not exact (multipart
  // boundaries/headers add a little overhead per file), but close
  // enough to be useful since there's no true per-file progress event
  // for a single bulk POST.
  updateFileProgress(loadedBytes, totalBytes) {
    if (!uploadFileManifest.length || !totalBytes) return;

    const fraction = loadedBytes / totalBytes;
    const approxBytesSent = fraction * uploadFileManifest.totalSize;

    let doneCount = 0;
    let currentName = uploadFileManifest[uploadFileManifest.length - 1].name;

    for (const entry of uploadFileManifest) {
      if (approxBytesSent >= entry.end) {
        doneCount++;
      } else {
        currentName = entry.name;
        break;
      }
    }

    const total = uploadFileManifest.length;
    this.currentFile.textContent =
      doneCount >= total ? "Finalizing..." : currentName;
    this.data.textContent = `${Math.min(doneCount, total)} / ${total} images`;
  },

  updateEta(loadedBytes, totalBytes) {
    const elapsedSeconds = (Date.now() - uploadStartTime) / 1000;
    if (elapsedSeconds <= 0 || loadedBytes <= 0) {
      this.time.textContent = "Calculating...";
      return;
    }
    const rate = loadedBytes / elapsedSeconds; // bytes/sec
    const remainingBytes = totalBytes - loadedBytes;
    this.time.textContent = formatEta(remainingBytes / rate);
  },

  complete() {
    this.status.textContent = "Upload completed";
    this.currentFile.textContent = "Done";
    this.time.textContent = "Finished";
    this.cancelBtn.disabled = true;
    this.fill.style.width = "100%";
    this.percent.textContent = "100%";
    const total = uploadFileManifest.length || 0;
    this.data.textContent = `${total} / ${total} images`;

    setTimeout(() => {
      this.close();
    }, 1800);
  },

  error() {
    this.status.textContent = "Upload failed";
    this.time.textContent = "--";
    this.cancelBtn.disabled = true;
    // Auto-hide only happens on success, so without this the modal
    // would otherwise stay stuck on screen forever with no way to
    // dismiss it after a failure.
    this.closeBtn.classList.remove("hidden");
  },

  cancelled() {
    this.status.textContent = "Upload cancelled";
    this.time.textContent = "--";
    this.cancelBtn.disabled = true;
    this.closeBtn.classList.remove("hidden");
  },
};

UploadManager.cancelBtn.addEventListener("click", () => {
  if (activeUploadXhr) {
    activeUploadXhr.abort();
  }
});

UploadManager.closeBtn.addEventListener("click", () => {
  UploadManager.close();
});

saveAllBtn.addEventListener("click", saveAllProducts);
closeModal.addEventListener("click", () => {
  imageModal.classList.add("hidden");
  revokeModalObjectUrls();
});
function markProductChanged(productId, data) {
  modifiedProducts.set(productId, data);
  syncSaveAllBtn();
}
// Keeps the "Save All" button's disabled state in sync with whether
// there's anything to save - single source of truth so we don't have
// to remember to toggle it manually at every call site that mutates
// modifiedProducts.
function syncSaveAllBtn() {
  saveAllBtn.disabled = modifiedProducts.size === 0;
}
async function getMissingProducts() {
  try {
    const response = await fetch(`${API_BASE}/missing-images`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch missing products");
    }
    const products = await response.json();
    return products;
  } catch (error) {
    console.error(error);
  }
}
// Shared by both the bulk "Save All" upload and a single card's "Save"
// upload - drives the same progress modal either way. Relies on
// uploadFileManifest being populated by the caller beforehand so
// UploadManager.updateFileProgress() has something to estimate
// "current file" / "N of M images" from.
function uploadImagesXhr(url, formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    activeUploadXhr = xhr;
    uploadStartTime = Date.now();

    xhr.open("POST", url);

    // Same as credentials: "include" in fetch
    xhr.withCredentials = true;

    // Upload progress
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      const percent = Math.round((event.loaded / event.total) * 100);

      UploadManager.update(percent, event.loaded, event.total);
      UploadManager.updateFileProgress(event.loaded, event.total);
      UploadManager.updateEta(event.loaded, event.total);
      UploadManager.status.textContent = "Uploading...";
    };

    // Finished successfully
    xhr.onload = () => {
      activeUploadXhr = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        // Not every endpoint returns a JSON body (the single-product
        // route may respond with an empty 200) - only parse when
        // there's actually something to parse.
        const data = xhr.responseText ? JSON.parse(xhr.responseText) : null;

        resolve(data);
      } else {
        reject(new Error("Upload failed"));
      }
    };

    // Network error
    xhr.onerror = () => {
      activeUploadXhr = null;
      reject(new Error("Network error"));
    };

    // User clicked Cancel - distinct from a network error so the
    // caller can show "cancelled" rather than "failed".
    xhr.onabort = () => {
      activeUploadXhr = null;
      reject(new Error("Upload cancelled"));
    };

    xhr.send(formData);
  });
}

function uploadProductImages(formData) {
  return uploadImagesXhr(`${API_ROOT}/upload/product-images/bulk`, formData);
}

// Builds the cumulative byte-boundary manifest uploadImagesXhr's progress
// handler reads from (see UploadManager.updateFileProgress) - same shape
// whether it's backing the bulk "Save All" upload or a single card's
// "Save" upload.
function buildFileManifest(files) {
  const manifest = [];
  let runningSize = 0;

  files.forEach((file) => {
    runningSize += file.size;
    manifest.push({ name: file.name, end: runningSize });
  });

  manifest.totalSize = runningSize;
  return manifest;
}
async function saveAllProducts() {
  if (modifiedProducts.size === 0) {
    showToast("No products to save", "error");
    return;
  }

  const formData = new FormData();
  const products = [];
  // Order matters: this flat list must match the exact order files are
  // appended to formData below, so the manifest's byte boundaries line
  // up with what the browser actually reports uploading.
  const allFiles = [];
  for (const [productId, product] of modifiedProducts) {
    products.push({
      productId,
      colorId: product.colorId,
    });
    product.files.forEach((image) => {
      formData.append(`product_${productId}`, image.file);
      allFiles.push(image.file);
    });
  }
  formData.append("products", JSON.stringify(products));
  uploadFileManifest = buildFileManifest(allFiles);

  saveAllBtn.disabled = true;

  try {
    UploadManager.open();
    const { results, errors } = await uploadProductImages(formData);
    UploadManager.complete();

    // Only clear out products the server actually saved - a product
    // that failed (bad colorId, upload error, etc.) stays in
    // modifiedProducts and on screen so the admin can retry it,
    // instead of silently disappearing along with the successful ones.
    (results || []).forEach(({ productId }) => {
      productImage.delete(productId);
      modifiedProducts.delete(productId);
      const card = document.querySelector(
        `.card[data-product-id="${productId}"]`,
      );
      removeCardAnimated(card);
    });

    if (errors && errors.length > 0) {
      showToast(
        `${results.length} saved, ${errors.length} failed - see console`,
        "error",
      );
      console.error("Bulk upload errors:", errors);
    } else {
      showToast("Images uploaded successfully", "success");
    }
  } catch (err) {
    if (err.message === "Upload cancelled") {
      UploadManager.cancelled();
      showToast("Upload cancelled", "error");
    } else {
      UploadManager.error();
      showToast("Something went wrong", "error");
    }
  } finally {
    uploadFileManifest = [];
    syncSaveAllBtn();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const products = await getMissingProducts();

  renderMissingProducts(products);
  syncSaveAllBtn();
});

function revokeModalObjectUrls() {
  modalObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  modalObjectUrls = [];
}

// Fades a saved card out and collapses its space, instead of a hard
// instant card.remove() that made products vanish with no
// confirmation the save actually happened.
function removeCardAnimated(card) {
  if (!card) return;

  const startHeight = card.getBoundingClientRect().height;

  card.style.overflow = "hidden";
  card.style.height = `${startHeight}px`;
  // Force layout so the browser registers the explicit starting
  // height before we transition it - otherwise the height/margin
  // change below would jump instantly instead of animating.
  card.offsetHeight;

  card.style.transition =
    "opacity 0.25s ease, transform 0.25s ease, height 0.3s ease 0.15s, margin 0.3s ease 0.15s, padding 0.3s ease 0.15s";
  card.style.opacity = "0";
  card.style.transform = "scale(0.96)";

  requestAnimationFrame(() => {
    card.style.height = "0px";
    card.style.marginTop = "0px";
    card.style.marginBottom = "0px";
    card.style.paddingTop = "0px";
    card.style.paddingBottom = "0px";
  });

  card.addEventListener("transitionend", () => card.remove(), {
    once: true,
  });

  // Safety net - if a transitionend never fires (e.g. the card was
  // already removed some other way, or a browser quirk), don't leave
  // a saved card stuck on screen forever.
  setTimeout(() => card.remove(), 700);
}

// Restores a card's preview to its initial empty state. Used when
// the last image for a product is deleted from the modal.
function resetCardPreview(card) {
  const preview = card.querySelector(".image-preview");
  const badge = card.querySelector(".image-count-badge");

  const previousUrl = preview.dataset.objectUrl;
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
    delete preview.dataset.objectUrl;
  }

  preview.querySelector(".main-image")?.remove();
  preview.classList.remove("has-image");
  preview.classList.add("empty");

  badge.classList.add("hidden");
  badge.textContent = "";

  if (!preview.querySelector(".upload-placeholder")) {
    const placeholder = document.createElement("div");
    placeholder.className = "upload-placeholder";
    placeholder.innerHTML = `
      <i class="fa-solid fa-camera"></i>
      <span>Add photo</span>
    `;
    preview.insertBefore(placeholder, preview.firstChild);
  }
}

// Updates the preview in place instead of nuking .image-preview's
// innerHTML — that used to destroy the hidden <input> living inside
// the same <label>, which silently broke "click again to replace
// the photo" after the first upload.
function displayImages(card, files) {
  const preview = card.querySelector(".image-preview");
  const badge = card.querySelector(".image-count-badge");
  const placeholder = card.querySelector(".upload-placeholder");

  // Revoke the previous object URL before creating a new one, so
  // replacing a photo repeatedly doesn't leak a blob each time.
  const previousUrl = preview.dataset.objectUrl;
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }

  const imageURL = URL.createObjectURL(files[0].file);
  preview.dataset.objectUrl = imageURL;

  preview.classList.remove("empty");
  preview.classList.add("has-image");

  // Only ever remove the dashed placeholder once; on a later
  // replace, it's already gone.
  placeholder?.remove();

  // Swap out just the previous main-image, if replacing a photo,
  // rather than any of the label's other children (badge, input).
  preview.querySelector(".main-image")?.remove();

  const mainImage = document.createElement("div");
  mainImage.className = "main-image";
  mainImage.innerHTML = `<img src="${imageURL}" alt="">`;
  preview.insertBefore(mainImage, badge);

  if (files.length > 1) {
    badge.textContent = `+${files.length - 1} more`;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function openImageModal(productId) {
  currentProductId = productId;

  const files = productImage.get(productId);

  if (!files || files.length === 0) {
    showToast("No images are selected", "error");
    imageModal.classList.add("hidden");
    revokeModalObjectUrls();
    return;
  }

  revokeModalObjectUrls();
  modalImages.innerHTML = "";

  files.forEach((image, index) => {
    const url = URL.createObjectURL(image.file);
    modalObjectUrls.push(url);

    const imageCard = document.createElement("div");
    imageCard.className = "modal-image";
    imageCard.dataset.localId = image.localId;
    imageCard.innerHTML = `
      <img src="${url}" alt="" draggable="false">
      <button class="delete-image" data-index="${index}">
          X
        </button>
    `;
    modalImages.appendChild(imageCard);
  });

  imageModal.classList.remove("hidden");
}

modalImages.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".delete-image");

  if (!deleteBtn) return;

  const index = Number(deleteBtn.dataset.index);

  const files = productImage.get(currentProductId);

  // BUGFIX: `card` must be looked up before it's used below (it was
  // previously referenced in modifiedProducts.set(...) before its
  // own declaration, which threw a ReferenceError on every delete).
  const card = document.querySelector(
    `.card[data-product-id="${currentProductId}"]`,
  );

  files.splice(index, 1);

  if (files.length === 0) {
    // Nothing left to show — close the modal and reset the card
    // instead of re-opening a modal with an empty image list.
    imageModal.classList.add("hidden");
    revokeModalObjectUrls();
    resetCardPreview(card);

    // BUGFIX: clear stale map entries so an emptied-out product
    // doesn't get resubmitted with zero files via "Save All".
    productImage.delete(currentProductId);
    modifiedProducts.delete(currentProductId);
    syncSaveAllBtn();
  } else {
    productImage.set(currentProductId, files);
    modifiedProducts.set(currentProductId, {
      colorId: card.dataset.colorId,
      files,
    });

    openImageModal(currentProductId);
    displayImages(card, files);
  }
});

function renderMissingProducts(products) {
  const container = document.querySelector(".products-container");
  const heroSection = document.querySelector(".hero-products");

  container.innerHTML = "";

  if (!products || products.length === 0) {
    container.classList.add("is-empty");
    heroSection?.classList.add("hidden");
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h2>All caught up</h2>
        <p>Every product has its images. New listings missing photos will show up here.</p>
      </div>
    `;
    return;
  }

  container.classList.remove("is-empty");
  heroSection?.classList.remove("hidden");

  products.forEach((product) => {
    const card = document.createElement("div");

    card.className = "card";
    card.dataset.productId = product.id;
    card.dataset.colorId = product.colors[0]?.id ?? "";

    card.innerHTML = `
      <div class="simple-info-high">
        <div class="typed-info">
          <h3 class="high-title">${product.name}</h3>
          <p class="variant">
           ${product.brand} • ${product.colors[0]?.name || "No color"}
          </p>
        </div>

        <div class="button">
          <button class="update-btn">
            Add Images
          </button>
        </div>
      </div>

      <label class="image-preview empty">
        <div class="upload-placeholder">
          <i class="fa-solid fa-camera"></i>
          <span>Add photo</span>
        </div>
        <span class="image-count-badge hidden"></span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
        />
      </label>
      <div class = "card-button-actions">
        <button class="view">View Images</button>
        <button class="save">Save</button>
      </div>
    `;

    const input = card.querySelector("input[type='file']");
    const addImagesBtn = card.querySelector(".update-btn");
    addImagesBtn.addEventListener("click", () => {
      input.click();
    });
    input.addEventListener("change", (event) => {
      const newFiles = Array.from(event.target.files).map((file) => ({
        localId: makeLocalId(),
        file,
      }));
      if (newFiles.length === 0) return;

      const productId = card.dataset.productId;

      const existingFiles = productImage.get(productId) || [];
      const allFiles = [...existingFiles, ...newFiles];

      productImage.set(productId, allFiles);
      markProductChanged(productId, {
        colorId: card.dataset.colorId,
        files: allFiles,
      });

      displayImages(card, allFiles);

      input.value = "";
    });
    const viewBtn = card.querySelector(".view");
    const saveBtn = card.querySelector(".save");

    viewBtn.addEventListener("click", () => {
      const productId = card.dataset.productId;
      openImageModal(productId);
      console.log("Viewing product:", productId);
    });

    saveBtn.addEventListener("click", async () => {
      const productId = card.dataset.productId;
      const colorId = card.dataset.colorId;
      const files = productImage.get(productId);
      if (!files || files.length === 0) {
        showToast("please select one file or more", "error");
        return;
      }
      const formData = new FormData();

      formData.append("productId", productId);

      files.forEach((image) => {
        formData.append("images", image.file);
      });

      // Same progress modal + manifest the bulk "Save All" upload uses -
      // uploadImagesXhr's progress handler reads uploadFileManifest
      // regardless of which endpoint it's posting to.
      uploadFileManifest = buildFileManifest(files.map((image) => image.file));
      saveBtn.disabled = true;

      try {
        UploadManager.open();
        await uploadImagesXhr(
          `${API_ROOT}/upload/product-images/${colorId}`,
          formData,
        );
        UploadManager.complete();

        showToast("Images Uploaded succesfully", "success");
        productImage.delete(productId);
        // BUGFIX: also drop it from modifiedProducts, otherwise a
        // later "Save All" click resubmits this already-saved product.
        modifiedProducts.delete(productId);
        syncSaveAllBtn();
        removeCardAnimated(card);
      } catch (err) {
        if (err.message === "Upload cancelled") {
          UploadManager.cancelled();
          showToast("Upload cancelled", "error");
        } else {
          UploadManager.error();
          showToast("Something went wrong", "error");
        }
      } finally {
        uploadFileManifest = [];
        saveBtn.disabled = false;
      }
    });

    container.appendChild(card);
  });
}

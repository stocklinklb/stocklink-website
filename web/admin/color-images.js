// =========================================================
// PRODUCT COLOR IMAGES
// =========================================================
// Renders one upload box per selected color, handles picking/previewing
// files, marking a cover image, removing images, and syncing all of that
// with the server (existing images on load, new files on save).
//
// Depends on: state.js (colorImages, deletedImages), dom.js
// (colorImagesContainer), utils.js (escapeHtml, makeLocalId),
// color-picker.js (getColorHex), upload-progress.js (showUploadProgress,
// updateUploadProgress, completeUploadProgress, errorUploadProgress).
let draggedImageLocalId = null;
document.addEventListener("pointerdown", (e) => {
  const draggedElement = e.target.closest(".image-card");
  if (!draggedElement) return;
  draggedImageLocalId = draggedElement?.dataset.localId;
  draggedElement.setPointerCapture(e.pointerId);
});
document.addEventListener("pointermove", (e) => {
  if(!draggedImageLocalId) return;

  const cardUnderPointer = document.elementFromPoint(e.clientX, e.clientY)?.closest(".image-card");
  if (!cardUnderPointer) return;
  if(cardUnderPointer.dataset.localId === draggedImageLocalId) return;
});

document.addEventListener("pointerup", (e) => {
  if (!draggedImageLocalId) return;

  const cardUnderPointer = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".image-card");

  if (!cardUnderPointer) {
    draggedImageLocalId = null;
    return;
  }

  const color = cardUnderPointer.dataset.color;
  const cardLocalId = cardUnderPointer.dataset.localId;

  const images = colorImages[color];
  if (!images) {
    draggedImageLocalId = null;
    return;
  }

  const draggedIndex = images.findIndex(
    (image) => image.localId === draggedImageLocalId,
  );
  const dropIndex = images.findIndex((image) => image.localId === cardLocalId);

  if (draggedIndex !== -1 && dropIndex !== -1) {
    const [movedImage] = images.splice(draggedIndex, 1);
    images.splice(dropIndex, 0, movedImage);
    renderSelectedImages(color);
  }

  draggedImageLocalId = null;
});


function saveImageOrder(color) {
  const colorImage = colorImages[color];
  colorImage.forEach((image, index) => {
    if (!image.existing) return;

    fetch(
      `${API_BASE.replace("/products", "")}/upload/product-images/${image.id}/order`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: index }),
        credentials: "include",
      },
    ).catch((err) => {
      console.error("Failed to save image order:", err);
      showToast("Could not save image order", "error");
    });
  });
}
function renderColorImageUpload(colors) {
  if (!colorImagesContainer) return;

  // remove colors that are no longer selected
  [...colorImagesContainer.children].forEach((box) => {
    const color = box.dataset.colorBox;

    if (!colors.some((c) => c.name === color)) {
      delete colorImages[color];
      box.remove();
    }
  });

  // create missing colors only
  colors.forEach((color) => {
    const existing = colorImagesContainer.querySelector(
      `[data-color-box="${color.name}"]`,
    );

    if (existing) return;

    colorImages[color.name] ??= [];

    const box = document.createElement("div");

    box.className = "color-image-box";

    box.dataset.colorBox = color.name;
    const hex = getColorHex(color.name);
    box.innerHTML = `

<h4>
  <span 
    class="color-dot-preview" 
    style="background:${getColorHex(color.name)}">
  </span>

  ${escapeHtml(color.name)}
</h4>

<label class="file-upload-btn">

  Choose Images

  <input
    type="file"
    multiple
    accept="image/*"
    class="color-image-input"
    data-color="${escapeHtml(color.name)}"
  >

</label>

<div class="selected-images"></div>

`;

    colorImagesContainer.appendChild(box);
  });

  // restore previews
  // BUG FIX: this was passing the whole `color` object ({id, name}) into
  // renderSelectedImages(), which builds a selector like
  // `[data-color-box="${color}"]` expecting a plain string. An object
  // stringifies to "[object Object]", so the selector matched nothing and
  // previously uploaded photos silently never rendered.
  colors.forEach((color) => {
    renderSelectedImages(color.name);
  });
}

const COMPRESSION_THRESHOLD_BYTES = 1024 * 1024; // 1MB

// Files this size or under are already small enough that running them
// through sharp on the server is fast and the client-side compression
// pass would only add latency (and CPU) for no real size benefit -
// skip compression entirely rather than compressing everything blindly.
//
// Files above the threshold are compressed with a live progress callback
// (imageCompression's onProgress reports 0-100) so renderSelectedImages()
// can show a per-image compression bar instead of the picker just
// appearing to hang while a big photo is processed.
async function compressImageFile(file, onProgress) {
  if (file.size <= COMPRESSION_THRESHOLD_BYTES) return file;
  if (typeof imageCompression !== "function") return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      onProgress: (percent) => onProgress?.(percent),
    });

    // browser-image-compression returns a Blob without the original
    // filename - rewrap as a File so renderSelectedImages()'s
    // "${image.file.name}" label and the FormData entry sent to the
    // server both still carry the right name.
    return new File([compressed], file.name, {
      type: compressed.type || file.type,
    });
  } catch (err) {
    console.warn("Client-side compression failed, using original file:", err);
    return file;
  }
}

// Compressions in flight, keyed by their own promise. uploadColorImages()
// awaits this set before building FormData, so clicking Save while a big
// photo is still compressing waits for it instead of uploading a
// half-finished/null file.
const pendingCompressions = new Set();

document.addEventListener("change", (e) => {
  if (!e.target.classList.contains("color-image-input")) return;

  const color = e.target.dataset.color;

  const files = Array.from(e.target.files);

  if (!colorImages[color]) {
    colorImages[color] = [];
  }

  // Push entries and render immediately (synchronously) rather than
  // awaiting compression first - small/skipped files show right away,
  // and large ones show their preview + a progress bar instead of the
  // whole picker appearing frozen until every file finishes compressing.
  files.forEach((file) => {
    const isFirstImageForColor = colorImages[color].length === 0;
    const needsCompression = file.size > COMPRESSION_THRESHOLD_BYTES;

    const entry = {
      localId: makeLocalId(),
      // Below the threshold: use the file as-is, nothing to wait on.
      // Above it: file starts null and is filled in once compression
      // resolves - rawFile is what the preview renders from meanwhile.
      file: needsCompression ? null : file,
      rawFile: needsCompression ? file : null,
      existing: false,
      isCover: isFirstImageForColor,
      compressing: needsCompression,
      compressProgress: 0,
    };

    colorImages[color].push(entry);

    if (needsCompression) {
      const job = compressImageFile(file, (percent) => {
        entry.compressProgress = percent;
        renderSelectedImages(color);
      }).then((compressedFile) => {
        // Drop the raw-file preview blob once the real one is ready, so
        // a 20MB original isn't held in memory for the rest of the
        // session just because it was used for an early preview.
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
          entry.previewUrl = null;
        }
        entry.file = compressedFile;
        entry.rawFile = null;
        entry.compressing = false;
        renderSelectedImages(color);
      });

      pendingCompressions.add(job);
      job.finally(() => pendingCompressions.delete(job));
    }
  });

  renderSelectedImages(color);
});

let compressUiStyleInjected = false;
function ensureCompressUiStyle() {
  if (compressUiStyleInjected) return;
  compressUiStyleInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .image-card { position: relative; }
    .compress-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: rgba(17, 24, 39, 0.55);
      border-radius: inherit;
      padding: 10px;
    }
    .compress-bar-bg {
      width: 80%;
      height: 5px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.3);
      overflow: hidden;
    }
    .compress-bar {
      height: 100%;
      background: #fff;
      transition: width 0.15s ease;
    }
    .compress-label {
      font-size: 11px;
      color: #fff;
      font-family: "Inter", sans-serif;
    }
  `;
  document.head.appendChild(style);
}

function renderSelectedImages(color) {
  ensureCompressUiStyle();

  const box = document.querySelector(`[data-color-box="${color}"]`);

  if (!box) return;

  const container = box.querySelector(".selected-images");

  container.innerHTML = "";

  colorImages[color].forEach((image) => {
    const card = document.createElement("div");

    card.className = "image-card";
    card.dataset.color = color;
    card.dataset.localId = image.localId;

    // While compressing, image.file is still null - preview from the
    // original (uncompressed) file instead so something shows up
    // immediately rather than a blank card until compression finishes.
    const previewSourceFile = image.file || image.rawFile;

    const displayName = image.existing
      ? image.url.split("/").pop()
      : (image.file || image.rawFile).name;

    card.innerHTML = `
   
      <button
        class="delete-image-btn"
        data-color="${color}"
        data-local-id="${image.localId}">
        ×
      </button>

      <button
        class="cover-star-btn ${image.isCover ? "is-cover" : ""}"
        data-color="${color}"
        data-local-id="${image.localId}"
        title="${image.isCover ? "Cover image" : "Set as cover image"}"
        aria-pressed="${image.isCover ? "true" : "false"}">
        ${image.isCover ? "★" : "☆"}
      </button>

      <img src="${
        image.existing
          ? image.url.startsWith("http")
            ? image.url
            : API_ROOT + image.url
          : (image.previewUrl ??= URL.createObjectURL(previewSourceFile))
      }">

      ${
        image.compressing
          ? `
            <div class="compress-overlay">
              <div class="compress-bar-bg">
                <div class="compress-bar" style="width:${image.compressProgress}%"></div>
              </div>
              <span class="compress-label">Compressing ${image.compressProgress}%</span>
            </div>
          `
          : ""
      }

      <p>${escapeHtml(displayName)}</p>
      <div class="drag-handle" data-color="${color}" data-local-id="${image.localId}">⠿</div>

    `;

    container.appendChild(card);
  });
}

// Marks a single image as the cover for its color, un-marking whichever
// image previously held that spot. Looks the image up by its stable
// localId (rather than array position) so this can never land on the
// wrong photo even if a render happens to be in flight. Updates local
// state + re-renders immediately (so the star fills instantly, no
// confirmation dialog), and - if the image already exists in the
// database - fires the PUT in the background to persist it.
// Newly-selected-but-not-yet-uploaded images just carry the flag in
// local state; uploadColorImages() below reads it off and tells the
// server which one to mark as cover at upload time.
function setCoverImage(color, localId) {
  const images = colorImages[color];
  if (!images) return;

  const target = images.find((image) => image.localId === localId);
  if (!target) return;

  images.forEach((image) => {
    image.isCover = image.localId === localId;
  });

  renderSelectedImages(color);

  if (target.existing) {
    fetch(
      `${API_BASE.replace("/products", "")}/upload/product-images/${target.id}/cover`,
      {
        method: "PUT",
        credentials: "include",
      },
    ).catch((error) => {
      console.error("Failed to set cover image:", error);
      showToast("Could not update cover image", "error");
    });
  }
}

document.addEventListener("click", (e) => {
  const starBtn = e.target.closest(".cover-star-btn");
  if (!starBtn) return;

  setCoverImage(starBtn.dataset.color, starBtn.dataset.localId);
});

// Queues an already-uploaded image for deletion on the server. Called from
// saveProduct() after the product save succeeds, so a cancelled edit (form
// reset, navigating away without saving) doesn't orphan-delete photos the
// admin only removed locally.
async function deleteRemovedImages() {
  for (const id of deletedImages) {
    await fetch(
      `${API_BASE.replace("/products", "")}/upload/product-images/${id}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );
  }

  deletedImages.length = 0;
}

document.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".delete-image-btn");
  if (!deleteBtn) return;

  const color = deleteBtn.dataset.color;
  const localId = deleteBtn.dataset.localId;

  const images = colorImages[color];
  const index = images.findIndex((image) => image.localId === localId);
  if (index === -1) return;

  const image = images[index];

  // Existing image in the database - queue it for deletion (see
  // deleteRemovedImages above) rather than deleting it immediately.
  if (image.existing) {
    deletedImages.push(image.id);
  }

  // Revoke the blob URL before dropping the reference, so the browser can
  // actually free the memory instead of holding it for the life of the tab.
  if (image.previewUrl) {
    URL.revokeObjectURL(image.previewUrl);
  }

  // Remove locally
  images.splice(index, 1);

  renderSelectedImages(color);
});

function loadExistingImages(colors) {
  if (!colors) return;
  colors.forEach((color) => {
    colorImages[color.name] = color.images.map((image) => ({
      localId: makeLocalId(),
      id: image.id,
      url: image.url,
      existing: true,
      isCover: !!image.isCover,
    }));
  });
}

// Wraps a single color's upload in a plain XMLHttpRequest instead of
// fetch(). fetch() only exposes progress on the *response* body (via its
// ReadableStream), never on the outgoing request - there's no way to know
// how much of a large photo has actually left the browser. XHR's
// upload.onprogress event is the one thing that reports outgoing bytes,
// so it's what the progress panel (upload-progress.js) is driven from.
function xhrUploadFormData(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    xhr.send(formData);
  });
}

async function uploadColorImages(colors) {
  // If Save was clicked while a large photo was still compressing,
  // image.file would still be null - wait for every in-flight
  // compression job to settle before reading any file off colorImages.
  if (pendingCompressions.size) {
    await Promise.all(pendingCompressions);
  }

  // Build one upload "job" per color that actually has new files to send -
  // same batching as before (still one request per color, still all fired
  // in parallel rather than awaited one at a time), just gathered up front
  // so the progress panel can be populated with every color's file size
  // before any request goes out.
  const jobs = colors
    .map((color) => {
      const images = colorImages[color.name];
      if (!images?.length) return null;

      const formData = new FormData();

      // coverIndex is the position of the cover image WITHIN this batch of
      // new files specifically (not its index in `images`, which also
      // includes already-uploaded ones) - that's what the server expects,
      // since the new rows don't have ids yet when this request is built.
      let coverIndex = -1;
      let totalBytes = 0;

      images.forEach((image) => {
        if (!image.existing) {
          if (image.isCover) coverIndex = formData.getAll("images").length;
          formData.append("images", image.file);
          totalBytes += image.file.size;
        }
      });

      if ([...formData.entries()].length === 0) return null;

      if (coverIndex !== -1) {
        formData.append("coverIndex", coverIndex);
      }

      return {
        color,
        formData,
        totalBytes,
        url: `${API_BASE.replace("/products", "")}/upload/product-images/${color.id}`,
      };
    })
    .filter(Boolean);

  if (!jobs.length) return;

  showUploadProgress(
    jobs.map((job) => ({ name: job.color.name, totalBytes: job.totalBytes })),
  );

  const uploads = jobs.map((job) =>
    xhrUploadFormData(job.url, job.formData, (loaded, total) => {
      updateUploadProgress(job.color.name, loaded, total);
    })
      .then(() => {
        completeUploadProgress(job.color.name);
      })
      .catch((error) => {
        errorUploadProgress(job.color.name);
        throw error;
      }),
  );

  await Promise.all(uploads);
}

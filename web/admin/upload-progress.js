// =========================================================
// UPLOAD PROGRESS WINDOW
// =========================================================
// Small floating panel (bottom-right) that shows per-color upload
// progress bars plus one overall bar, driven entirely by
// XMLHttpRequest's upload.progress events (fetch() has no way to report
// upload progress, only download progress, so color-images.js uses XHR
// for the actual upload requests and calls into the functions below).
//
// No dependencies on other files - safe to load anywhere before
// color-images.js's uploadColorImages() actually runs (i.e. before the
// first Save click).

let uploadProgressPanel = null;
let uploadProgressList = null;
let uploadProgressOverallBar = null;
let uploadProgressOverallLabel = null;
let uploadProgressTitle = null;

// name -> { loaded, total, done, error, indeterminate }
const uploadProgressState = {};
let uploadProgressHideTimer = null;

function ensureUploadProgressUI() {
  if (uploadProgressPanel) return;

  const style = document.createElement("style");
  style.textContent = `
    #upload-progress-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      max-height: 70vh;
      overflow-y: auto;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
      z-index: 9999;
      font-family: "Inter", sans-serif;
      display: none;
      border: 1px solid #e5e7eb;
    }
    #upload-progress-panel.open {
      display: block;
    }
    #upload-progress-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid #eee;
      font-weight: 600;
      font-size: 14px;
      color: #111827;
    }
    #upload-progress-close {
      cursor: pointer;
      border: none;
      background: none;
      font-size: 18px;
      color: #6b7280;
      line-height: 1;
      padding: 0;
    }
    #upload-progress-close:hover {
      color: #111827;
    }
    #upload-progress-overall-wrap {
      padding: 10px 14px 0;
    }
    #upload-progress-overall-bar-bg {
      height: 6px;
      border-radius: 4px;
      background: #eef2f7;
      overflow: hidden;
    }
    #upload-progress-overall-bar {
      height: 100%;
      width: 0%;
      background: #2f6fed;
      transition: width 0.15s ease;
    }
    #upload-progress-overall-label {
      font-size: 11px;
      color: #6b7280;
      margin: 4px 0 8px;
    }
    #upload-progress-list {
      padding: 4px 14px 12px;
    }
    .upload-progress-row {
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .upload-progress-row:last-child {
      border-bottom: none;
    }
    .upload-progress-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12.5px;
      color: #374151;
      margin-bottom: 5px;
      gap: 8px;
    }
    .upload-progress-row-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .upload-progress-row-status {
      font-size: 11px;
      color: #9ca3af;
      flex-shrink: 0;
    }
    .upload-progress-row-status.done {
      color: #16a34a;
    }
    .upload-progress-row-status.error {
      color: #dc2626;
    }
    .upload-progress-bar-bg {
      height: 5px;
      border-radius: 4px;
      background: #eef2f7;
      overflow: hidden;
    }
    .upload-progress-bar {
      height: 100%;
      width: 0%;
      background: #2f6fed;
      transition: width 0.15s ease;
    }
    .upload-progress-bar.done {
      background: #16a34a;
      width: 100% !important;
    }
    .upload-progress-bar.error {
      background: #dc2626;
    }
    .upload-progress-bar.indeterminate {
      width: 40% !important;
      animation: upload-progress-indeterminate 1.1s ease-in-out infinite;
    }
    @keyframes upload-progress-indeterminate {
      0% { margin-left: -40%; }
      100% { margin-left: 100%; }
    }
  `;
  document.head.appendChild(style);

  uploadProgressPanel = document.createElement("div");
  uploadProgressPanel.id = "upload-progress-panel";
  uploadProgressPanel.innerHTML = `
    <div id="upload-progress-header">
      <span id="upload-progress-title">Uploading images...</span>
      <button type="button" id="upload-progress-close" aria-label="Close">&times;</button>
    </div>
    <div id="upload-progress-overall-wrap">
      <div id="upload-progress-overall-bar-bg">
        <div id="upload-progress-overall-bar"></div>
      </div>
      <div id="upload-progress-overall-label">Starting...</div>
    </div>
    <div id="upload-progress-list"></div>
  `;
  document.body.appendChild(uploadProgressPanel);

  uploadProgressList = uploadProgressPanel.querySelector("#upload-progress-list");
  uploadProgressOverallBar = uploadProgressPanel.querySelector("#upload-progress-overall-bar");
  uploadProgressOverallLabel = uploadProgressPanel.querySelector("#upload-progress-overall-label");
  uploadProgressTitle = uploadProgressPanel.querySelector("#upload-progress-title");

  uploadProgressPanel
    .querySelector("#upload-progress-close")
    .addEventListener("click", () => {
      uploadProgressPanel.classList.remove("open");
    });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// items: [{ name, totalBytes }]
function showUploadProgress(items) {
  ensureUploadProgressUI();

  clearTimeout(uploadProgressHideTimer);

  Object.keys(uploadProgressState).forEach((key) => delete uploadProgressState[key]);

  uploadProgressTitle.textContent = "Uploading images...";
  uploadProgressOverallBar.classList.remove("done", "error");
  uploadProgressOverallBar.style.width = "0%";
  uploadProgressOverallLabel.textContent = "Starting...";

  uploadProgressList.innerHTML = items
    .map((item) => {
      const knownSize = item.totalBytes > 0;

      uploadProgressState[item.name] = {
        loaded: 0,
        total: item.totalBytes || 0,
        done: false,
        error: false,
        indeterminate: !knownSize,
      };

      return `
        <div class="upload-progress-row" data-upload-row="${escapeHtml(item.name)}">
          <div class="upload-progress-row-top">
            <span class="upload-progress-row-name">${escapeHtml(item.name)}</span>
            <span class="upload-progress-row-status">Waiting...</span>
          </div>
          <div class="upload-progress-bar-bg">
            <div class="upload-progress-bar${knownSize ? "" : " indeterminate"}"></div>
          </div>
        </div>
      `;
    })
    .join("");

  uploadProgressPanel.classList.add("open");
}

function updateUploadProgress(name, loaded, total) {
  const state = uploadProgressState[name];
  if (!state || state.done || state.error) return;

  state.loaded = loaded;
  state.total = total;
  state.indeterminate = false;

  const row = uploadProgressList?.querySelector(`[data-upload-row="${CSS.escape(name)}"]`);
  if (row) {
    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
    const bar = row.querySelector(".upload-progress-bar");
    const status = row.querySelector(".upload-progress-row-status");
    bar.classList.remove("indeterminate");
    bar.style.width = `${percent}%`;
    status.textContent = `${percent}% - ${formatBytes(loaded)} / ${formatBytes(total)}`;
  }

  recalcOverallUploadProgress();
}

function completeUploadProgress(name) {
  const state = uploadProgressState[name];
  if (!state) return;

  state.done = true;
  state.loaded = state.total || state.loaded;

  const row = uploadProgressList?.querySelector(`[data-upload-row="${CSS.escape(name)}"]`);
  if (row) {
    const bar = row.querySelector(".upload-progress-bar");
    const status = row.querySelector(".upload-progress-row-status");
    bar.classList.remove("indeterminate", "error");
    bar.classList.add("done");
    status.textContent = "Done";
    status.classList.add("done");
    status.classList.remove("error");
  }

  recalcOverallUploadProgress();
  maybeFinishUploadProgress();
}

function errorUploadProgress(name) {
  const state = uploadProgressState[name];
  if (!state) return;

  state.error = true;

  const row = uploadProgressList?.querySelector(`[data-upload-row="${CSS.escape(name)}"]`);
  if (row) {
    const bar = row.querySelector(".upload-progress-bar");
    const status = row.querySelector(".upload-progress-row-status");
    bar.classList.remove("indeterminate", "done");
    bar.classList.add("error");
    status.textContent = "Failed";
    status.classList.add("error");
    status.classList.remove("done");
  }

  recalcOverallUploadProgress();
  maybeFinishUploadProgress();
}

function recalcOverallUploadProgress() {
  const entries = Object.values(uploadProgressState);
  if (!entries.length) return;

  let loadedSum = 0;
  let totalSum = 0;
  let hasIndeterminate = false;

  entries.forEach((state) => {
    if (state.indeterminate && !state.done && !state.error) {
      hasIndeterminate = true;
      return;
    }
    loadedSum += state.loaded;
    totalSum += state.total;
  });

  if (hasIndeterminate || totalSum === 0) {
    uploadProgressOverallBar.classList.add("indeterminate");
    uploadProgressOverallLabel.textContent = "Uploading...";
    return;
  }

  uploadProgressOverallBar.classList.remove("indeterminate");
  const percent = Math.min(100, Math.round((loadedSum / totalSum) * 100));
  uploadProgressOverallBar.style.width = `${percent}%`;
  uploadProgressOverallLabel.textContent = `${percent}% - ${formatBytes(loadedSum)} / ${formatBytes(totalSum)}`;
}

function maybeFinishUploadProgress() {
  const entries = Object.values(uploadProgressState);
  const allSettled = entries.every((state) => state.done || state.error);
  if (!allSettled) return;

  const anyError = entries.some((state) => state.error);

  if (anyError) {
    uploadProgressTitle.textContent = "Some uploads failed";
    uploadProgressOverallBar.classList.add("error");
    uploadProgressOverallLabel.textContent = "Check the items above";
    // Leave it open - admin needs to notice the failure and can close manually.
    return;
  }

  uploadProgressTitle.textContent = "Upload complete";
  uploadProgressOverallBar.classList.add("done");
  uploadProgressOverallLabel.textContent = "100%";

  clearTimeout(uploadProgressHideTimer);
  uploadProgressHideTimer = setTimeout(() => {
    uploadProgressPanel?.classList.remove("open");
  }, 1500);
}
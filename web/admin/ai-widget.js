// AI Assistant Widget
// Include AFTER shared.js on pages containing #ai-widget.
//
// Sending integration:
// The widget emits:
//   ai-widget:send
// with:
//   event.detail.message
//
// Example:
// document.getElementById("ai-widget").addEventListener(
//   "ai-widget:send",
//   async (event) => {
//     const message = event.detail.message;
//     // send message to your backend here
//   }
// );

(function () {
  const widget = document.getElementById("ai-widget");
  const fab = document.getElementById("ai-widget-fab");
  const panel = document.getElementById("ai-widget-panel");
  const closeBtn = document.getElementById("ai-widget-close");
  const input = document.getElementById("ai-widget-input");
  const sendBtn = document.getElementById("ai-widget-send");
  const body = document.getElementById("ai-widget-body");

  if (!widget || !fab || !panel || !closeBtn) return;

  const STATUS_BADGES = {
    PENDING: { label: "Pending", cls: "ai-widget-msg-badge--pending" },
    CONFIRMED: { label: "Approved", cls: "ai-widget-msg-badge--approved" },
    REJECTED: { label: "Declined", cls: "ai-widget-msg-badge--rejected" },
  };
  // Where a product's edit mode lives. If your add-product page uses a
  // different page name or query param, this is the ONLY place to change.
  const EDIT_PRODUCT_PAGE = "/admin/add-product";
  function editProductUrl(productId) {
    return `${EDIT_PRODUCT_PAGE}?id=${productId}`;
  }

  const CLOSE_ANIMATION_MS = 180;
  const SEND_ANIMATION_MS = 450;
  const MAX_INPUT_HEIGHT = 120;

  let closeTimeout = null;
  let sendTimeout = null;

  // Thinking indicator (shown while waiting for the assistant's reply)
  const THINKING_LABELS = [
    "Thinking…",
    "Reading your store…",
    "Working on it…",
    "Still working…",
  ];
  const THINKING_INTERVAL_MS = 2200;

  let thinkingEl = null;
  let thinkingTimer = null;

  // -------------------------------------------------------
  // Utilities
  // -------------------------------------------------------

  function escapeHtml(value) {
    if (typeof value !== "string") return "";

    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---- Product links / card (built from the `ui` list the backend sends) ----

  // Keep only well-formed items, so a bad payload can never break rendering.
  function cleanProductList(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(
      (item) =>
        item &&
        Number.isInteger(item.productId) &&
        typeof item.name === "string" &&
        item.name.trim().length > 0,
    );
  }

  // Only plain http(s) image URLs are ever put in a src attribute.
  function safeImageUrl(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url) ? url : "";
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Wraps every product name found in the assistant's text with an edit link.
  // Returns the finished HTML plus the products whose name was NOT found in
  // the text (the model may paraphrase), so they can still be reached.
  function linkifyProductNames(text, items) {
    const safeText = escapeHtml(text); // escape FIRST, then add our own tags

    // Names are compared in their escaped form, because that's the form the
    // text is in now (e.g. "&" is already "&amp;").
    const byName = new Map();
    for (const item of items) {
      const key = escapeHtml(item.name.trim()).toLowerCase();
      if (!byName.has(key)) byName.set(key, item);
    }

    // One pass, longest names first: "Redmi Note 14 Pro" must win over its
    // prefix "Redmi Note 14", and replacing name by name would nest the links.
    const alternation = [...byName.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|");

    // The lookarounds stop a name matching in the middle of a longer word.
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`,
      "giu",
    );

    const matched = new Set();
    const html = safeText.replace(pattern, (found) => {
      const item = byName.get(found.toLowerCase());
      if (!item) return found;
      matched.add(item);
      return `<a class="ai-widget-product-link" href="${escapeHtml(editProductUrl(item.productId))}">${found}</a>`;
    });

    return { html, unmatched: items.filter((item) => !matched.has(item)) };
  }

  // Single product: a small card with one photo. Built with NO whitespace
  // between tags, because message bubbles use white-space: pre-wrap.
  function renderProductCard(item) {
    const imageUrl = safeImageUrl(item.imageUrl);
    const image = imageUrl
      ? `<img class="ai-widget-product-card-img" src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`
      : "";

    return `<a class="ai-widget-product-card" href="${escapeHtml(editProductUrl(item.productId))}"><span class="ai-widget-product-card-media"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>${image}</span><span class="ai-widget-product-card-body"><span class="ai-widget-product-card-name">${escapeHtml(item.name)}</span><span class="ai-widget-product-card-action">Edit product</span></span></a>`;
  }

  // Fallback row for products the text didn't name.
  function renderProductChips(items) {
    if (items.length === 0) return "";

    const chips = items
      .map(
        (item) =>
          `<a class="ai-widget-product-chip" href="${escapeHtml(editProductUrl(item.productId))}">${escapeHtml(item.name)}</a>`,
      )
      .join("");

    return `<div class="ai-widget-product-chips">${chips}</div>`;
  }

  // One place that decides how a status looks.
  // Used by renderMessage (history + new messages) and by the live update.
  function badgeHtml(status) {
    const info = STATUS_BADGES[status];
    return info
      ? `<span class="ai-widget-msg-badge ${info.cls}">${info.label}</span>`
      : "";
  }

  function scrollToBottom(smooth = true) {
    if (!body) return;

    body.scrollTo({
      top: body.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
  }

  async function request(method, path, body) {
    const response = await fetch(`${API_ROOT}${path}`, {
      method: method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error(error);
      data = {};
    }
    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }
    return data;
  }

  async function loadHistory() {
    const data = await request("GET", "/assistant/history");
    return data.history;
  }
  async function sendMessage(content) {
    const data = await request("POST", "/assistant/message", { content });
    return data;
  }

  async function confirmAction(id, approve) {
    const data = await request("POST", `/assistant/confirm/${id}`, { approve });
    return data;
  }
  let historyLoaded = false;

  async function ensureHistoryLoaded() {
    if (historyLoaded) return;
    try {
      const history = await loadHistory();
      renderHistory(history);
      historyLoaded = true;
    } catch (error) {
      showToast(error.message, "error");
      historyLoaded = false;
    }
  }
  // -------------------------------------------------------
  // Open / close
  // -------------------------------------------------------

  function openWidget() {
    clearTimeout(closeTimeout);

    panel.hidden = false;

    // Force a layout so the opening transition always runs.
    void panel.offsetHeight;

    requestAnimationFrame(() => {
      widget.classList.add("open");
    });

    fab.setAttribute("aria-expanded", "true");

    setTimeout(() => {
      input?.focus();
    }, 180);
    ensureHistoryLoaded();
  }

  function closeWidget() {
    widget.classList.remove("open");
    fab.setAttribute("aria-expanded", "false");

    clearTimeout(closeTimeout);

    closeTimeout = setTimeout(() => {
      panel.hidden = true;
    }, CLOSE_ANIMATION_MS);
  }

  function toggleWidget() {
    if (widget.classList.contains("open")) {
      closeWidget();
    } else {
      openWidget();
    }
  }

  fab.addEventListener("click", toggleWidget);
  closeBtn.addEventListener("click", closeWidget);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && widget.classList.contains("open")) {
      closeWidget();
    }
  });

  document.addEventListener("click", (event) => {
    if (!widget.classList.contains("open")) return;

    if (!widget.contains(event.target)) {
      closeWidget();
    }
  });

  // -------------------------------------------------------
  // Input
  // -------------------------------------------------------

  if (input && sendBtn) {
    let isSending = false;
    function autoResize() {
      input.style.height = "auto";

      const nextHeight = Math.min(input.scrollHeight, MAX_INPUT_HEIGHT);

      input.style.height = `${nextHeight}px`;
    }

    function updateSendState() {
      sendBtn.disabled = isSending || input.value.trim().length === 0;
    }

    function resetComposer() {
      input.style.height = "auto";
      updateSendState();
    }

    input.addEventListener("input", () => {
      autoResize();
      updateSendState();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();

        if (!sendBtn.disabled) {
          sendBtn.click();
        }
      }
    });

    sendBtn.addEventListener("click", async () => {
      const message = input.value.trim();

      if (!message || sendBtn.disabled) return;

      // Immediately clear composer.
      input.value = "";
      resetComposer();

      // Visual sending state.
      sendBtn.disabled = true;
      isSending = true;
      sendBtn.classList.add("is-sending");

      const icon = sendBtn.querySelector("i");

      if (icon) {
        icon.classList.remove("fa-paper-plane");
        icon.classList.add("fa-spinner");
        icon.classList.add("fa-spin");
      }

      // Add the user's message immediately with a pop animation.
      appendMessages(
        [
          {
            role: "OWNER",
            content: message,
            actionStatus: null,
          },
        ],
        true,
      );

      // Let the rest of your app/backend listen for this.
      widget.dispatchEvent(
        new CustomEvent("ai-widget:send", {
          bubbles: true,
          detail: {
            message,
          },
        }),
      );

      showThinking();

      try {
        const { assistantMessage, ui } = await sendMessage(message);
        hideThinking();
        // `ui` only exists on the live response (it is not saved in history),
        // so attach it to the message object for renderMessage to read.
        appendMessages([{ ...assistantMessage, ui }], true);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        hideThinking(); // safety net: covers errors, harmless if already hidden
        isSending = false;
        sendBtn.classList.remove("is-sending");
        if (icon) {
          icon.classList.remove("fa-spinner", "fa-spin");
          icon.classList.add("fa-paper-plane");
        }
        updateSendState();
      }
    });

    updateSendState();
    autoResize();
  }

  // -------------------------------------------------------
  // Chat rendering
  // -------------------------------------------------------

  function renderMessage(msg, animate = false) {
    const isOwner = msg.role === "OWNER";
    const badge = badgeHtml(msg.actionStatus);
    const actionsBlock =
      msg.actionStatus === "PENDING"
        ? `<div class="ai-widget-msg-actions"><button class="ai-widget-decline-action ai-action-btn" data-action="decline">Decline</button><button class="ai-widget-approve-action ai-action-btn" data-action="approve">Approve</button></div>`
        : "";
    const idAttr = msg.id != null ? ` data-id="${msg.id}"` : "";

    // Product links/card only ever apply to assistant messages that carry `ui`.
    const products = isOwner ? [] : cleanProductList(msg.ui);
    let textHtml = escapeHtml(msg.content);
    let productsBlock = "";

    if (products.length === 1) {
      productsBlock = renderProductCard(products[0]);
    } else if (products.length > 1) {
      const linked = linkifyProductNames(msg.content, products);
      textHtml = linked.html;
      productsBlock = renderProductChips(linked.unmatched);
    }
    const classes = `ai-widget-msg ${isOwner ? "owner" : "assistant"}${
      animate ? " is-new" : ""
    }`;

    return `<div class="${classes}"${idAttr}><div class="ai-widget-msg-content" dir="auto">${badge}<span class="ai-widget-msg-text">${textHtml}</span>${productsBlock}${actionsBlock}</div></div>`;
  }

  function renderHistory(messages) {
    if (!body) return;

    if (!Array.isArray(messages) || messages.length === 0) {
      body.classList.add("is-empty");

      body.innerHTML = `
        <div class="ai-widget-empty">
          <div class="ai-widget-empty-icon">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>

          <div class="ai-widget-empty-title">
            How can I help?
          </div>

          <div class="ai-widget-empty-text">
            Ask me about your store, products, stock, or analytics.
          </div>
        </div>
      `;

      return;
    }

    body.classList.remove("is-empty");

    body.innerHTML = messages.map((message) => renderMessage(message)).join("");

    scrollToBottom(false);
  }

  function appendMessages(messages, animate = false) {
    if (!body || !Array.isArray(messages) || messages.length === 0) {
      return;
    }

    const emptyState = body.querySelector(".ai-widget-empty");

    if (emptyState) {
      body.innerHTML = "";
      body.classList.remove("is-empty");
    }

    body.insertAdjacentHTML(
      "beforeend",
      messages.map((message) => renderMessage(message, animate)).join(""),
    );

    requestAnimationFrame(() => {
      scrollToBottom(true);
    });
  }

  // -------------------------------------------------------
  // Thinking indicator
  // -------------------------------------------------------

  function showThinking() {
    hideThinking(); // never allow two at once
    if (!body) return;

    // Remove the empty state if it's still there
    if (body.querySelector(".ai-widget-empty")) {
      body.innerHTML = "";
      body.classList.remove("is-empty");
    }

    // No whitespace between tags, same rule as renderMessage
    body.insertAdjacentHTML(
      "beforeend",
      `<div class="ai-widget-msg assistant ai-widget-thinking is-new" role="status" aria-live="polite"><div class="ai-widget-msg-content"><span class="ai-widget-thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span><span class="ai-widget-thinking-label">${THINKING_LABELS[0]}</span></div></div>`,
    );

    thinkingEl = body.lastElementChild;
    const label = thinkingEl.querySelector(".ai-widget-thinking-label");

    let i = 0;
    thinkingTimer = setInterval(() => {
      // Hold on the last label instead of looping
      i = Math.min(i + 1, THINKING_LABELS.length - 1);
      label.textContent = THINKING_LABELS[i];

      // Restart the fade-in animation on every label change
      label.classList.remove("is-swapping");
      void label.offsetWidth;
      label.classList.add("is-swapping");
    }, THINKING_INTERVAL_MS);

    requestAnimationFrame(() => scrollToBottom(true));
  }

  function hideThinking() {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
    thinkingEl?.remove();
    thinkingEl = null;
  }

  // -------------------------------------------------------
  // Approve / decline a pending proposal
  // -------------------------------------------------------

  if (body) {
    // Image "error" events don't bubble, so listen in the capture phase.
    // Removing the broken <img> reveals the placeholder icon behind it.
    body.addEventListener(
      "error",
      (e) => {
        if (e.target.matches?.(".ai-widget-product-card-img")) {
          e.target.remove();
        }
      },
      true,
    );

    body.addEventListener("click", async (e) => {
      const action = e.target.closest("[data-action]");
      const msg = e.target.closest(".ai-widget-msg");
      if (!action || !msg) return;

      const msgId = msg.dataset.id;
      if (!msgId) return;

      // Only an explicit "approve" approves; anything else is a decline.
      const approve = action.dataset.action === "approve";

      // Disable synchronously, before the await, to block double-clicks.
      const actionButtons = msg.querySelectorAll("[data-action]");
      actionButtons.forEach((btn) => (btn.disabled = true));

      try {
        const result = await confirmAction(msgId, approve);

        // Final status comes from the response, not from which button was clicked.
        const finalStatus = approve
          ? result.outcome?.status === "success"
            ? "CONFIRMED"
            : "REJECTED"
          : result.message?.actionStatus;

        // Remove the buttons so they can never be clicked again.
        msg.querySelector(".ai-widget-msg-actions")?.remove();

        // Swap the badge (or add one if somehow missing).
        const oldBadge = msg.querySelector(".ai-widget-msg-badge");
        if (oldBadge) {
          oldBadge.outerHTML = badgeHtml(finalStatus);
        } else {
          msg
            .querySelector(".ai-widget-msg-content")
            ?.insertAdjacentHTML("afterbegin", badgeHtml(finalStatus));
        }

        // resultMessage can be null if that DB write failed.
        if (approve && result.resultMessage) {
          appendMessages([result.resultMessage], true);
        }
      } catch (error) {
        console.error(error);
        showToast(error.message, "error");
        // Only here does the message stay PENDING, so only here do buttons return.
        actionButtons.forEach((btn) => (btn.disabled = false));
      }
    });
  }

  // Expose rendering methods for your backend/history logic.
  window.AIWidget = {
    renderHistory,
    appendMessages,
    loadHistory,
    sendMessage,
    confirmAction,
    open: openWidget,
    close: closeWidget,
  };

  // Initial empty state.
  renderHistory([]);
})();

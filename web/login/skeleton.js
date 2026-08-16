// Small shared helpers for skeleton loading states. Include this on a
// page AFTER shared.js and BEFORE the page-specific script:
//   <script src="shared.js"></script>
//   <script src="skeleton.js"></script>
//   <script src="products.js"></script>
//
// Two patterns, matching the CSS in shared.css:
//
// 1) Table/list rows that get fully replaced once real data loads
//    (nothing to "reveal", the skeleton IS the temporary content):
//      Skeleton.tableRows(tbody, { cols: 7, rows: 6 })
//      Skeleton.listItems(container, { rows: 3, height: 48 })
//
// 2) Real elements already in the DOM that should stay hidden behind
//    a skeleton until data arrives, then get revealed as-is (e.g.
//    stat card numbers, a settings form). Mark the wrapping element
//    with the `data-loading` attribute in HTML; call:
//      Skeleton.clear(wrapperEl)          // clears one element
//      Skeleton.clear('.stat-card')       // or a selector, clears all matches
//    to remove it once the real content is populated.

window.Skeleton = {
  // Renders `rows` skeleton <tr> elements (each with `cols` <td>s) into
  // a <tbody>. Use as the tbody's content while the first fetch is in
  // flight; your normal render function overwrites it once data
  // arrives, same as it already overwrites the old "Loading…" row.
  tableRows(tbody, { cols = 5, rows = 6 } = {}) {
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: rows })
      .map(
        () => `
          <tr class="skeleton-row">
            ${Array.from({ length: cols })
              .map(
                () => `
                  <td>
                    <span class="skeleton skeleton-text" style="width:${
                      60 + Math.random() * 30
                    }%"></span>
                  </td>`,
              )
              .join("")}
          </tr>`,
      )
      .join("");
  },

  // Renders `rows` simple skeleton blocks (e.g. for a dropdown menu's
  // list of checkboxes, or an activity feed) into any container.
  listItems(container, { rows = 4, height = 16 } = {}) {
    if (!container) return;
    container.innerHTML = Array.from({ length: rows })
      .map(
        () => `
          <div class="skeleton skeleton-text" style="height:${height}px;width:${
            50 + Math.random() * 40
          }%;margin:8px 0"></div>`,
      )
      .join("");
  },

  // Masks an existing element's live content with .skeleton-inline
  // (see shared.css) and automatically un-masks it the first time its
  // content actually changes - i.e. whenever the page's own script
  // does its normal `el.textContent = value` once data has loaded.
  // No changes to that other script are needed. A timeout fallback
  // (default 6s) guarantees it never gets stuck masked if the content
  // genuinely never changes (e.g. the fetch failed silently).
  //
  // NOTE: this relies on DOM mutations (childList/characterData), so
  // it detects `.textContent =` / `.innerHTML =` updates but NOT
  // `<input>.value =` assignments (those aren't DOM mutations) - use
  // the data-loading overlay pattern + Skeleton.clear() for form
  // inputs instead.
  autoReveal(target, { timeout = 6000 } = {}) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;

    el.classList.add("skeleton-inline");

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      el.classList.remove("skeleton-inline");
      observer.disconnect();
      clearTimeout(timer);
    };

    const observer = new MutationObserver(reveal);
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    const timer = setTimeout(reveal, timeout);
  },

  // Removes the data-loading attribute (revealing .real-only content
  // and hiding .skel-only placeholders per the shared.css rules) from
  // one element, a NodeList, or every match of a selector.
  clear(target) {
    const els =
      typeof target === "string"
        ? document.querySelectorAll(target)
        : target instanceof NodeList || Array.isArray(target)
          ? target
          : [target];

    els.forEach((el) => el && el.removeAttribute("data-loading"));
  },
};
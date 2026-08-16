/* StockLink — main.js
   No dependencies. Progressive enhancement only:
   the site is fully readable and usable with JS disabled. */

(function () {
  "use strict";

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  var navLinks = document.querySelector(".nav-links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Contact form validation ---------- */
  var form = document.getElementById("contactForm");
  if (form) {
    var successPanel = document.getElementById("formSuccess");

    var validators = {
      fullName: function (v) { return v.trim().length >= 2; },
      storeName: function (v) { return v.trim().length >= 2; },
      phone: function (v) { return /^[+0-9\s()-]{7,}$/.test(v.trim()); },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); },
      message: function (v) { return v.trim().length >= 10; }
    };

    function validateField(field) {
      var input = form.elements[field];
      if (!input) return true;
      var wrapper = input.closest(".field");
      var isValid = validators[field] ? validators[field](input.value) : true;
      if (wrapper) wrapper.classList.toggle("invalid", !isValid);
      return isValid;
    }

    Object.keys(validators).forEach(function (field) {
      var input = form.elements[field];
      if (!input) return;
      input.addEventListener("blur", function () { validateField(field); });
      input.addEventListener("input", function () {
        var wrapper = input.closest(".field");
        if (wrapper && wrapper.classList.contains("invalid")) validateField(field);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var allValid = Object.keys(validators)
        .map(validateField)
        .every(Boolean);

      if (!allValid) {
        var firstInvalid = form.querySelector(".field.invalid input, .field.invalid textarea");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      /* No backend is wired up yet: show a clear, honest success state
         and let the visitor reach us directly in the meantime. */
      form.classList.add("is-hidden");
      if (successPanel) {
        successPanel.classList.add("is-visible");
        successPanel.focus();
      }
      form.reset();
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

/* =========================================================
   StockLink — interactions
   1. Sticky nav glass effect on scroll
   2. Mobile nav toggle
   3. Cursor-following ambient glow
   4. Scroll-reveal animations
   5. Timeline progress fill
   6. Small in-mockup counter
   7. FAQ accordion
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Sticky nav glass on scroll ---------- */
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 12) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- 2. Mobile nav ---------- */
  const navToggle = document.getElementById('navToggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('mobile-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    document.querySelectorAll('.nav-mobile a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('mobile-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- 3. Cursor-following ambient glow ---------- */
  const glow = document.getElementById('cursorGlow');
  if (glow && !prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('mousemove', (e) => {
      glow.style.setProperty('--x', e.clientX + 'px');
      glow.style.setProperty('--y', e.clientY + 'px');
    }, { passive: true });
  } else if (glow) {
    glow.style.display = 'none';
  }

  /* ---------- 3b. Floating 3D phone — tilts toward the cursor ---------- */
  const phoneStage = document.getElementById('phoneStage');
  const phone3d = document.getElementById('phone3d');
  if (phoneStage && phone3d && !prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    let targetRX = 6, targetRY = -14, currentRX = 6, currentRY = -14;

    phoneStage.addEventListener('mousemove', (e) => {
      const rect = phoneStage.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;   // 0 -> 1
      const py = (e.clientY - rect.top) / rect.height;   // 0 -> 1
      targetRY = -26 + px * 26;   // roughly -26deg .. 0deg
      targetRX = 20 - py * 26;    // roughly 20deg .. -6deg
    });
    phoneStage.addEventListener('mouseleave', () => {
      targetRX = 6; targetRY = -14;
    });

    const animateTilt = () => {
      currentRX += (targetRX - currentRX) * 0.08;
      currentRY += (targetRY - currentRY) * 0.08;
      phone3d.style.setProperty('--rx', currentRX.toFixed(2) + 'deg');
      phone3d.style.setProperty('--ry', currentRY.toFixed(2) + 'deg');
      requestAnimationFrame(animateTilt);
    };
    requestAnimationFrame(animateTilt);
  }

  /* ---------- 4. Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (prefersReducedMotion) {
    revealEls.forEach(el => el.classList.add('in-view'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => revealObserver.observe(el));
  }

  /* ---------- 5. Timeline progress fill ---------- */
  const timelineFill = document.getElementById('timelineFill');
  const timelineSection = document.getElementById('process');
  if (timelineFill && timelineSection) {
    const fillObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          timelineFill.classList.add('filled');
          fillObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    fillObserver.observe(timelineSection);
  }

  /* ---------- 6. In-mockup stock counter ---------- */
  const stockCounter = document.querySelector('.stock-counter');
  if (stockCounter) {
    const animateCounter = () => {
      const target = parseInt(stockCounter.dataset.count, 10);
      if (prefersReducedMotion) { stockCounter.textContent = target; return; }
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        stockCounter.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter();
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counterObserver.observe(stockCounter);
  }

  /* ---------- 7. FAQ accordion ---------- */
  const triggers = document.querySelectorAll('.accordion-trigger');
  triggers.forEach(trigger => {
    const panel = trigger.nextElementSibling;
    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      triggers.forEach(other => {
        if (other !== trigger) {
          other.setAttribute('aria-expanded', 'false');
          other.nextElementSibling.style.maxHeight = null;
        }
      });

      trigger.setAttribute('aria-expanded', String(!isOpen));
      panel.style.maxHeight = isOpen ? null : panel.scrollHeight + 'px';
    });
  });
});
(() => {
  "use strict";

  const header = document.getElementById("site-header");
  const navToggle = document.getElementById("nav-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileMenuClose = document.getElementById("mobile-menu-close");
  const mobileLinks = mobileMenu ? mobileMenu.querySelectorAll("a") : [];
  const body = document.body;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------------- Same-page anchor links: smooth scroll ----------------
     No CSS `scroll-behavior: smooth` on <html> on purpose — that also
     animates the browser's own on-load scroll when arriving from another
     page with a #hash in the URL, which crawls for several seconds on a
     long page. Cross-page arrivals should jump straight there; only clicks
     on a link that targets an element already in THIS document get an
     animated scroll. */
  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const hash = link.getAttribute("href").split("#")[1];
      const target = hash ? document.getElementById(hash) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      history.pushState(null, "", `#${hash}`);
    });
  });

  /* ---------------- Header shadow on scroll ---------------- */
  const onScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------- Mobile menu ---------------- */
  const openMenu = () => {
    if (!mobileMenu || !navToggle) return;
    mobileMenu.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    body.classList.add("menu-open");
  };
  const closeMenu = () => {
    if (!mobileMenu || !navToggle) return;
    mobileMenu.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    body.classList.remove("menu-open");
  };
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      mobileMenu.classList.contains("is-open") ? closeMenu() : openMenu();
    });
  }
  if (mobileMenuClose) mobileMenuClose.addEventListener("click", closeMenu);
  mobileLinks.forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  // Close the drawer if the viewport grows past the mobile breakpoint
  // (e.g. rotating a tablet), so it never gets stuck open on desktop.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });

  /* ---------------- Scroll-reveal animations ---------------- */
  const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  if ("IntersectionObserver" in window && revealEls.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------------- Count-up numbers ---------------- */
  const formatNumber = (value, format) => {
    const rounded = Math.round(value);
    if (format === "thousand") return rounded.toLocaleString("pt-BR");
    return String(rounded);
  };

  const animateCounter = (el) => {
    const target = parseFloat(el.dataset.target || "0");
    const format = el.dataset.format || "";
    const duration = 1400;
    let start = null;

    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatNumber(target * eased, format);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatNumber(target, format);
      }
    };
    requestAnimationFrame(step);
  };

  const counters = document.querySelectorAll(".count-up");
  if (!prefersReducedMotion && "IntersectionObserver" in window && counters.length) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => counterObserver.observe(el));
  }

  /* ---------------- Active nav link on scroll ---------------- */
  const sectionIds = ["atuamos", "cases", "sobre", "contato"];
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navAnchors = document.querySelectorAll('.menu-link[href^="#"]');

  if ("IntersectionObserver" in window && sections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navAnchors.forEach((a) => {
              a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`);
            });
          }
        });
      },
      { threshold: 0.3, rootMargin: "-40% 0px -50% 0px" }
    );
    sections.forEach((sec) => navObserver.observe(sec));
  }

  /* ---------------- Hero carousel (featured cases in the main banner) ---------------- */
  document.querySelectorAll(".hero-carousel").forEach((carousel) => {
    const slides = carousel.querySelectorAll(".hero-slide");
    if (slides.length < 2) return;

    const seconds = parseFloat(carousel.dataset.autoplaySeconds || "6");
    const intervalMs = (Number.isFinite(seconds) && seconds > 0 ? seconds : 6) * 1000;
    let current = 0;
    let timer = null;

    const showSlide = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle("is-active", i === current));
    };

    const start = () => {
      if (prefersReducedMotion) return;
      stop();
      timer = setInterval(() => showSlide(current + 1), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", start);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("focusout", start);

    start();
  });

  /* ---------------- Case filter (cases.html) ---------------- */
  const filterBtns = document.querySelectorAll(".case-filter__btn");
  if (filterBtns.length) {
    const filterCards = document.querySelectorAll(".portfolio-grid .portfolio-card[data-service]");
    const emptyState = document.querySelector(".case-empty-state");
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const filter = btn.dataset.filter;
        let visibleCount = 0;
        filterCards.forEach((card) => {
          const services = (card.dataset.service || "").split(" ");
          const match = filter === "todos" || services.includes(filter);
          card.classList.toggle("is-hidden", !match);
          if (match) visibleCount++;
        });
        if (emptyState) emptyState.classList.toggle("is-visible", visibleCount === 0);
      });
    });
  }
})();

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

  /* ---------------- Lazy-load background video (only fetch once near view) ---------------- */
  const lazyVideos = document.querySelectorAll("[data-lazy-video]");
  if ("IntersectionObserver" in window && lazyVideos.length) {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const video = entry.target;
          const src = video.dataset.src;
          if (src) {
            const source = document.createElement("source");
            source.src = src;
            source.type = "video/mp4";
            video.appendChild(source);
            video.load();
            video.play().catch(() => {});
          }
          videoObserver.unobserve(video);
        });
      },
      { rootMargin: "600px 0px" }
    );
    lazyVideos.forEach((el) => videoObserver.observe(el));
  } else {
    lazyVideos.forEach((video) => {
      const src = video.dataset.src;
      if (src) {
        const source = document.createElement("source");
        source.src = src;
        source.type = "video/mp4";
        video.appendChild(source);
        video.load();
      }
    });
  }

  /* ---------------- Hero load-in ---------------- */
  const heroCarousel = document.querySelector(".hero-carousel");
  if (heroCarousel) {
    // Double rAF: let the browser paint the opacity:0/scaled starting state
    // from CSS first, so adding .is-loaded actually transitions instead of
    // the two states collapsing into one frame.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => heroCarousel.classList.add("is-loaded"));
    });
  }

  /* ---------------- Scroll-linked text reveal (word by word) ---------------- */
  const scrollRevealTexts = document.querySelectorAll(".scroll-reveal-text");
  if (scrollRevealTexts.length && !prefersReducedMotion && "IntersectionObserver" in window) {
    scrollRevealTexts.forEach((el) => {
      const words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map((w) => `<span class="srt-word">${w}</span>`).join(" ");
      const wordEls = el.querySelectorAll(".srt-word");

      let ticking = false;
      const update = () => {
        ticking = false;
        const vh = window.innerHeight;
        const start = vh * 0.85;
        const end = vh * 0.55;
        wordEls.forEach((word) => {
          const rect = word.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const progress = Math.min(1, Math.max(0, (start - center) / (start - end)));
          word.style.opacity = String(0.25 + progress * 0.75);
        });
      };
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      };

      let active = false;
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !active) {
              active = true;
              window.addEventListener("scroll", onScroll, { passive: true });
              update();
            } else if (!entry.isIntersecting && active) {
              active = false;
              window.removeEventListener("scroll", onScroll);
            }
          });
        },
        { threshold: 0 }
      );
      sectionObserver.observe(el);
    });
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

  /* ---------------- Video lightbox (showreel play button, etc.) ---------------- */
  const videoModal = document.getElementById("video-modal");
  const videoTriggers = document.querySelectorAll("[data-video-id]");
  if (videoModal && videoTriggers.length) {
    const frame = videoModal.querySelector(".video-modal__frame");
    let lastFocused = null;

    const openVideo = (id) => {
      lastFocused = document.activeElement;
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      iframe.title = "YouTube video player";
      iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "");
      frame.appendChild(iframe);
      videoModal.classList.add("is-open");
      videoModal.setAttribute("aria-hidden", "false");
      body.classList.add("menu-open");
      videoModal.querySelector(".video-modal__close").focus();
    };

    const closeVideo = () => {
      videoModal.classList.remove("is-open");
      videoModal.setAttribute("aria-hidden", "true");
      body.classList.remove("menu-open");
      frame.innerHTML = "";
      if (lastFocused) lastFocused.focus();
    };

    videoTriggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const id = trigger.dataset.videoId;
        if (id) openVideo(id);
      });
    });

    videoModal.querySelectorAll("[data-video-modal-close]").forEach((el) => {
      el.addEventListener("click", closeVideo);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && videoModal.classList.contains("is-open")) closeVideo();
    });
  }

  /* ---------------- Contact form (AJAX submit to Formspree) ---------------- */
  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    const status = contactForm.querySelector("[data-contact-status]");
    const submitBtn = contactForm.querySelector(".contact-form__submit");

    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (submitBtn) submitBtn.disabled = true;
      if (status) {
        status.textContent = "";
        status.removeAttribute("data-state");
      }

      fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      })
        .then((response) => {
          if (response.ok) {
            if (status) {
              status.textContent = contactForm.dataset.successMessage || "";
              status.setAttribute("data-state", "success");
            }
            contactForm.reset();
          } else {
            throw new Error("Form submission failed");
          }
        })
        .catch(() => {
          if (status) {
            status.textContent = contactForm.dataset.errorMessage || "";
            status.setAttribute("data-state", "error");
          }
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ---------------- Newsletter popup (delayed, dismissible, RD Station) ---------------- */
  const newsletterPopup = document.getElementById("newsletter-popup");
  if (newsletterPopup) {
    const STORAGE_KEY = "melo_newsletter_seen";
    const dialog = newsletterPopup.querySelector(".newsletter-popup__dialog");
    const form = newsletterPopup.querySelector("[data-newsletter-form]");
    const status = newsletterPopup.querySelector("[data-newsletter-status]");
    let lastFocused = null;

    const alreadySeen = () => {
      try {
        return !!localStorage.getItem(STORAGE_KEY);
      } catch (err) {
        return false;
      }
    };
    const markSeen = () => {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch (err) {
        /* private browsing / storage disabled — popup may reappear, non-critical */
      }
    };

    const openPopup = () => {
      lastFocused = document.activeElement;
      newsletterPopup.classList.add("is-open");
      newsletterPopup.setAttribute("aria-hidden", "false");
      const closeBtn = newsletterPopup.querySelector(".newsletter-popup__close");
      if (closeBtn) closeBtn.focus();
    };
    const closePopup = () => {
      newsletterPopup.classList.remove("is-open");
      newsletterPopup.setAttribute("aria-hidden", "true");
      markSeen();
      if (lastFocused) lastFocused.focus();
    };

    if (!alreadySeen()) {
      const delay = (parseFloat(newsletterPopup.dataset.delaySeconds) || 6) * 1000;
      setTimeout(() => {
        if (!alreadySeen()) openPopup();
      }, delay);
    }

    newsletterPopup.querySelectorAll("[data-newsletter-close]").forEach((el) => {
      el.addEventListener("click", closePopup);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && newsletterPopup.classList.contains("is-open")) closePopup();
    });

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector("button[type=submit]");
        if (submitBtn) submitBtn.disabled = true;
        if (status) {
          status.textContent = "";
          status.removeAttribute("data-state");
        }

        fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: new FormData(form).get("email") }),
        })
          .then((response) => {
            if (!response.ok) throw new Error("Newsletter signup failed");
            if (status) {
              status.textContent = form.dataset.successMessage || "";
              status.setAttribute("data-state", "success");
            }
            markSeen();
            form.reset();
            setTimeout(closePopup, 1800);
          })
          .catch(() => {
            if (status) {
              status.textContent = form.dataset.errorMessage || "";
              status.setAttribute("data-state", "error");
            }
          })
          .finally(() => {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
    }
  }
})();

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');

  /* ========================================================================
     1. Two-State Dark Mode Toggle (System default vs Opposite literal override)
     ======================================================================== */
  function getRenderedScheme() {
    const content = metaColorScheme?.getAttribute('content') || 'light dark';
    if (content === 'dark' || content === 'light') return content;
    return systemDarkQuery.matches ? 'dark' : 'light';
  }

  function applyStoredScheme(value) {
    if (!metaColorScheme) return;
    metaColorScheme.setAttribute('content', value || 'light dark');
  }

  function toggleColorScheme() {
    const current = getRenderedScheme();
    const target = current === 'dark' ? 'light' : 'dark';
    const systemScheme = systemDarkQuery.matches ? 'dark' : 'light';

    try {
      if (target === systemScheme) {
        localStorage.removeItem('color-scheme');
        applyStoredScheme('light dark');
      } else {
        localStorage.setItem('color-scheme', target);
        applyStoredScheme(target);
      }
    } catch {
      applyStoredScheme(target);
    }
  }

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleColorScheme);
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'color-scheme') {
      applyStoredScheme(event.newValue || 'light dark');
    }
  });

  /* ========================================================================
     2. Scroll Progress Fallback (when CSS scroll() timeline is unsupported)
     ======================================================================== */
  const progressBar = document.querySelector('.scroll-progress');
  if (
    progressBar &&
    !CSS.supports('animation-timeline', 'scroll()') &&
    !prefersReducedMotion.matches
  ) {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      progressBar.style.transform = `scaleX(${ratio})`;
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ========================================================================
     3. Scroll Reveal Fallback (when CSS view() + animation-range is unsupported)
     ======================================================================== */
  const revealEls = document.querySelectorAll('.reveal-on-scroll');
  if (
    revealEls.length > 0 &&
    !CSS.supports('(animation-timeline: view()) and (animation-range: entry)') &&
    !prefersReducedMotion.matches
  ) {
    revealEls.forEach((el) => el.classList.add('reveal-fallback'));

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ========================================================================
     4. Sidebar Active State Scrollspy (keeps boxed Profile/[Section] + dash synced)
     ======================================================================== */
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));

  if (sections.length > 0 && navLinks.length > 0) {
    const setActiveNav = (id) => {
      navLinks.forEach((link) => {
        const isMatch = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', isMatch);
        if (isMatch) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    const spyObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveNav(visible[0].target.id);
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] }
    );

    sections.forEach((sec) => spyObserver.observe(sec));
  }

  /* ========================================================================
     5. Mobile Navigation <dialog> Drawer (following navigation-drawer guide)
     ======================================================================== */
  const drawer = document.getElementById('mobile-drawer');
  const openBtn = document.getElementById('drawer-open');
  const closeBtn = document.getElementById('drawer-close');

  if (drawer && openBtn && closeBtn) {
    const scroller = drawer.querySelector('.Drawer-scroller');
    const sheet = drawer.querySelector('.Drawer-sheet');

    const openDrawer = async () => {
      drawer.showModal();
      if (!CSS.supports('scroll-initial-target', 'nearest')) {
        scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      scroller.scrollTo({ left: 0, behavior: 'auto' });
    };

    const closeDrawer = () => {
      scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'auto' });
    };

    const visibleThreshold = 1 / Math.max(1, window.innerWidth);
    const drawerObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        if (entry.intersectionRatio < visibleThreshold && drawer.open) {
          drawer.close();
          openBtn.setAttribute('aria-expanded', 'false');
        } else if (entry.intersectionRatio === 1) {
          openBtn.setAttribute('aria-expanded', 'true');
        }
      },
      { root: drawer, threshold: [visibleThreshold, 1] }
    );
    drawerObserver.observe(sheet);

    if (!CSS.supports('animation-timeline', 'scroll()')) {
      scroller.addEventListener('scroll', () => {
        const ratio = 1 - scroller.scrollLeft / Math.max(1, sheet.offsetWidth);
        drawer.style.setProperty('--drawer-backdrop', String(Math.max(0, Math.min(1, ratio))));
      }, { passive: true });
    }

    openBtn.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);

    drawer.addEventListener('click', (event) => {
      if (!sheet.contains(event.target)) {
        closeDrawer();
      }
    });

    drawer.addEventListener('cancel', (event) => {
      if (event.cancelable) {
        event.preventDefault();
        closeDrawer();
      }
    });

    drawer.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });
  }

  /* ========================================================================
     6. Contact Form Mailto Composer & Copy Email Action
     ======================================================================== */
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');
  if (contactForm && formStatus) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(contactForm);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const message = String(data.get('message') || '').trim();

      if (!name || !email || !message) {
        formStatus.textContent = 'Please complete all fields before sending.';
        return;
      }

      const subject = encodeURIComponent(`Portfolio Inquiry from ${name}`);
      const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
      formStatus.textContent = 'Opening your email client with a pre-filled message…';
      window.location.href = `mailto:kalvatara554@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  const copyBtn = document.querySelector('[data-copy-email]');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('kalvatara554@gmail.com');
        const label = copyBtn.querySelector('[data-copy-label]');
        if (label) {
          const prev = label.textContent;
          label.textContent = 'Copied!';
          setTimeout(() => {
            label.textContent = prev;
          }, 1800);
        }
      } catch {
        // Clipboard unavailable; fallback is normal mailto link
      }
    });
  }
})();

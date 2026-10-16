/* ============================================================
   WILLIAM · Interacciones de la página
   ============================================================ */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = window.matchMedia('(hover: none)').matches;

/* ------------------------------------------------------------
   Navegación móvil
   ------------------------------------------------------------ */
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav__link');

const closeMenu = () => {
  if (!navMenu || !navToggle) return;
  navMenu.classList.remove('is-open');
  navToggle.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
};

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.forEach((link) => link.addEventListener('click', closeMenu));

  document.addEventListener('click', (event) => {
    if (!navMenu.contains(event.target) && !navToggle.contains(event.target)) {
      closeMenu();
    }
  });
}

/* ------------------------------------------------------------
   Header: borde sutil al desplazar
   ------------------------------------------------------------ */
const header = document.querySelector('.header');

window.addEventListener(
  'scroll',
  () => {
    if (!header) return;
    header.style.borderBottomColor = window.scrollY > 24 ? 'rgba(236,231,220,0.14)' : 'rgba(236,231,220,0.07)';
  },
  { passive: true }
);

/* ------------------------------------------------------------
   Enlace activo según sección visible
   ------------------------------------------------------------ */
const sections = document.querySelectorAll('main section[id]');

if ('IntersectionObserver' in window && sections.length) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('id');
        navLinks.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
        });
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

/* ------------------------------------------------------------
   Año dinámico
   ------------------------------------------------------------ */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

/* ------------------------------------------------------------
   Lightbox (galería)
   ------------------------------------------------------------ */
const galleryButtons = document.querySelectorAll('[data-gallery-btn]');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxBackdrop = document.querySelector('[data-lightbox-close]');

const openLightbox = (src, alt) => {
  if (!lightbox || !lightboxImg || !src) return;
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  lightbox.classList.add('is-active');
  document.body.style.overflow = 'hidden';
  if (lightboxClose) lightboxClose.focus();
};

const closeLightbox = () => {
  if (!lightbox || !lightboxImg) return;
  lightbox.classList.remove('is-active');
  document.body.style.overflow = '';
  setTimeout(() => {
    if (!lightbox.classList.contains('is-active')) {
      lightboxImg.src = '';
      lightboxImg.alt = '';
    }
  }, 300);
};

galleryButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openLightbox(btn.getAttribute('data-src'), btn.getAttribute('data-alt'));
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(btn.getAttribute('data-src'), btn.getAttribute('data-alt'));
    }
  });
});

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLightbox();
    closeMenu();
  }
});

/* ------------------------------------------------------------
   Polaroid · inclinación que sigue al cursor
   ------------------------------------------------------------ */
const MAX_TILT = 14; // grados
const polaroids = document.querySelectorAll('[data-polaroid]');

const setPolaroidVars = (el, clientX, clientY) => {
  const rect = el.getBoundingClientRect();
  const px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

  el.style.setProperty('--ry', ((px - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
  el.style.setProperty('--rx', ((0.5 - py) * 2 * MAX_TILT).toFixed(2) + 'deg');
  el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
  el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
};

const activatePolaroid = (el, clientX, clientY) => {
  el.classList.add('is-active');
  setPolaroidVars(el, clientX, clientY);
};

const resetPolaroid = (el) => {
  el.classList.remove('is-active');
  ['--rx', '--ry', '--mx', '--my'].forEach((v) => el.style.removeProperty(v));
};

if (polaroids.length && !prefersReducedMotion) {
  polaroids.forEach((el) => {
    // Ratón / lápiz: sigue al cursor
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      activatePolaroid(el, e.clientX, e.clientY);
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && !el.classList.contains('is-active')) return;
      if (!el.classList.contains('is-active')) el.classList.add('is-active');
      setPolaroidVars(el, e.clientX, e.clientY);
    });

    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return;
      resetPolaroid(el);
    });

    // Táctil: activa al tocar y sigue el dedo
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      activatePolaroid(el, e.clientX, e.clientY);
    });

    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') resetPolaroid(el);
    });

    el.addEventListener('pointercancel', () => resetPolaroid(el));
  });
}

/* ------------------------------------------------------------
   Reveal on scroll
   ------------------------------------------------------------ */
const revealEls = document.querySelectorAll('[data-reveal]');

if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const revealObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );

  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-inview'));
}

/* ------------------------------------------------------------
   Efecto magnético sutil en botones (solo escritorio)
   ------------------------------------------------------------ */
if (!isCoarsePointer && !prefersReducedMotion) {
  document.querySelectorAll('.btn, .nav__cta, .wa-float').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) * 0.12;
      const dy = (e.clientY - rect.top - rect.height / 2) * 0.2;
      el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    });

    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

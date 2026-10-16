// Navegación móvil
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav__link');

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', (event) => {
    if (!navMenu.contains(event.target) && !navToggle.contains(event.target)) {
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Cerrar con ESC
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Año dinámico en footer
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear().toString();
}

// Lightbox galería
const galleryButtons = document.querySelectorAll('[data-gallery-btn]');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxBackdrop = document.querySelector('[data-lightbox-close]');

let currentSrc = '';
let currentAlt = '';

const openLightbox = (src, alt) => {
  if (!lightbox || !lightboxImg) return;
  currentSrc = src;
  currentAlt = alt || '';
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  lightbox.classList.add('is-active');
  document.body.style.overflow = 'hidden';
};

const closeLightbox = () => {
  if (!lightbox || !lightboxImg) return;
  lightbox.classList.remove('is-active');
  document.body.style.overflow = '';
  // Limpia src para evitar mostrar imagen anterior
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
    const src = btn.getAttribute('data-src');
    const alt = btn.getAttribute('data-alt');
    if (src) {
      openLightbox(src, alt);
    }
  });

  // Soporte teclado
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const src = btn.getAttribute('data-src');
      const alt = btn.getAttribute('data-alt');
      if (src) {
        openLightbox(src, alt);
      }
    }
  });
});

if (lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
}

if (lightboxBackdrop) {
  lightboxBackdrop.addEventListener('click', closeLightbox);
}

// Cerrar lightbox con ESC
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLightbox();
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    if (navMenu) navMenu.classList.remove('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }
});

// Reveal on scroll con IntersectionObserver
const revealEls = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  revealEls.forEach((el) => {
    observer.observe(el);
  });
} else {
  // Fallback
  revealEls.forEach((el) => {
    el.classList.add('is-inview');
  });
}

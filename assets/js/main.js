/* ============================================================
   WILLIAMS · Interacciones de la página
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
   Enlace activo según la página actual
   ------------------------------------------------------------ */
// Páginas que no están en el menú y marcan como activa la sección a la que pertenecen
const parentPages = { 'curso.html': 'cursos.html' };
const pageName = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
const currentPage = parentPages[pageName] || pageName;

navLinks.forEach((link) => {
  const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
  link.classList.toggle('is-active', href === currentPage);
});

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
const lightboxVideo = document.getElementById('lightbox-video');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxBackdrop = document.querySelector('[data-lightbox-close]');

const resetLightboxMedia = () => {
  if (lightboxImg) {
    lightboxImg.hidden = true;
    lightboxImg.src = '';
    lightboxImg.alt = '';
  }
  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.hidden = true;
    lightboxVideo.removeAttribute('src');
    lightboxVideo.load();
  }
};

const openLightbox = (src, alt) => {
  if (!lightbox || !lightboxImg || !src) return;
  resetLightboxMedia();
  lightboxImg.hidden = false;
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  lightbox.classList.add('is-active');
  document.body.style.overflow = 'hidden';
  if (lightboxClose) lightboxClose.focus();
};

const openVideoLightbox = (src) => {
  if (!lightbox || !lightboxVideo || !src) return;
  resetLightboxMedia();
  lightboxVideo.hidden = false;
  lightboxVideo.src = src;
  lightbox.classList.add('is-active');
  document.body.style.overflow = 'hidden';
  const played = lightboxVideo.play();
  if (played && typeof played.catch === 'function') played.catch(() => {});
  if (lightboxClose) lightboxClose.focus();
};

const closeLightbox = () => {
  if (!lightbox) return;
  lightbox.classList.remove('is-active');
  document.body.style.overflow = '';
  setTimeout(() => {
    if (!lightbox.classList.contains('is-active')) resetLightboxMedia();
  }, 300);
};

galleryButtons.forEach((btn) => {
  const open = () => {
    const video = btn.getAttribute('data-video');
    if (video) {
      openVideoLightbox(video);
      return;
    }
    openLightbox(btn.getAttribute('data-src'), btn.getAttribute('data-alt'));
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
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
   Videos automáticos: se aseguran de reproducirse al entrar a la
   página. Si el navegador bloquea la reproducción (ahorro de batería
   o de datos), arrancan con el primer toque, scroll o tecla, y se
   reanudan cada vez que vuelven a estar en pantalla.
   ------------------------------------------------------------ */
const autoVideos = Array.from(document.querySelectorAll('video[autoplay]'));

if (autoVideos.length) {
  const playVideo = (video) => {
    video.muted = true;
    const attempt = video.play();
    return attempt && attempt.catch ? attempt.catch(() => {}) : Promise.resolve();
  };

  autoVideos.forEach(playVideo);

  const unlockEvents = ['pointerdown', 'touchstart', 'scroll', 'keydown'];
  const unlock = () => {
    autoVideos.filter((video) => video.paused).forEach(playVideo);
    unlockEvents.forEach((type) => window.removeEventListener(type, unlock));
  };
  unlockEvents.forEach((type) => window.addEventListener(type, unlock, { passive: true }));

  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.paused) playVideo(entry.target);
      });
    }, { threshold: 0.25 });
    autoVideos.forEach((video) => videoObserver.observe(video));
  }
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

/* ------------------------------------------------------------
   Tarjetas "Qué trabajamos": giro y luz que siguen al cursor,
   y un recorrido automático que va encendiendo una a una
   ------------------------------------------------------------ */
const CARD_TILT = 8; // grados
const temasGroups = document.querySelectorAll('[data-temas]');

temasGroups.forEach((group) => {
  const cards = Array.from(group.querySelectorAll('[data-tilt]'));
  if (!cards.length) return;

  // Cuando termina la entrada escalonada, las tarjetas responden sin retraso
  setTimeout(() => group.classList.add('is-ready'), 1500);

  if (!prefersReducedMotion) {
    cards.forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;

        card.classList.add('is-active');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        if (e.pointerType !== 'touch') {
          card.style.setProperty('--ry', ((px - 0.5) * 2 * CARD_TILT).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((0.5 - py) * 2 * CARD_TILT).toFixed(2) + 'deg');
        }
      });

      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-active');
        ['--rx', '--ry', '--mx', '--my'].forEach((v) => card.style.removeProperty(v));
      });
    });
  }

  // Recorrido automático: se detiene mientras el usuario interactúa
  if (prefersReducedMotion) return;

  let index = -1;
  let paused = false;
  let visible = false;

  const step = () => {
    cards.forEach((c) => c.classList.remove('is-lit'));
    if (paused || !visible) return;
    index = (index + 1) % cards.length;
    cards[index].classList.add('is-lit');
  };

  setInterval(step, 2200);

  group.addEventListener('pointerenter', () => { paused = true; step(); });
  group.addEventListener('pointerleave', () => { paused = false; });
  group.addEventListener('focusin', () => { paused = true; step(); });
  group.addEventListener('focusout', () => { paused = false; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.3 }).observe(group);
  } else {
    visible = true;
  }
});

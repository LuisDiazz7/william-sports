/* ============================================================
   WILLIAM SPORT · Clínica Certificado Monitor de Fútbol
   Tarjeta flotante del evento (solo en el inicio): cuenta
   regresiva y modal de detalles. Componente autocontenido.
   ============================================================ */

(function () {
  const card = document.getElementById('evento-card');
  if (!card) return;

  const EVENT_START = Date.UTC(2026, 10, 13, 13, 0, 0); // Vie 13 nov 2026 · 10:00 hrs Chile (UTC-3)

  const countdown = document.getElementById('evento-countdown');
  const doneEl = document.getElementById('evento-done');
  const ctaLink = document.getElementById('evento-cta');

  /* ----------------------------------------------------------
     Entrada suave (aparece apenas carga la página)
     ---------------------------------------------------------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealCard = () => card.classList.add('is-visible');

  if (reduceMotion) {
    revealCard();
  } else {
    window.requestAnimationFrame(() => window.requestAnimationFrame(revealCard));
  }

  /* ----------------------------------------------------------
     Cuenta regresiva
     ---------------------------------------------------------- */
  const units = {
    days: document.getElementById('evento-days'),
    hours: document.getElementById('evento-hours'),
    mins: document.getElementById('evento-mins'),
    secs: document.getElementById('evento-secs'),
  };

  const pad = (value) => String(value).padStart(2, '0');
  let timerId = null;

  const renderCountdown = () => {
    const remaining = EVENT_START - Date.now();

    if (remaining <= 0) {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
      if (countdown) countdown.hidden = true;
      if (doneEl) doneEl.hidden = false;
      if (ctaLink) ctaLink.hidden = true;
      return;
    }

    const total = Math.floor(remaining / 1000);
    if (units.days) units.days.textContent = pad(Math.floor(total / 86400));
    if (units.hours) units.hours.textContent = pad(Math.floor((total % 86400) / 3600));
    if (units.mins) units.mins.textContent = pad(Math.floor((total % 3600) / 60));
    if (units.secs) units.secs.textContent = pad(total % 60);
  };

  renderCountdown();
  if (timerId === null && EVENT_START - Date.now() > 0) {
    timerId = window.setInterval(renderCountdown, 1000);
  }

  /* ----------------------------------------------------------
     Modal de detalles
     ---------------------------------------------------------- */
  const modal = document.getElementById('evento-modal');
  const openBtn = document.getElementById('evento-open');

  if (modal && openBtn) {
    const closeBtn = modal.querySelector('.evento-modal__close');
    let lastFocused = null;

    const openModal = () => {
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('evento-no-scroll');
      if (closeBtn) closeBtn.focus();
    };

    const closeModal = () => {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove('evento-no-scroll');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      } else {
        openBtn.focus();
      }
    };

    openBtn.addEventListener('click', openModal);
    modal.querySelectorAll('[data-evento-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  /* ----------------------------------------------------------
     Afiche: si el archivo aún no está disponible, se oculta la
     miniatura para no dejar un hueco roto.
     ---------------------------------------------------------- */
  card.querySelectorAll('[data-evento-poster]').forEach((img) => {
    const handleError = () => {
      img.hidden = true;
      if (img.classList.contains('evento-card__thumb')) img.style.display = 'none';
    };
    img.addEventListener('error', handleError);
    if (img.complete && img.naturalWidth === 0) handleError();
  });
})();

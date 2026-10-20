/* ============================================================
   CURSO · Información del evento + inscripción con Webpay
   IIFE autocontenida (mismo patrón que evento.js)
   ============================================================ */

(function () {
  'use strict';

  // Si la página no está servida por el backend (file://, Live Server, etc.),
  // se intenta el backend local. En producción son el mismo origen.
  var API_CANDIDATES = ['', 'http://localhost:3000'];
  var apiBase = '';

  var $ = function (id) { return document.getElementById(id); };

  function fmtFecha(iso, tz) {
    try {
      return new Date(iso).toLocaleDateString('es-CL', {
        timeZone: tz,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch (e) { return iso; }
  }

  function fmtHora(iso, tz) {
    try {
      return new Date(iso).toLocaleTimeString('es-CL', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) { return iso; }
  }

  function fmtCLP(amount, currency) {
    return '$' + new Intl.NumberFormat('es-CL').format(amount) +
      (currency && currency !== 'CLP' ? ' ' + currency : '');
  }

  function mayus(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function tryFetchEvento() {
    var i = 0;
    function attempt() {
      return fetchJson(API_CANDIDATES[i] + '/api/evento')
        .then(function (data) {
          apiBase = API_CANDIDATES[i];
          return data;
        })
        .catch(function () {
          i += 1;
          if (i >= API_CANDIDATES.length) throw new Error('sin backend');
          return attempt();
        });
    }
    return attempt();
  }

  function renderEvento(ev) {
    $('curso-title').textContent = ev.title;

    if (ev.edition) {
      $('curso-edition').textContent = ev.edition;
      $('curso-edition').hidden = false;
    }

    $('curso-description').textContent = ev.description || '';

    $('curso-fecha').textContent = mayus(fmtFecha(ev.startsAt, ev.timezone));
    $('curso-horario').textContent = fmtHora(ev.startsAt, ev.timezone) + ' – ' + fmtHora(ev.endsAt, ev.timezone);

    if (ev.venue) {
      $('curso-lugar').textContent = [ev.venue.name, ev.venue.commune, ev.venue.city]
        .filter(Boolean).join(', ');
    }

    if (ev.speaker) {
      $('curso-speaker').textContent = ev.speaker.name + ' — ' + ev.speaker.role;
    }

    if (ev.organizers && ev.organizers.length) {
      $('curso-organizers').textContent = ev.organizers.join(' · ');
    }

    if (ev.includes && ev.includes.length) {
      var ul = $('curso-includes');
      ul.innerHTML = '';
      ev.includes.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item.label;
        if (item.note) {
          var span = document.createElement('span');
          span.className = 'curso__includes-note';
          span.textContent = item.note;
          li.appendChild(span);
        }
        if (item.issuer) {
          var span2 = document.createElement('span');
          span2.className = 'curso__includes-note';
          span2.textContent = 'Emitido por ' + item.issuer;
          li.appendChild(span2);
        }
        ul.appendChild(li);
      });
    }

    if (ev.price) {
      $('curso-price').textContent = ev.price.label || fmtCLP(ev.price.amount, ev.price.currency);
      $('curso-price-note').textContent = ev.price.note || '';
    }

    if (ev.paymentMethods && ev.paymentMethods.length) {
      var pm = $('curso-payment-methods');
      pm.textContent = 'Medios de pago: ' + ev.paymentMethods
        .map(function (m) { return m.label + ' — ' + m.description; })
        .join(' · ');
      pm.hidden = false;
    }

    if (ev.sizes && ev.sizes.length) {
      var select = $('size');
      ev.sizes.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        select.appendChild(opt);
      });
    }

    if (ev.contact) {
      if (ev.contact.whatsapp) {
        var wa = $('curso-whatsapp');
        wa.href = 'https://wa.me/' + ev.contact.whatsapp.replace(/\+/g, '');
      }
      if (ev.contact.instagram) {
        var ig = $('curso-instagram');
        var handle = ev.contact.instagram.replace('@', '');
        ig.href = 'https://www.instagram.com/' + handle;
        ig.textContent = ev.contact.instagram;
      }
    }

    document.title = ev.title + ' | Williams Sport';
  }

  function showError(mensaje) {
    var el = $('load-error');
    if (mensaje) el.textContent = mensaje;
    el.hidden = false;
    $('curso-title').textContent = 'Curso no disponible';
  }

  function initForm() {
    var form = $('inscripcion-form');
    var btn = $('submit-btn');
    var btnText = $('submit-text');
    var errorEl = $('form-error');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorEl.hidden = true;

      var data = {
        fullName: form.fullName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        size: form.size.value,
      };

      // Validación básica en cliente (la definitiva es la del servidor)
      if (data.fullName.length < 3) return mostrarError('Ingresa tu nombre completo (mínimo 3 caracteres).');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return mostrarError('Ingresa un correo válido.');
      if (!/^(\+56\s?9\s?\d{4}\s?\d{4})$/.test(data.phone.replace(/\s+/g, '')) &&
        !/^(\+569\d{8})$/.test(data.phone.replace(/\s+/g, ''))) {
        return mostrarError('Teléfono en formato chileno: +569XXXXXXXX.');
      }
      if (!data.size) return mostrarError('Selecciona la talla de tu polera.');

      btn.disabled = true;
      btnText.textContent = 'Redirigiendo a Webpay…';

      fetch(apiBase + '/api/evento/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { ok: res.ok, body: body };
          });
        })
        .then(function (r) {
          if (!r.ok || !r.body.url || !r.body.token) {
            var msg = (r.body && r.body.error && r.body.error.message) ||
              'No se pudo iniciar el pago. Intenta nuevamente.';
            throw new Error(msg);
          }
          // Redirect POST a Webpay (patrón oficial): token_ws + url
          var f = document.createElement('form');
          f.method = 'POST';
          f.action = r.body.url;
          var input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'token_ws';
          input.value = r.body.token;
          f.appendChild(input);
          document.body.appendChild(f);
          f.submit();
        })
        .catch(function (err) {
          mostrarError(err.message || 'Error de conexión con el servidor.');
          btn.disabled = false;
          btnText.textContent = 'Pagar con Webpay';
        });
    });

    function mostrarError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
  }

  tryFetchEvento()
    .then(renderEvento)
    .catch(function () {
      showError();
    });

  initForm();
})();

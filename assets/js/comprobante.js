/* ============================================================
   COMPROBANTE · Muestra el comprobante de pago o el estado
   IIFE autocontenida
   ============================================================ */

(function () {
  'use strict';

  var API_CANDIDATES = ['', 'http://localhost:3000'];
  var WHATSAPP = 'https://wa.me/56984267737';

  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');
  var estado = params.get('estado');

  var ESTADOS = {
    rejected: {
      badge: 'Pago rechazado',
      titulo: 'El pago no se pudo completar',
      mensaje: 'Transbank rechazó el pago. No se realizó ningún cobro. Puedes intentarlo nuevamente desde la página del curso.',
    },
    cancelled: {
      badge: 'Pago cancelado',
      titulo: 'Cancelaste el pago',
      mensaje: 'Cancelaste el proceso en Webpay. No se realizó ningún cobro. Cuando quieras, vuelve a la página del curso para inscribirte.',
    },
    failed: {
      badge: 'Error en el pago',
      titulo: 'Hubo un problema con el pago',
      mensaje: 'El proceso en Webpay tuvo un error o expiró. No se realizó ningún cobro. Intenta nuevamente desde la página del curso.',
    },
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(html) {
    document.getElementById('comp-card').innerHTML = html;
  }

  function acciones(extra) {
    return '<div class="comp__actions">' +
      (extra || '') +
      '<a class="btn btn--ghost" href="curso.html">Volver al curso</a>' +
      '<a class="btn btn--whatsapp" href="' + WHATSAPP + '" target="_blank" rel="noopener noreferrer">' +
      '<img class="btn__icon" src="assets/svg/whatsapp.svg" alt="" aria-hidden="true"> Consultar por WhatsApp</a>' +
      '</div>';
  }

  function renderEstado(clave) {
    var e = ESTADOS[clave] || ESTADOS.failed;
    render(
      '<span class="comp__badge comp__badge--error">' + e.badge + '</span>' +
      '<h1 class="comp__title">' + e.titulo + '</h1>' +
      '<p class="comp__msg">' + e.mensaje + '</p>' +
      acciones()
    );
    document.title = e.badge + ' | Williams Sport';
  }

  function renderNoEncontrado() {
    render(
      '<span class="comp__badge comp__badge--error">No encontrado</span>' +
      '<h1 class="comp__title">Comprobante no encontrado</h1>' +
      '<p class="comp__msg">El enlace no es válido o el pago aún no está confirmado. Si acabas de pagar, espera unos segundos y recarga la página.</p>' +
      acciones()
    );
    document.title = 'Comprobante no encontrado | Williams Sport';
  }

  function fila(etiqueta, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    return '<div class="comp__row"><dt>' + etiqueta + '</dt><dd>' + escapeHtml(valor) + '</dd></div>';
  }

  function renderComprobante(c) {
    render(
      '<span class="comp__badge comp__badge--ok">Pago confirmado</span>' +
      '<h1 class="comp__title">Comprobante de pago</h1>' +
      '<p class="comp__subtitle">' + escapeHtml(c.evento.title) + ' · ' + escapeHtml(c.evento.edition) + '</p>' +
      '<dl class="comp__list">' +
      fila('N.° de orden', c.numeroOrden) +
      fila('Participante', c.participante) +
      fila('Talla', c.talla) +
      fila('Fecha del evento', c.fecha) +
      fila('Horario', c.horario) +
      fila('Lugar', c.lugar) +
      fila('Monto', '$' + new Intl.NumberFormat('es-CL').format(c.monto) + ' ' + c.moneda) +
      fila('Fecha de pago', c.fechaPago) +
      fila('Tarjeta', c.tarjetaUltimos4 ? '**** ' + c.tarjetaUltimos4 : '') +
      fila('Código de autorización', c.codigoAutorizacion) +
      fila('Tipo de pago', c.tipoPago) +
      fila('Cuotas', c.cuotas) +
      fila('Correo', c.correo) +
      '</dl>' +
      '<p class="comp__msg">' + escapeHtml(c.mensaje) + '</p>' +
      acciones()
    );
    document.title = 'Comprobante ' + c.numeroOrden + ' | Williams Sport';
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (res.status === 404) return { __404: true };
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function buscarComprobante(i) {
    return fetchJson(API_CANDIDATES[i] + '/api/comprobante/' + encodeURIComponent(token))
      .then(function (data) {
        if (data.__404) { renderNoEncontrado(); return; }
        renderComprobante(data);
      })
      .catch(function () {
        if (i + 1 < API_CANDIDATES.length) return buscarComprobante(i + 1);
        renderNoEncontrado();
      });
  }

  if (token) {
    buscarComprobante(0);
  } else if (estado && ESTADOS[estado]) {
    renderEstado(estado);
  } else if (estado) {
    renderEstado('failed');
  } else {
    renderNoEncontrado();
  }
})();

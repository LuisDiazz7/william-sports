(function () {
  'use strict';

  var WHATSAPP =
    'https://wa.me/56984267737?text=' +
    encodeURIComponent('Hola Williams, tengo una consulta sobre mi pago.');

  var ESTADOS = {
    aprobado: {
      badge: 'Pago aprobado',
      titulo: 'Pago confirmado',
      mensaje:
        'Tu pago fue aprobado. Conserva el número de orden para cualquier consulta.',
      ok: true,
    },
    rechazado: {
      badge: 'Pago rechazado',
      titulo: 'El pago no se pudo completar',
      mensaje:
        'Transbank no autorizó el pago. No se realizó ningún cobro. Puedes intentarlo nuevamente desde la página del curso.',
      causas: [
        'Error en los datos de la tarjeta ingresados.',
        'Saldo o cupo insuficiente.',
        'Tarjeta no habilitada para compras en línea.',
      ],
      ok: false,
    },
    cancelado: {
      badge: 'Pago cancelado',
      titulo: 'Cancelaste el pago',
      mensaje:
        'Cancelaste el proceso en Webpay. No se realizó ningún cobro. Cuando quieras, vuelve a la página del curso para inscribirte.',
      ok: false,
    },
    timeout: {
      badge: 'Pago expirado',
      titulo: 'El pago expiró',
      mensaje:
        'El proceso en Webpay expiró por inactividad. No se realizó ningún cobro. Intenta nuevamente desde la página del curso.',
      ok: false,
    },
    error: {
      badge: 'Error en el pago',
      titulo: 'Hubo un problema con el pago',
      mensaje:
        'No pudimos confirmar el resultado del pago. Si ves un cargo en tu tarjeta, escríbenos por WhatsApp antes de intentarlo nuevamente.',
      ok: false,
    },
  };

  function escapeHtml(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render(html) {
    document.getElementById('comp-card').innerHTML = html;
  }

  function acciones() {
    return (
      '<div class="comp__actions">' +
      '<a class="btn btn--ghost" href="curso.html">Volver al curso</a>' +
      '<a class="btn btn--whatsapp" href="' +
      WHATSAPP +
      '" target="_blank" rel="noopener noreferrer">' +
      '<img class="btn__icon" src="assets/svg/whatsapp.svg" alt="" aria-hidden="true"> Consultar por WhatsApp</a>' +
      '</div>'
    );
  }

  function fila(etiqueta, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    return (
      '<div class="comp__row"><dt>' +
      etiqueta +
      '</dt><dd>' +
      escapeHtml(valor) +
      '</dd></div>'
    );
  }

  function formatearMonto(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    var monto = Number(valor);
    if (!Number.isFinite(monto)) return '';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(monto);
  }

  function formatearFecha(valor) {
    if (!valor) return '';
    var fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santiago',
    }).format(fecha);
  }

  function formatearCuotas(valor) {
    if (valor === null || valor === undefined) return '';
    if (valor === 0) return 'Sin cuotas';
    return valor === 1 ? '1 cuota' : valor + ' cuotas';
  }

  function listaCausas(causas) {
    if (!causas) return '';
    return (
      '<div class="comp__causes"><p>Posibles causas:</p><ul>' +
      causas
        .map(function (causa) {
          return '<li>' + causa + '</li>';
        })
        .join('') +
      '</ul></div>'
    );
  }

  function renderResultado(data) {
    var estado = ESTADOS[data.status] || ESTADOS.error;
    var monto = formatearMonto(data.amount);
    var fecha = formatearFecha(data.date);

    render(
      '<span class="comp__badge ' +
        (estado.ok ? 'comp__badge--ok' : 'comp__badge--error') +
        '">' +
        estado.badge +
        '</span>' +
        '<h1 class="comp__title">' +
        estado.titulo +
        '</h1>' +
        '<p class="comp__subtitle">' +
        escapeHtml(data.glosa || 'Clínica Certificado Monitor de Fútbol') +
        '</p>' +
        '<dl class="comp__list">' +
        fila('Comercio', data.commerce) +
        fila('Orden de compra', data.buyOrder) +
        fila('Monto', monto) +
        fila('Fecha', fecha) +
        fila('Código de autorización', data.authorizationCode) +
        fila('Tipo de pago', data.paymentType) +
        fila('Cuotas', formatearCuotas(data.installments)) +
        fila('Tarjeta', data.cardLast4 ? '•••• ' + data.cardLast4 : '') +
        '</dl>' +
        '<p class="comp__msg">' +
        estado.mensaje +
        '</p>' +
        listaCausas(estado.causas) +
        acciones()
    );

    document.title = estado.badge + ' | Williams Sport';
  }

  function renderInvalido(mensaje) {
    render(
      '<span class="comp__badge comp__badge--error">Resultado no disponible</span>' +
        '<h1 class="comp__title">No pudimos mostrar el resultado</h1>' +
        '<p class="comp__msg">' +
        mensaje +
        '</p>' +
        acciones()
    );
    document.title = 'Resultado no disponible | Williams Sport';
  }

  var params = new URLSearchParams(window.location.search);
  var token = params.get('t');

  if (!token) {
    renderInvalido(
      'El enlace de resultado no es válido. Si acabas de pagar, escríbenos por WhatsApp para revisar tu caso.'
    );
    return;
  }

  fetch('/api/webpay/resultado?t=' + encodeURIComponent(token))
    .then(function (respuesta) {
      if (!respuesta.ok) throw new Error('Resultado no disponible');
      return respuesta.json();
    })
    .then(function (data) {
      if (!data || !ESTADOS[data.status]) {
        renderInvalido(
          'El enlace de resultado expiró o no es válido. Si acabas de pagar, escríbenos por WhatsApp para revisar tu caso.'
        );
        return;
      }
      renderResultado(data);
    })
    .catch(function () {
      renderInvalido(
        'El enlace de resultado expiró o no es válido. Si acabas de pagar, escríbenos por WhatsApp para revisar tu caso.'
      );
    });
})();

(function () {
  'use strict';

  var WHATSAPP =
    'https://wa.me/56984267737?text=' +
    encodeURIComponent('Hola Williams, tengo una consulta sobre mi pago.');

  var ESTADOS = {
    aprobado: {
      badge: 'Pago aprobado',
      titulo: 'Pago realizado con éxito',
      tono: 'ok',
      mensaje:
        'Tu pago fue aprobado. Conserva el número de orden para cualquier consulta.',
      ok: true,
    },
    rechazado: {
      badge: 'Pago rechazado',
      titulo: 'El pago no se pudo completar',
      tono: 'error',
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
      tono: 'warn',
      mensaje:
        'Cancelaste el proceso en Webpay. No se realizó ningún cobro. Cuando quieras, vuelve a la página del curso para inscribirte.',
      ok: false,
    },
    timeout: {
      badge: 'Pago expirado',
      titulo: 'El pago expiró',
      tono: 'warn',
      mensaje:
        'El proceso en Webpay expiró por inactividad. No se realizó ningún cobro. Intenta nuevamente desde la página del curso.',
      ok: false,
    },
    error: {
      badge: 'Error en el pago',
      titulo: 'Hubo un problema con el pago',
      tono: 'error',
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

  var CURSO = 'Clínica Certificado Monitor de Fútbol';

  var ICONOS = {
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    error: '<path d="M7 7l10 10M17 7L7 17"/>',
    warn: '<path d="M12 7v6"/><path d="M12 16.5v.5"/>',
  };

  function icono(tono) {
    return (
      '<div class="comp__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONOS[tono] || ICONOS.error) +
      '</svg></div>'
    );
  }

  function cabecera() {
    return (
      '<header class="comp__head">' +
      '<div class="comp__brand">' +
      '<img src="assets/images/logo-williams-sport.png" alt="">' +
      '<span class="comp__brand-name">WILLIAMS SPORT</span>' +
      '</div>' +
      '<span class="comp__doc-label">Comprobante de pago</span>' +
      '</header>'
    );
  }

  function pie() {
    return (
      '<footer class="comp__foot">' +
      '<p><strong>Williams Sport SpA</strong> · RUT 78.473.946-5 · La Reina 868</p>' +
      '<p><a href="mailto:ventas@williamssport.cl">ventas@williamssport.cl</a> · WhatsApp ' +
      '<a href="https://wa.me/56984267737" target="_blank" rel="noopener noreferrer">+56 9 8426 7737</a></p>' +
      '<p><a href="/terminos">Términos y condiciones</a></p>' +
      '</footer>'
    );
  }

  function acciones(conPdf) {
    return (
      '<div class="comp__actions">' +
      (conPdf
        ? '<button type="button" class="comp__btn comp__btn--primary" id="comp-pdf">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>' +
          'Descargar comprobante PDF</button>'
        : '') +
      '<a class="comp__btn" href="curso.html">Volver al curso</a>' +
      '<a class="comp__btn comp__btn--wa" href="' +
      WHATSAPP +
      '" target="_blank" rel="noopener noreferrer">' +
      '<img src="assets/svg/whatsapp.svg" alt="" aria-hidden="true"> Consultar por WhatsApp</a>' +
      '</div>'
    );
  }

  function render(tono, html) {
    var card = document.getElementById('comp-card');
    card.className = 'comp__card comp--' + tono;
    card.innerHTML = cabecera() + html + pie();

    var pdf = document.getElementById('comp-pdf');
    if (pdf) {
      pdf.addEventListener('click', function () {
        window.print();
      });
    }
  }

  // En pagos aprobados se muestran todas las filas, aunque falte algún dato.
  function fila(etiqueta, valor, siempre, clase) {
    var vacio = valor === null || valor === undefined || valor === '';
    if (vacio && !siempre) return '';
    return (
      '<tr><th scope="row">' +
      etiqueta +
      '</th><td' +
      (clase ? ' class="' + clase + '"' : '') +
      '>' +
      (vacio ? '—' : escapeHtml(valor)) +
      '</td></tr>'
    );
  }

  function formatearMonto(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    var monto = Number(valor);
    if (!Number.isFinite(monto)) return '';
    return (
      new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
      }).format(monto) + ' CLP'
    );
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
      hour12: false,
      timeZone: 'America/Santiago',
    }).format(fecha) + ' hrs';
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
    var aprobado = data.status === 'aprobado';

    render(
      estado.tono,
      '<div class="comp__status">' +
        icono(estado.tono) +
        '<h1 class="comp__title">' +
        estado.titulo +
        '</h1>' +
        '<p class="comp__subtitle">' +
        CURSO +
        '</p>' +
        '</div>' +
        '<div class="comp__body">' +
        '<table class="comp__table" aria-label="Detalle del pago"><tbody>' +
        fila('Comercio', aprobado ? data.commerce || 'Williams Sport SpA' : null, aprobado) +
        fila('Orden de compra', data.buyOrder, aprobado) +
        fila('Descripción del servicio', data.glosa, aprobado) +
        fila('Monto', formatearMonto(data.amount), aprobado, 'comp__amount') +
        fila('Fecha y hora', formatearFecha(data.date), aprobado) +
        fila('Código de autorización', data.authorizationCode, aprobado) +
        fila('Tipo de pago', data.paymentType, aprobado) +
        fila('Cuotas', formatearCuotas(data.installments), aprobado) +
        fila('Tarjeta', data.cardLast4 ? '•••• ' + data.cardLast4 : '', aprobado) +
        '</tbody></table>' +
        '<p class="comp__msg">' +
        estado.mensaje +
        '</p>' +
        listaCausas(estado.causas) +
        '</div>' +
        acciones(aprobado)
    );

    document.title = estado.badge + ' | Williams Sport';
  }

  function renderInvalido(mensaje) {
    render(
      'error',
      '<div class="comp__status">' +
        icono('error') +
        '<h1 class="comp__title">No pudimos mostrar el resultado</h1>' +
        '<p class="comp__subtitle">' +
        CURSO +
        '</p>' +
        '</div>' +
        '<div class="comp__body"><p class="comp__msg">' +
        mensaje +
        '</p></div>' +
        acciones(false)
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

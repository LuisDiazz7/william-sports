(function () {
  'use strict';

  var botones = document.querySelectorAll('.js-pay');
  var toast = document.getElementById('toast');
  var toastTimer;
  var enviando = false;

  function mostrarAviso(mensaje) {
    if (!toast) return;
    toast.textContent = mensaje;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.hidden = true;
    }, 5000);
  }

  function esUrlTransbank(valor) {
    try {
      var url = new URL(valor);
      return (
        url.protocol === 'https:' &&
        (url.hostname === 'webpay3g.transbank.cl' ||
          url.hostname === 'webpay3gint.transbank.cl')
      );
    } catch (error) {
      return false;
    }
  }

  function irAWebpay(datos) {
    var formulario = document.createElement('form');
    formulario.method = 'POST';
    formulario.action = datos.url;
    formulario.acceptCharset = 'UTF-8';
    formulario.style.display = 'none';

    var token = document.createElement('input');
    token.type = 'hidden';
    token.name = 'token_ws';
    token.value = datos.token;

    formulario.appendChild(token);
    document.body.appendChild(formulario);
    formulario.submit();
  }

  function crearPago(producto) {
    return fetch('/api/webpay/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto: producto }),
    }).then(function (respuesta) {
      return respuesta.json().then(function (datos) {
        if (!respuesta.ok) {
          throw new Error(datos && datos.error ? datos.error : 'Error de pago');
        }
        return datos;
      });
    });
  }

  Array.prototype.forEach.call(botones, function (boton) {
    boton.addEventListener('click', function (evento) {
      evento.preventDefault();
      if (enviando) return;

      var producto = boton.getAttribute('data-producto');
      if (!producto) {
        mostrarAviso('No se pudo identificar el producto. Escríbenos por WhatsApp.');
        return;
      }

      enviando = true;
      boton.setAttribute('aria-busy', 'true');
      mostrarAviso('Conectando con Webpay…');

      crearPago(producto)
        .then(function (datos) {
          if (!datos || !esUrlTransbank(datos.url) || !datos.token) {
            throw new Error('Respuesta de Webpay inválida');
          }
          irAWebpay(datos);
        })
        .catch(function () {
          enviando = false;
          boton.removeAttribute('aria-busy');
          mostrarAviso(
            'No se pudo iniciar el pago. Intenta nuevamente o escríbenos por WhatsApp.'
          );
        });
    });
  });
})();

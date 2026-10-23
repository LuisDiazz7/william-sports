import crypto from 'node:crypto';
import { generarBuyOrder, getProducto } from '../_lib/productos.js';
import { createWebpay, isTransbankUrl } from '../_lib/webpay.js';
import { assertResultTokenConfig } from '../_lib/result-token.js';
import {
  getSiteUrl,
  logError,
  logEvent,
  methodNotAllowed,
  readBody,
  sendJson,
} from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Solicitud inválida.' });
  }

  const producto = getProducto(body?.producto);
  if (!producto) {
    return sendJson(res, 400, { error: 'Producto inválido.' });
  }

  try {
    assertResultTokenConfig();
    const siteUrl = getSiteUrl(process.env);
    const webpay = createWebpay(process.env);
    const buyOrder = generarBuyOrder(producto);
    const sessionId = `ws-${crypto.randomBytes(8).toString('hex')}`;
    const returnUrl = `${siteUrl}/api/webpay/confirmar`;

    const tx = await webpay.create(
      buyOrder,
      sessionId,
      producto.monto,
      returnUrl
    );

    if (
      !tx ||
      typeof tx.url !== 'string' ||
      typeof tx.token !== 'string' ||
      !isTransbankUrl(tx.url)
    ) {
      throw new Error('Respuesta inválida de Webpay');
    }

    logEvent('webpay_create', {
      buyOrder,
      producto: producto.id,
      glosa: producto.glosa,
      monto: producto.monto,
      environment: webpay.environment,
    });

    return sendJson(res, 200, { url: tx.url, token: tx.token });
  } catch (error) {
    logError('webpay_create_error', error);
    return sendJson(res, 502, {
      error: 'No se pudo iniciar el pago. Intenta nuevamente.',
    });
  }
}

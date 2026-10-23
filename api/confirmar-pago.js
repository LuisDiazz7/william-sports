import { findProductoByBuyOrder } from './_lib/productos.js';
import { createWebpay, mapCommitResult } from './_lib/webpay.js';
import {
  assertResultTokenConfig,
  createResultToken,
} from './_lib/result-token.js';
import {
  getSiteUrl,
  logError,
  logEvent,
  methodNotAllowed,
  readBody,
  sendJson,
  sendRedirect,
} from './_lib/http.js';

function first(value) {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function redirectResult(res, siteUrl, data) {
  const token = createResultToken(data);
  return sendRedirect(
    res,
    `${siteUrl}/comprobante.html?t=${encodeURIComponent(token)}`
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  let input;
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const query = Object.fromEntries(url.searchParams);
    const body = req.method === 'POST' ? await readBody(req) : {};
    input = { ...query, ...(req.query || {}), ...body };
  } catch {
    return sendJson(res, 400, { error: 'Solicitud de retorno inválida.' });
  }

  const tokenWs = first(input.token_ws);
  const tbkToken = first(input.TBK_TOKEN);
  const tbkOrder = first(input.TBK_ORDEN_COMPRA);
  const tbkSession =
    first(input.TBK_ID_SESION) || first(input.TBK_ID_SESSION);

  let siteUrl;
  try {
    siteUrl = getSiteUrl(process.env);
  } catch (error) {
    logError('webpay_return_config_error', error);
    return sendJson(res, 500, { error: 'Configuración de pago incompleta.' });
  }

  try {
    assertResultTokenConfig();

    if (tokenWs && !tbkToken) {
      const webpay = createWebpay(process.env);

      try {
        const commit = mapCommitResult(await webpay.commit(tokenWs));
        const producto = findProductoByBuyOrder(commit.buyOrder);
        const status = commit.authorized ? 'aprobado' : 'rechazado';
        const amount =
          commit.amount > 0 ? commit.amount : producto?.monto ?? null;
        const date = commit.transactionDate || new Date().toISOString();

        logEvent('webpay_commit', {
          buyOrder: commit.buyOrder,
          status,
          monto: amount,
          date,
          environment: webpay.environment,
        });

        return redirectResult(res, siteUrl, {
          status,
          buyOrder: commit.buyOrder,
          amount,
          date,
        });
      } catch (error) {
        logError('webpay_commit_error', error);

        return redirectResult(res, siteUrl, {
          status: 'error',
          buyOrder: null,
          amount: null,
          date: new Date().toISOString(),
        });
      }
    }

    if (tokenWs && tbkToken) {
      const producto = findProductoByBuyOrder(tbkOrder);

      logEvent('webpay_error_return', {
        buyOrder: tbkOrder || null,
        status: 'error',
        monto: producto?.monto ?? null,
      });

      return redirectResult(res, siteUrl, {
        status: 'error',
        buyOrder: tbkOrder || null,
        amount: producto?.monto ?? null,
        date: new Date().toISOString(),
      });
    }

    if (!tokenWs && tbkToken) {
      const producto = findProductoByBuyOrder(tbkOrder);

      logEvent('webpay_abort', {
        buyOrder: tbkOrder || null,
        status: 'cancelado',
        monto: producto?.monto ?? null,
      });

      return redirectResult(res, siteUrl, {
        status: 'cancelado',
        buyOrder: tbkOrder || null,
        amount: producto?.monto ?? null,
        date: new Date().toISOString(),
      });
    }

    if (!tokenWs && !tbkToken && (tbkOrder || tbkSession)) {
      const producto = findProductoByBuyOrder(tbkOrder);

      logEvent('webpay_timeout', {
        buyOrder: tbkOrder || null,
        status: 'timeout',
        monto: producto?.monto ?? null,
      });

      return redirectResult(res, siteUrl, {
        status: 'timeout',
        buyOrder: tbkOrder || null,
        amount: producto?.monto ?? null,
        date: new Date().toISOString(),
      });
    }

    logEvent('webpay_invalid_return', { method: req.method });
    return sendJson(res, 400, { error: 'Solicitud de retorno inválida.' });
  } catch (error) {
    logError('webpay_result_error', error);
    return sendJson(res, 500, {
      error: 'No se pudo procesar el resultado del pago.',
    });
  }
}

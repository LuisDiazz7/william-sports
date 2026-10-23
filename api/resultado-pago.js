import { verifyResultToken } from './_lib/result-token.js';
import { methodNotAllowed, sendJson } from './_lib/http.js';

const STATUSES = new Set([
  'aprobado',
  'rechazado',
  'cancelado',
  'timeout',
  'error',
]);

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const token =
    url.searchParams.get('t') ||
    (typeof req.query?.t === 'string' ? req.query.t : '');

  let data;
  try {
    data = verifyResultToken(token);
  } catch {
    return sendJson(res, 500, { error: 'Resultado no disponible.' });
  }

  if (!data || !STATUSES.has(data.status)) {
    return sendJson(res, 400, { error: 'Token inválido o expirado.' });
  }

  const amount =
    data.amount === null || data.amount === undefined
      ? null
      : Number(data.amount);

  return sendJson(res, 200, {
    status: data.status,
    buyOrder: typeof data.buyOrder === 'string' ? data.buyOrder : null,
    amount: Number.isFinite(amount) ? amount : null,
    date: typeof data.date === 'string' ? data.date : null,
  });
}

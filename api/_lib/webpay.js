import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  WebpayPlus,
  Options,
  Environment,
  IntegrationCommerceCodes,
} = require('transbank-sdk');

// Las credenciales se leen solo desde variables de entorno, en ambos entornos.
export function createWebpay(env = process.env) {
  const environment =
    String(env.WEBPAY_ENV || 'integration').trim().toLowerCase();
  if (environment !== 'integration' && environment !== 'production') {
    throw new Error('WEBPAY_ENV debe ser integration o production');
  }
  const isProduction = environment === 'production';
  const commerceCode = String(env.WEBPAY_COMMERCE_CODE || '').trim();
  const apiKey = String(env.WEBPAY_API_KEY || '').trim();

  if (!commerceCode || !apiKey) {
    throw new Error('WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY son obligatorios');
  }

  if (isProduction && commerceCode === IntegrationCommerceCodes.WEBPAY_PLUS) {
    throw new Error(
      'WEBPAY_ENV=production no puede usar el código de comercio de integración'
    );
  }

  const options = new Options(
    commerceCode,
    apiKey,
    isProduction ? Environment.Production : Environment.Integration
  );

  return {
    environment,
    create(buyOrder, sessionId, amount, returnUrl) {
      return new WebpayPlus.Transaction(options).create(
        buyOrder,
        sessionId,
        amount,
        returnUrl
      );
    },
    commit(token) {
      return new WebpayPlus.Transaction(options).commit(token);
    },
  };
}

export function mapCommitResult(result = {}) {
  const rawStatus = result.status ?? result.statusCode ?? null;
  const responseCode = result.response_code ?? result.responseCode ?? null;
  const normalizedResponseCode =
    responseCode === null || responseCode === undefined || responseCode === ''
      ? null
      : Number(responseCode);

  let authorized =
    typeof result.authorized === 'boolean' ? result.authorized : null;

  if (normalizedResponseCode !== null) {
    const codeAuthorized = normalizedResponseCode === 0;
    authorized =
      authorized === null ? codeAuthorized : authorized && codeAuthorized;
  }

  if (rawStatus !== null && rawStatus !== undefined) {
    const normalizedStatus = String(rawStatus).toUpperCase();
    const statusAuthorized =
      normalizedStatus === 'AUTHORIZED' || normalizedStatus === '0';
    authorized =
      authorized === null ? statusAuthorized : authorized && statusAuthorized;
  }

  const amount = Number(result.amount ?? result.total_amount ?? result.totalAmount ?? 0);

  return {
    authorized: authorized === true,
    buyOrder: result.buy_order ?? result.buyOrder ?? null,
    amount: Number.isFinite(amount) ? amount : 0,
    transactionDate: result.transaction_date ?? result.transactionDate ?? null,
  };
}

export function isTransbankUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'webpay3g.transbank.cl' ||
        url.hostname === 'webpay3gint.transbank.cl')
    );
  } catch {
    return false;
  }
}

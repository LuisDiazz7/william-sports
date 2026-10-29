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
    authorizationCode: sanitizeAuthorizationCode(
      result.authorization_code ?? result.authorizationCode
    ),
    paymentType: mapPaymentType(
      result.payment_type_code ?? result.paymentTypeCode
    ),
    installments: sanitizeInstallments(
      result.installments_number ?? result.installmentsNumber
    ),
    cardLast4: sanitizeCardLast4(
      result.card_detail?.card_number ?? result.cardDetail?.cardNumber
    ),
  };
}

const PAYMENT_TYPES = {
  VD: 'Débito',
  VN: 'Crédito',
  VC: 'Crédito',
  SI: 'Crédito',
  S2: 'Crédito',
  NC: 'Crédito',
  VP: 'Prepago',
};

function mapPaymentType(code) {
  if (typeof code !== 'string') return null;
  return PAYMENT_TYPES[code.trim().toUpperCase()] || null;
}

function sanitizeAuthorizationCode(value) {
  if (value === null || value === undefined) return null;
  const code = String(value).trim();
  return /^[A-Za-z0-9]{1,12}$/.test(code) ? code : null;
}

function sanitizeInstallments(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 99 ? number : null;
}

// Transbank entrega solo los últimos 4 dígitos; igual se recorta por seguridad.
function sanitizeCardLast4(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
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

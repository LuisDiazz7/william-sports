'use strict';

// Credenciales públicas de prueba del ambiente de integración de Transbank.
// Documentación oficial: https://developers.transbank.cl
const INTEGRATION_COMMERCE_CODE = '597055555532';
const INTEGRATION_API_KEY =
  '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

function createWebpay(env = process.env) {
  const { WebpayPlus, Options, Environment } = require('transbank-sdk');

  const isProduction = env.TBK_ENV === 'production';
  const environment = isProduction ? Environment.Production : Environment.Integration;

  if (isProduction && (!env.TBK_COMMERCE_CODE || !env.TBK_API_KEY)) {
    throw new Error(
      'TBK_ENV=production requiere TBK_COMMERCE_CODE y TBK_API_KEY definidos en el entorno.'
    );
  }

  const commerceCode = env.TBK_COMMERCE_CODE || INTEGRATION_COMMERCE_CODE;
  const apiKey = env.TBK_API_KEY || INTEGRATION_API_KEY;
  const options = new Options(commerceCode, apiKey, environment);

  const transaction = () => new WebpayPlus.Transaction(options);

  return {
    environment: isProduction ? 'production' : 'integration',
    commerceCode,
    create(buyOrder, sessionId, amount, returnUrl) {
      return transaction().create(buyOrder, sessionId, amount, returnUrl);
    },
    commit(token) {
      return transaction().commit(token);
    },
  };
}

// Normaliza la respuesta del commit, que varía entre versiones del SDK
// (camelCase vs snake_case, authorized boolean vs response_code/status).
function mapCommitResult(result = {}) {
  const status = result.status || result.statusCode || null;
  const responseCode =
    result.response_code !== undefined ? result.response_code : result.responseCode;
  let authorized =
    typeof result.authorized === 'boolean'
      ? result.authorized
      : responseCode === 0 && (status === 'AUTHORIZED' || status === 0);
  if (responseCode !== undefined && responseCode !== null && Number(responseCode) !== 0) {
    authorized = false;
  }
  if (status && status !== 'AUTHORIZED' && status !== 0) {
    authorized = false;
  }

  const cardDetail = result.card_detail || result.cardDetail || {};
  const cardLast4 =
    cardDetail.card_number || cardDetail.cardNumber || result.cardLast4 || null;

  return {
    authorized,
    status,
    responseCode: responseCode === undefined ? null : responseCode,
    authorizationCode:
      result.authorization_code || result.authorizationCode || null,
    cardLast4: cardLast4 ? String(cardLast4).slice(-4) : null,
    paymentTypeCode: result.payment_type_code || result.paymentTypeCode || null,
    installments: result.installments_number ?? result.installmentsNumber ?? result.installments ?? null,
    transactionDate: result.transaction_date || result.transactionDate || null,
  };
}

module.exports = { createWebpay, mapCommitResult };

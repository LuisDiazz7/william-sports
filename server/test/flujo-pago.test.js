'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { crearApp } = require('../app');
const { createDb } = require('../db');
const evento = require('../evento');

function fakeWebpay() {
  const calls = { create: [], commit: [] };
  let commitResult = {
    authorized: true,
    status: 'AUTHORIZED',
    response_code: 0,
    authorization_code: 'AUTH12345',
    card_detail: { card_number: '6214831234567890' },
    payment_type_code: 'VD',
    installments_number: 0,
    transaction_date: '17-10-2026',
  };
  return {
    calls,
    setCommitResult(r) {
      commitResult = r;
    },
    async create(buyOrder, sessionId, amount, returnUrl) {
      calls.create.push({ buyOrder, sessionId, amount, returnUrl });
      return { token: `tok-${sessionId}`, url: 'https://webpay.interpagos.cl/token_ws' };
    },
    async commit(token) {
      calls.commit.push(token);
      return commitResult;
    },
  };
}

function setup() {
  const db = createDb(':memory:');
  const webpay = fakeWebpay();
  const mail = { sent: [], async sendReceipt(o, url) { this.sent.push({ o, url }); } };
  const logger = { info() {}, error() {} };
  const app = crearApp({
    db,
    webpay,
    mail,
    logger,
    env: {
      FRONTEND_URL: 'http://localhost:5173',
      APP_BASE_URL: 'http://localhost:3000',
    },
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, webpay, mail, server, base };
}

const inscripcionValida = {
  fullName: 'Juan Pérez González',
  email: 'juan.perez@gmail.com',
  phone: '+56984267737',
  size: 'M',
};

async function crearOrden(base, webpay, overrides = {}) {
  const res = await fetch(`${base}/api/evento/pagar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...inscripcionValida, ...overrides }),
  });
  const body = await res.json();
  return { res, body };
}

test('GET /api/evento devuelve la info completa y cachea 60s', async (t) => {
  const { server, base } = setup();
  t.after(() => server.close());

  const res = await fetch(`${base}/api/evento`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /max-age=60/);
  const body = await res.json();
  assert.equal(body.title, evento.title);
  assert.equal(body.edition, '2da versión');
  assert.equal(body.price.amount, 100000);
  assert.equal(body.paymentMethods[0].id, 'webpay');
  assert.ok(body.description.includes('Williams Olave Fritz'));
  assert.deepEqual(body.sizes, ['XS', 'S', 'M', 'L', 'XL', 'XXL']);
});

test('POST /api/evento/pagar valida los datos de entrada', async (t) => {
  const { server, base, webpay } = setup();
  t.after(() => server.close());

  const casos = [
    { ...inscripcionValida, fullName: 'AB' },
    { ...inscripcionValida, email: 'no-es-email' },
    { ...inscripcionValida, phone: '123456789' },
    { ...inscripcionValida, size: 'XXXXL' },
  ];
  for (const caso of casos) {
    const { res, body } = await crearOrden(base, webpay, caso);
    assert.equal(res.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(webpay.calls.create.length, 0);
});

test('POST /api/evento/pagar ignora el monto del cliente y usa el del servidor', async (t) => {
  const { server, base, webpay, db } = setup();
  t.after(() => server.close());

  const { res, body } = await crearOrden(base, webpay, { amount: 1 });
  assert.equal(res.status, 200);
  assert.ok(body.url && body.token && body.buyOrder);
  assert.ok(body.buyOrder.length <= 26);

  assert.equal(webpay.calls.create[0].amount, 100000);
  const orden = db.prepare('SELECT * FROM ordenes WHERE buyOrder = ?').get(body.buyOrder);
  assert.equal(orden.amount, 100000);
  assert.equal(orden.status, 'pending');
});

test('retorno aprobado: marca paid, envía comprobante y redirige con token', async (t) => {
  const { server, base, webpay, mail, db } = setup();
  t.after(() => server.close());

  const { body } = await crearOrden(base, webpay);
  const res = await fetch(`${base}/api/webpay/retorno`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token_ws: body.token }),
    redirect: 'manual',
  });

  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  assert.equal(location.pathname, '/comprobante.html');
  assert.ok(location.searchParams.get('token'));

  const orden = db.prepare('SELECT * FROM ordenes WHERE buyOrder = ?').get(body.buyOrder);
  assert.equal(orden.status, 'paid');
  assert.equal(orden.authorizationCode, 'AUTH12345');
  assert.equal(orden.cardLast4, '7890');
  assert.equal(orden.paymentTypeCode, 'VD');
  assert.equal(mail.sent.length, 1);
  assert.equal(mail.sent[0].o.email, inscripcionValida.email);

  // comprobante accesible con el token
  const comp = await fetch(`${base}/api/comprobante/${orden.receiptToken}`);
  assert.equal(comp.status, 200);
  const data = await comp.json();
  assert.equal(data.numeroOrden, body.buyOrder);
  assert.equal(data.participante, inscripcionValida.fullName);
  assert.equal(data.monto, 100000);
  assert.equal(data.correo, 'j***@gmail.com');
  assert.equal(data.tarjetaUltimos4, '7890');
  assert.equal(data.cuotas, 0);
});

test('retorno rechazado: marca rejected y redirige con estado', async (t) => {
  const { server, base, webpay, db } = setup();
  t.after(() => server.close());

  webpay.setCommitResult({
    authorized: false,
    status: 'REJECTED',
    response_code: -1,
  });

  const { body } = await crearOrden(base, webpay);
  const res = await fetch(`${base}/api/webpay/retorno`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token_ws: body.token }),
    redirect: 'manual',
  });

  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  assert.equal(location.searchParams.get('estado'), 'rejected');

  const orden = db.prepare('SELECT * FROM ordenes WHERE buyOrder = ?').get(body.buyOrder);
  assert.equal(orden.status, 'rejected');
  assert.equal(orden.receiptToken, null);
});

test('retorno cancelado por el usuario: marca cancelled sin commit', async (t) => {
  const { server, base, webpay, db } = setup();
  t.after(() => server.close());

  const { body } = await crearOrden(base, webpay);
  const res = await fetch(`${base}/api/webpay/retorno`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ TBK_TOKEN: body.token, TBK_ORDEN_COMPRA: body.buyOrder }),
    redirect: 'manual',
  });

  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  assert.equal(location.searchParams.get('estado'), 'cancelled');

  const orden = db.prepare('SELECT * FROM ordenes WHERE buyOrder = ?').get(body.buyOrder);
  assert.equal(orden.status, 'cancelled');
  assert.equal(webpay.calls.commit.length, 0);
});

test('retorno con timeout (TBK_TOKEN + token_ws): marca failed', async (t) => {
  const { server, base, webpay, db } = setup();
  t.after(() => server.close());

  const { body } = await crearOrden(base, webpay);
  const res = await fetch(`${base}/api/webpay/retorno`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ TBK_TOKEN: body.token, token_ws: body.token }),
    redirect: 'manual',
  });

  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  assert.equal(location.searchParams.get('estado'), 'failed');

  const orden = db.prepare('SELECT * FROM ordenes WHERE buyOrder = ?').get(body.buyOrder);
  assert.equal(orden.status, 'failed');
});

test('idempotencia: un pago ya confirmado no repite el commit', async (t) => {
  const { server, base, webpay, db } = setup();
  t.after(() => server.close());

  const { body } = await crearOrden(base, webpay);
  await fetch(`${base}/api/webpay/retorno`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token_ws: body.token }),
    redirect: 'manual',
  });
  assert.equal(webpay.calls.commit.length, 1);

  const res = await fetch(`${base}/api/webpay/retorno`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token_ws: body.token }),
    redirect: 'manual',
  });
  assert.equal(webpay.calls.commit.length, 1); // no se repitió
  const location = new URL(res.headers.get('location'));
  const orden = db.prepare('SELECT * FROM ordenes WHERE buyOrder = ?').get(body.buyOrder);
  assert.equal(location.searchParams.get('token'), orden.receiptToken);
});

test('GET /api/comprobante devuelve 404 para token desconocido o no pagado', async (t) => {
  const { server, base, webpay } = setup();
  t.after(() => server.close());

  const desconocido = await fetch(`${base}/api/comprobante/no-existe`);
  assert.equal(desconocido.status, 404);

  const { body } = await crearOrden(base, webpay); // queda pending
  const ordenNoPagada = await fetch(`${base}/api/comprobante/abc123`);
  assert.equal(ordenNoPagada.status, 404);
  assert.ok(body.buyOrder);
});

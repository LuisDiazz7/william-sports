'use strict';

const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');

const evento = require('./evento');
const { createDb } = require('./db');
const { createWebpay, mapCommitResult } = require('./webpay');
const { createMailer } = require('./mail');

const TERMINALES = new Set(['rejected', 'cancelled', 'failed']);

function nowIso() {
  return new Date().toISOString();
}

function baseUrl(env) {
  return (
    env.APP_BASE_URL ||
    env.FRONTEND_URL ||
    `http://localhost:${env.PORT || 3000}`
  ).replace(/\/$/, '');
}

function generarBuyOrder() {
  // "CLI26-" + 10 hex = 16 caracteres (máx. permitido: 26)
  return 'CLI26-' + crypto.randomBytes(5).toString('hex');
}

function generarReceiptToken() {
  return crypto.randomBytes(24).toString('hex'); // 48 chars, no adivinable
}

function errorRes(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function crearApp(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const db = options.db || createDb(env.DB_PATH);
  const webpay = options.webpay || createWebpay(env);
  const mail = options.mail || createMailer(env, logger);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  app.use(
    cors({
      origin(origin, cb) {
        // sin Origin (curl, server-to-server) se permite
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const pagoLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.',
      },
    },
  });

  const ordenByBuyOrder = db.prepare('SELECT * FROM ordenes WHERE buyOrder = ?');
  const ordenByToken = db.prepare('SELECT * FROM ordenes WHERE webpayToken = ?');
  const ordenByReceipt = db.prepare('SELECT * FROM ordenes WHERE receiptToken = ?');

  function registrarOrden(id, campos) {
    const sets = Object.keys(campos)
      .map((k) => `${k} = ?`)
      .join(', ');
    db.prepare(`UPDATE ordenes SET ${sets}, updatedAt = ? WHERE id = ?`).run(
      ...Object.values(campos),
      nowIso(),
      id
    );
  }

  function redirectComprobante(res, params) {
    const base = baseUrl(env).replace(/\/$/, '');
    const qs = new URLSearchParams(params).toString();
    return res.redirect(302, `${base}/comprobante.html?${qs}`);
  }

  // ---------------------------------------------------------------
  // 1) GET /api/evento — toda la información del evento
  // ---------------------------------------------------------------
  app.get('/api/evento', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(evento);
  });

  // ---------------------------------------------------------------
  // 2) POST /api/evento/pagar — crea orden + transacción Webpay
  // ---------------------------------------------------------------
  const telChileno = /^(\+56\s?9\s?\d{4}\s?\d{4})$/;
  const inscripcionSchema = z.object({
    fullName: z.string().trim().min(3).max(80),
    email: z.string().trim().email().max(120),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, ''))
      .refine((v) => telChileno.test(v.replace(/\s+/g, '')), {
        message: 'Teléfono debe tener formato chileno: +569XXXXXXXX',
      }),
    size: z.enum(evento.sizes),
  });

  app.post('/api/evento/pagar', pagoLimiter, async (req, res) => {
    const parsed = inscripcionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const detalle = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return errorRes(res, 400, 'VALIDATION_ERROR', detalle);
    }

    const data = parsed.data;
    // El monto sale SOLO del servidor; se ignora cualquier monto del cliente.
    const amount = evento.price.amount;
    const returnUrl = `${baseUrl(env)}/api/webpay/retorno`;
    const createdAt = nowIso();

    let orden;
    try {
      const insert = db.prepare(
        `INSERT INTO ordenes (fullName, email, phone, size, buyOrder, status, amount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      );
      let info;
      for (let intento = 0; intento < 3; intento++) {
        try {
          info = insert.run(
            data.fullName,
            data.email,
            data.phone,
            data.size,
            generarBuyOrder(),
            amount,
            createdAt,
            createdAt
          );
          break;
        } catch (e) {
          if (intento === 2 || !String(e.message).includes('UNIQUE')) throw e;
        }
      }
      orden = db.prepare('SELECT * FROM ordenes WHERE id = ?').get(info.lastInsertRowid);
    } catch (e) {
      logger.error('[pagar] error al crear orden:', e.message);
      return errorRes(res, 500, 'DB_ERROR', 'No se pudo crear la orden.');
    }

    try {
      const tx = await webpay.create(orden.buyOrder, String(orden.id), amount, returnUrl);
      registrarOrden(orden.id, { webpayToken: tx.token });
      logger.info(`[pagar] orden ${orden.buyOrder} creada, transacción Webpay iniciada`);
      return res.json({ url: tx.url, token: tx.token, buyOrder: orden.buyOrder });
    } catch (e) {
      logger.error(`[pagar] orden ${orden.buyOrder} falló al crear transacción:`, e.message);
      registrarOrden(orden.id, { status: 'failed' });
      return errorRes(
        res,
        502,
        'WEBPAY_ERROR',
        'No se pudo iniciar el pago con Webpay. Intenta nuevamente.'
      );
    }
  });

  // ---------------------------------------------------------------
  // 3) GET/POST /api/webpay/retorno — retorno de Webpay
  // ---------------------------------------------------------------
  async function manejarRetorno(req, res) {
    const body = { ...(req.query || {}), ...(req.body || {}) };
    const tokenWs = body.token_ws;
    const tbkToken = body.TBK_TOKEN;
    const tbkOrden = body.TBK_ORDEN_COMPRA;

    // a) Cancelado por el usuario: TBK_TOKEN + TBK_ORDEN_COMPRA, sin token_ws
    if (!tokenWs && tbkToken && tbkOrden) {
      const orden = ordenByBuyOrder.get(tbkOrden);
      if (!orden) return errorRes(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');
      if (orden.status !== 'paid') {
        registrarOrden(orden.id, { status: 'cancelled' });
        logger.info(`[webpay] orden ${orden.buyOrder} cancelada por el usuario`);
      }
      return redirectComprobante(res, { estado: orden.status === 'paid' ? 'paid' : 'cancelled' });
    }

    // b) Timeout / error en Webpay: TBK_TOKEN + token_ws
    if (tokenWs && tbkToken) {
      const orden = ordenByToken.get(tokenWs) || (tbkOrden ? ordenByBuyOrder.get(tbkOrden) : null);
      if (!orden) return errorRes(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');
      if (orden.status !== 'paid') {
        registrarOrden(orden.id, { status: 'failed' });
        logger.info(`[webpay] orden ${orden.buyOrder} marcada como failed (timeout/error en Webpay)`);
      }
      return redirectComprobante(res, { estado: orden.status === 'paid' ? 'paid' : 'failed' });
    }

    // c) Flujo normal: token_ws
    if (!tokenWs) {
      return errorRes(res, 400, 'MISSING_TOKEN', 'Falta token_ws.');
    }

    const orden = ordenByToken.get(tokenWs);
    if (!orden) return errorRes(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');

    // Idempotencia: si ya está pagada, no se repite el commit.
    if (orden.status === 'paid') {
      logger.info(`[webpay] orden ${orden.buyOrder} ya estaba pagada; commit omitido`);
      return redirectComprobante(res, { token: orden.receiptToken });
    }
    if (TERMINALES.has(orden.status)) {
      return redirectComprobante(res, { estado: orden.status });
    }

    let commit;
    try {
      commit = mapCommitResult(await webpay.commit(tokenWs));
    } catch (e) {
      logger.error(`[webpay] orden ${orden.buyOrder} falló el commit:`, e.message);
      registrarOrden(orden.id, { status: 'failed' });
      return redirectComprobante(res, { estado: 'failed' });
    }

    const raw = JSON.stringify({ ...commit, token: tokenWs });
    // mapCommitResult ya exige response_code 0 y status AUTHORIZED
    const aprobado = commit.authorized === true;

    if (aprobado) {
      const receiptToken = generarReceiptToken();
      registrarOrden(orden.id, {
        status: 'paid',
        receiptToken,
        authorizationCode: commit.authorizationCode,
        cardLast4: commit.cardLast4,
        paymentTypeCode: commit.paymentTypeCode,
        installments: commit.installments === null ? null : Number(commit.installments),
        transactionDate: commit.transactionDate,
        rawResponse: raw,
      });
      logger.info(
        `[webpay] orden ${orden.buyOrder} PAGADA (auth ${commit.authorizationCode}, **** ${commit.cardLast4})`
      );

      // Punto de extensión: envío de correo. Un fallo NO revierte el pago.
      const ordenPagada = ordenByBuyOrder.get(orden.buyOrder);
      try {
        await mail.sendReceipt(ordenPagada, `${baseUrl(env)}/comprobante.html?token=${receiptToken}`);
      } catch (e) {
        logger.error(`[webpay] orden ${orden.buyOrder} comprobante por correo falló:`, e.message);
      }

      return redirectComprobante(res, { token: receiptToken });
    }

    registrarOrden(orden.id, { status: 'rejected', rawResponse: raw });
    logger.info(
      `[webpay] orden ${orden.buyOrder} RECHAZADA (response_code ${commit.responseCode}, status ${commit.status})`
    );
    return redirectComprobante(res, { estado: 'rejected' });
  }

  app.get('/api/webpay/retorno', manejarRetorno);
  app.post('/api/webpay/retorno', manejarRetorno);

  // ---------------------------------------------------------------
  // 4) GET /api/comprobante/:receiptToken
  // ---------------------------------------------------------------
  function enmascararEmail(email) {
    const [local, dominio] = email.split('@');
    return `${local[0]}***@${dominio}`;
  }

  app.get('/api/comprobante/:receiptToken', (req, res) => {
    const orden = ordenByReceipt.get(req.params.receiptToken);
    if (!orden || orden.status !== 'paid') {
      return errorRes(res, 404, 'RECEIPT_NOT_FOUND', 'Comprobante no encontrado.');
    }

    const fmtFecha = (iso) => {
      try {
        return new Date(iso).toLocaleString('es-CL', {
          timeZone: evento.timezone,
          dateStyle: 'long',
          timeStyle: 'short',
        });
      } catch {
        return iso;
      }
    };

    res.json({
      numeroOrden: orden.buyOrder,
      evento: { title: evento.title, edition: evento.edition },
      fecha: fmtFecha(evento.startsAt),
      horario: `${fmtFecha(evento.startsAt).split(', ')[1]} – ${fmtFecha(evento.endsAt).split(', ')[1]}`,
      lugar: `${evento.venue.name}, ${evento.venue.commune}, ${evento.venue.city}`,
      participante: orden.fullName,
      talla: orden.size,
      correo: enmascararEmail(orden.email),
      monto: orden.amount,
      moneda: evento.price.currency,
      fechaPago: orden.transactionDate || orden.updatedAt,
      tarjetaUltimos4: orden.cardLast4,
      codigoAutorizacion: orden.authorizationCode,
      tipoPago: orden.paymentTypeCode,
      cuotas: orden.installments,
      mensaje: `Presenta este comprobante el día del evento. Consultas por WhatsApp: ${evento.contact.whatsappDisplay}`,
    });
  });

  // Solo para rutas /api: el frontend estático lo sirve server.js (o cualquier otro host)
  app.use('/api', (req, res) => errorRes(res, 404, 'NOT_FOUND', 'Ruta no encontrada.'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('[error]', err.message);
    return errorRes(res, 500, 'INTERNAL_ERROR', 'Error interno del servidor.');
  });

  return app;
}

module.exports = { crearApp };

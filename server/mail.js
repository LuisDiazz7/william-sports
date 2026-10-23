'use strict';

const evento = require('./evento');

function formatoCLP(amount) {
  return '$' + new Intl.NumberFormat('es-CL').format(amount);
}

function createMailer(env = process.env, logger = console) {
  if (!env.SMTP_HOST) {
    logger.info('[mail] SMTP no configurado (SMTP_HOST ausente); el comprobante solo se entrega vía API.');
    return {
      enabled: false,
      async sendReceipt() {
        /* sin transporte: no hace nada */
      },
    };
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });

  return {
    enabled: true,
    async sendReceipt(orden, receiptUrl) {
      const html = `
        <h1 style="font-family:sans-serif">${evento.title} · ${evento.edition}</h1>
        <p style="font-family:sans-serif">¡Gracias, ${orden.fullName}! Tu pago fue confirmado.</p>
        <ul style="font-family:sans-serif">
          <li><strong>Número de orden:</strong> ${orden.buyOrder}</li>
          <li><strong>Monto:</strong> ${formatoCLP(orden.amount)} CLP</li>
          <li><strong>Fecha del evento:</strong> 13 de noviembre de 2026, 10:00 a 14:00 (America/Santiago)</li>
          <li><strong>Lugar:</strong> ${evento.venue.name}, ${evento.venue.commune}</li>
          <li><strong>Talla:</strong> ${orden.size}</li>
          <li><strong>Tarjeta:</strong> **** ${orden.cardLast4 || '—'}</li>
        </ul>
        <p style="font-family:sans-serif">
          Presenta este comprobante el día del evento.<br/>
          Consultas por WhatsApp: ${evento.contact.whatsappDisplay}
        </p>
        <p style="font-family:sans-serif"><a href="${receiptUrl}">Ver comprobante en línea</a></p>
      `;

      await transporter.sendMail({
        from: env.SMTP_FROM || 'Williams Sport <no-reply@williamssport.cl>',
        to: orden.email,
        subject: `Comprobante de pago · ${evento.title}`,
        text: `Pago confirmado. Orden ${orden.buyOrder}. Monto ${formatoCLP(orden.amount)} CLP. Comprobante: ${receiptUrl}`,
        html,
      });
    },
  };
}

module.exports = { createMailer };

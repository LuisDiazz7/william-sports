'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const { crearApp } = require('./app');

const PORT = Number(process.env.PORT || 3000);
const app = crearApp();

// Sirve el sitio estático (HTML/CSS/JS de la raíz del repo) detrás de la API,
// sin exponer la carpeta server/.
const ROOT = path.join(__dirname, '..');
app.use('/server', (req, res) => res.status(404).end());
app.use(express.static(ROOT, { dotfiles: 'deny', index: 'index.html' }));

app.listen(PORT, () => {
  console.log(`Williams Sport server escuchando en http://localhost:${PORT}`);
  console.log(`  GET  /api/evento`);
  console.log(`  POST /api/evento/pagar`);
  console.log(`  GET/POST /api/webpay/retorno`);
  console.log(`  GET  /api/comprobante/:receiptToken`);
});

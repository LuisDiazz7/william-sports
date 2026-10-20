# API del evento — Clínica Certificado Monitor de Fútbol

Backend en **Node.js + Express + SQLite** (`better-sqlite3`) con pago vía **Webpay Plus (Transbank)** y comprobante de pago.

No toca el frontend estático existente; puede servirlo además como archivos estáticos (ver más abajo).

## Puesta en marcha

```bash
cd server
npm install
cp .env.example .env   # completa las variables
npm start              # http://localhost:3000
```

Variables (todas en `server/.env`, nunca en el código):

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default 3000) |
| `APP_BASE_URL` | URL pública del servidor; se usa como `returnUrl` de Webpay |
| `FRONTEND_URL` | URL del sitio; destino del redirect al comprobante |
| `DB_PATH` | Ruta de SQLite (default `server/data/william.db`) |
| `TBK_ENV` | `integration` o `production` |
| `TBK_COMMERCE_CODE` / `TBK_API_KEY` | Credenciales Transbank (obligatorias en producción; en integration se usan las públicas de prueba si quedan vacías) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correo del comprobante. Si `SMTP_HOST` está vacío, el comprobante solo se entrega por la API |

En desarrollo con el frontend en Vite/localhost, `FRONTEND_URL=http://localhost:5173` y `APP_BASE_URL=http://localhost:3000`. El CORS acepta `FRONTEND_URL` y `localhost:3000/5173`.

## Endpoints

### 1. `GET /api/evento`

Toda la información del evento. `Cache-Control: public, max-age=60`.

```json
{
  "slug": "clinica-monitor-futbol-2026",
  "title": "Clínica Certificado Monitor de Fútbol",
  "edition": "2da versión",
  "description": "Clínica presencial de un día…",
  "startsAt": "2026-11-13T10:00:00-03:00",
  "endsAt": "2026-11-13T14:00:00-03:00",
  "timezone": "America/Santiago",
  "venue": { "name": "Sport Park Malloco", "commune": "Peñaflor", "city": "Malloco", "country": "Chile" },
  "speaker": { "name": "Williams Olave Fritz", "role": "Jefe de scouting de Palestino" },
  "organizers": ["Williams Sport", "Colegio de Entrenadores de Fútbol de Chile"],
  "includes": [ … ],
  "price": { "amount": 100000, "currency": "CLP", "label": "$100 mil", "note": "Costo total" },
  "contact": { "whatsapp": "+56984267737", "whatsappDisplay": "+56 9 8426 7737", "instagram": "@williamssport.oficial" },
  "paymentMethods": [ { "id": "webpay", "label": "Webpay", "enabled": true, "description": "…" } ],
  "sizes": ["XS","S","M","L","XL","XXL"],
  "status": "open",
  "images": []
}
```

Los datos viven solo en `server/evento.js` (un solo archivo para cambiar precio, tallas, imágenes, etc.).

### 2. `POST /api/evento/pagar`

Crea la orden en SQLite (`pending`) y la transacción Webpay. **El monto sale siempre del servidor (100000 CLP)**; cualquier `amount` enviado por el cliente se ignora. Límite: 10 peticiones por minuto por IP.

Request:

```json
{
  "fullName": "Juan Pérez González",
  "email": "juan.perez@gmail.com",
  "phone": "+56984267737",
  "size": "M"
}
```

Validación (zod): nombre 3–80 caracteres, correo válido, teléfono `+569XXXXXXXX` (acepta espacios opcionales), talla dentro de `sizes`.

Response `200`:

```json
{ "url": "https://webpay.interpagos.cl/token_ws", "token": "…", "buyOrder": "CLI26-a1b2c3d4e5" }
```

El frontend redirige con un POST:

```html
<form action="{url}" method="POST">
  <input type="hidden" name="token_ws" value="{token}" />
</form>
```

Errores: `400 VALIDATION_ERROR`, `429 RATE_LIMITED`, `502 WEBPAY_ERROR`, con formato `{ "error": { "code", "message" } }`.

### 3. `GET|POST /api/webpay/retorno`

URL de retorno de Webpay (`{APP_BASE_URL}/api/webpay/retorno`). Maneja los cuatro caminos:

| Caso | Señal | Acción | Redirect |
|---|---|---|---|
| Aprobado | `token_ws`, commit con `response_code: 0` y `AUTHORIZED` | orden `paid`, guarda datos y `receiptToken`, envía correo | `comprobante.html?token={receiptToken}` |
| Rechazado | `token_ws`, commit no autorizado | orden `rejected` | `comprobante.html?estado=rejected` |
| Cancelado | `TBK_TOKEN` + `TBK_ORDEN_COMPRA`, sin `token_ws` | orden `cancelled`, sin commit | `comprobante.html?estado=cancelled` |
| Timeout/error | `TBK_TOKEN` + `token_ws` | orden `failed` | `comprobante.html?estado=failed` |

Idempotente: si la orden ya está `paid`, no repite el commit y redirige con el `receiptToken` guardado. Un fallo del correo no revierte el pago (solo se registra en el log). Logs de pago sin datos personales ni de tarjeta.

### 4. `GET /api/comprobante/:receiptToken`

Comprobante (solo órdenes `paid`; si no, `404`):

```json
{
  "numeroOrden": "CLI26-a1b2c3d4e5",
  "evento": { "title": "Clínica Certificado Monitor de Fútbol", "edition": "2da versión" },
  "fecha": "13 de noviembre de 2026, 10:00",
  "horario": "10:00 – 14:00",
  "lugar": "Sport Park Malloco, Peñaflor, Malloco",
  "participante": "Juan Pérez González",
  "talla": "M",
  "correo": "j***@gmail.com",
  "monto": 100000,
  "moneda": "CLP",
  "fechaPago": "2026-10-17T…",
  "tarjetaUltimos4": "7890",
  "codigoAutorizacion": "AUTH12345",
  "tipoPago": "VD",
  "cuotas": 0,
  "mensaje": "Presenta este comprobante el día del evento. Consultas por WhatsApp: +56 9 8426 7737"
}
```

No expone datos completos de tarjeta, RUT, teléfono ni el correo real.

## Persistencia

Una sola tabla `ordenes` (SQLite en `server/data/william.db`, creada automáticamente):

`id, fullName, email, phone, size, buyOrder (único), status (pending|paid|rejected|cancelled|failed), amount, webpayToken, receiptToken (único), authorizationCode, cardLast4, paymentTypeCode, installments, transactionDate, rawResponse, createdAt, updatedAt`

## Pruebas

```bash
cd server
npm test
```

9 pruebas con `node:test` (sin dependencias extra): evento 200, validación, monto del servidor, y los cuatro caminos del retorno de Webpay (simulando el SDK), idempotencia y comprobante 404.

## Probar en integración de Transbank

1. `TBK_ENV=integration` en `.env` (puedes dejar commerce code y api key vacíos: se usan las credenciales públicas de prueba `597055555532`).
2. `npm start` y abre `http://localhost:3000/api/evento` para verificar.
3. Crea una orden con `POST /api/evento/pagar` y completa el redirect con `token_ws`.
4. En la tarjeta de prueba de Webpay usa un RUT y tarjeta de la documentación oficial: https://developers.transbank.cl/webpay-plus

## Servir el sitio estático desde el mismo proceso (opcional)

`npm start` además sirve los HTML/CSS/JS de la raíz del repo en el mismo puerto (sin exponer `server/`). En ese caso `APP_BASE_URL` y `FRONTEND_URL` pueden ser la misma URL.

# Webpay Plus en Vercel

Integración de Webpay Plus para la Clínica Certificado Monitor de Fútbol.

## Producto y monto

- Producto: `clinica-monitor-futbol-2026`
- Nombre: Clínica Certificado Monitor de Fútbol (2da versión)
- Monto: CLP 100.000
- Glosa: «Clínica Certificado Monitor de Fútbol - 13 nov 2026» (Webpay Plus no recibe glosa: se muestra en el sitio, el comprobante y los logs)
- Prefijo de orden de compra: `CLI26`

Confirmar producto y monto con el cliente antes de activar producción.

## Flujo

1. El botón «Paga con Webpay» de `curso.html` envía `POST /api/webpay/crear` con el identificador del producto.
2. `crear` crea la transacción en Transbank y devuelve `url` + `token`.
3. El navegador envía `token_ws` a Webpay mediante un formulario POST.
4. Transbank vuelve a `GET` o `POST /api/webpay/confirmar`.
5. `confirmar` confirma la transacción y redirige a `comprobante.html?t=...`.
6. `comprobante.html` consulta `GET /api/webpay/resultado?t=...` y muestra la página de éxito o rechazo con estado, glosa, monto, orden de compra y fecha. En pagos aprobados agrega comercio (Williams Sport SpA), código de autorización, tipo de pago (VD = Débito; VN, VC, SI, S2, NC = Crédito; VP = Prepago), cuotas y últimos 4 dígitos de la tarjeta. En pagos rechazados muestra las posibles causas.

El token de resultado está cifrado con AES-256-GCM y firmado con HMAC SHA-256. Ambas claves se derivan de `PAYMENT_RESULT_SECRET` con HKDF. Expira a las 24 horas.

## Endpoints

| Endpoint | Método | Uso |
| --- | --- | --- |
| `/api/webpay/crear` | POST | Crea la transacción en Webpay |
| `/api/webpay/confirmar` | GET, POST | Recibe el retorno de Transbank y confirma el pago |
| `/api/webpay/resultado` | GET | Entrega el resultado a partir del token cifrado y firmado |

## Variables de entorno

Configurar en Vercel en **Project Settings > Environment Variables**. No crear archivos con secretos dentro del repositorio.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `SITE_URL` | Sí, en Production | URL pública del sitio, por ejemplo `https://tu-dominio.cl`. Debe usar HTTPS en producción. En Preview se usa `VERCEL_URL` si no está definida. |
| `WEBPAY_ENV` | No | `integration` (por defecto) o `production`. Cualquier otro valor es un error. |
| `WEBPAY_COMMERCE_CODE` | Sí | Código de comercio. En integración: `597055555532`. En producción no se acepta el código de integración. |
| `WEBPAY_API_KEY` | Sí | API Key. En integración: la API Key pública de la [documentación de Transbank](https://www.transbankdevelopers.cl/documentacion/como_empezar#ambientes). |
| `PAYMENT_RESULT_SECRET` | Sí | Secreto aleatorio de al menos 32 caracteres para firmar el resultado. |

Generar un secreto localmente:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

No reutilizar el secreto de otro proyecto. Si cambia, los enlaces de resultado ya emitidos dejan de ser válidos.

## Desarrollo local

```powershell
bun install
Copy-Item .env.example .env.local
```

Completa `WEBPAY_COMMERCE_CODE` y `WEBPAY_API_KEY` en `.env.local` con las credenciales de integración de la documentación oficial de Transbank: <https://www.transbankdevelopers.cl/>. El código no trae credenciales por defecto.

```powershell
npx vercel dev
```

Usar `npx vercel dev` para que se ejecuten las funciones de `api/`. El script `bun run dev` solo sirve el sitio estático y no procesa pagos.

Para desarrollo local, `SITE_URL` debe ser la misma URL donde corre `vercel dev`, por ejemplo `http://localhost:3000`.

## Pruebas de integración

Usar únicamente tarjetas y credenciales de prueba de Transbank. Nunca probar con tarjetas reales.

Verificar como mínimo:

- Pago aprobado.
- Pago rechazado.
- Pago cancelado o abandonado en Webpay.
- Timeout por inactividad.
- Retorno por GET y por POST.
- Enlace de resultado vencido o alterado.

Registrar la evidencia:

| Orden de compra | Fecha | Hora | Resultado | Entorno | Observaciones |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

## Seguridad

- El sitio no recibe ni guarda datos de tarjeta, correo ni nombre. En pagos aprobados el comprobante muestra solo los últimos 4 dígitos que entrega Transbank y el código de autorización, ambos dentro del token de resultado cifrado; no se guardan en el navegador ni en el servidor.
- El token de resultado está cifrado y firmado: su contenido (incluidos los últimos 4 dígitos) no se puede leer ni modificar desde la URL del comprobante.
- El navegador solo recibe la URL y el token de inicio de Webpay.
- La confirmación se hace siempre en el servidor.
- El resultado se muestra únicamente con un token cifrado y firmado que expira en 24 horas.
- Los logs no incluyen tokens ni datos de tarjeta. Registran orden de compra, estado, monto y fecha.
- `PAYMENT_RESULT_SECRET` solo se configura como variable de entorno. `WEBPAY_COMMERCE_CODE` y `WEBPAY_API_KEY` también, incluso en integración. No hay claves en el código ni en el front.
- La URL de retorno se construye con `SITE_URL`; no se acepta una URL de retorno enviada por el navegador.

## Activación en producción

1. Completar las pruebas de integración y la tabla de evidencia.
2. Confirmar con el cliente producto y monto.
3. Configurar las variables de producción en Vercel con credenciales reales.
4. Definir `WEBPAY_ENV=production` y `SITE_URL` con el dominio HTTPS definitivo.
5. Volver a desplegar.
6. Realizar un pago controlado y verificar el resultado antes de difundir el enlace.

Si falla la creación del pago, revisar `WEBPAY_COMMERCE_CODE`, `WEBPAY_API_KEY`, `WEBPAY_ENV` y `SITE_URL` (el log `webpay_create_error` indica la causa). Si falla el resultado, revisar `PAYMENT_RESULT_SECRET` y la vigencia del enlace.

## Páginas relacionadas

- `/terminos` (`terminos.html`, vía rewrite en `vercel.json`): servicio, precio, devoluciones y reclamos. La sección de suspensión del evento está marcada `[PENDIENTE]`.
- El pie de página de todas las páginas muestra Williams Sport SpA, La Reina 868, ventas@williamssport.cl y WhatsApp +56 9 8426 7737.
- `.vercelignore` evita publicar `docs/` y archivos de configuración local.

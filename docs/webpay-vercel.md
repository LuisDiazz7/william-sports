# Webpay Plus en Vercel

Integración de Webpay Plus para la Clínica Certificado Monitor de Fútbol.

## Producto y monto

- Producto: `clinica-monitor-futbol-2026`
- Nombre: Clínica Certificado Monitor de Fútbol (2da versión)
- Monto: CLP 100.000
- Prefijo de orden de compra: `CLI26`

Confirmar producto y monto con el cliente antes de activar producción.

## Flujo

1. `curso.html` envía `POST /api/crear-pago` con el identificador del producto.
2. `crear-pago` crea la transacción en Transbank y devuelve `url` + `token`.
3. El navegador envía `token_ws` a Webpay mediante un formulario POST.
4. Transbank vuelve a `GET` o `POST /api/confirmar-pago`.
5. `confirmar-pago` confirma la transacción y redirige a `comprobante.html?t=...`.
6. `comprobante.html` consulta `GET /api/resultado-pago?t=...` y muestra solo estado, monto, orden de compra y fecha.

El token de resultado está firmado con HMAC SHA-256 y expira a las 24 horas.

## Endpoints

| Endpoint | Método | Uso |
| --- | --- | --- |
| `/api/crear-pago` | POST | Crea la transacción en Webpay |
| `/api/confirmar-pago` | GET, POST | Recibe el retorno de Transbank y confirma el pago |
| `/api/resultado-pago` | GET | Entrega el resultado a partir del token firmado |

## Variables de entorno

Configurar en Vercel en **Project Settings > Environment Variables**. No crear archivos con secretos dentro del repositorio.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `SITE_URL` | Sí, en Production | URL pública del sitio, por ejemplo `https://tu-dominio.cl`. Debe usar HTTPS en producción. En Preview se usa `VERCEL_URL` si no está definida. |
| `TBK_ENV` | No | `integration` (por defecto) o `production`. |
| `TBK_COMMERCE_CODE` | Sí, en Production | Código de comercio de Transbank. En integración se usa la credencial pública del SDK si no está definida. |
| `TBK_API_KEY` | Sí, en Production | API Key de Transbank. En integración se usa la credencial pública del SDK si no está definida. |
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

En integración puedes dejar `TBK_COMMERCE_CODE` y `TBK_API_KEY` vacías: el SDK usa las credenciales públicas de prueba. Si necesitas otras, se obtienen en la documentación oficial de Transbank: <https://www.transbankdevelopers.cl/>.

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

- El sitio no recibe, muestra ni guarda datos de tarjeta, correo, nombre ni código de autorización.
- El navegador solo recibe la URL y el token de inicio de Webpay.
- La confirmación se hace siempre en el servidor.
- El resultado se muestra únicamente con un token firmado que expira en 24 horas.
- Los logs no incluyen tokens ni datos de tarjeta. Registran orden de compra, estado, monto y fecha.
- `PAYMENT_RESULT_SECRET` solo se configura como variable de entorno. Las credenciales reales de `TBK_COMMERCE_CODE` y `TBK_API_KEY` también; en integración el SDK usa credenciales públicas de prueba.
- La URL de retorno se construye con `SITE_URL`; no se acepta una URL de retorno enviada por el navegador.

## Activación en producción

1. Completar las pruebas de integración y la tabla de evidencia.
2. Confirmar con el cliente producto y monto.
3. Configurar las variables de producción en Vercel con credenciales reales.
4. Definir `TBK_ENV=production` y `SITE_URL` con el dominio HTTPS definitivo.
5. Volver a desplegar.
6. Realizar un pago controlado y verificar el resultado antes de difundir el enlace.

Si falla la creación del pago, revisar credenciales, `TBK_ENV` y `SITE_URL`. Si falla el resultado, revisar `PAYMENT_RESULT_SECRET` y la vigencia del enlace.

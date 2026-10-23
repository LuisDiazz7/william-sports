const MAX_BODY_BYTES = 32 * 1024;

export async function readBody(req) {
  const existing = req.body;

  if (
    existing !== undefined &&
    existing !== null &&
    typeof existing === 'object' &&
    !Buffer.isBuffer(existing)
  ) {
    return existing;
  }

  let text;
  if (Buffer.isBuffer(existing)) {
    text = existing.toString('utf8');
  } else if (typeof existing === 'string') {
    text = existing;
  } else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
      chunks.push(buffer);
    }
    text = Buffer.concat(chunks).toString('utf8');
  }

  if (!text) return {};

  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  return Object.fromEntries(new URLSearchParams(text));
}

export function getSiteUrl(env = process.env) {
  const configured = String(env.SITE_URL || '').trim();
  let raw = configured;

  if (!raw) {
    if (env.VERCEL_ENV === 'production') {
      throw new Error('SITE_URL es obligatoria en producción');
    }

    const vercelUrl = String(env.VERCEL_URL || '').trim();
    if (!vercelUrl) {
      raw = 'http://localhost:3000';
    } else {
      const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(vercelUrl);
      raw = `${isLocal ? 'http' : 'https'}://${vercelUrl}`;
    }
  }

  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('SITE_URL debe usar http o https');
  }
  if (env.VERCEL_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('SITE_URL debe usar https en producción');
  }

  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sendRedirect(res, location) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, { error: 'Método no permitido.' });
}

export function logEvent(event, fields = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

export function logError(event, error) {
  const details = {
    name: error instanceof Error ? error.name : 'Unknown',
    status: error?.response?.status ?? null,
    code: typeof error?.code === 'string' ? error.code : null,
  };

  if (
    error instanceof Error &&
    /^(SITE_URL|PAYMENT_RESULT_SECRET|TBK_)/.test(error.message)
  ) {
    details.reason = error.message;
  }

  logEvent(event, details);
}

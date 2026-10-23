import crypto from 'node:crypto';

const TTL_SECONDS = 24 * 60 * 60;

function getSecret() {
  const secret = process.env.PAYMENT_RESULT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PAYMENT_RESULT_SECRET no configurado');
  }
  return secret;
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function assertResultTokenConfig() {
  getSecret();
}

export function createResultToken(data) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ ...data, iat: now, exp: now + TTL_SECONDS })
  ).toString('base64url');

  return `${payload}.${sign(payload, getSecret())}`;
}

export function verifyResultToken(token) {
  if (typeof token !== 'string' || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payload, signature] = parts;
  const expected = sign(payload, getSecret());
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!data || typeof data.exp !== 'number') return null;
  if (data.exp < Math.floor(Date.now() / 1000)) return null;

  return data;
}

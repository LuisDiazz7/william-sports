import crypto from 'node:crypto';

const TTL_SECONDS = 24 * 60 * 60;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getSecret() {
  const secret = process.env.PAYMENT_RESULT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PAYMENT_RESULT_SECRET no configurado');
  }
  return secret;
}

// Se derivan dos claves independientes del mismo secreto: una para cifrar
// (AES-256-GCM) y otra para la firma HMAC sobre el texto cifrado.
function deriveKey(secret, info) {
  return Buffer.from(
    crypto.hkdfSync('sha256', secret, 'williams-sport-result-token', info, 32)
  );
}

function getKeys() {
  const secret = getSecret();
  return {
    encKey: deriveKey(secret, 'aes-256-gcm'),
    macKey: deriveKey(secret, 'hmac-sha256'),
  };
}

function sign(payload, macKey) {
  return crypto.createHmac('sha256', macKey).update(payload).digest('base64url');
}

export function assertResultTokenConfig() {
  getSecret();
}

export function createResultToken(data) {
  const { encKey, macKey } = getKeys();
  const now = Math.floor(Date.now() / 1000);
  const plaintext = Buffer.from(
    JSON.stringify({ ...data, iat: now, exp: now + TTL_SECONDS })
  );

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const payload = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString(
    'base64url'
  );

  return `${payload}.${sign(payload, macKey)}`;
}

export function verifyResultToken(token) {
  if (typeof token !== 'string' || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const { encKey, macKey } = getKeys();
  const [payload, signature] = parts;
  const expected = sign(payload, macKey);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const raw = Buffer.from(payload, 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;

  let data;
  try {
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(raw.length - TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    data = JSON.parse(plaintext.toString('utf8'));
  } catch {
    return null;
  }

  if (!data || typeof data.exp !== 'number') return null;
  if (data.exp < Math.floor(Date.now() / 1000)) return null;

  return data;
}

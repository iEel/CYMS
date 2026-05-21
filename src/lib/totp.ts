import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

interface TotpOptions {
  timeMs?: number;
  stepSeconds?: number;
  digits?: number;
}

interface TotpUriOptions {
  issuer: string;
  accountName: string;
  secret: string;
}

function encodeBase32(bytes: Buffer) {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');

  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function decodeBase32(secret: string) {
  const normalized = secret.replace(/[\s=]/g, '').toUpperCase();
  if (!normalized || /[^A-Z2-7]/.test(normalized)) {
    throw new Error('Invalid base32 secret');
  }

  let bits = '';
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error('Invalid base32 secret');
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(byteLength = 20) {
  return encodeBase32(randomBytes(byteLength));
}

export function createTotpCode(secret: string, options: TotpOptions = {}) {
  const stepSeconds = options.stepSeconds || 30;
  const digits = options.digits || 6;
  const timeMs = options.timeMs ?? Date.now();
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const modulo = 10 ** digits;
  return (binary % modulo).toString().padStart(digits, '0');
}

export function verifyTotpCode(secret: string, code: string, options: TotpOptions & { window?: number } = {}) {
  const digits = options.digits || 6;
  const sanitizedCode = String(code || '').replace(/\s/g, '');
  if (!new RegExp(`^\\d{${digits}}$`).test(sanitizedCode)) return false;

  const windowSize = options.window ?? 1;
  const stepSeconds = options.stepSeconds || 30;
  const timeMs = options.timeMs ?? Date.now();

  try {
    for (let offset = -windowSize; offset <= windowSize; offset++) {
      const expected = createTotpCode(secret, {
        timeMs: timeMs + offset * stepSeconds * 1000,
        stepSeconds,
        digits,
      });
      const expectedBuffer = Buffer.from(expected);
      const codeBuffer = Buffer.from(sanitizedCode);
      if (expectedBuffer.length === codeBuffer.length && timingSafeEqual(expectedBuffer, codeBuffer)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export function getTotpAuthUri({ issuer, accountName, secret }: TotpUriOptions) {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

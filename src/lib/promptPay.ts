type PromptPayTargetType = 'phone' | 'national_id' | 'ewallet';

interface PromptPayPayloadOptions {
  promptPayId: string;
  amount?: number;
}

function emv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function crc16CcittFalse(value: string) {
  let crc = 0xffff;
  for (let i = 0; i < value.length; i++) {
    crc ^= value.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function sanitizePromptPayId(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export function getPromptPayTargetType(promptPayId: string): PromptPayTargetType | null {
  const normalized = sanitizePromptPayId(promptPayId);
  if (/^0\d{9}$/.test(normalized)) return 'phone';
  if (/^\d{13}$/.test(normalized)) return 'national_id';
  if (/^\d{15}$/.test(normalized)) return 'ewallet';
  return null;
}

function getTargetTag(type: PromptPayTargetType) {
  return type === 'phone' ? '01' : type === 'national_id' ? '02' : '03';
}

function getTargetValue(promptPayId: string, type: PromptPayTargetType) {
  const normalized = sanitizePromptPayId(promptPayId);
  return type === 'phone' ? `0066${normalized.slice(1)}` : normalized;
}

export function validatePromptPayPayloadCrc(payload: string) {
  const withoutCrc = payload.slice(0, -4);
  return crc16CcittFalse(withoutCrc) === payload.slice(-4).toUpperCase();
}

export function buildPromptPayPayload({ promptPayId, amount }: PromptPayPayloadOptions) {
  const type = getPromptPayTargetType(promptPayId);
  if (!type) throw new Error('Invalid PromptPay identifier');

  const merchantAccount = [
    emv('00', 'A000000677010111'),
    emv(getTargetTag(type), getTargetValue(promptPayId, type)),
  ].join('');

  const parts = [
    emv('00', '01'),
    emv('01', '11'),
    emv('29', merchantAccount),
    emv('58', 'TH'),
    emv('53', '764'),
  ];

  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    parts.push(emv('54', amount.toFixed(2)));
  }

  const payloadWithoutCrc = `${parts.join('')}6304`;
  return `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}`;
}

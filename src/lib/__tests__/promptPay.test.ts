import {
  buildPromptPayPayload,
  getPromptPayTargetType,
  sanitizePromptPayId,
  validatePromptPayPayloadCrc,
} from '@/lib/promptPay';

describe('promptPay', () => {
  it('builds a PromptPay EMV payload for a phone number with a valid CRC', () => {
    const payload = buildPromptPayPayload({ promptPayId: '0812345678' });

    expect(payload).toBe('00020101021129370016A000000677010111011300668123456785802TH530376463045D82');
    expect(validatePromptPayPayloadCrc(payload)).toBe(true);
  });

  it('adds fixed amount in THB when supplied', () => {
    const payload = buildPromptPayPayload({ promptPayId: '0812345678', amount: 123.45 });

    expect(payload).toContain('5303764');
    expect(payload).toContain('5406123.45');
    expect(validatePromptPayPayloadCrc(payload)).toBe(true);
  });

  it('normalizes phone, national id, and e-wallet identifiers', () => {
    expect(sanitizePromptPayId('081-234-5678')).toBe('0812345678');
    expect(getPromptPayTargetType('0812345678')).toBe('phone');
    expect(getPromptPayTargetType('1234567890123')).toBe('national_id');
    expect(getPromptPayTargetType('123456789012345')).toBe('ewallet');
  });
});

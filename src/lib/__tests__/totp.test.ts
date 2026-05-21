import {
  createTotpCode,
  generateTotpSecret,
  getTotpAuthUri,
  verifyTotpCode,
} from '../totp';

describe('TOTP helper', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('generates RFC 6238 compatible codes', () => {
    expect(createTotpCode(rfcSecret, { timeMs: 59_000, digits: 8 })).toBe('94287082');
    expect(createTotpCode(rfcSecret, { timeMs: 1_111_111_109_000, digits: 8 })).toBe('07081804');
  });

  it('accepts the current and adjacent time windows', () => {
    const code = createTotpCode(rfcSecret, { timeMs: 60_000 });

    expect(verifyTotpCode(rfcSecret, code, { timeMs: 60_000 })).toBe(true);
    expect(verifyTotpCode(rfcSecret, code, { timeMs: 89_000 })).toBe(true);
    expect(verifyTotpCode(rfcSecret, code, { timeMs: 121_000 })).toBe(false);
  });

  it('rejects malformed codes and secrets', () => {
    expect(verifyTotpCode(rfcSecret, '12345', { timeMs: 60_000 })).toBe(false);
    expect(verifyTotpCode('not-base32!', '123456', { timeMs: 60_000 })).toBe(false);
  });

  it('generates base32 secrets and otpauth uri for authenticator apps', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);

    const uri = getTotpAuthUri({
      issuer: 'CYMS',
      accountName: 'admin',
      secret,
    });

    expect(uri).toContain('otpauth://totp/CYMS%3Aadmin');
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('issuer=CYMS');
  });
});

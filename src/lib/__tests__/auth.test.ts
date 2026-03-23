/**
 * Tests for authentication functions
 * Uses manual JWT implementation to avoid jose ESM import issues in Jest
 * @module auth
 */

// Mock jose module before importing auth
jest.mock('jose', () => {
  // Simple HMAC-like signing for test purposes
  const sign = (payload: Record<string, unknown>, _secret: Uint8Array) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = Buffer.from('test-signature').toString('base64url');
    return `${header}.${body}.${sig}`;
  };

  return {
    SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      let finalPayload = { ...payload };
      return {
        setProtectedHeader: jest.fn().mockReturnThis(),
        setIssuedAt: jest.fn().mockReturnThis(),
        setExpirationTime: jest.fn().mockImplementation(function (this: { sign: (secret: Uint8Array) => Promise<string> }) {
          finalPayload = { ...finalPayload, exp: Math.floor(Date.now() / 1000) + 3600 };
          return this;
        }),
        sign: jest.fn().mockImplementation((_secret: Uint8Array) => {
          return Promise.resolve(sign(finalPayload, _secret));
        }),
      };
    }),
    jwtVerify: jest.fn().mockImplementation(async (token: string, _secret: Uint8Array) => {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token');
        // Check our test signature
        if (parts[2] !== Buffer.from('test-signature').toString('base64url')) {
          throw new Error('Invalid signature');
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        return { payload };
      } catch {
        throw new Error('JWT verification failed');
      }
    }),
  };
});

import {
  createToken,
  verifyToken,
  getRoleLabel,
  ROLES,
  type UserPayload,
} from '../auth';

// ======================== createToken + verifyToken ========================

describe('JWT Token Round-Trip', () => {
  const testPayload: UserPayload = {
    userId: 1,
    username: 'admin',
    fullName: 'ผู้ดูแลระบบ',
    role: 'yard_manager',
    yardIds: [1, 2],
    activeYardId: 1,
  };

  it('should create a token and verify it back to original payload', async () => {
    const token = await createToken(testPayload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(testPayload.userId);
    expect(decoded!.username).toBe(testPayload.username);
    expect(decoded!.fullName).toBe(testPayload.fullName);
    expect(decoded!.role).toBe(testPayload.role);
    expect(decoded!.yardIds).toEqual(testPayload.yardIds);
    expect(decoded!.activeYardId).toBe(testPayload.activeYardId);
  });

  it('should create different tokens for different payloads', async () => {
    const token1 = await createToken(testPayload);
    const token2 = await createToken({ ...testPayload, userId: 2 });
    expect(token1).not.toBe(token2);
  });
});

describe('verifyToken', () => {
  it('should return null for invalid token', async () => {
    const result = await verifyToken('invalid.token.here');
    expect(result).toBeNull();
  });

  it('should return null for empty string', async () => {
    const result = await verifyToken('');
    expect(result).toBeNull();
  });

  it('should return null for random string', async () => {
    const result = await verifyToken('not-a-jwt-at-all');
    expect(result).toBeNull();
  });

  it('should return null for tampered token', async () => {
    const token = await createToken({
      userId: 1,
      username: 'admin',
      fullName: 'Admin',
      role: 'yard_manager',
      yardIds: [1],
      activeYardId: 1,
    });
    // Tamper with the signature
    const parts = token.split('.');
    parts[2] = 'tampered-signature';
    const tampered = parts.join('.');
    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });
});

// ======================== getRoleLabel ========================

describe('getRoleLabel', () => {
  const expectedLabels: Record<string, string> = {
    yard_manager: 'ผู้จัดการลาน',
    gate_clerk: 'พนักงานหน้าประตู',
    surveyor: 'พนักงานสำรวจ',
    rs_driver: 'คนขับรถยก',
    billing_officer: 'พนักงานบัญชี',
    customer: 'ลูกค้า',
  };

  Object.entries(expectedLabels).forEach(([role, label]) => {
    it(`should return "${label}" for role "${role}"`, () => {
      expect(getRoleLabel(role)).toBe(label);
    });
  });

  it('should return input string for unknown role', () => {
    expect(getRoleLabel('unknown_role')).toBe('unknown_role');
  });

  it('should return empty string for empty input', () => {
    expect(getRoleLabel('')).toBe('');
  });
});

// ======================== ROLES constant ========================

describe('ROLES constant', () => {
  it('should have all 6 roles defined', () => {
    expect(Object.keys(ROLES)).toHaveLength(6);
  });

  it('should have correct values', () => {
    expect(ROLES.YARD_MANAGER).toBe('yard_manager');
    expect(ROLES.GATE_CLERK).toBe('gate_clerk');
    expect(ROLES.SURVEYOR).toBe('surveyor');
    expect(ROLES.RS_DRIVER).toBe('rs_driver');
    expect(ROLES.BILLING_OFFICER).toBe('billing_officer');
    expect(ROLES.CUSTOMER).toBe('customer');
  });
});

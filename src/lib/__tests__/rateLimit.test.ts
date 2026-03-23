/**
 * Tests for rate limiting logic (in-memory, no DB)
 * @module rateLimit
 */

import {
  getRateLimitStats,
  clearRateLimitStores,
  getClientIP,
} from '../rateLimit';

// ======================== clearRateLimitStores ========================

describe('clearRateLimitStores', () => {
  it('should clear all stores without error', () => {
    expect(() => clearRateLimitStores()).not.toThrow();
  });

  it('should result in empty stats after clearing', () => {
    clearRateLimitStores();
    const stats = getRateLimitStats();
    expect(stats.login.active).toBe(0);
    expect(stats.login.blocked).toBe(0);
    expect(stats.api.active).toBe(0);
    expect(stats.api.blocked).toBe(0);
    expect(stats.upload.active).toBe(0);
    expect(stats.upload.blocked).toBe(0);
  });
});

// ======================== getRateLimitStats ========================

describe('getRateLimitStats', () => {
  beforeEach(() => {
    clearRateLimitStores();
  });

  it('should return stats object with login, api, upload', () => {
    const stats = getRateLimitStats();
    expect(stats).toHaveProperty('login');
    expect(stats).toHaveProperty('api');
    expect(stats).toHaveProperty('upload');
    expect(stats.login).toHaveProperty('active');
    expect(stats.login).toHaveProperty('blocked');
  });

  it('should have zero counts after clearing', () => {
    const stats = getRateLimitStats();
    expect(stats.login.active).toBe(0);
    expect(stats.api.active).toBe(0);
    expect(stats.upload.active).toBe(0);
  });
});

// ======================== getClientIP ========================

describe('getClientIP', () => {
  function createMockRequest(headers: Record<string, string>): Request {
    return {
      headers: {
        get: (key: string) => headers[key.toLowerCase()] || null,
      },
    } as unknown as Request;
  }

  it('should extract IP from x-forwarded-for header', () => {
    const req = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  it('should use first IP from x-forwarded-for chain', () => {
    const req = createMockRequest({
      'x-forwarded-for': '10.0.0.1, 192.168.1.1, 172.16.0.1',
    });
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('should trim whitespace from x-forwarded-for', () => {
    const req = createMockRequest({
      'x-forwarded-for': '  192.168.1.1  , 10.0.0.1',
    });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  it('should fallback to x-real-ip', () => {
    const req = createMockRequest({ 'x-real-ip': '10.0.0.5' });
    expect(getClientIP(req)).toBe('10.0.0.5');
  });

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const req = createMockRequest({
      'x-forwarded-for': '192.168.1.1',
      'x-real-ip': '10.0.0.5',
    });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  it('should fallback to 127.0.0.1 when no headers', () => {
    const req = createMockRequest({});
    expect(getClientIP(req)).toBe('127.0.0.1');
  });
});

import {
  buildOfflineQueuedPayload,
  isOfflineQueuedResponse,
  normalizeOfflineHeaders,
  shouldQueueOfflineRequest,
} from '@/lib/offlineQueue';

describe('offline queue helpers', () => {
  it('queues only non-GET mutations', () => {
    expect(shouldQueueOfflineRequest({ method: 'POST' })).toBe(true);
    expect(shouldQueueOfflineRequest({ method: 'PUT' })).toBe(true);
    expect(shouldQueueOfflineRequest({ method: 'DELETE' })).toBe(true);
    expect(shouldQueueOfflineRequest({ method: 'GET' })).toBe(false);
    expect(shouldQueueOfflineRequest({})).toBe(false);
  });

  it('normalizes Headers objects into plain records', () => {
    const headers = new Headers({ 'Content-Type': 'application/json', 'X-Test': '1' });
    expect(normalizeOfflineHeaders(headers)).toEqual({
      'content-type': 'application/json',
      'x-test': '1',
    });
  });

  it('builds a queued payload with operation metadata', () => {
    expect(buildOfflineQueuedPayload('gate_in')).toEqual({
      success: true,
      offline: true,
      queued: true,
      status: 'queued',
      operation: 'gate_in',
      message: 'บันทึกแบบออฟไลน์ — จะซิงค์อัตโนมัติเมื่อเชื่อมต่ออินเทอร์เน็ต',
    });
  });

  it('detects queued offline responses', () => {
    expect(isOfflineQueuedResponse({ offline: true, queued: true, status: 'queued' })).toBe(true);
    expect(isOfflineQueuedResponse({ success: true })).toBe(false);
    expect(isOfflineQueuedResponse(null)).toBe(false);
  });
});

import {
  buildOfflineQueuedPayload,
  clearSynced,
  enqueue,
  getAll,
  isOfflineQueuedResponse,
  listQueuedRequests,
  markConflict,
  normalizeOfflineHeaders,
  remove,
  retryQueuedRequest,
  shouldQueueOfflineRequest,
} from '@/lib/offlineQueue';

function installFakeIndexedDb() {
  let nextId = 1;
  const rows = new Map<number, Record<string, unknown>>();
  const db = {
    objectStoreNames: {
      contains: jest.fn().mockReturnValue(true),
    },
    createObjectStore: jest.fn(),
    transaction: jest.fn(() => {
      const tx: {
        objectStore: () => {
          add: (value: Record<string, unknown>) => { result?: number; onsuccess?: () => void; onerror?: () => void };
          put: (value: Record<string, unknown>) => { result?: number; onsuccess?: () => void; onerror?: () => void };
          getAll: () => { result: Array<Record<string, unknown>>; onsuccess?: () => void; onerror?: () => void };
          delete: (id: number) => { onsuccess?: () => void; onerror?: () => void };
        };
        oncomplete?: () => void;
        onerror?: () => void;
        error: Error | null;
      } = {
        error: null,
        objectStore: () => ({
          add: (value) => {
            const id = nextId++;
            rows.set(id, { ...value, id });
            const request: { result: number; onsuccess?: () => void; onerror?: () => void } = { result: id };
            setTimeout(() => { request.onsuccess?.(); tx.oncomplete?.(); }, 0);
            return request;
          },
          put: (value) => {
            const id = Number(value.id);
            rows.set(id, { ...value });
            const request: { result: number; onsuccess?: () => void; onerror?: () => void } = { result: id };
            setTimeout(() => { request.onsuccess?.(); tx.oncomplete?.(); }, 0);
            return request;
          },
          getAll: () => {
            const request: { result: Array<Record<string, unknown>>; onsuccess?: () => void; onerror?: () => void } = {
              result: Array.from(rows.values()),
            };
            setTimeout(() => { request.onsuccess?.(); }, 0);
            return request;
          },
          delete: (id) => {
            rows.delete(id);
            const request: { onsuccess?: () => void; onerror?: () => void } = {};
            setTimeout(() => { request.onsuccess?.(); tx.oncomplete?.(); }, 0);
            return request;
          },
        }),
      };
      return tx;
    }),
  };

  const indexedDb = {
    open: jest.fn(() => {
      const request: {
        result: typeof db;
        error: Error | null;
        onupgradeneeded?: () => void;
        onsuccess?: () => void;
        onerror?: () => void;
      } = { result: db, error: null };
      setTimeout(() => { request.onsuccess?.(); }, 0);
      return request;
    }),
  };

  Object.defineProperty(global, 'indexedDB', {
    value: indexedDb,
    configurable: true,
  });

  return { rows };
}

function queuedRequest(overrides: Partial<Parameters<typeof enqueue>[0]> = {}) {
  return {
    url: '/api/gate',
    method: 'POST',
    body: '{"container_number":"TGHU1234567"}',
    headers: { 'content-type': 'application/json' },
    timestamp: Date.now(),
    retries: 0,
    operation: 'gate_in',
    status: 'queued' as const,
    ...overrides,
  };
}

describe('offline queue helpers', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    installFakeIndexedDb();
  });

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

  it('lists queue items newest first and can remove one item', async () => {
    const olderId = await enqueue(queuedRequest({ timestamp: 1000, operation: 'yard_audit' }));
    const newerId = await enqueue(queuedRequest({ timestamp: 2000, operation: 'gate_out' }));

    expect((await listQueuedRequests()).map(item => item.id)).toEqual([newerId, olderId]);

    await remove(newerId);

    expect((await getAll()).map(item => item.id)).toEqual([olderId]);
  });

  it('marks successful manual retry as synced and keeps it until clearSynced', async () => {
    const id = await enqueue(queuedRequest());
    const fetcher = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    const result = await retryQueuedRequest(id, fetcher);

    expect(fetcher).toHaveBeenCalledWith('/api/gate', expect.objectContaining({ method: 'POST' }));
    expect(result.status).toBe('synced');
    expect((await getAll())[0]).toEqual(expect.objectContaining({ id, status: 'synced', retries: 1 }));

    expect(await clearSynced()).toBe(1);
    expect(await getAll()).toEqual([]);
  });

  it('retains conflict status for operator review', async () => {
    const id = await enqueue(queuedRequest());
    const fetcher = jest.fn().mockResolvedValue(new Response('duplicate', { status: 409 }));

    const result = await retryQueuedRequest(id, fetcher);

    expect(result.status).toBe('conflict');
    expect((await getAll())[0]).toEqual(expect.objectContaining({
      id,
      status: 'conflict',
      conflictReason: 'HTTP 409',
    }));
  });

  it('can mark a queued request as conflict without replaying it', async () => {
    const id = await enqueue(queuedRequest());

    await markConflict(id, 'ตำแหน่งถูกแก้ไขจากเครื่องอื่น');

    expect((await getAll())[0]).toEqual(expect.objectContaining({
      id,
      status: 'conflict',
      conflictReason: 'ตำแหน่งถูกแก้ไขจากเครื่องอื่น',
    }));
  });
});

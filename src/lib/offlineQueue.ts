/**
 * NFR1 — Offline-First: IndexedDB Queue + Auto-Sync
 * 
 * Queues failed API requests when offline and replays them when back online.
 * Works alongside Service Worker caching for a full offline experience.
 */

const DB_NAME = 'cyms_offline';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';

export interface OfflineRequestMeta {
  operation?: string;
}

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  timestamp: number;
  retries: number;
  operation?: string;
  status?: 'queued' | 'synced' | 'conflict';
}

export interface OfflineQueuedPayload {
  success: true;
  offline: true;
  queued: true;
  status: 'queued';
  operation?: string;
  message: string;
}

export function shouldQueueOfflineRequest(options: RequestInit = {}) {
  const method = (options.method || 'GET').toUpperCase();
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

export function normalizeOfflineHeaders(headers: RequestInit['headers']): Record<string, string> {
  if (!headers) return { 'content-type': 'application/json' };
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => { record[key.toLowerCase()] = value; });
    return record;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key.toLowerCase(), value]));
  }
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
}

export function buildOfflineQueuedPayload(operation?: string): OfflineQueuedPayload {
  return {
    success: true,
    offline: true,
    queued: true,
    status: 'queued',
    ...(operation ? { operation } : {}),
    message: 'บันทึกแบบออฟไลน์ — จะซิงค์อัตโนมัติเมื่อเชื่อมต่ออินเทอร์เน็ต',
  };
}

export function isOfflineQueuedResponse(value: unknown): value is OfflineQueuedPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<OfflineQueuedPayload>;
  return payload.offline === true && payload.queued === true && payload.status === 'queued';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Add a failed request to the offline queue */
export async function enqueue(req: QueuedRequest): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(req);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all queued requests */
export async function getAll(): Promise<QueuedRequest[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a request from the queue */
export async function remove(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Replay all queued requests (called when back online) */
export async function replayQueue(): Promise<{ success: number; failed: number; conflict: number }> {
  const items = await getAll();
  let success = 0, failed = 0, conflict = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (res.ok) {
        await remove(item.id!);
        success++;
      } else if (res.status === 409) {
        conflict++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed, conflict };
}

/**
 * Offline-aware fetch wrapper.
 * If the device is offline or the request fails due to network,
 * the request is queued in IndexedDB for replay when online.
 */
export async function offlineFetch(
  url: string,
  options: RequestInit = {},
  meta: OfflineRequestMeta = {}
): Promise<Response> {
  const canQueue = shouldQueueOfflineRequest(options);
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (!isOnline && canQueue) {
    // Queue the request for later
    await enqueue({
      url,
      method: (options.method || 'GET').toUpperCase(),
      body: options.body as string | null,
      headers: normalizeOfflineHeaders(options.headers),
      timestamp: Date.now(),
      retries: 0,
      operation: meta.operation,
      status: 'queued',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cyms:queued', { detail: { operation: meta.operation } }));
    }
    // Return a fake offline response
    return new Response(JSON.stringify(buildOfflineQueuedPayload(meta.operation)), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    return await fetch(url, options);
  } catch (err) {
    // Network error — queue it
    if (canQueue) {
      await enqueue({
        url,
        method: (options.method || 'GET').toUpperCase(),
        body: options.body as string | null,
        headers: normalizeOfflineHeaders(options.headers),
        timestamp: Date.now(),
        retries: 0,
        operation: meta.operation,
        status: 'queued',
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cyms:queued', { detail: { operation: meta.operation } }));
      }
      return new Response(JSON.stringify(buildOfflineQueuedPayload(meta.operation)), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }
}

/** Set up auto-sync when coming back online */
export function initOfflineSync() {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('online', async () => {
    console.log('[CYMS] Back online — replaying queued requests...');
    const result = await replayQueue();
    if (result.success > 0 || result.conflict > 0) {
      console.log(`[CYMS] Synced ${result.success} queued operations; conflicts=${result.conflict}`);
      // Dispatch event for toast notification
      window.dispatchEvent(new CustomEvent('cyms:sync', { detail: result }));
    }
  });
}

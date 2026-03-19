/**
 * NFR1 — Offline-First: IndexedDB Queue + Auto-Sync
 * 
 * Queues failed API requests when offline and replays them when back online.
 * Works alongside Service Worker caching for a full offline experience.
 */

const DB_NAME = 'cyms_offline';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';

interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  timestamp: number;
  retries: number;
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
export async function replayQueue(): Promise<{ success: number; failed: number }> {
  const items = await getAll();
  let success = 0, failed = 0;

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
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Offline-aware fetch wrapper.
 * If the device is offline or the request fails due to network,
 * the request is queued in IndexedDB for replay when online.
 */
export async function offlineFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!navigator.onLine) {
    // Queue the request for later
    await enqueue({
      url,
      method: options.method || 'GET',
      body: options.body as string | null,
      headers: (options.headers as Record<string, string>) || { 'Content-Type': 'application/json' },
      timestamp: Date.now(),
      retries: 0,
    });
    // Return a fake offline response
    return new Response(JSON.stringify({ offline: true, queued: true, message: 'บันทึกแบบออฟไลน์ — จะซิงค์อัตโนมัติเมื่อเชื่อมต่ออินเทอร์เน็ต' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    return await fetch(url, options);
  } catch (err) {
    // Network error — queue it
    if (options.method && options.method !== 'GET') {
      await enqueue({
        url,
        method: options.method,
        body: options.body as string | null,
        headers: (options.headers as Record<string, string>) || { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retries: 0,
      });
      return new Response(JSON.stringify({ offline: true, queued: true, message: 'บันทึกแบบออฟไลน์' }), {
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
    if (result.success > 0) {
      console.log(`[CYMS] Synced ${result.success} queued operations`);
      // Dispatch event for toast notification
      window.dispatchEvent(new CustomEvent('cyms:sync', { detail: result }));
    }
  });
}

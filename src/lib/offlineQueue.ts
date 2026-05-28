/**
 * NFR1 — Offline-First: IndexedDB Queue + Auto-Sync
 * 
 * Queues failed API requests when offline and replays them when back online.
 * Works alongside Service Worker caching for a full offline experience.
 */

import { canQueueOfflineOperation, type OfflineOperationDecision } from './offlineOperationPolicy';

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
  syncedAt?: number;
  updatedAt?: number;
  lastAttemptAt?: number;
  lastError?: string | null;
  lastHttpStatus?: number | null;
  conflictReason?: string | null;
}

export interface OfflineQueuedPayload {
  success: true;
  offline: true;
  queued: true;
  status: 'queued';
  operation?: string;
  message: string;
}

export interface OfflineBlockedPayload {
  success: false;
  error: string;
  offline: true;
  queued: false;
  blocked: true;
  status: 'blocked';
  operation?: string;
  reason?: string;
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

export function buildOfflineBlockedPayload(
  decision: OfflineOperationDecision,
  operation?: string,
): OfflineBlockedPayload {
  return {
    success: false,
    error: decision.message,
    offline: true,
    queued: false,
    blocked: true,
    status: 'blocked',
    ...(operation ? { operation } : {}),
    ...(decision.reasonCode ? { reason: decision.reasonCode } : {}),
    message: decision.message,
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

function dispatchQueueChanged(detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cyms:offline-queue-changed', { detail }));
}

/** Add a failed request to the offline queue */
export async function enqueue(req: QueuedRequest): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    let insertedId = 0;
    const request = tx.objectStore(STORE_NAME).add({
      ...req,
      status: req.status || 'queued',
      timestamp: req.timestamp || Date.now(),
      retries: req.retries || 0,
      updatedAt: Date.now(),
    });
    request.onsuccess = () => {
      insertedId = Number(request.result);
    };
    tx.oncomplete = () => {
      dispatchQueueChanged({ action: 'enqueue', id: insertedId });
      resolve(insertedId);
    };
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

export async function listQueuedRequests(status?: QueuedRequest['status']): Promise<QueuedRequest[]> {
  const items = await getAll();
  return items
    .filter(item => !status || (item.status || 'queued') === status)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

async function updateQueuedRequest(item: QueuedRequest): Promise<void> {
  if (!item.id) throw new Error('Queued request id is required');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...item, updatedAt: Date.now() });
    tx.oncomplete = () => {
      dispatchQueueChanged({ action: 'update', id: item.id, status: item.status });
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueuedRequest(id: number): Promise<QueuedRequest | null> {
  const items = await getAll();
  return items.find(item => item.id === id) || null;
}

/** Remove a request from the queue */
export async function remove(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      dispatchQueueChanged({ action: 'remove', id });
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function markConflict(id: number, reason = 'HTTP 409'): Promise<void> {
  const item = await getQueuedRequest(id);
  if (!item) return;

  await updateQueuedRequest({
    ...item,
    status: 'conflict',
    conflictReason: reason,
    lastError: reason,
    lastAttemptAt: Date.now(),
  });
}

export async function clearSynced(): Promise<number> {
  const synced = await listQueuedRequests('synced');
  for (const item of synced) {
    if (item.id) await remove(item.id);
  }
  if (synced.length > 0) {
    dispatchQueueChanged({ action: 'clear_synced', count: synced.length });
  }
  return synced.length;
}

type OfflineQueueFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function retryQueuedRequest(
  id: number,
  fetcher: OfflineQueueFetch = fetch,
): Promise<{ status: 'synced' | 'queued' | 'conflict' | 'missing'; httpStatus?: number; error?: string }> {
  const item = await getQueuedRequest(id);
  if (!item) return { status: 'missing' };

  const retries = (item.retries || 0) + 1;
  const lastAttemptAt = Date.now();

  try {
    const res = await fetcher(item.url, {
      method: item.method,
      headers: item.headers,
      body: item.body,
    });

    if (res.ok) {
      await updateQueuedRequest({
        ...item,
        retries,
        status: 'synced',
        syncedAt: Date.now(),
        lastAttemptAt,
        lastError: null,
        lastHttpStatus: res.status,
        conflictReason: null,
      });
      return { status: 'synced', httpStatus: res.status };
    }

    const error = `HTTP ${res.status}`;
    if (res.status === 409) {
      await updateQueuedRequest({
        ...item,
        retries,
        status: 'conflict',
        conflictReason: error,
        lastError: error,
        lastAttemptAt,
        lastHttpStatus: res.status,
      });
      return { status: 'conflict', httpStatus: res.status, error };
    }

    await updateQueuedRequest({
      ...item,
      retries,
      status: 'queued',
      lastError: error,
      lastAttemptAt,
      lastHttpStatus: res.status,
    });
    return { status: 'queued', httpStatus: res.status, error };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await updateQueuedRequest({
      ...item,
      retries,
      status: 'queued',
      lastError: error,
      lastAttemptAt,
      lastHttpStatus: null,
    });
    return { status: 'queued', error };
  }
}

/** Replay all queued requests (called when back online) */
export async function replayQueue(): Promise<{ success: number; failed: number; conflict: number }> {
  const items = (await getAll()).filter(item => (item.status || 'queued') === 'queued');
  let success = 0, failed = 0, conflict = 0;

  for (const item of items) {
    if (!item.id) continue;
    const result = await retryQueuedRequest(item.id);
    if (result.status === 'synced') {
      success++;
    } else if (result.status === 'conflict') {
      conflict++;
    } else if (result.status === 'queued') {
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
  const method = (options.method || 'GET').toUpperCase();
  const queueDecision = canQueue
    ? canQueueOfflineOperation(meta.operation, { url, method })
    : null;
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (!isOnline && canQueue) {
    if (!queueDecision?.allowed) {
      return new Response(JSON.stringify(buildOfflineBlockedPayload(
        queueDecision || canQueueOfflineOperation(meta.operation, { url, method }),
        meta.operation,
      )), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Queue the request for later
    await enqueue({
      url,
      method,
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
    if (canQueue && queueDecision?.allowed) {
      await enqueue({
        url,
        method,
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
    if (canQueue && !queueDecision?.allowed) {
      return new Response(JSON.stringify(buildOfflineBlockedPayload(
        queueDecision || canQueueOfflineOperation(meta.operation, { url, method }),
        meta.operation,
      )), {
        status: 409,
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

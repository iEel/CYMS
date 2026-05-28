/**
 * Authenticated Fetch — auto-attaches JWT Authorization header
 * Drop-in replacement for fetch() that includes auth token from localStorage
 */

const AUTH_FETCH_PATCHED = Symbol.for('cyms.authFetchPatched');
const AUTH_FETCH_ORIGINAL = Symbol.for('cyms.authFetchOriginal');

type AuthFetchWindow = Window & {
  [key: symbol]: unknown;
};

function getSessionToken(storage: Storage): string | null {
  try {
    const sessionStr = storage.getItem('cyms_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session?.token) return session.token;
    }
  } catch { /* ignore */ }

  return null;
}

function getFetchUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
}

function isApiRoute(url: string, win: Window): boolean {
  if (url.startsWith('/api/')) return true;

  try {
    const parsed = new URL(url, win.location.href);
    return parsed.origin === win.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function isAuthRoute(url: string, win: Window): boolean {
  if (url.startsWith('/api/auth/')) return true;

  try {
    const parsed = new URL(url, win.location.href);
    return parsed.origin === win.location.origin && parsed.pathname.startsWith('/api/auth/');
  } catch {
    return false;
  }
}

function getRequestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  return new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
}

export function installAuthFetchPatch(win?: Window): void {
  const target = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!target) return;

  const patchedWindow = target as AuthFetchWindow;
  if (patchedWindow[AUTH_FETCH_PATCHED]) return;

  if (!patchedWindow[AUTH_FETCH_ORIGINAL]) {
    patchedWindow[AUTH_FETCH_ORIGINAL] = target.fetch.bind(target);
  }

  const originalFetch = patchedWindow[AUTH_FETCH_ORIGINAL] as typeof fetch;
  target.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = getFetchUrl(input);

    if (isApiRoute(url, target) && !isAuthRoute(url, target)) {
      const headers = getRequestHeaders(input, init);
      if (!headers.has('Authorization')) {
        const token = getSessionToken(target.localStorage);
        if (token) headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await originalFetch(input, { ...init, headers });
      if (response.status === 401 && !target.location.pathname.includes('/login')) {
        const hasExistingSession = target.localStorage.getItem('cyms_session');
        if (hasExistingSession) {
          target.localStorage.removeItem('cyms_session');
          target.location.href = '/login';
        }
      }

      return response;
    }

    return originalFetch(input, init);
  };
  patchedWindow[AUTH_FETCH_PATCHED] = true;
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Auto-add Authorization header if not present
  if (!headers.has('Authorization')) {
    const token = getSessionToken(localStorage);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  // Auto-logout on 401
  if (response.status === 401) {
    const url = getFetchUrl(input);
    // Don't auto-logout for login endpoint
    if (!url.includes('/api/auth/login')) {
      console.warn('🔒 Session expired — redirecting to login');
      localStorage.removeItem('cyms_session');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }

  return response;
}

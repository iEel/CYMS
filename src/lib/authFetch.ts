/**
 * Authenticated Fetch — auto-attaches JWT Authorization header
 * Drop-in replacement for fetch() that includes auth token from localStorage
 */

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Auto-add Authorization header if not present
  if (!headers.has('Authorization')) {
    try {
      const sessionStr = localStorage.getItem('cyms_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.token) {
          headers.set('Authorization', `Bearer ${session.token}`);
        }
      }
    } catch { /* ignore */ }
  }

  const response = await fetch(input, { ...init, headers });

  // Auto-logout on 401
  if (response.status === 401) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
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

import { installAuthFetchPatch } from '../authFetch';

function makeWindow(fetchImpl: jest.Mock): Window {
  const storage = new Map<string, string>();

  return {
    fetch: fetchImpl,
    localStorage: {
      getItem: jest.fn((key: string) => storage.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: jest.fn((key: string) => {
        storage.delete(key);
      }),
    },
    location: {
      pathname: '/dashboard',
      href: 'http://localhost/dashboard',
      origin: 'http://localhost',
    },
  } as unknown as Window;
}

describe('installAuthFetchPatch', () => {
  it('keeps the same patched fetch when installed twice', () => {
    const originalFetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const win = makeWindow(originalFetch);

    installAuthFetchPatch(win);
    const patchedFetch = win.fetch;

    installAuthFetchPatch(win);

    expect(win.fetch).toBe(patchedFetch);
    expect(win.fetch).not.toBe(originalFetch);
  });

  it('does not double-wrap the original fetch after repeated installs', async () => {
    const originalFetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const win = makeWindow(originalFetch);
    win.localStorage.setItem('cyms_session', JSON.stringify({ token: 'abc123' }));

    installAuthFetchPatch(win);
    installAuthFetchPatch(win);

    await win.fetch('/api/containers');

    expect(originalFetch).toHaveBeenCalledTimes(1);
    const [, init] = originalFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer abc123');
  });

  it('preserves an explicit Authorization header', async () => {
    const originalFetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const win = makeWindow(originalFetch);
    win.localStorage.setItem('cyms_session', JSON.stringify({ token: 'abc123' }));

    installAuthFetchPatch(win);

    await win.fetch('/api/containers', {
      headers: {
        Authorization: 'Bearer explicit-token',
      },
    });

    const [, init] = originalFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer explicit-token');
  });

  it('preserves an explicit Authorization header from a Request input', async () => {
    const originalFetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const win = makeWindow(originalFetch);
    win.localStorage.setItem('cyms_session', JSON.stringify({ token: 'abc123' }));

    installAuthFetchPatch(win);

    await win.fetch(new Request('http://localhost/api/containers', {
      headers: {
        Authorization: 'Bearer request-token',
      },
    }));

    const [, init] = originalFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer request-token');
  });
});

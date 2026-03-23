/**
 * Rate Limiting Utility — In-memory rate limiter
 * Tracks requests per key (IP) with configurable limits and windows
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  enabled: boolean;
  login_limit: number;
  login_window_min: number;
  api_limit: number;
  api_window_min: number;
  upload_limit: number;
  upload_window_min: number;
}

// In-memory stores
const stores: Record<string, Map<string, RateLimitEntry>> = {
  login: new Map(),
  api: new Map(),
  upload: new Map(),
};

// Default config
let cachedConfig: RateLimitConfig = {
  enabled: true,
  login_limit: 5,
  login_window_min: 15,
  api_limit: 100,
  api_window_min: 1,
  upload_limit: 10,
  upload_window_min: 1,
};

let configLoadedAt = 0;
const CONFIG_TTL = 30_000; // Reload config every 30 seconds

/**
 * Load rate limit config from DB (cached 30s)
 */
export async function loadRateLimitConfig(): Promise<RateLimitConfig> {
  const now = Date.now();
  if (now - configLoadedAt < CONFIG_TTL) return cachedConfig;

  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const result = await db.request().query(
      "SELECT setting_value FROM SystemSettings WHERE setting_key = 'rate_limit'"
    );
    if (result.recordset[0]) {
      cachedConfig = JSON.parse(result.recordset[0].setting_value);
      configLoadedAt = now;
    }
  } catch {
    // If DB fails, use cached config
  }
  return cachedConfig;
}

/**
 * Force refresh cached config (called after settings update)
 */
export function invalidateRateLimitConfig() {
  configLoadedAt = 0;
}

/**
 * Check rate limit for a given key and store
 */
function checkLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  // Clean expired entry
  if (entry && now >= entry.resetTime) {
    store.delete(key);
  }

  const current = store.get(key);

  if (!current) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (current.count >= limit) {
    return {
      success: false,
      remaining: 0,
      retryAfterMs: current.resetTime - now,
    };
  }

  current.count++;
  return { success: true, remaining: limit - current.count, retryAfterMs: 0 };
}

/**
 * Rate limit for login attempts
 */
export async function rateLimitLogin(ip: string) {
  const config = await loadRateLimitConfig();
  if (!config.enabled) return { success: true, remaining: 999, retryAfterMs: 0 };
  return checkLimit(stores.login, ip, config.login_limit, config.login_window_min * 60 * 1000);
}

/**
 * Rate limit for general API requests
 */
export async function rateLimitAPI(ip: string) {
  const config = await loadRateLimitConfig();
  if (!config.enabled) return { success: true, remaining: 999, retryAfterMs: 0 };
  return checkLimit(stores.api, ip, config.api_limit, config.api_window_min * 60 * 1000);
}

/**
 * Rate limit for file uploads
 */
export async function rateLimitUpload(ip: string) {
  const config = await loadRateLimitConfig();
  if (!config.enabled) return { success: true, remaining: 999, retryAfterMs: 0 };
  return checkLimit(stores.upload, ip, config.upload_limit, config.upload_window_min * 60 * 1000);
}

/**
 * Get current stats for admin UI
 */
export function getRateLimitStats() {
  const now = Date.now();
  const countActive = (store: Map<string, RateLimitEntry>) => {
    let blocked = 0;
    let active = 0;
    store.forEach((entry) => {
      if (now < entry.resetTime) {
        active++;
        // Consider "blocked" if at 80%+ of typical limit
        if (entry.count >= 4) blocked++;
      }
    });
    return { active, blocked };
  };

  return {
    login: countActive(stores.login),
    api: countActive(stores.api),
    upload: countActive(stores.upload),
  };
}

/**
 * Clear all rate limit stores (admin action)
 */
export function clearRateLimitStores() {
  stores.login.clear();
  stores.api.clear();
  stores.upload.clear();
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return '127.0.0.1';
}

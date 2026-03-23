import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, UserPayload } from '@/lib/auth';
import { rateLimitAPI, getClientIP } from '@/lib/rateLimit';

/**
 * API Authentication Middleware
 * Verifies JWT token from Authorization header and optionally checks roles
 */

interface AuthOptions {
  roles?: string[];          // Allowed roles (empty = any authenticated user)
  skipRateLimit?: boolean;   // Skip API rate limiting (e.g., for SSE streams)
}

interface AuthenticatedRequest extends NextRequest {
  user: UserPayload;
}

type AuthHandler = (
  request: AuthenticatedRequest,
  context?: Record<string, unknown>
) => Promise<NextResponse>;

/**
 * Wrap an API handler with authentication + rate limiting
 * 
 * Usage:
 *   export const GET = withAuth(async (request) => {
 *     const user = request.user; // typed UserPayload
 *     return NextResponse.json({ ... });
 *   });
 * 
 *   export const POST = withAuth(async (request) => { ... }, { roles: ['yard_manager'] });
 */
export function withAuth(handler: AuthHandler, options: AuthOptions = {}) {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    try {
      // 1. Rate limit check
      if (!options.skipRateLimit) {
        const ip = getClientIP(request);
        const rl = await rateLimitAPI(ip);
        if (!rl.success) {
          return NextResponse.json(
            { error: 'คำขอมากเกินกำหนด กรุณารอสักครู่', retryAfterMs: rl.retryAfterMs },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
          );
        }
      }

      // 2. Extract token
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'ไม่ได้รับอนุญาต — กรุณาเข้าสู่ระบบ' },
          { status: 401 }
        );
      }

      const token = authHeader.slice(7);
      const user = await verifyToken(token);

      if (!user) {
        return NextResponse.json(
          { error: 'Token หมดอายุหรือไม่ถูกต้อง — กรุณาเข้าสู่ระบบใหม่' },
          { status: 401 }
        );
      }

      // 3. Role check
      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(user.role)) {
          return NextResponse.json(
            { error: 'คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้' },
            { status: 403 }
          );
        }
      }

      // 4. Attach user to request and call handler
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = user;

      return handler(authenticatedRequest, context);
    } catch (error) {
      console.error('❌ Auth middleware error:', error);
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' },
        { status: 500 }
      );
    }
  };
}

/**
 * Extract user from request without enforcing auth (optional auth)
 * Returns null if no valid token
 */
export async function getOptionalUser(request: NextRequest): Promise<UserPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

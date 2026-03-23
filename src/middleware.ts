import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'cyms-default-secret'
);

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/eir/',                    // Public EIR page (QR scan)
];

// Routes that should skip auth (static, pages, etc.)
const SKIP_PATHS = [
  '/_next/',
  '/uploads/',
  '/favicon',
  '/manifest.json',
  '/sw.js',
  '/icons/',
  '/login',
  '/api/auth/', // login endpoint
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes and public paths
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (SKIP_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'ไม่ได้รับอนุญาต — กรุณาเข้าสู่ระบบ' },
      { status: 401 }
    );
  }

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Attach user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', String(payload.userId || ''));
    response.headers.set('x-user-role', String(payload.role || ''));
    response.headers.set('x-user-name', String(payload.username || ''));
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Token หมดอายุหรือไม่ถูกต้อง — กรุณาเข้าสู่ระบบใหม่' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};

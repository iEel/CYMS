import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'cyms_token';

// [Security] Fail-fast: ถ้าไม่ตั้งค่า JWT_SECRET ระบบจะปฏิเสธทุก request
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('⛔ JWT_SECRET is not configured. Set JWT_SECRET in .env.local');
  }
  return new TextEncoder().encode(secret);
}

// Page routes ที่ต้องการ auth (dashboard group)
const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/yard',
  '/gate',
  '/booking',
  '/operations',
  '/edi',
  '/mnr',
  '/billing',
  '/reports',
  '/settings',
  '/audit-trail',
];

// Public API paths — ไม่ต้องการ token แต่ยังต้อง forward headers (รวม cookie)
const PUBLIC_API_PATHS = [
  '/api/auth/',
  '/api/gate/eir',
];

// Static/public paths — ข้ามทั้งหมด
const SKIP_PREFIXES = [
  '/_next/',
  '/uploads/',
  '/favicon',
  '/manifest.json',
  '/sw.js',
  '/icons/',
  '/login',
  '/eir/',
];

// [Fix] Forward token ผ่าน custom header x-cyms-token
// เพื่อให้ route handler สามารถอ่านค่า token ได้แน่นอนทุกกรณี
// (ป้องกันปัญหา Next.js internal header manipulation)
function passthrough(request: NextRequest, extraHeaders?: Record<string, string>): NextResponse {
  const requestHeaders = new Headers(request.headers);

  // Forward cookie value ผ่าน custom header
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    requestHeaders.set('x-cyms-token', token);
  }

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      requestHeaders.set(key, value);
    }
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ข้าม static/public paths
  if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) {
    return passthrough(request);
  }

  // ===== PAGE ROUTE GUARD (server-side) =====
  // ตรวจ cookie สำหรับ page route เพื่อแก้ปัญหา new tab redirect
  if (PROTECTED_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;

    if (!token) {
      // ไม่มี cookie → redirect ไป /login ทันที (server-side, ไม่ต้องรอ JS)
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      await jwtVerify(token, getJwtSecret());
      return passthrough(request);
    } catch {
      // Token หมดอายุ → clear cookie แล้ว redirect
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
  }

  // ===== API ROUTE GUARD =====
  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.some(p => pathname.startsWith(p))) return passthrough(request);

    // ตรวจ Bearer token ใน Authorization header ก่อน (จาก fetch interceptor)
    // ถ้าไม่มี ตรวจ cookie เป็น fallback (สำหรับกรณี server-side fetch)
    const authHeader = request.headers.get('authorization');
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      token = request.cookies.get(SESSION_COOKIE)?.value;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต — กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    try {
      const { payload } = await jwtVerify(token, getJwtSecret());

      // Portal routes: only customer role allowed
      if (pathname.startsWith('/api/portal/') && payload.role !== 'customer') {
        return NextResponse.json(
          { error: 'เฉพาะลูกค้าเท่านั้นที่เข้าถึง Portal ได้' },
          { status: 403 }
        );
      }

      // Forward user info + original headers เพื่อให้ route handler อ่านได้
      return passthrough(request, {
        'x-user-id': String(payload.userId || ''),
        'x-user-role': String(payload.role || ''),
        'x-user-name': String(payload.username || ''),
        ...(payload.customerId ? { 'x-customer-id': String(payload.customerId) } : {}),
      });

    } catch (err) {
      if (err instanceof Error && err.message.includes('JWT_SECRET')) {
        console.error('⛔', err.message);
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
      }
      return NextResponse.json(
        { error: 'Token หมดอายุหรือไม่ถูกต้อง — กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      );
    }
  }

  return passthrough(request);
}

export const config = {
  // ครอบทั้ง page routes และ API routes
  matcher: [
    '/dashboard/:path*',
    '/yard/:path*',
    '/gate/:path*',
    '/booking/:path*',
    '/operations/:path*',
    '/edi/:path*',
    '/mnr/:path*',
    '/billing/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/audit-trail/:path*',
    '/api/:path*',
  ],
};

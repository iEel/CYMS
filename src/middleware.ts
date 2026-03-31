import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// [Security] Fail-fast: ถ้าไม่ตั้งค่า JWT_SECRET ระบบจะปฏิเสธทุก request
// ไม่ใช้ fallback default เพราะเดาได้และเปิดช่องให้ forge token ได้ทั้งระบบ
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('⛔ JWT_SECRET is not configured. Set JWT_SECRET in .env.local');
  }
  return new TextEncoder().encode(secret);
}

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/gate/eir',  // EIR API — public QR scan access (QR link ไม่มี token)
  '/eir/',          // Public EIR page (QR scan)
  // [Security] /api/uploads/ ถูกลบออก — ต้อง login ก่อนอัปโหลดได้
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
    const { payload } = await jwtVerify(token, getJwtSecret());

    // Portal routes: only customer role allowed
    if (pathname.startsWith('/api/portal/') && payload.role !== 'customer') {
      return NextResponse.json(
        { error: 'เฉพาะลูกค้าเท่านั้นที่เข้าถึง Portal ได้' },
        { status: 403 }
      );
    }

    // [Fix P1] Forward user info เป็น REQUEST headers (ไม่ใช่ response headers)
    // เพื่อให้ route handler อ่านได้จาก request.headers.get('x-user-id') ได้จริง
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(payload.userId || ''));
    requestHeaders.set('x-user-role', String(payload.role || ''));
    requestHeaders.set('x-user-name', String(payload.username || ''));
    if (payload.customerId) {
      requestHeaders.set('x-customer-id', String(payload.customerId));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    // Fail-fast ถ้า JWT_SECRET ไม่ถูกตั้ง
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

export const config = {
  matcher: '/api/:path*',
};

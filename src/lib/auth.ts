import { SignJWT, jwtVerify } from 'jose';

// [Security] Fail-fast: ไม่มี fallback secret — ถ้าไม่ตั้งค่า JWT_SECRET จะ throw ทันที
// ป้องกันการ forge token กรณีลืมตั้งค่า env
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('⛔ JWT_SECRET is not configured. Set JWT_SECRET in .env.local before starting the application.');
  }
  return new TextEncoder().encode(secret);
}

export interface UserPayload {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  yardIds: number[];
  activeYardId: number;
  customerId?: number;
}

export async function createToken(payload: UserPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '8h')
    .sign(getJwtSecret());

  return token;
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    yard_manager: 'ผู้จัดการลาน',
    gate_clerk: 'พนักงานหน้าประตู',
    surveyor: 'พนักงานสำรวจ',
    rs_driver: 'คนขับรถยก',
    billing_officer: 'พนักงานบัญชี',
    customer: 'ลูกค้า',
  };
  return labels[role] || role;
}

export const ROLES = {
  YARD_MANAGER: 'yard_manager',
  GATE_CLERK: 'gate_clerk',
  SURVEYOR: 'surveyor',
  RS_DRIVER: 'rs_driver',
  BILLING_OFFICER: 'billing_officer',
  CUSTOMER: 'customer',
} as const;

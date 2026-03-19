import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'cyms-default-secret'
);

export interface UserPayload {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  yardIds: number[];
  activeYardId: number;
}

export async function createToken(payload: UserPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '8h')
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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

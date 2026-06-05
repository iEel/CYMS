'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthSession } from '@/types';

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  permissions: string[];
  permissionsLoading: boolean;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  login: (username: string, password: string, totpCode?: string) => Promise<{ success: boolean; error?: string; locked?: boolean; remaining_minutes?: number; remaining_attempts?: number; requires_2fa?: boolean }>;
  logout: () => void;
  switchYard: (yardId: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const DEVICE_ID_STORAGE_KEY = 'cyms_device_id';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ต้องใช้ภายใน AuthProvider');
  return ctx;
}

// ตรวจว่า JWT token หมดอายุแล้วหรือยัง (decode จาก payload ไม่ต้อง verify signature)
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp as number) * 1000 < Date.now();
  } catch {
    return true; // parse ไม่ได้ → ถือว่าหมดอายุ
  }
}

function getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  useEffect(() => {
    async function initSession() {
      // 1. ลอง restore จาก localStorage ก่อน (เร็วที่สุด)
      const saved = localStorage.getItem('cyms_session');
      if (saved) {
        try {
          const parsed: AuthSession = JSON.parse(saved);
          if (parsed.token && !isTokenExpired(parsed.token)) {
            setSession(parsed);
            setIsLoading(false);
            return; // สำเร็จ — ไม่ต้องเรียก API
          } else {
            localStorage.removeItem('cyms_session'); // token หมดอายุ → clear
          }
        } catch {
          localStorage.removeItem('cyms_session');
        }
      }

      // 2. localStorage ว่างหรือ token หมดอายุ → ตรวจ httpOnly cookie ผ่าน API
      // กรณีนี้เกิดขึ้นเมื่อ: เปิด new tab, รีสตาร์ท browser, หรือ localStorage ถูก clear
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.session) {
            setSession(data.session);
            // sync กลับไปใน localStorage เพื่อให้ครั้งต่อไปเร็วขึ้น
            localStorage.setItem('cyms_session', JSON.stringify(data.session));
          }
        }
      } catch { /* network error — ปล่อยให้ middleware จัดการ */ }

      setIsLoading(false);
    }

    initSession();
  }, []);

  useEffect(() => {
    async function loadPermissions() {
      if (!session?.role) {
        setPermissions([]);
        setPermissionsLoading(false);
        return;
      }
      setPermissions([]);
      if (session.role === 'yard_manager') {
        setPermissions(['*']);
        setPermissionsLoading(false);
        return;
      }

      if (Array.isArray(session.permissions) && session.permissions.length > 0) {
        setPermissions(session.permissions);
        setPermissionsLoading(false);
        return;
      }

      setPermissionsLoading(true);
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Permission refresh failed');
        const data = await res.json();
        const refreshed = data.session as Partial<AuthSession> | undefined;
        const codes = Array.isArray(refreshed?.permissions) ? refreshed.permissions : [];
        setPermissions(codes);
        if (refreshed) {
          setSession(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...refreshed, token: prev.token };
            localStorage.setItem('cyms_session', JSON.stringify(updated));
            return updated;
          });
        }
      } catch {
        setPermissions([]);
      } finally {
        setPermissionsLoading(false);
      }
    }

    loadPermissions();
  }, [session?.role, session?.permissions]);

  const hasPermission = useCallback((permissionCode: string) => {
    if (session?.role === 'yard_manager' || permissions.includes('*')) return true;
    return permissions.includes(permissionCode);
  }, [permissions, session?.role]);

  const hasAnyPermission = useCallback((permissionCodes: string[]) => {
    if (permissionCodes.length === 0) return true;
    return permissionCodes.some(hasPermission);
  }, [hasPermission]);


  const login = useCallback(async (username: string, password: string, totpCode?: string): Promise<{ success: boolean; error?: string; locked?: boolean; remaining_minutes?: number; remaining_attempts?: number; requires_2fa?: boolean }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          device_id: getOrCreateDeviceId(),
          ...(totpCode ? { totp_code: totpCode } : {}),
        }),
      });

      const data = await res.json();

      if (data.requires_2fa) {
        return {
          success: false,
          requires_2fa: true,
          error: data.error || 'กรุณากรอกรหัสยืนยัน 2FA',
        };
      }

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'เกิดข้อผิดพลาด',
          locked: data.locked,
          remaining_minutes: data.remaining_minutes,
          remaining_attempts: data.remaining_attempts,
        };
      }

      setSession(data.session);
      localStorage.setItem('cyms_session', JSON.stringify(data.session));
      return { success: true };

    } catch {
      return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
    }
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    localStorage.removeItem('cyms_session');
    // [Fix] เรียก logout API เพื่อ clear httpOnly cookie ฝั่ง server ด้วย
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    window.location.href = '/login';
  }, []);

  const switchYard = useCallback((yardId: number) => {
    setSession(prev => {
      if (!prev) return prev;
      const updated = { ...prev, activeYardId: yardId };
      localStorage.setItem('cyms_session', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, permissions, permissionsLoading, hasPermission, hasAnyPermission, login, logout, switchYard }}>
      {children}
    </AuthContext.Provider>
  );
}

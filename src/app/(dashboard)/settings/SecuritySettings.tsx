'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Shield, Lock, Unlock, Save, Loader2, CheckCircle2, AlertTriangle,
  Key, Hash, Type, AtSign, Clock, Users, RefreshCw,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PolicyConfig {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  max_login_attempts: number;
  lockout_duration_min: number;
}

interface LockedUser {
  user_id: number;
  username: string;
  full_name: string;
  failed_login_count: number;
  locked_at: string;
  role_code: string;
  role_name: string;
}

const DEFAULT_POLICY: PolicyConfig = {
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_special: true,
  max_login_attempts: 5,
  lockout_duration_min: 30,
};

export default function SecuritySettings() {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<PolicyConfig>(DEFAULT_POLICY);
  const [lockedUsers, setLockedUsers] = useState<LockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/security');
      const data = await res.json();
      if (data.policy) setPolicy(data.policy);
      setLockedUsers(data.locked_users || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        toast('success', 'บันทึกนโยบายความปลอดภัยเรียบร้อย');
        setTimeout(() => setSaved(false), 2000);
        if (data.policy) setPolicy(data.policy);
      } else {
        toast('error', data.error || 'ไม่สามารถบันทึกได้');
      }
    } catch { toast('error', 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const handleUnlock = (user: LockedUser) => {
    setConfirmDlg({
      open: true,
      message: `ปลดล็อคบัญชี "${user.full_name}" (${user.username})?`,
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        try {
          const res = await fetch('/api/settings/security', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unlock', user_id: user.user_id }),
          });
          const data = await res.json();
          if (data.success) {
            toast('success', `ปลดล็อค ${user.username} เรียบร้อย`);
            fetchData();
          } else {
            toast('error', data.error || 'ไม่สามารถปลดล็อคได้');
          }
        } catch { toast('error', 'เกิดข้อผิดพลาด'); }
      },
    });
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  const fmtDate = (d: string) => {
    if (!d) return '-';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>;
  }

  return (
    <>
    <div className="space-y-4">
      {/* ===== PASSWORD POLICY ===== */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">นโยบายรหัสผ่าน</h3>
              <p className="text-xs text-slate-400">กำหนดความซับซ้อนของรหัสผ่านสำหรับผู้ใช้ทุกคน</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? 'บันทึกแล้ว' : 'บันทึก'}
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Password Requirements */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Shield size={14} className="text-violet-500" /> ข้อกำหนดรหัสผ่าน
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>ความยาวขั้นต่ำ (ตัวอักษร)</label>
                <input type="number" min={6} max={32} value={policy.min_length}
                  onChange={e => setPolicy({ ...policy, min_length: parseInt(e.target.value) || 8 })}
                  className={inputClass} />
              </div>
              <div className="flex items-center gap-3 col-span-2 md:col-span-2">
                {[
                  { key: 'require_uppercase' as const, label: 'ตัวพิมพ์ใหญ่ (A-Z)', icon: <Type size={14} /> },
                  { key: 'require_lowercase' as const, label: 'ตัวพิมพ์เล็ก (a-z)', icon: <Type size={14} className="rotate-180" /> },
                  { key: 'require_number' as const, label: 'ตัวเลข (0-9)', icon: <Hash size={14} /> },
                  { key: 'require_special' as const, label: 'อักขระพิเศษ (!@#$)', icon: <AtSign size={14} /> },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={policy[item.key]}
                      onChange={e => setPolicy({ ...policy, [item.key]: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      {item.icon} {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/30">
            <p className="text-xs text-violet-700 dark:text-violet-400 font-medium mb-1">📋 ตัวอย่างกฎที่บังคับ:</p>
            <ul className="text-[11px] text-violet-600 dark:text-violet-300 space-y-0.5 list-inside">
              <li>• ความยาวอย่างน้อย {policy.min_length} ตัวอักษร</li>
              {policy.require_uppercase && <li>• ต้องมีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว</li>}
              {policy.require_lowercase && <li>• ต้องมีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว</li>}
              {policy.require_number && <li>• ต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว</li>}
              {policy.require_special && <li>• ต้องมีอักขระพิเศษ (!@#$%...) อย่างน้อย 1 ตัว</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* ===== ACCOUNT LOCKOUT ===== */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">ล็อคบัญชีอัตโนมัติ</h3>
              <p className="text-xs text-slate-400">กำหนดจำนวนครั้งที่ login ผิดก่อนล็อคและระยะเวลาล็อค</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>จำนวนครั้งสูงสุดที่ล็อกอินผิด</label>
              <div className="flex items-center gap-2">
                <input type="number" min={3} max={20} value={policy.max_login_attempts}
                  onChange={e => setPolicy({ ...policy, max_login_attempts: parseInt(e.target.value) || 5 })}
                  className={inputClass} />
                <span className="text-xs text-slate-400 whitespace-nowrap">ครั้ง</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">😮 ล็อกอินผิดครบ {policy.max_login_attempts} ครั้ง → ล็อคบัญชีอัตโนมัติ</p>
            </div>
            <div>
              <label className={labelClass}>ระยะเวลาล็อค</label>
              <div className="flex items-center gap-2">
                <input type="number" min={5} max={1440} value={policy.lockout_duration_min}
                  onChange={e => setPolicy({ ...policy, lockout_duration_min: parseInt(e.target.value) || 30 })}
                  className={inputClass} />
                <span className="text-xs text-slate-400 whitespace-nowrap">นาที</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                🕐 ล็อคนาน {policy.lockout_duration_min} นาที
                {policy.lockout_duration_min >= 60 && ` (= ${(policy.lockout_duration_min / 60).toFixed(1)} ชม.)`}
                {' '}— หรือ Admin ปลดล็อคเอง
              </p>
            </div>
          </div>

          {/* Info callout */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-700 dark:text-amber-400">
              <p className="font-medium">วิธีการทำงาน:</p>
              <p className="mt-0.5">1. ผู้ใช้ล็อกอินผิดนับแต่ละครั้ง — เมื่อถึง {policy.max_login_attempts} ครั้ง → บัญชีถูกล็อค</p>
              <p>2. ล็อคอัตโนมัติ {policy.lockout_duration_min} นาที — หรือ Admin ปลดล็อคจากตารางด้านล่าง</p>
              <p>3. เมื่อล็อกอินสำเร็จ ตัวนับจะ reset เป็น 0 อัตโนมัติ</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== LOCKED USERS TABLE ===== */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={16} className="text-rose-500" /> บัญชีที่ถูกล็อค / มีการล็อกอินผิด
          </h3>
          <button onClick={fetchData} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1">
            <RefreshCw size={12} /> รีเฟรช
          </button>
        </div>

        {lockedUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
            <CheckCircle2 size={24} className="text-emerald-400" />
            ไม่มีบัญชีที่ถูกล็อค
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">ผู้ใช้</th>
                  <th className="text-left px-4 py-2.5 font-semibold">บทบาท</th>
                  <th className="text-center px-4 py-2.5 font-semibold">ล็อกอินผิด</th>
                  <th className="text-left px-4 py-2.5 font-semibold">ถูกล็อคเมื่อ</th>
                  <th className="text-center px-4 py-2.5 font-semibold">สถานะ</th>
                  <th className="text-center px-4 py-2.5 font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {lockedUsers.map(u => {
                  const isLocked = !!u.locked_at;
                  const lockExpired = isLocked && new Date(u.locked_at).getTime() + policy.lockout_duration_min * 60000 < Date.now();
                  return (
                    <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isLocked && !lockExpired && <Lock size={12} className="text-rose-500" />}
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-white">{u.full_name}</span>
                            <span className="text-slate-400 ml-1.5 font-mono">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{u.role_name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.failed_login_count >= policy.max_login_attempts ? 'bg-rose-100 text-rose-600' :
                          u.failed_login_count > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {u.failed_login_count} / {policy.max_login_attempts}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{isLocked ? fmtDate(u.locked_at) : '-'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {isLocked && !lockExpired ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600">🔒 ถูกล็อค</span>
                        ) : lockExpired ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600">⏰ หมดเวลาล็อค</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-500">⚠️ มี login ผิด</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => handleUnlock(u)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-medium hover:bg-emerald-100 flex items-center gap-1 mx-auto transition-colors">
                          <Unlock size={10} /> ปลดล็อค
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400">
          แสดงผู้ใช้ที่ถูกล็อค หรือมีประวัติ login ผิด • กดปุ่ม &quot;ปลดล็อค&quot; เพื่อ reset ตัวนับและปลดล็อค
        </div>
      </div>
    </div>

    <ConfirmDialog open={confirmDlg.open} title="ยืนยันการปลดล็อค" message={confirmDlg.message}
      confirmLabel="ปลดล็อค" onConfirm={confirmDlg.action} onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />
    </>
  );
}

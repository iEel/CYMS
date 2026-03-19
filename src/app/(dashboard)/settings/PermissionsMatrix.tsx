'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2, Check, X, Lock } from 'lucide-react';

interface Permission {
  permission_id: number;
  module: string;
  action: string;
  description: string;
}

interface Role {
  role_id: number;
  role_code: string;
  role_name: string;
}

const MODULE_LABELS: Record<string, { label: string; color: string }> = {
  dashboard:  { label: 'แดชบอร์ด',         color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  yard:       { label: 'จัดการลาน',         color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  gate:       { label: 'ประตู Gate',       color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  operations: { label: 'ปฏิบัติการ',       color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  edi:        { label: 'EDI & ข้อมูลล่วงหน้า', color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  mnr:        { label: 'ซ่อมบำรุง M&R',    color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  billing:    { label: 'บัญชี & การเงิน',   color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  customers:  { label: 'จัดการลูกค้า',      color: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  settings:   { label: 'ตั้งค่าระบบ',       color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

const ACTION_LABELS: Record<string, string> = {
  create: 'สร้าง',
  read: 'ดู',
  update: 'แก้ไข',
  delete: 'ลบ',
};

export default function PermissionsMatrix() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [matrix, setMatrix] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/permissions');
      const data = await res.json();
      setPermissions(data.permissions);
      setRoles(data.roles);
      setMatrix(data.matrix);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePermission = async (roleId: number, permId: number) => {
    const key = `${roleId}-${permId}`;
    setToggling(key);

    const currentPerms = matrix[roleId] || [];
    const granted = !currentPerms.includes(permId);

    // Optimistic update
    setMatrix(prev => {
      const updated = { ...prev };
      if (granted) {
        updated[roleId] = [...(updated[roleId] || []), permId];
      } else {
        updated[roleId] = (updated[roleId] || []).filter(id => id !== permId);
      }
      return updated;
    });

    try {
      await fetch('/api/settings/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, permission_id: permId, granted }),
      });
    } catch (err) {
      console.error(err);
      fetchData(); // revert on error
    }
    finally { setToggling(null); }
  };

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map(p => p.module)));

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-[#F59E0B]">
          <Shield size={20} />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-white">Granular RBAC — สิทธิ์ CRUD ตามฟังก์ชัน</h2>
          <p className="text-xs text-slate-400">คลิกเพื่อเปิด/ปิดสิทธิ์ — บันทึกอัตโนมัติทันที</p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-44">โมดูล / สิทธิ์</th>
                {roles.map(role => (
                  <th key={role.role_id} className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <div className="flex flex-col items-center gap-0.5">
                      <Lock size={12} className="text-slate-400" />
                      <span className="text-[10px]">{role.role_name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(mod => {
                const modPerms = permissions.filter(p => p.module === mod);
                const modInfo = MODULE_LABELS[mod] || { label: mod, color: 'bg-slate-50 text-slate-600' };
                
                return modPerms.map((perm, idx) => (
                  <tr key={perm.permission_id}
                    className={`border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors
                      ${idx === 0 ? 'border-t-2 border-t-slate-200 dark:border-t-slate-600' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {idx === 0 && (
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${modInfo.color}`}>
                            {modInfo.label}
                          </span>
                        )}
                        {idx > 0 && <span className="w-[1px] h-4 ml-1" />}
                        <span className="text-slate-600 dark:text-slate-300 text-xs">
                          {ACTION_LABELS[perm.action] || perm.action}
                        </span>
                      </div>
                    </td>
                    {roles.map(role => {
                      const hasPermission = (matrix[role.role_id] || []).includes(perm.permission_id);
                      const isToggling = toggling === `${role.role_id}-${perm.permission_id}`;
                      const isAdmin = role.role_code === 'yard_manager';

                      return (
                        <td key={role.role_id} className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => !isAdmin && togglePermission(role.role_id, perm.permission_id)}
                            disabled={isAdmin || !!isToggling}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150
                              ${isAdmin
                                ? 'bg-blue-100 text-blue-500 dark:bg-blue-900/30 cursor-not-allowed'
                                : hasPermission
                                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 cursor-pointer'
                                  : 'bg-slate-100 text-slate-300 dark:bg-slate-700 dark:text-slate-500 hover:bg-rose-50 hover:text-rose-300 dark:hover:bg-rose-900/20 cursor-pointer'
                              }`}
                            title={`${role.role_name}: ${perm.description} — ${isAdmin ? 'Admin มีทุกสิทธิ์' : hasPermission ? 'คลิกเพื่อถอนสิทธิ์' : 'คลิกเพื่อให้สิทธิ์'}`}
                          >
                            {isToggling ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : hasPermission ? (
                              <Check size={14} strokeWidth={3} />
                            ) : (
                              <X size={12} />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check size={10} className="text-emerald-600" />
          </span>
          มีสิทธิ์
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <X size={10} className="text-slate-300" />
          </span>
          ไม่มีสิทธิ์
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Check size={10} className="text-blue-500" />
          </span>
          Admin (ล็อก — มีทุกสิทธิ์)
        </span>
      </div>
    </div>
  );
}

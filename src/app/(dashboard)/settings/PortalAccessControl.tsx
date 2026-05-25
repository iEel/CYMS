'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';

interface PortalGrantRow {
  access_id: number;
  customer_id: number;
  customer_name: string;
  entity_type: string;
  entity_ref?: string | null;
  entity_id?: number | null;
  access_role: string;
  permission_scope?: string | null;
  valid_until?: string | null;
  is_active: boolean;
}

interface PermissionScope {
  eir?: {
    fields?: {
      container_grade?: boolean;
    };
  };
}

function parsePermissionScope(value?: string | null): PermissionScope {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as PermissionScope
      : {};
  } catch {
    return {};
  }
}

export default function PortalAccessControl() {
  const { toast } = useToast();
  const [grants, setGrants] = useState<PortalGrantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconcile, setReconcile] = useState<{ missing?: unknown[]; stale?: unknown[] } | null>(null);
  const [reason, setReason] = useState('');

  const loadGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/grants?limit=200');
      const json = await res.json();
      setGrants(Array.isArray(json.grants) ? json.grants : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGrants(); }, [loadGrants]);

  const previewReconcile = async () => {
    const res = await fetch('/api/portal/grants/reconcile?mode=preview');
    const json = await res.json();
    setReconcile(json);
  };

  const repairReconcile = async () => {
    const res = await fetch('/api/portal/grants/reconcile', { method: 'POST' });
    const json = await res.json();
    setReconcile(json);
    toast(res.ok ? 'success' : 'error', res.ok ? 'ซ่อมแซม grants แล้ว' : json.error || 'ซ่อมแซม grants ไม่สำเร็จ');
    loadGrants();
  };

  const toggleGrade = async (grant: PortalGrantRow, enabled: boolean) => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast('warning', 'กรุณาระบุเหตุผล', 'ต้องมี audit log ทุกครั้งที่เปลี่ยน field visibility');
      return;
    }
    const res = await fetch('/api/portal/grants/field-scope', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_id: grant.access_id, field: 'container_grade', enabled, reason: trimmed }),
    });
    const json = await res.json();
    toast(res.ok ? 'success' : 'error', res.ok ? 'อัปเดตสิทธิ์เรียบร้อย' : json.error || 'อัปเดตไม่สำเร็จ');
    if (res.ok) loadGrants();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Portal Access</h2>
            <p className="text-xs text-slate-400">ตรวจสอบ grants, preview reconcile และตั้ง field-level EIR visibility</p>
          </div>
          <button onClick={loadGrants} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reload
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-700">PortalEntityAccess</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/30">
                <tr>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Grade</th>
                </tr>
              </thead>
              <tbody>
                {grants.map(grant => {
                  const scope = parsePermissionScope(grant.permission_scope);
                  const gradeEnabled = Boolean(scope?.eir?.fields?.container_grade);
                  return (
                    <tr key={grant.access_id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2">{grant.customer_name}</td>
                      <td className="px-3 py-2 font-mono">{grant.entity_type}:{grant.entity_ref || grant.entity_id}</td>
                      <td className="px-3 py-2">{grant.access_role}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleGrade(grant, !gradeEnabled)}
                          className={`rounded-full px-2 py-1 ${gradeEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          แสดงเกรดตู้ใน EIR ให้ลูกค้า: {gradeEnabled ? 'On' : 'Off'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={14} /> Audit reason</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className="mt-2 h-20 w-full rounded-lg border p-2 text-xs" placeholder="เช่น ลูกค้าขอเห็น grade ตามสัญญา..." />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={14} /> Reconcile Grants</p>
            <div className="mt-3 flex gap-2">
              <button onClick={previewReconcile} className="rounded-lg border px-3 py-2 text-xs">Preview</button>
              <button onClick={repairReconcile} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white">Repair</button>
            </div>
            {reconcile && <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-100">{JSON.stringify(reconcile, null, 2)}</pre>}
          </div>
        </div>
      </div>
    </div>
  );
}

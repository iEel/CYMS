'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  ClipboardList, Search, RefreshCcw, Filter, Clock, User,
  Package, Settings, Truck, DoorOpen, Receipt, Shield,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { formatAuditLog } from '@/lib/auditFormatter';

interface AuditEntry {
  log_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string;
  created_at: string;
  full_name: string | null;
  username: string | null;
}

const actionLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  // Gate
  gate_in: { label: 'Gate-In (รับตู้เข้า)', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <DoorOpen size={14} /> },
  gate_out: { label: 'Gate-Out (ปล่อยตู้ออก)', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <DoorOpen size={14} /> },
  transfer: { label: 'โอนย้ายตู้', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <Package size={14} /> },
  // Work Orders
  wo_create: { label: 'สร้างคำสั่งงาน', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <Truck size={14} /> },
  wo_accept: { label: 'รับงาน', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: <Truck size={14} /> },
  wo_complete: { label: 'ทำงานเสร็จ', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <Truck size={14} /> },
  wo_cancel: { label: 'ยกเลิกงาน', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <Truck size={14} /> },
  // Invoices
  invoice_create: { label: 'สร้างใบแจ้งหนี้', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: <Receipt size={14} /> },
  invoice_pay: { label: 'ชำระเงิน', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <Receipt size={14} /> },
  invoice_cancel: { label: 'ยกเลิกใบแจ้งหนี้', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <Receipt size={14} /> },
  invoice_hold: { label: 'ระงับตู้ (billing hold)', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: <Receipt size={14} /> },
  invoice_release: { label: 'ปลดล็อกตู้', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: <Receipt size={14} /> },
  // Settings
  customer_create: { label: 'เพิ่มลูกค้า', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  customer_update: { label: 'แก้ไขลูกค้า', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  customer_delete: { label: 'ลบลูกค้า', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <Settings size={14} /> },
  user_create: { label: 'เพิ่มผู้ใช้', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Shield size={14} /> },
  user_update: { label: 'แก้ไขผู้ใช้', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Shield size={14} /> },
  zone_create: { label: 'เพิ่มโซน', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  zone_update: { label: 'แก้ไขโซน', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  zone_delete: { label: 'ลบโซน', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <Settings size={14} /> },
  yard_create: { label: 'เพิ่มลาน', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  yard_update: { label: 'แก้ไขลาน', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  yard_delete: { label: 'ลบลาน', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <Settings size={14} /> },
  company_update: { label: 'แก้ไขข้อมูลบริษัท', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  permission_update: { label: 'แก้ไขสิทธิ์', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: <Shield size={14} /> },
  prefix_create: { label: 'เพิ่ม Prefix Mapping', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  prefix_delete: { label: 'ลบ Prefix Mapping', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <Settings size={14} /> },
  storage_rates_update: { label: 'แก้ไขอัตราค่าฝาก', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: <Settings size={14} /> },
  // Auth
  login: { label: 'เข้าสู่ระบบ', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: <User size={14} /> },
};

const entityTypeFilters = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'gate_transaction', label: '🚪 Gate' },
  { value: 'work_order', label: '🚛 Work Order' },
  { value: 'invoice', label: '💰 Invoice' },
  { value: 'user', label: '👤 User' },
  { value: 'customer', label: '🏢 Customer' },
  { value: 'zone', label: '📍 Zone' },
  { value: 'yard', label: '🏗 Yard' },
  { value: 'permission', label: '🔐 Permission' },
  { value: 'company', label: '🏛 Company' },
  { value: 'session', label: '🔑 Login' },
];

export default function AuditTrailPage() {
  const { session, hasPermission } = useAuth();
  const yardId = session?.activeYardId || 1;
  const canReadAuditTrail = hasPermission('audit_trail.read');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [limit, setLimit] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    if (!canReadAuditTrail) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ yard_id: String(yardId), limit: String(limit) });
      if (entityFilter) params.set('entity_type', entityFilter);
      const res = await fetch(`/api/yard/audit-log?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setCurrentPage(1);
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, [yardId, entityFilter, limit, canReadAuditTrail]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(log => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    const actionLabel = actionLabels[log.action]?.label || log.action;
    return actionLabel.toLowerCase().includes(q) ||
      (log.full_name || '').toLowerCase().includes(q) ||
      (log.username || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.entity_type || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hrs / 24);
    return `${days} วันที่แล้ว`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ClipboardList size={24} /> ประวัติการใช้งาน (Audit Trail)
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ใคร ทำอะไร ที่ไหน อย่างไร — บันทึกทุกกิจกรรมในระบบ</p>
      </div>

      {!canReadAuditTrail ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          คุณไม่มีสิทธิ์ดู Audit Trail ใน Granular RBAC
        </div>
      ) : (
      <>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
              placeholder="ค้นหา... ชื่อผู้ใช้, กิจกรรม, รายละเอียด"
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400" />
            <select
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
              className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300"
            >
              {entityTypeFilters.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <select
            value={limit}
            onChange={e => setLimit(parseInt(e.target.value))}
            className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300"
          >
            <option value={50}>50 รายการ</option>
            <option value={100}>100 รายการ</option>
            <option value={200}>200 รายการ</option>
            <option value={500}>500 รายการ</option>
          </select>
          <button onClick={fetchLogs} className="h-9 px-3 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 flex items-center gap-1">
            <RefreshCcw size={12} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
            {loading ? 'กำลังโหลด...' : `${filtered.length} รายการ`}
          </h3>
          {totalPages > 1 && (
            <span className="text-xs text-slate-400">
              หน้า {currentPage}/{totalPages}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">กำลังโหลด...</div>
        ) : paged.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">ไม่พบข้อมูล Audit Log</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {paged.map(log => {
              const info = actionLabels[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', icon: <ClipboardList size={14} /> };
              const readable = formatAuditLog(log);
              return (
                <div key={log.log_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${info.color}`}>
                      {info.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${info.color}`}>
                          {actionLabels[log.action] ? info.label : readable.title}
                        </span>
                        {log.entity_type && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}
                          </span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {readable.summary}
                        </p>
                      )}
                      {readable.fields.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1.5">
                          {readable.fields.slice(0, 8).map(field => (
                            <div key={`${log.log_id}-${field.label}`} className="rounded bg-slate-50 dark:bg-slate-700/40 px-2 py-1">
                              <p className="text-[9px] text-slate-400">{field.label}</p>
                              <p className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">{field.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          {log.full_name || log.username || 'ระบบ'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(log.created_at).toLocaleString('th-TH', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">
                          ({relativeTime(log.created_at)})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              แสดง {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} จาก {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const page = totalPages <= 10 ? i + 1 : (currentPage <= 5 ? i + 1 : currentPage - 5 + i + 1);
                if (page > totalPages) return null;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded text-xs font-medium ${page === currentPage ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                    {page}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

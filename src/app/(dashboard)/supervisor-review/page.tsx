'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileWarning,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

interface ApprovalReview {
  review_id: number;
  yard_id: number | null;
  yard_name?: string | null;
  permission_code: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  status: 'pending_review' | 'approved' | 'rejected';
  requested_by: number | null;
  approved_by: number | null;
  requested_by_name?: string | null;
  approved_by_name?: string | null;
  reason?: string | null;
  details?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

interface ReviewDetails {
  [key: string]: unknown;
}

const statusOptions = [
  { value: 'pending_review', label: 'รอตรวจ' },
  { value: 'approved', label: 'อนุมัติแล้ว' },
  { value: 'rejected', label: 'ไม่เห็นชอบ' },
  { value: 'all', label: 'ทั้งหมด' },
];

const statusInfo: Record<string, { label: string; color: string }> = {
  pending_review: { label: 'รอตรวจ', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  rejected: { label: 'ไม่เห็นชอบ', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800' },
};

const actionInfo: Record<string, { label: string; group: string }> = {
  container_grade_change_after_save: { label: 'เปลี่ยนเกรดตู้หลังบันทึก', group: 'Survey' },
  container_billing_hold_override: { label: 'เปลี่ยนสถานะตู้ที่ติด Billing Hold', group: 'Yard' },
  gate_out_with_billing_hold: { label: 'Gate Out ทั้งที่ติด Billing Hold', group: 'Gate' },
  billing_no_charge_recorded: { label: 'No Charge', group: 'Billing' },
  billing_waive_recorded: { label: 'Waived / ลดค่าบริการ', group: 'Billing' },
  credit_note_created: { label: 'ออกใบลดหนี้', group: 'Billing' },
  invoice_cancel_after_issue: { label: 'ยกเลิก Invoice', group: 'Billing' },
  billing_hold_released: { label: 'ปลด Billing Hold', group: 'Billing' },
};

const detailLabels: Record<string, string> = {
  previous_grade: 'เกรดเดิม',
  new_grade: 'เกรดใหม่',
  previous_status: 'สถานะเดิม',
  new_status: 'สถานะใหม่',
  hold_status: 'Hold',
  container_number: 'เลขตู้',
  eir_number: 'EIR',
  billing_clearance_id: 'Billing Clearance',
  clearance_type: 'ประเภทชำระ',
  original_amount: 'ยอดเดิม',
  final_amount: 'ยอดสุทธิ',
  waived_amount: 'ยอดยกเว้น',
  invoice_id: 'Invoice ID',
  cn_number: 'Credit Note',
  ref_invoice_number: 'Invoice อ้างอิง',
  credit_amount: 'ยอดลดหนี้',
  remaining_amount: 'ยอดคงเหลือ',
  revised_invoice_number: 'Invoice ใหม่',
};

function parseDetails(value?: string | null): ReviewDetails {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (String(value).includes('.') || Math.abs(value) >= 1000) {
      return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function SupervisorReviewPage() {
  const { session } = useAuth();
  const yardId = session?.activeYardId || 1;
  const [reviews, setReviews] = useState<ApprovalReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending_review');
  const [permissionCode, setPermissionCode] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [noteById, setNoteById] = useState<Record<number, string>>({});
  const pageSize = 12;

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ yard_id: String(yardId), status });
      if (permissionCode) params.set('permission_code', permissionCode);
      const res = await fetch(`/api/approval-reviews?${params}`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Failed to fetch approval reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [yardId, status, permissionCode]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const permissionOptions = useMemo(() => {
    const unique = Array.from(new Set(reviews.map(item => item.permission_code))).sort();
    return unique;
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter(item => {
      const details = parseDetails(item.details);
      return [
        item.permission_code,
        item.action,
        actionInfo[item.action]?.label,
        actionInfo[item.action]?.group,
        item.entity_type,
        item.reason,
        item.requested_by_name,
        item.approved_by_name,
        JSON.stringify(details),
      ].some(value => String(value || '').toLowerCase().includes(q));
    });
  }, [reviews, search]);

  const pendingCount = reviews.filter(item => item.status === 'pending_review').length;
  const approvedCount = reviews.filter(item => item.status === 'approved').length;
  const rejectedCount = reviews.filter(item => item.status === 'rejected').length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateReview = async (reviewId: number, nextStatus: 'approved' | 'rejected') => {
    setReviewingId(reviewId);
    try {
      const res = await fetch('/api/approval-reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          status: nextStatus,
          approved_by: session?.userId || null,
          reason: noteById[reviewId] || null,
        }),
      });
      if (!res.ok) throw new Error('update failed');
      setNoteById(prev => ({ ...prev, [reviewId]: '' }));
      await fetchReviews();
    } catch (error) {
      console.error('Failed to update approval review:', error);
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck size={24} /> Supervisor Review
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            ตรวจรายการเสี่ยงย้อนหลังโดยไม่หยุดงานหน้าลาน รายการที่ reject จะไม่ย้อนธุรกรรมอัตโนมัติ
          </p>
        </div>
        <button onClick={fetchReviews} className="h-9 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 w-fit">
          <RefreshCcw size={13} /> รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
          <p className="text-xs text-amber-700 dark:text-amber-300">รอตรวจ</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-4">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">อนุมัติแล้ว</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{approvedCount}</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 p-4">
          <p className="text-xs text-rose-700 dark:text-rose-300">ไม่เห็นชอบ</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{rejectedCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="ค้นหาเลขตู้, EIR, invoice, action, ผู้ทำรายการ..."
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400" />
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300"
            >
              {statusOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <select
            value={permissionCode}
            onChange={e => setPermissionCode(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300"
          >
            <option value="">ทุก permission</option>
            {permissionOptions.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
            {loading ? 'กำลังโหลด...' : `${filtered.length} รายการ`}
          </h3>
          <span className="text-xs text-slate-400">หน้า {currentPage}/{totalPages}</span>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> กำลังโหลดรายการ review
          </div>
        ) : paged.length === 0 ? (
          <div className="p-12 text-center">
            <FileWarning size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">ไม่พบรายการตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {paged.map(item => {
              const info = actionInfo[item.action] || { label: item.action, group: item.permission_code };
              const badge = statusInfo[item.status] || statusInfo.pending_review;
              const details = parseDetails(item.details);
              const detailEntries = Object.entries(details).filter(([, value]) => value !== null && value !== undefined && value !== '');
              const isPending = item.status === 'pending_review';
              const isReviewing = reviewingId === item.review_id;

              return (
                <div key={item.review_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${badge.color}`}>
                          {item.status === 'pending_review' && <AlertTriangle size={11} />}
                          {item.status === 'approved' && <Check size={11} />}
                          {item.status === 'rejected' && <X size={11} />}
                          {badge.label}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                          {info.group}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">{info.label}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <User size={12} /> ผู้ทำรายการ: {item.requested_by_name || item.requested_by || 'ระบบ'}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Clock size={12} /> {new Date(item.created_at).toLocaleString('th-TH')}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {item.entity_type} {item.entity_id ? `#${item.entity_id}` : ''}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="rounded bg-slate-50 dark:bg-slate-700/40 px-2 py-1.5">
                          <p className="text-[10px] text-slate-400">Permission</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.permission_code}</p>
                        </div>
                        {detailEntries.slice(0, 7).map(([key, value]) => (
                          <div key={`${item.review_id}-${key}`} className="rounded bg-slate-50 dark:bg-slate-700/40 px-2 py-1.5">
                            <p className="text-[10px] text-slate-400">{detailLabels[key] || key}</p>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{formatValue(value)}</p>
                          </div>
                        ))}
                      </div>

                      {(item.reason || item.approved_by_name || item.reviewed_at) && (
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                          {item.reason && <p>หมายเหตุ: {item.reason}</p>}
                          {item.approved_by_name && <p>ตรวจโดย: {item.approved_by_name}</p>}
                          {item.reviewed_at && <p>เวลาตรวจ: {new Date(item.reviewed_at).toLocaleString('th-TH')}</p>}
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <div className="xl:w-80 space-y-2">
                        <textarea
                          value={noteById[item.review_id] || ''}
                          onChange={e => setNoteById(prev => ({ ...prev, [item.review_id]: e.target.value }))}
                          placeholder="หมายเหตุ supervisor..."
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-white outline-none focus:border-blue-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateReview(item.review_id, 'approved')}
                            disabled={isReviewing}
                            className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1"
                          >
                            {isReviewing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            Approve
                          </button>
                          <button
                            onClick={() => updateReview(item.review_id, 'rejected')}
                            disabled={isReviewing}
                            className="flex-1 h-9 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60 flex items-center justify-center gap-1"
                          >
                            {isReviewing ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              แสดง {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} จาก {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

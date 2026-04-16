'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, ArrowRightLeft, Loader2, AlertTriangle, CheckCircle2, FileText, Receipt, Ship, Radio, Clock, User, ShieldCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import {
  buildPhotoEvidenceSnapshot,
  normalizeEvidencePhotos,
  type EvidencePhoto,
  type PhotoCompleteness,
  type PhotoRequirement,
} from '@/lib/photoEvidence';

interface DamagePoint {
  id: string;
  side: string;
  x: number;
  y: number;
  type: string;
  severity: 'minor' | 'major' | 'severe';
  note?: string;
  photo?: string;
}

interface ContainerDetail {
  container: {
    container_id: number;
    container_number: string;
    size: string;
    type: string;
    status: string;
    shipping_line: string;
    is_laden: boolean;
    yard_name: string;
    zone_name: string;
    zone_type: string;
    bay: number;
    row: number;
    tier: number;
    booking_ref: string;
    seal_number: string;
    container_grade: string;
    hold_status?: string | null;
    dwell_days: number;
  };
  gate_in: {
    eir_number: string;
    date: string;
    driver_name: string;
    driver_license: string;
    truck_plate: string;
    seal_number: string;
    booking_ref: string;
    notes: string;
    processed_by: string;
    damage_report: {
      points?: DamagePoint[];
      condition_grade?: string;
      inspector_notes?: string;
      photos?: string[];
      photo_evidence?: EvidencePhoto[];
      photo_requirements?: PhotoRequirement[];
      photo_completeness?: PhotoCompleteness;
      inspection_template?: string;
    } | null;
  } | null;
  gate_out: {
    eir_number: string;
    date: string;
    driver_name: string;
    truck_plate: string;
    processed_by: string;
    damage_report: { exit_photos?: string[] } | null;
  } | null;
  lifecycle?: Record<'gate_in' | 'inspection' | 'location' | 'booking' | 'billing' | 'edi' | 'gate_out', boolean>;
  exceptions?: Array<{
    code: string;
    severity: 'info' | 'warning' | 'danger';
    title: string;
    message: string;
  }>;
  documents?: {
    eir_gate_in: string | null;
    eir_gate_out: string | null;
    invoices: Array<{
      invoice_id: number;
      invoice_number: string;
      charge_type: string;
      description: string;
      grand_total: number;
      status: string;
      paid_at?: string;
      created_at: string;
      due_date?: string;
    }>;
  };
  billing?: {
    clearances: Array<{
      clearance_id: number;
      transaction_type: 'gate_in' | 'gate_out';
      clearance_type: 'paid' | 'credit' | 'no_charge' | 'waived';
      original_amount: number;
      final_amount: number;
      reason?: string;
      invoice_id?: number;
      invoice_number?: string;
      invoice_status?: string;
      approved_by_name?: string;
      created_at: string;
    }>;
    totals: {
      paid: number;
      outstanding: number;
      credit_notes: number;
    };
  };
  booking?: {
    booking_id: number;
    booking_number: string;
    booking_type: string;
    status: string;
    vessel_name?: string;
    voyage_number?: string;
    container_count: number;
    container_size?: string;
    container_type?: string;
    received_count: number;
    released_count: number;
    valid_from?: string;
    valid_to?: string;
    eta?: string;
    customer_name?: string;
    container_booking_status?: string;
    gate_in_at?: string;
    gate_out_at?: string;
  } | null;
  edi?: {
    endpoints: Array<{
      endpoint_id: number;
      name: string;
      shipping_line?: string;
      type?: string;
      format?: string;
      last_sent_at?: string;
      last_status?: string;
      last_log_status?: string;
      last_error_message?: string;
    }>;
  };
  approval_reviews?: Array<{
    review_id: number;
    permission_code: string;
    action: string;
    entity_type: string;
    entity_id?: number;
    status: 'pending_review' | 'approved' | 'rejected';
    requested_by_name?: string;
    approved_by_name?: string;
    reason?: string;
    details?: string;
    created_at: string;
    reviewed_at?: string;
  }>;
}

interface ContainerDetailModalProps {
  containerId: number;
  onClose: () => void;
  onRefresh?: () => void;
  onViewEIR?: (eirNumber: string) => void;
}

interface ReadableAuditLog {
  log_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  created_at: string;
  actor_name: string;
  title: string;
  summary: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  fields: Array<{ label: string; value: string }>;
}

const SIDES = [
  { key: 'front', label: 'ด้านหน้า', icon: '🚪' },
  { key: 'back', label: 'ด้านหลัง', icon: '🔙' },
  { key: 'left', label: 'ด้านซ้าย', icon: '◀️' },
  { key: 'right', label: 'ด้านขวา', icon: '▶️' },
  { key: 'top', label: 'ด้านบน', icon: '🔝' },
  { key: 'floor', label: 'พื้น', icon: '⬇️' },
];

const DAMAGE_LABELS: Record<string, string> = {
  dent: 'บุ๋ม', hole: 'ทะลุ', rust: 'สนิม',
  scratch: 'ขีดข่วน', crack: 'แตกร้าว', missing_part: 'ชิ้นส่วนหาย',
};

const SEVERITY_COLORS: Record<string, { bg: string; label: string }> = {
  minor: { bg: 'bg-amber-400', label: 'เล็กน้อย' },
  major: { bg: 'bg-orange-500', label: 'ปานกลาง' },
  severe: { bg: 'bg-red-600', label: 'รุนแรง' },
};

const GRADE_INFO: Record<string, { desc: string; color: string }> = {
  A: { desc: 'สภาพดี', color: '#10B981' },
  B: { desc: 'สภาพพอใช้', color: '#F59E0B' },
  C: { desc: 'ใส่ของทั่วไป', color: '#F97316' },
  D: { desc: 'ชำรุดหนัก', color: '#EF4444' },
};

const GRADE_OPTIONS = [
  { grade: 'A', desc: 'สภาพดี', color: 'bg-emerald-500' },
  { grade: 'B', desc: 'พอใช้', color: 'bg-amber-500' },
  { grade: 'C', desc: 'ต้องซ่อม', color: 'bg-orange-500' },
  { grade: 'D', desc: 'Hold', color: 'bg-red-600' },
];

const STATUS_LABELS: Record<string, string> = {
  in_yard: 'ในลาน', hold: 'ค้างจ่าย', repair: 'ซ่อม', gated_out: 'ปล่อยแล้ว', available: 'ว่าง',
};

const LIFECYCLE_LABELS: Record<string, string> = {
  gate_in: 'Gate-In',
  inspection: 'ตรวจสภาพ',
  location: 'พิกัด',
  booking: 'Booking',
  billing: 'Billing',
  edi: 'EDI',
  gate_out: 'Gate-Out',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'ร่าง',
  issued: 'แจ้งหนี้',
  paid: 'ชำระแล้ว',
  overdue: 'เกินกำหนด',
  cancelled: 'ยกเลิก',
  credit_note: 'ใบลดหนี้',
};

const CLEARANCE_LABELS: Record<string, string> = {
  paid: 'Paid',
  credit: 'Credit',
  no_charge: 'No Charge',
  waived: 'Waived',
};

const REVIEW_STATUS_INFO: Record<string, { label: string; color: string }> = {
  pending_review: { label: 'รอตรวจ', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'ไม่เห็นชอบ', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
};

const REVIEW_ACTION_LABELS: Record<string, string> = {
  container_grade_change_after_save: 'เปลี่ยนเกรดตู้',
  container_billing_hold_override: 'เปลี่ยนสถานะตู้ที่ติด Billing Hold',
  gate_out_with_billing_hold: 'Gate Out ทั้งที่ติด Billing Hold',
  billing_no_charge_recorded: 'No Charge',
  billing_waive_recorded: 'Waived / ลดค่าบริการ',
  credit_note_created: 'ออกใบลดหนี้',
  invoice_cancel_after_issue: 'ยกเลิก Invoice',
  billing_hold_released: 'ปลด Billing Hold',
};

export default function ContainerDetailModal({ containerId, onClose, onRefresh, onViewEIR }: ContainerDetailModalProps) {
  const [data, setData] = useState<ContainerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSide, setActiveSide] = useState('front');
  const [selectedPoint, setSelectedPoint] = useState<DamagePoint | null>(null);
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [gradeChanging, setGradeChanging] = useState(false);
  const [newGrade, setNewGrade] = useState('A');
  const [auditLogs, setAuditLogs] = useState<ReadableAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/containers/detail?container_id=${containerId}`);
        const json = await res.json();
        setData(json);
        if (json.container) setNewStatus(json.container.status);
        if (json.container) setNewGrade(json.container.container_grade || 'A');
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    fetchDetail();
  }, [containerId]);

  useEffect(() => {
    async function fetchAudit() {
      setAuditLoading(true);
      try {
        const res = await fetch(`/api/audit-trail/readable?container_id=${containerId}&limit=30`);
        const json = await res.json();
        setAuditLogs(json.logs || []);
      } catch {
        setAuditLogs([]);
      } finally {
        setAuditLoading(false);
      }
    }
    fetchAudit();
  }, [containerId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8" onClick={e => e.stopPropagation()}>
          <Loader2 size={24} className="animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-400 mt-3">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!data?.container) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center" onClick={e => e.stopPropagation()}>
          <p className="text-red-500 font-semibold">❌ ไม่พบข้อมูลตู้</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 rounded-lg bg-slate-100 text-sm">ปิด</button>
        </div>
      </div>
    );
  }

  const c = data.container;
  const gi = data.gate_in;
  const go = data.gate_out;
  const damagePoints: DamagePoint[] = gi?.damage_report?.points || [];
  const grade = gi?.damage_report?.condition_grade || 'A';
  const gradeInfo = GRADE_INFO[grade] || GRADE_INFO.A;
  const hasDamage = damagePoints.length > 0;
  const currentSidePoints = damagePoints.filter(p => p.side === activeSide);

  const evidenceSnapshot = gi?.damage_report?.photo_evidence?.length
    ? {
        photo_evidence: normalizeEvidencePhotos(gi.damage_report.photo_evidence, 'other'),
        photo_requirements: gi.damage_report.photo_requirements || [],
        photo_completeness: gi.damage_report.photo_completeness,
      }
    : buildPhotoEvidenceSnapshot({
        templateKey: gi?.damage_report?.inspection_template,
        legacyPhotos: gi?.damage_report?.photos || [],
        damagePoints,
      });
  const exitPhotos = normalizeEvidencePhotos(go?.damage_report?.exit_photos || [], 'other').map((photo, i) => ({
    ...photo,
    id: `exit-${photo.id || i}`,
    label: `ขาออก ${i + 1}`,
  }));
  const galleryPhotos = [...evidenceSnapshot.photo_evidence, ...exitPhotos];
  const photoCompleteness = evidenceSnapshot.photo_completeness;
  const lifecycle = data.lifecycle || {
    gate_in: Boolean(gi),
    inspection: Boolean(gi?.damage_report),
    location: Boolean(c.zone_name && c.bay && c.row && c.tier),
    booking: Boolean(c.booking_ref),
    billing: Boolean(data.documents?.invoices?.length || data.billing?.clearances?.length),
    edi: Boolean(data.edi?.endpoints?.length),
    gate_out: Boolean(go),
  };
  const exceptions = data.exceptions || [];
  const invoices = data.documents?.invoices || [];
  const clearances = data.billing?.clearances || [];
  const booking = data.booking;
  const ediEndpoints = data.edi?.endpoints || [];
  const approvalReviews = data.approval_reviews || [];
  const pendingReviews = approvalReviews.filter(review => review.status === 'pending_review');
  const lifecycleDone = Object.values(lifecycle).filter(Boolean).length;
  const lifecycleTotal = Object.keys(lifecycle).length;
  const billingOutstanding = data.billing?.totals?.outstanding || 0;

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === c.status) return;
    setStatusChanging(true);
    try {
      await fetch('/api/containers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_id: c.container_id, status: newStatus }),
      });
      onRefresh?.();
      onClose();
    } catch { /* ignore */ }
    finally { setStatusChanging(false); }
  };

  const handleGradeChange = async () => {
    if (!newGrade || newGrade === (c.container_grade || 'A')) return;
    setGradeChanging(true);
    try {
      await fetch('/api/containers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_id: c.container_id, container_grade: newGrade }),
      });
      setData(prev => prev ? { ...prev, container: { ...prev.container, container_grade: newGrade } } : prev);
      onRefresh?.();
    } catch { /* ignore */ }
    finally { setGradeChanging(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>

          {/* ===== HEADER ===== */}
          <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Container 360</span>
              <span className="text-xl font-mono font-bold text-slate-800 dark:text-white">{c.container_number}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                c.status === 'in_yard' ? 'bg-emerald-100 text-emerald-600' :
                c.status === 'hold' ? 'bg-amber-100 text-amber-600' :
                c.status === 'repair' ? 'bg-rose-100 text-rose-600' :
                'bg-slate-100 text-slate-500'
              }`}>{STATUS_LABELS[c.status] || c.status}</span>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">{c.size}&apos;{c.type}</span>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-black"
                style={{ backgroundColor: (GRADE_INFO[c.container_grade || 'A'] || GRADE_INFO.A).color }}>
                {c.container_grade || 'A'}
              </span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-5">

            {/* ===== CONTAINER INFO ===== */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoField label="สายเรือ" value={c.shipping_line || '—'} />
              <InfoField label="ซีล" value={c.seal_number || '—'} />
              <InfoField label="สินค้า" value={c.is_laden ? '📦 มีสินค้า' : '📭 ตู้เปล่า'} />
              <InfoField label="Booking" value={c.booking_ref || '—'} />
              <InfoField label="เกรด" value={`Grade ${c.container_grade || 'A'} · ${(GRADE_INFO[c.container_grade || 'A'] || GRADE_INFO.A).desc}`} highlight />
              <InfoField label="Hold" value={c.hold_status || '—'} highlight={Boolean(c.hold_status)} />
              <InfoField label="ลาน" value={c.yard_name || '—'} />
              <InfoField label="โซน" value={c.zone_name || '—'} />
              <InfoField label="พิกัด" value={c.bay && c.row && c.tier ? `B${c.bay}-R${c.row}-T${c.tier}` : '—'} mono />
              <InfoField label="อยู่ลานแล้ว" value={`${c.dwell_days} วัน`} highlight />
            </div>

            {/* ===== 360 SNAPSHOT ===== */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 overflow-hidden">
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-200 dark:border-blue-900/40">
                <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Container 360 Snapshot
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                <MiniMetric label="Lifecycle" value={`${lifecycleDone}/${lifecycleTotal}`} color={lifecycleDone === lifecycleTotal ? 'text-emerald-600' : 'text-blue-600'} />
                <MiniMetric label="Exception" value={`${exceptions.length}`} color={exceptions.length ? 'text-amber-600' : 'text-emerald-600'} />
                <MiniMetric label="Pending Review" value={`${pendingReviews.length}`} color={pendingReviews.length ? 'text-rose-600' : 'text-emerald-600'} />
                <MiniMetric label="รูปถ่าย" value={`${galleryPhotos.length}`} color={galleryPhotos.length ? 'text-blue-600' : 'text-slate-500'} />
                <MiniMetric label="ค้างชำระ" value={`฿${billingOutstanding.toLocaleString()}`} color={billingOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'} />
              </div>
            </div>

            {/* ===== LIFECYCLE OVERVIEW ===== */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Lifecycle Status
                </h3>
                <span className="text-[10px] text-slate-400">
                  {Object.values(lifecycle).filter(Boolean).length}/{Object.keys(lifecycle).length} ขั้นตอน
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-7 gap-2">
                {Object.entries(LIFECYCLE_LABELS).map(([key, label]) => {
                  const done = lifecycle[key as keyof typeof lifecycle];
                  return (
                    <div key={key} className={`rounded-lg border px-2.5 py-2 ${
                      done
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                    }`}>
                      <div className={`text-[10px] font-bold ${done ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {done ? 'ครบแล้ว' : 'รอข้อมูล'}
                      </div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-0.5">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== EXCEPTIONS ===== */}
            {exceptions.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 overflow-hidden">
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-900/40">
                  <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> สิ่งที่ควรตรวจสอบ ({exceptions.length})
                  </h3>
                </div>
                <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                  {exceptions.map(ex => (
                    <div key={ex.code} className="px-4 py-2.5 flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        ex.severity === 'danger' ? 'bg-red-500' : ex.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-white">{ex.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ex.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== GATE-IN INFO ===== */}
            {gi && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">📥 Gate-In</h3>
                  <button onClick={() => onViewEIR ? onViewEIR(gi.eir_number) : window.open(`/eir/${gi.eir_number}`, '_blank')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <ExternalLink size={10} /> {gi.eir_number}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
                  <InfoField label="วันที่" value={gi.date ? formatDateTime(gi.date) : '—'} />
                  <InfoField label="คนขับ" value={gi.driver_name || '—'} />
                  <InfoField label="ทะเบียนรถ" value={gi.truck_plate || '—'} mono />
                  <InfoField label="ผู้ดำเนินการ" value={gi.processed_by} />
                </div>
              </div>
            )}

            {/* ===== INSPECTION DIAGRAM ===== */}
            {gi?.damage_report && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    🔍 ผลตรวจสภาพ — {hasDamage ? `พบ ${damagePoints.length} จุดเสียหาย` : 'ไม่พบความเสียหาย'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-white text-xs font-bold"
                      style={{ backgroundColor: gradeInfo.color }}>{grade}</span>
                    <span className="text-[10px] text-slate-400">{gradeInfo.desc}</span>
                  </div>
                </div>

                {/* Side Tabs */}
                <div className="px-4 pt-3 flex gap-1 flex-wrap">
                  {SIDES.map(side => {
                    const count = damagePoints.filter(p => p.side === side.key).length;
                    return (
                      <button key={side.key} onClick={() => { setActiveSide(side.key); setSelectedPoint(null); }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border relative ${
                          activeSide === side.key
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-blue-200'
                        }`}>
                        {side.icon} {side.label}
                        {count > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* SVG Panel (Read-Only) */}
                <div className="px-4 py-3">
                  <div className="relative rounded-xl overflow-hidden" style={{ height: 220 }}>
                    <div className="absolute inset-0 bg-gradient-to-b from-sky-100 to-slate-200 dark:from-slate-900 dark:to-slate-800" />

                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet">
                      {activeSide === 'front' && (
                        <g>
                          <rect x="80" y="10" width="440" height="200" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                          <rect x="85" y="15" width="213" height="190" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
                          <rect x="302" y="15" width="213" height="190" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
                          {[50, 100, 150].map(y => (
                            <g key={`lh${y}`}>
                              <rect x="85" y={y} width="8" height="14" rx="2" fill="#94A3B8" />
                              <rect x="507" y={y} width="8" height="14" rx="2" fill="#94A3B8" />
                            </g>
                          ))}
                          <rect x="280" y="80" width="6" height="50" rx="3" fill="#64748B" />
                          <rect x="314" y="80" width="6" height="50" rx="3" fill="#64748B" />
                          <circle cx="300" cy="140" r="7" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="3,2" />
                        </g>
                      )}
                      {activeSide === 'back' && (
                        <g>
                          <rect x="80" y="10" width="440" height="200" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                          {Array.from({ length: 15 }, (_, i) => (
                            <line key={i} x1="85" y1={18 + i * 13} x2="515" y2={18 + i * 13} stroke="#CBD5E1" strokeWidth="1" />
                          ))}
                          <text x="300" y="118" textAnchor="middle" fill="#94A3B8" fontSize="12" fontFamily="sans-serif" fontWeight="600">ผนังด้านหลัง</text>
                        </g>
                      )}
                      {(activeSide === 'left' || activeSide === 'right') && (
                        <g>
                          <rect x="40" y="10" width="520" height="200" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                          {Array.from({ length: 15 }, (_, i) => (
                            <line key={i} x1="45" y1={18 + i * 13} x2="555" y2={18 + i * 13} stroke="#CBD5E1" strokeWidth="1" />
                          ))}
                          {[160, 300, 440].map(x => (
                            <line key={x} x1={x} y1="10" x2={x} y2="210" stroke="#B0BEC5" strokeWidth="2" />
                          ))}
                        </g>
                      )}
                      {activeSide === 'top' && (
                        <g>
                          <rect x="40" y="20" width="520" height="170" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                          {Array.from({ length: 10 }, (_, i) => (
                            <line key={i} x1={90 + i * 48} y1="20" x2={90 + i * 48} y2="190" stroke="#CBD5E1" strokeWidth="1" />
                          ))}
                          <line x1="40" y1="105" x2="560" y2="105" stroke="#B0BEC5" strokeWidth="2" strokeDasharray="8,4" />
                        </g>
                      )}
                      {activeSide === 'floor' && (
                        <g>
                          <rect x="40" y="20" width="520" height="170" rx="3" fill="#DDD6C8" stroke="#A89F91" strokeWidth="2" />
                          {Array.from({ length: 7 }, (_, i) => (
                            <line key={i} x1="40" y1={44 + i * 22} x2="560" y2={44 + i * 22} stroke="#C4B99A" strokeWidth="1" />
                          ))}
                          <rect x="120" y="192" width="70" height="14" rx="3" fill="#94A3B8" />
                          <rect x="400" y="192" width="70" height="14" rx="3" fill="#94A3B8" />
                        </g>
                      )}
                    </svg>

                    {/* Damage points */}
                    {currentSidePoints.map(point => (
                      <button key={point.id}
                        className={`absolute w-6 h-6 rounded-full ${SEVERITY_COLORS[point.severity]?.bg || 'bg-amber-400'} shadow-lg border-2 border-white dark:border-slate-800 z-10 flex items-center justify-center transition-transform ${selectedPoint?.id === point.id ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'}`}
                        style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
                        onClick={() => setSelectedPoint(selectedPoint?.id === point.id ? null : point)}>
                        <span className="text-[9px] text-white font-bold">{damagePoints.findIndex(p => p.id === point.id) + 1}</span>
                      </button>
                    ))}

                    {currentSidePoints.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-xs text-slate-400/60">ไม่พบจุดเสียหายด้านนี้</span>
                      </div>
                    )}
                  </div>

                  {/* Selected Point Tooltip */}
                  {selectedPoint && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                      {selectedPoint.photo && (
                        <button onClick={() => setFullPhoto(selectedPoint.photo!)}>
                          <img src={selectedPoint.photo} alt="damage" className="w-24 h-20 rounded-lg object-cover border border-slate-200 hover:border-blue-400 transition-colors cursor-pointer" />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-3 h-3 rounded-full ${SEVERITY_COLORS[selectedPoint.severity]?.bg}`} />
                          <span className="text-sm font-semibold text-slate-700 dark:text-white">
                            {DAMAGE_LABELS[selectedPoint.type] || selectedPoint.type}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({SEVERITY_COLORS[selectedPoint.severity]?.label})
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {SIDES.find(s => s.key === selectedPoint.side)?.icon} {SIDES.find(s => s.key === selectedPoint.side)?.label} — ตำแหน่ง ({selectedPoint.x.toFixed(0)}%, {selectedPoint.y.toFixed(0)}%)
                        </p>
                        {selectedPoint.note && (
                          <p className="text-xs text-slate-500 mt-1">{selectedPoint.note}</p>
                        )}
                        {!selectedPoint.photo && (
                          <p className="text-[10px] text-slate-300 mt-1 italic">ไม่มีรูปถ่ายประกอบ</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inspector Notes */}
                {gi.damage_report?.inspector_notes && (
                  <div className="px-4 pb-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400">
                      <span className="font-semibold">บันทึกผู้ตรวจ:</span> {gi.damage_report.inspector_notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== PHOTOS GALLERY ===== */}
            {galleryPhotos.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400">
                      📸 Photo Evidence ({galleryPhotos.length} รูป)
                    </h3>
                    {photoCompleteness && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        photoCompleteness.missing_categories.length === 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                      }`}>
                        ครบ {photoCompleteness.completed}/{photoCompleteness.required}
                      </span>
                    )}
                  </div>
                  {photoCompleteness?.missing_categories.length ? (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      ยังขาด: {photoCompleteness.missing_categories.join(', ')}
                    </p>
                  ) : null}
                </div>
                <div className="p-4 grid grid-cols-3 md:grid-cols-4 gap-2">
                  {galleryPhotos.map(photo => (
                    <button key={photo.id} onClick={() => setFullPhoto(photo.url)} className="text-left group">
                      <img src={photo.url} alt={photo.label}
                        className="w-full h-20 object-cover rounded-lg border border-slate-200 group-hover:border-blue-400 transition-all" />
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">{photo.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== GATE-OUT INFO ===== */}
            {go && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400">📤 Gate-Out</h3>
                  <button onClick={() => onViewEIR ? onViewEIR(go.eir_number) : window.open(`/eir/${go.eir_number}`, '_blank')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <ExternalLink size={10} /> {go.eir_number}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
                  <InfoField label="วันที่" value={go.date ? formatDateTime(go.date) : '—'} />
                  <InfoField label="คนขับ" value={go.driver_name || '—'} />
                  <InfoField label="ทะเบียนรถ" value={go.truck_plate || '—'} mono />
                  <InfoField label="ผู้ดำเนินการ" value={go.processed_by} />
                </div>
              </div>
            )}

            {/* ===== DOCUMENTS / BILLING / BOOKING / EDI ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText size={13} /> เอกสารที่เกี่ยวข้อง
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {gi?.eir_number && (
                    <DocumentRow label="EIR Gate-In" number={gi.eir_number} onClick={() => onViewEIR ? onViewEIR(gi.eir_number) : window.open(`/eir/${gi.eir_number}`, '_blank')} />
                  )}
                  {go?.eir_number && (
                    <DocumentRow label="EIR Gate-Out" number={go.eir_number} onClick={() => onViewEIR ? onViewEIR(go.eir_number) : window.open(`/eir/${go.eir_number}`, '_blank')} />
                  )}
                  {invoices.length === 0 && !gi?.eir_number && !go?.eir_number && (
                    <p className="text-xs text-slate-400">ยังไม่มีเอกสารที่ผูกกับตู้นี้</p>
                  )}
                  {invoices.map(inv => (
                    <button key={inv.invoice_id} onClick={() => window.open(`/billing/print?id=${inv.invoice_id}&type=${inv.status === 'paid' ? 'receipt' : 'invoice'}`, '_blank')}
                      className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-slate-800 dark:text-white truncate">{inv.invoice_number}</p>
                        <p className="text-[10px] text-slate-400 truncate">{inv.description || inv.charge_type}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">฿{(inv.grand_total || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">{INVOICE_STATUS_LABELS[inv.status] || inv.status}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Receipt size={13} /> Billing Clearance
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {data.billing?.totals && (
                    <div className="grid grid-cols-3 gap-2">
                      <MiniMetric label="ชำระแล้ว" value={`฿${data.billing.totals.paid.toLocaleString()}`} color="text-emerald-600" />
                      <MiniMetric label="ค้าง" value={`฿${data.billing.totals.outstanding.toLocaleString()}`} color="text-red-600" />
                      <MiniMetric label="CN" value={`฿${data.billing.totals.credit_notes.toLocaleString()}`} color="text-amber-600" />
                    </div>
                  )}
                  {clearances.length === 0 ? (
                    <p className="text-xs text-slate-400">ยังไม่มี Billing Clearance</p>
                  ) : clearances.map(cl => (
                    <div key={cl.clearance_id} className="rounded-lg bg-slate-50 dark:bg-slate-700/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-white">
                          {cl.transaction_type === 'gate_in' ? 'Gate-In' : 'Gate-Out'} · {CLEARANCE_LABELS[cl.clearance_type] || cl.clearance_type}
                        </p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">฿{(cl.final_amount || 0).toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {cl.invoice_number || 'ไม่มีใบแจ้งหนี้'}{cl.reason ? ` · ${cl.reason}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Ship size={13} /> Booking
                  </h3>
                </div>
                <div className="p-4">
                  {!booking ? (
                    <p className="text-xs text-slate-400">{c.booking_ref ? `ยังไม่พบ Booking ${c.booking_ref}` : 'ไม่มี Booking ที่ผูกกับตู้'}</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-bold text-slate-800 dark:text-white">{booking.booking_number}</p>
                          <p className="text-xs text-slate-400">{booking.customer_name || 'ไม่ระบุลูกค้า'} · {booking.vessel_name || 'ไม่ระบุเรือ'} {booking.voyage_number || ''}</p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-bold">
                          {booking.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <MiniMetric label="จำนวน" value={`${booking.container_count || 0}`} />
                        <MiniMetric label="รับแล้ว" value={`${booking.received_count || 0}`} color="text-blue-600" />
                        <MiniMetric label="ออกแล้ว" value={`${booking.released_count || 0}`} color="text-emerald-600" />
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, ((booking.received_count || 0) / Math.max(1, booking.container_count || 1)) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400">
                        ตู้นี้: {booking.container_booking_status || 'ยังไม่ระบุสถานะ'}{booking.gate_in_at ? ` · รับเข้า ${formatDateTime(booking.gate_in_at)}` : ''}{booking.gate_out_at ? ` · ออก ${formatDateTime(booking.gate_out_at)}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Radio size={13} /> EDI
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {ediEndpoints.length === 0 ? (
                    <p className="text-xs text-slate-400">{c.shipping_line ? 'ยังไม่พบ endpoint EDI สำหรับสายเรือนี้' : 'ไม่มีสายเรือสำหรับตรวจ EDI endpoint'}</p>
                  ) : ediEndpoints.map(ep => (
                    <div key={ep.endpoint_id} className="rounded-lg bg-slate-50 dark:bg-slate-700/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-white truncate">{ep.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          (ep.last_log_status || ep.last_status) === 'sent' ? 'bg-emerald-50 text-emerald-600' :
                          (ep.last_log_status || ep.last_status) === 'failed' ? 'bg-red-50 text-red-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {ep.last_log_status || ep.last_status || 'pending'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {ep.type || 'endpoint'} · {ep.format || 'EDIFACT'}{ep.last_sent_at ? ` · ส่งล่าสุด ${formatDateTime(ep.last_sent_at)}` : ''}
                      </p>
                      {ep.last_error_message && <p className="text-[10px] text-red-500 mt-0.5 truncate">{ep.last_error_message}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ===== READABLE AUDIT TRAIL ===== */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Supervisor Review
                </h3>
                <span className={`text-[10px] font-bold ${pendingReviews.length ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {pendingReviews.length ? `${pendingReviews.length} รายการรอตรวจ` : 'ไม่มีรายการรอตรวจ'}
                </span>
              </div>
              <div className="p-4 space-y-2">
                {approvalReviews.length === 0 ? (
                  <p className="text-xs text-slate-400">ยังไม่มีรายการ soft approval ที่ผูกกับตู้นี้</p>
                ) : approvalReviews.slice(0, 6).map(review => {
                  const info = REVIEW_STATUS_INFO[review.status] || REVIEW_STATUS_INFO.pending_review;
                  return (
                    <div key={review.review_id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${info.color}`}>{info.label}</span>
                            <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                              {REVIEW_ACTION_LABELS[review.action] || review.action}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {review.permission_code} · {review.requested_by_name || 'ระบบ'} · {formatDateTime(review.created_at)}
                          </p>
                          {review.reason && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">หมายเหตุ: {review.reason}</p>}
                        </div>
                        {review.approved_by_name && (
                          <span className="text-[10px] text-slate-400 flex-shrink-0">โดย {review.approved_by_name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {approvalReviews.length > 6 && (
                  <p className="text-[10px] text-slate-400 text-center pt-1">แสดง 6 จาก {approvalReviews.length} รายการล่าสุด</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock size={13} /> Audit Trail
                </h3>
                <span className="text-[10px] text-slate-400">{auditLogs.length} รายการล่าสุด</span>
              </div>
              <div className="p-4">
                {auditLoading ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                    กำลังโหลดประวัติ...
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">ยังไม่มีประวัติการแก้ไขที่ผูกกับตู้นี้</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.slice(0, 8).map(log => (
                      <div key={log.log_id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                log.tone === 'success' ? 'bg-emerald-500' :
                                log.tone === 'warning' ? 'bg-amber-500' :
                                log.tone === 'danger' ? 'bg-red-500' :
                                log.tone === 'info' ? 'bg-blue-500' : 'bg-slate-400'
                              }`} />
                              <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{log.title}</p>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{log.summary}</p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1"><User size={10} /> {log.actor_name}</span>
                              <span>{formatDateTime(log.created_at)}</span>
                              <span className="font-mono">{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
                            </div>
                          </div>
                        </div>
                        {log.fields.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1.5">
                            {log.fields.slice(0, 8).map(field => (
                              <div key={`${log.log_id}-${field.label}`} className="rounded bg-slate-50 dark:bg-slate-700/40 px-2 py-1">
                                <p className="text-[9px] text-slate-400">{field.label}</p>
                                <p className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">{field.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {auditLogs.length > 8 && (
                      <p className="text-[10px] text-slate-400 text-center pt-1">แสดง 8 จาก {auditLogs.length} รายการล่าสุด</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ===== ACTIONS ===== */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              {/* View EIR */}
              {gi?.eir_number && (
                <button onClick={() => onViewEIR ? onViewEIR(gi.eir_number) : window.open(`/eir/${gi.eir_number}`, '_blank')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors">
                  <ExternalLink size={12} /> ดู EIR
                </button>
              )}

              {/* Change Status */}
              {c.status !== 'gated_out' && (
                <div className="flex items-center gap-1.5">
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                    className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-white outline-none">
                    <option value="in_yard">ในลาน</option>
                    <option value="hold">ค้างจ่าย</option>
                    <option value="repair">ซ่อม</option>
                  </select>
                  <button onClick={handleStatusChange}
                    disabled={statusChanging || newStatus === c.status}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-xs font-medium hover:bg-amber-100 disabled:opacity-30 transition-colors">
                    {statusChanging ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
                    เปลี่ยนสถานะ
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <select value={newGrade} onChange={e => setNewGrade(e.target.value)}
                  className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-white outline-none">
                  {GRADE_OPTIONS.map(g => (
                    <option key={g.grade} value={g.grade}>Grade {g.grade} - {g.desc}</option>
                  ))}
                </select>
                <button onClick={handleGradeChange}
                  disabled={gradeChanging || newGrade === (c.container_grade || 'A')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-medium hover:bg-blue-100 disabled:opacity-30 transition-colors">
                  {gradeChanging ? <Loader2 size={12} className="animate-spin" /> : null}
                  บันทึกเกรด
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-size photo overlay */}
      {fullPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setFullPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-lg flex items-center justify-center hover:bg-white/30">✕</button>
          <img src={fullPhoto} alt="Full-size photo" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

function InfoField({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${highlight ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}

function DocumentRow({ label, number, onClick }: { label: string; number: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
      <div>
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="font-mono text-xs font-semibold text-slate-800 dark:text-white">{number}</p>
      </div>
      <ExternalLink size={12} className="text-slate-400" />
    </button>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-xs font-bold ${color || 'text-slate-700 dark:text-slate-200'}`}>{value}</p>
    </div>
  );
}

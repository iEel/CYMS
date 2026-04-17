'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Loader2, Search, Wrench, FileCheck2, Plus, CheckCircle2,
  XCircle, Clock, RotateCcw, Send, ThumbsUp, Play,
  DollarSign, Ban, BookOpen, Camera, ImageIcon, Save,
  Printer, Link2,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface EORRow {
  eor_id: number; eor_number: string; container_number: string;
  size: string; type: string; customer_name: string;
  billing_customer_name?: string; invoice_number?: string;
  damage_details: string; estimated_cost: number; actual_cost: number;
  status: string; approved_at: string; created_name: string; created_at: string;
}

interface ContainerOption {
  container_id: number; container_number: string; size: string; type: string; shipping_line: string; customer_id?: number;
}

interface CustomerOption {
  customer_id: number;
  customer_code?: string;
  customer_name: string;
  is_line?: boolean;
  is_forwarder?: boolean;
  is_trucking?: boolean;
  is_shipper?: boolean;
  is_consignee?: boolean;
  is_active?: boolean;
}

// Standard CEDEX-like damage codes — loaded from DB
interface CedexCode {
  cedex_id: number;
  code: string;
  component: string;
  damage: string;
  repair: string;
  labor_hours: number;
  material_cost: number;
  is_active: boolean;
}

interface DamagePoint {
  id?: string;
  side?: string;
  type?: string;
  severity?: string;
  note?: string;
  photo?: string;
}

interface ContainerDetailLite {
  container?: ContainerOption & { customer_id?: number };
  gate_in?: {
    eir_number?: string;
    damage_report?: {
      points?: DamagePoint[];
      photos?: string[];
      photo_evidence?: Array<{ url?: string }>;
      condition_grade?: string;
      inspector_notes?: string;
    } | null;
  } | null;
}

const DAMAGE_TYPE_TO_CEDEX_KEYWORD: Record<string, string[]> = {
  dent: ['dent', 'บุ๋ม'],
  hole: ['hole', 'ทะลุ', 'รู'],
  rust: ['rust', 'สนิม'],
  scratch: ['scratch', 'ขีด', 'ถลอก'],
  crack: ['crack', 'แตก', 'ร้าว'],
  missing_part: ['missing', 'หาย'],
};

export default function MnRPage() {
  const searchParams = useSearchParams();
  const { session, hasPermission, hasAnyPermission } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'cedex'>('list');
  const yardId = session?.activeYardId || 1;
  const canCreateEor = hasPermission('mnr.eor.create');
  const canApproveEor = hasPermission('mnr.eor.approve');
  const canUpdateEor = hasPermission('mnr.eor.update');
  const canManageCedex = hasPermission('mnr.cedex.manage');
  const canViewMnr = hasAnyPermission(['mnr.eor.create', 'mnr.eor.approve', 'mnr.eor.update', 'mnr.cedex.manage']);

  // List
  const [orders, setOrders] = useState<EORRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Create
  const [searchText, setSearchText] = useState('');
  const [containers, setContainers] = useState<ContainerOption[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerOption | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [repairPhotos, setRepairPhotos] = useState<string[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [billingCustomerId, setBillingCustomerId] = useState('');
  const [sourceEirNumber, setSourceEirNumber] = useState('');
  const [sourceDamagePoints, setSourceDamagePoints] = useState<DamagePoint[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);

  // CEDEX Management
  const [cedexCodes, setCedexCodes] = useState<CedexCode[]>([]);
  const [cedexLoading, setCedexLoading] = useState(false);
  const [showCedexForm, setShowCedexForm] = useState(false);
  const [editingCedex, setEditingCedex] = useState<CedexCode | null>(null);
  const [cedexForm, setCedexForm] = useState({
    code: '', component: '', damage: '', repair: '', labor_hours: 0, material_cost: 0,
  });
  const [cedexSaving, setCedexSaving] = useState(false);
  const [laborRate, setLaborRate] = useState(350);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });

  // Complete modal (actual_cost prompt)
  const [completeModal, setCompleteModal] = useState<{ open: boolean; eorId: number; estimatedCost: number } | null>(null);
  const [actualCostInput, setActualCostInput] = useState('');
  const [eorNotes, setEorNotes] = useState('');

  // Load labor rate from company settings
  useEffect(() => {
    fetch('/api/settings/company').then(r => r.json()).then(d => {
      if (d?.labor_rate) setLaborRate(d.labor_rate);
    }).catch(() => {});
  }, []);

  const fetchCedexCodes = useCallback(async () => {
    setCedexLoading(true);
    try {
      const res = await fetch('/api/mnr/cedex');
      const data = await res.json();
      setCedexCodes(data.codes || []);
    } catch (err) { console.error(err); }
    finally { setCedexLoading(false); }
  }, []);

  useEffect(() => { fetchCedexCodes(); }, [fetchCedexCodes]);

  const fetchOrders = useCallback(async () => {
    setListLoading(true);
    try {
      let url = `/api/mnr?yard_id=${yardId}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) { console.error(err); }
    finally { setListLoading(false); }
  }, [yardId, statusFilter]);

  useEffect(() => { if (activeTab === 'list') fetchOrders(); }, [activeTab, fetchOrders]);

  useEffect(() => {
    if (!canCreateEor) return;
    fetch('/api/settings/customers')
      .then(r => r.json())
      .then(data => setCustomers(Array.isArray(data) ? data.filter(c => c.is_active !== false) : []))
      .catch(() => {});
  }, [canCreateEor]);

  const customerRoleLabel = (customer: CustomerOption) => {
    const roles = [
      customer.is_line ? 'สายเรือ' : '',
      customer.is_forwarder ? 'Forwarder' : '',
      customer.is_trucking ? 'ขนส่ง' : '',
      customer.is_shipper ? 'Shipper' : '',
      customer.is_consignee ? 'Consignee' : '',
    ].filter(Boolean);
    return roles.length > 0 ? roles.join(', ') : 'ลูกค้า';
  };

  const selectContainerForEor = (container: ContainerOption) => {
    setSelectedContainer(container);
    setContainers([]);
    setBillingCustomerId(container.customer_id ? String(container.customer_id) : '');
  };

  const applyDamageSource = useCallback((detail: ContainerDetailLite, autoSelectCodes = true) => {
    const gateIn = detail.gate_in;
    const damageReport = gateIn?.damage_report;
    const points = damageReport?.points || [];
    const evidencePhotos = (damageReport?.photo_evidence || []).map(photo => photo.url).filter(Boolean) as string[];
    const photos = [
      ...evidencePhotos,
      ...(damageReport?.photos || []),
      ...points.map(point => point.photo).filter(Boolean) as string[],
    ];

    setSourceEirNumber(gateIn?.eir_number || '');
    setSourceDamagePoints(points);
    setRepairPhotos(prev => Array.from(new Set([...prev, ...photos])));
    if (gateIn?.eir_number && !eorNotes) {
      setEorNotes(`สร้างจาก EIR ${gateIn.eir_number}`);
    }

    if (autoSelectCodes && points.length > 0 && cedexCodes.length > 0) {
      const matched = new Set<string>();
      for (const point of points) {
        const keywords = DAMAGE_TYPE_TO_CEDEX_KEYWORD[String(point.type || '')] || [String(point.type || '')];
        const hit = cedexCodes.find(code => {
          const haystack = `${code.code} ${code.component} ${code.damage} ${code.repair}`.toLowerCase();
          return keywords.some(keyword => keyword && haystack.includes(keyword.toLowerCase()));
        });
        if (hit) matched.add(hit.code);
      }
      if (matched.size > 0) setSelectedCodes(prev => Array.from(new Set([...prev, ...matched])));
    }
  }, [cedexCodes, eorNotes]);

  useEffect(() => {
    const containerId = searchParams.get('container_id');
    if (!containerId || !canCreateEor) return;
    let cancelled = false;
    setActiveTab('create');
    setSourceLoading(true);
    fetch(`/api/containers/detail?container_id=${containerId}`)
      .then(r => r.json())
      .then((detail: ContainerDetailLite) => {
        if (cancelled || !detail.container) return;
        setSelectedContainer({
          container_id: detail.container.container_id,
          container_number: detail.container.container_number,
          size: detail.container.size,
          type: detail.container.type,
          shipping_line: detail.container.shipping_line,
          customer_id: detail.container.customer_id,
        });
        setBillingCustomerId(detail.container.customer_id ? String(detail.container.customer_id) : '');
        applyDamageSource(detail);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSourceLoading(false); });
    return () => { cancelled = true; };
  }, [searchParams, canCreateEor, applyDamageSource]);

  const searchContainers = async () => {
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&status=in_yard&search=${searchText}`);
      const data = await res.json();
      setContainers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const estimatedCost = selectedCodes.reduce((sum, code) => {
    const c = cedexCodes.find(cx => cx.code === code);
    return sum + (c ? c.labor_hours * laborRate + c.material_cost : 0);
  }, 0);

  const handleCreate = async () => {
    if (!canCreateEor) return;
    if (!selectedContainer || selectedCodes.length === 0) return;
    if (!billingCustomerId) {
      toast('error', 'กรุณาเลือกผู้รับผิดชอบค่าซ่อม');
      return;
    }
    setCreateLoading(true); setCreateResult(null);
    try {
      const cedexItems = selectedCodes.map(code => {
        const cx = cedexCodes.find(item => item.code === code);
        return cx ? {
          ...cx,
          amount: cx.labor_hours * laborRate + cx.material_cost,
          labor_rate: laborRate,
        } : null;
      }).filter(Boolean);
      const res = await fetch('/api/mnr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: selectedContainer.container_id, yard_id: yardId,
          customer_id: selectedContainer.customer_id || null,
          billing_customer_id: billingCustomerId ? parseInt(billingCustomerId) : null,
          damage_details: {
            source: sourceEirNumber ? 'eir_damage' : 'manual',
            source_eir_number: sourceEirNumber || null,
            cedex_items: cedexItems,
            damage_points: sourceDamagePoints,
          },
          estimated_cost: estimatedCost,
          repair_photos: repairPhotos,
          source_eir_number: sourceEirNumber || null,
          notes: eorNotes || null,
          user_id: session?.userId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateResult({ success: true, message: `✅ สร้าง EOR ${data.eor_number} สำเร็จ — ราคาประเมิน ฿${estimatedCost.toLocaleString()} (พร้อมรูปถ่าย ${repairPhotos.length} รูป)` });
        setSelectedContainer(null); setSelectedCodes([]); setRepairPhotos([]); setBillingCustomerId(''); setEorNotes(''); setSourceEirNumber(''); setSourceDamagePoints([]);
      } else {
        setCreateResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); }
    finally { setCreateLoading(false); }
  };

  const loadSelectedContainerDamage = async () => {
    if (!selectedContainer) return;
    setSourceLoading(true);
    try {
      const res = await fetch(`/api/containers/detail?container_id=${selectedContainer.container_id}`);
      const detail = await res.json();
      applyDamageSource(detail);
      if (!detail.gate_in?.damage_report?.points?.length) {
        toast('info', 'ยังไม่พบ damage point จาก EIR ของตู้นี้');
      }
    } catch {
      toast('error', 'โหลดข้อมูล damage จาก EIR ไม่สำเร็จ');
    } finally {
      setSourceLoading(false);
    }
  };

  const handleSaveCedex = async () => {
    if (!canManageCedex) return;
    setCedexSaving(true);
    try {
      const url = '/api/mnr/cedex';
      const method = editingCedex ? 'PUT' : 'POST';
      const payload = editingCedex
        ? { ...cedexForm, cedex_id: editingCedex.cedex_id, is_active: editingCedex.is_active }
        : cedexForm;
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success || data.data) {
        setShowCedexForm(false);
        setEditingCedex(null);
        setCedexForm({ code: '', component: '', damage: '', repair: '', labor_hours: 0, material_cost: 0 });
        fetchCedexCodes();
      } else {
        toast('error', data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) { console.error(err); }
    finally { setCedexSaving(false); }
  };

  const handleDeleteCedex = async (id: number) => {
    if (!canManageCedex) return;
    setConfirmDlg({
      open: true,
      message: 'ยืนยันลบรหัส CEDEX นี้?',
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        try {
          await fetch(`/api/mnr/cedex?id=${id}`, { method: 'DELETE' });
          fetchCedexCodes();
        } catch (err) { console.error(err); }
      },
    });
  };

  const startEditCedex = (c: CedexCode) => {
    if (!canManageCedex) return;
    setEditingCedex(c);
    setCedexForm({
      code: c.code, component: c.component, damage: c.damage,
      repair: c.repair, labor_hours: c.labor_hours, material_cost: c.material_cost,
    });
    setShowCedexForm(true);
  };

  const startCreateCedex = () => {
    if (!canManageCedex) return;
    setEditingCedex(null);
    setCedexForm({ code: '', component: '', damage: '', repair: '', labor_hours: 0, material_cost: 0 });
    setShowCedexForm(true);
  };

  const updateOrder = async (eorId: number, action: string, actualCost?: number) => {
    const allowed =
      (action === 'submit' && canCreateEor) ||
      (['approve', 'reject'].includes(action) && canApproveEor) ||
      (['start_repair', 'complete'].includes(action) && canUpdateEor);
    if (!allowed) return;
    await fetch('/api/mnr', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eor_id: eorId, action, actual_cost: actualCost, user_id: session?.userId || null }),
    });
    fetchOrders();
  };

  const handleComplete = (eorId: number, estimatedCost: number) => {
    setCompleteModal({ open: true, eorId, estimatedCost });
    setActualCostInput(String(estimatedCost || 0));
  };

  const confirmComplete = async () => {
    if (!canUpdateEor) return;
    if (!completeModal) return;
    const cost = parseFloat(actualCostInput) || 0;
    await updateOrder(completeModal.eorId, 'complete', cost);
    setCompleteModal(null);
    setActualCostInput('');
  };

  const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: 'ร่าง', color: 'bg-slate-100 text-slate-500', icon: <Clock size={10} /> },
    pending_approval: { label: 'รออนุมัติ', color: 'bg-amber-50 text-amber-600', icon: <Send size={10} /> },
    approved: { label: 'อนุมัติแล้ว', color: 'bg-blue-50 text-blue-600', icon: <ThumbsUp size={10} /> },
    in_repair: { label: 'กำลังซ่อม', color: 'bg-violet-50 text-violet-600', icon: <Wrench size={10} /> },
    completed: { label: 'เสร็จ', color: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle2 size={10} /> },
    rejected: { label: 'ปฏิเสธ', color: 'bg-rose-50 text-rose-500', icon: <Ban size={10} /> },
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";
  const tabs = [
    { id: 'list' as const, label: 'รายการ EOR', icon: <FileCheck2 size={14} />, allowed: canViewMnr },
    { id: 'create' as const, label: 'สร้าง EOR', icon: <Plus size={14} />, allowed: canCreateEor },
    { id: 'cedex' as const, label: 'รหัสความเสียหาย', icon: <BookOpen size={14} />, allowed: canManageCedex },
  ].filter(tab => tab.allowed);
  const effectiveTab = tabs.some(tab => tab.id === activeTab) ? activeTab : tabs[0]?.id;

  return (
    <>
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">ซ่อมบำรุง M&R</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">สร้าง EOR, มาตรฐาน CEDEX, อนุมัติใบซ่อม</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              effectiveTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== EOR LIST TAB =================== */}
      {effectiveTab === 'list' && canViewMnr && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Wrench size={16} /> EOR ({orders.length})</h3>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
                <option value="">ทุกสถานะ</option>
                <option value="draft">ร่าง</option>
                <option value="pending_approval">รออนุมัติ</option>
                <option value="approved">อนุมัติ</option>
                <option value="in_repair">กำลังซ่อม</option>
                <option value="completed">เสร็จ</option>
              </select>
              <button onClick={fetchOrders} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
            </div>
          </div>

          {listLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ยังไม่มี EOR — กดแท็บ &quot;สร้าง EOR&quot; เพื่อเพิ่ม</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {orders.map(o => (
                <div key={o.eor_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wrench size={16} className="text-violet-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{o.eor_number}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${statusLabels[o.status]?.color}`}>
                            {statusLabels[o.status]?.icon} {statusLabels[o.status]?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span>🏷️ {o.container_number} {o.size}&apos;{o.type}</span>
                          <span>• ฿{(o.estimated_cost || 0).toLocaleString()}</span>
                          {o.actual_cost > 0 && <span>• จริง: ฿{o.actual_cost.toLocaleString()}</span>}
                          {o.billing_customer_name && <span>• Bill to: {o.billing_customer_name}</span>}
                          {o.invoice_number && <span>• {o.invoice_number}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {o.status === 'draft' && canCreateEor && (
                        <button onClick={() => updateOrder(o.eor_id, 'submit')} disabled={!canCreateEor}
                          className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><Send size={10} /> ส่งอนุมัติ</button>
                      )}
                      {o.status === 'pending_approval' && canApproveEor && (
                        <>
                          <button onClick={() => updateOrder(o.eor_id, 'approve')} disabled={!canApproveEor}
                            className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><ThumbsUp size={10} /> อนุมัติ</button>
                          <button onClick={() => updateOrder(o.eor_id, 'reject')} disabled={!canApproveEor}
                            className="px-1.5 py-1 rounded-lg text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs"><XCircle size={14} /></button>
                        </>
                      )}
                      {o.status === 'approved' && canUpdateEor && (
                        <button onClick={() => updateOrder(o.eor_id, 'start_repair')} disabled={!canUpdateEor}
                          className="px-2 py-1 rounded-lg bg-violet-50 text-violet-600 text-xs font-medium hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><Play size={10} /> เริ่มซ่อม</button>
                      )}
                      {o.status === 'in_repair' && canUpdateEor && (
                        <button onClick={() => handleComplete(o.eor_id, o.estimated_cost)} disabled={!canUpdateEor}
                          className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><CheckCircle2 size={10} /> เสร็จ</button>
                      )}
                      <button onClick={() => window.open(`/api/mnr/eor-pdf?eor_id=${o.eor_id}`, '_blank')}
                        className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-500 text-xs font-medium hover:bg-slate-100 flex items-center gap-1">
                        <Printer size={10} /> EOR PDF
                      </button>
                      {o.status === 'completed' && (
                        <button onClick={() => window.open(`/billing?search=${encodeURIComponent(o.eor_number)}`, '_blank')}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 flex items-center gap-1">
                          <Link2 size={10} /> Billing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================== CREATE EOR TAB =================== */}
      {effectiveTab === 'create' && canCreateEor && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600"><Plus size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">สร้างใบ EOR ใหม่</h3>
                <p className="text-xs text-slate-400">เลือกตู้ + เลือกประเภทความเสียหาย → คำนวณราคา</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Select Container */}
            <div>
              <label className={labelClass}>เลือกตู้</label>
              <div className="flex gap-2">
                <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchContainers()}
                  className={`${inputClass} flex-1 font-mono`} placeholder="พิมพ์เลขตู้..." />
                <button onClick={searchContainers} className="h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 flex items-center gap-1.5">
                  <Search size={14} /> ค้นหา</button>
              </div>
            </div>

            {containers.length > 0 && !selectedContainer && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {containers.slice(0, 5).map(c => (
                  <button key={c.container_id} onClick={() => selectContainerForEor(c)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-300 text-xs">
                    <span className="font-mono font-semibold text-slate-800 dark:text-white">{c.container_number}</span>
                    <span className="text-slate-400 ml-2">{c.size}&apos;{c.type} • {c.shipping_line || '-'}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedContainer && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 text-xs text-violet-600 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p>✅ ตู้: <span className="font-mono font-bold">{selectedContainer.container_number}</span> ({selectedContainer.size}&apos;{selectedContainer.type})</p>
                  <button onClick={loadSelectedContainerDamage} disabled={sourceLoading}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-violet-600 border border-violet-200 text-[10px] font-medium hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1">
                    {sourceLoading ? <Loader2 size={10} className="animate-spin" /> : <Link2 size={10} />}
                    ดึง Damage จาก EIR
                  </button>
                </div>
                {(sourceEirNumber || sourceDamagePoints.length > 0) && (
                  <div className="rounded-lg bg-white/70 dark:bg-slate-800/60 border border-violet-100 dark:border-violet-900/40 px-3 py-2">
                    <p className="font-semibold">Source: {sourceEirNumber || 'EIR ล่าสุด'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">พบ damage point {sourceDamagePoints.length} จุด และรูปประกอบ {repairPhotos.length} รูป</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={labelClass}>ผู้รับผิดชอบค่าซ่อม / Billing Customer *</label>
              <select value={billingCustomerId} onChange={e => setBillingCustomerId(e.target.value)}
                className={inputClass}>
                <option value="">เลือกบริษัทที่จะออก Invoice M&R</option>
                {customers.map(customer => (
                  <option key={customer.customer_id} value={customer.customer_id}>
                    {customer.customer_name} {customer.customer_code ? `(${customer.customer_code})` : ''} — {customerRoleLabel(customer)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                ค่าเริ่มต้นจะดึงจากลูกค้าของตู้ แต่สามารถเปลี่ยนเป็นสายเรือ, ลูกค้าเครดิต, ขนส่ง หรือบริษัทที่รับผิดชอบค่าซ่อมจริงได้
              </p>
            </div>

            {/* CEDEX Codes Selection */}
            <div>
              <label className={labelClass}>เลือกประเภทความเสียหาย (CEDEX)</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {cedexCodes.map((c: CedexCode) => (
                  <label key={c.code} className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedCodes.includes(c.code) ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}>
                    <input type="checkbox" checked={selectedCodes.includes(c.code)}
                      onChange={e => setSelectedCodes(e.target.checked ? [...selectedCodes, c.code] : selectedCodes.filter(x => x !== c.code))}
                      className="rounded border-slate-300" />
                    <span className="font-mono text-violet-600 font-semibold w-10">{c.code}</span>
                    <span className="flex-1 text-slate-700 dark:text-slate-300">{c.component} — {c.damage} → {c.repair}</span>
                    <span className="text-slate-400">฿{(c.labor_hours * laborRate + c.material_cost).toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedCodes.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 flex items-center justify-between">
                <span className="text-xs text-amber-600"><DollarSign size={12} className="inline" /> ราคาประเมินรวม</span>
                <span className="text-lg font-bold text-amber-700">฿{estimatedCost.toLocaleString()}</span>
              </div>
            )}

            {/* Repair Photos */}
            <div className="space-y-2">
              <label className={labelClass}>รูปถ่ายความเสียหาย / ประกอบ EOR</label>
              <div className="flex gap-2 flex-wrap">
                {repairPhotos.map((photo, i) => (
                  <div key={i} className="relative">
                    <img src={photo} alt={`repair ${i + 1}`} className="w-20 h-16 rounded-lg object-cover border border-slate-200" />
                    <button onClick={() => setRepairPhotos(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px]">✕</button>
                  </div>
                ))}
                <label className="w-20 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-violet-400 hover:text-violet-500 cursor-pointer transition-colors">
                  <Camera size={16} /> <span className="text-[8px] mt-0.5">เพิ่มรูป</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setRepairPhotos(prev => [...prev, reader.result as string]);
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                </label>
              </div>
              {repairPhotos.length > 0 && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1"><ImageIcon size={10} /> {repairPhotos.length} รูปแนบ</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>หมายเหตุ (ถ้ามี)</label>
              <input type="text" value={eorNotes} onChange={e => setEorNotes(e.target.value)}
                className={inputClass} placeholder="เช่น ผู้ใช้แจ้ง, ตรวจพบตอน Gate-In" />
            </div>

            <button onClick={handleCreate} disabled={createLoading || !canCreateEor || !selectedContainer || !billingCustomerId || selectedCodes.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-all">
              {createLoading ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} สร้าง EOR
            </button>

            {createResult && (
              <div className={`p-3 rounded-xl text-sm ${createResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {createResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== CEDEX TAB =================== */}
      {effectiveTab === 'cedex' && canManageCedex && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><BookOpen size={16} /> รหัสความเสียหาย (CEDEX)</h3>
            <button onClick={startCreateCedex} disabled={!canManageCedex}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition-colors">
              <Plus size={14} /> เพิ่มรหัส
            </button>
          </div>

          {/* Form Modal */}
          {showCedexForm && (
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-violet-50/50 dark:bg-violet-900/10">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">
                {editingCedex ? `แก้ไข ${editingCedex.code}` : 'เพิ่มรหัส CEDEX ใหม่'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">รหัส</label>
                  <input type="text" value={cedexForm.code}
                    onChange={e => setCedexForm({ ...cedexForm, code: e.target.value.toUpperCase() })}
                    placeholder="DT01" disabled={!!editingCedex}
                    className={`${inputClass} font-mono ${editingCedex ? 'opacity-50' : ''}`} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ชิ้นส่วน</label>
                  <input type="text" value={cedexForm.component}
                    onChange={e => setCedexForm({ ...cedexForm, component: e.target.value })}
                    placeholder="Panel" className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ความเสียหาย</label>
                  <input type="text" value={cedexForm.damage}
                    onChange={e => setCedexForm({ ...cedexForm, damage: e.target.value })}
                    placeholder="Dent" className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">วิธีซ่อม</label>
                  <input type="text" value={cedexForm.repair}
                    onChange={e => setCedexForm({ ...cedexForm, repair: e.target.value })}
                    placeholder="Straighten" className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ชม.แรงงาน</label>
                  <input type="number" step="0.5" value={cedexForm.labor_hours}
                    onChange={e => setCedexForm({ ...cedexForm, labor_hours: parseFloat(e.target.value) || 0 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ค่าวัสดุ (฿)</label>
                  <input type="number" step="50" value={cedexForm.material_cost}
                    onChange={e => setCedexForm({ ...cedexForm, material_cost: parseFloat(e.target.value) || 0 })}
                    className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={handleSaveCedex} disabled={cedexSaving || !canManageCedex || !cedexForm.code || !cedexForm.component}
                  className="px-4 py-2 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
                  {cedexSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingCedex ? 'บันทึก' : 'เพิ่ม'}
                </button>
                <button onClick={() => { setShowCedexForm(false); setEditingCedex(null); }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-300">
                  ยกเลิก
                </button>
                <span className="text-xs text-slate-400 ml-2">
                  รวม: ฿{(cedexForm.labor_hours * laborRate + cedexForm.material_cost).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {cedexLoading ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" size={24} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">รหัส</th>
                    <th className="text-left px-4 py-2.5 font-semibold">ชิ้นส่วน</th>
                    <th className="text-left px-4 py-2.5 font-semibold">ความเสียหาย</th>
                    <th className="text-left px-4 py-2.5 font-semibold">วิธีซ่อม</th>
                    <th className="text-right px-4 py-2.5 font-semibold">ชม.แรงงาน</th>
                    <th className="text-right px-4 py-2.5 font-semibold">ค่าวัสดุ</th>
                    <th className="text-right px-4 py-2.5 font-semibold">รวม (฿)</th>
                    <th className="text-center px-4 py-2.5 font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {cedexCodes.map((c: CedexCode) => (
                    <tr key={c.cedex_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-violet-600">{c.code}</td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{c.component}</td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{c.damage}</td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{c.repair}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{c.labor_hours}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">฿{c.material_cost.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-white">฿{(c.labor_hours * laborRate + c.material_cost).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEditCedex(c)} disabled={!canManageCedex}
                            className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                            <Wrench size={12} />
                          </button>
                          <button onClick={() => handleDeleteCedex(c.cedex_id)} disabled={!canManageCedex}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded">
                            <Ban size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {cedexCodes.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">ยังไม่มีรหัส CEDEX — กดปุ่ม &quot;เพิ่มรหัส&quot; หรือรัน migration</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400">
            ทั้งหมด {cedexCodes.length} รายการ | อัตราแรงงาน {laborRate.toLocaleString()} ฿/ชม. (ตั้งค่าได้ที่หน้าตั้งค่าระบบ)
          </div>
        </div>
      )}
      {tabs.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          คุณไม่มีสิทธิ์ใช้งาน M&R ใน Granular RBAC
        </div>
      )}
    </div>

    <ConfirmDialog open={confirmDlg.open} title="ยืนยันการลบ" message={confirmDlg.message} confirmLabel="ลบ" onConfirm={confirmDlg.action} onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />

    {/* Complete Modal — ถามค่าซ่อมจริง */}
    {completeModal?.open && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" /> ยืนยันซ่อมเสร็จ
          </h3>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">ราคาประเมิน</label>
            <p className="text-sm text-slate-400">฿{(completeModal.estimatedCost || 0).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">ค่าซ่อมจริง (฿) *</label>
            <input type="number" value={actualCostInput}
              onChange={e => setActualCostInput(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-lg font-mono text-slate-800 dark:text-white outline-none focus:border-emerald-500"
              autoFocus />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={confirmComplete}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle2 size={14} /> ยืนยัน
            </button>
            <button onClick={() => setCompleteModal(null)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 text-sm hover:bg-slate-200">
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

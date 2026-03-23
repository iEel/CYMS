'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Loader2, Search, Truck, Package, ArrowRight, Play, CheckCircle2,
  XCircle, Clock, AlertTriangle, Plus, Layers, Shuffle, ChevronDown,
  ArrowDown, ArrowUp, ArrowUpFromLine, ArrowDownToLine, MapPin, User, ListOrdered, RotateCcw,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const ContainerTimeline = dynamic(() => import('@/components/containers/ContainerTimeline'), { ssr: false });

interface WorkOrderRow {
  order_id: number;
  order_type: string;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  from_zone_name: string;
  from_bay: number; from_row: number; from_tier: number;
  to_zone_id: number;
  to_zone_name: string;
  to_bay: number; to_row: number; to_tier: number;
  priority: number;
  status: string;
  assigned_name: string;
  created_name: string;
  notes: string;
  created_at: string;
  started_at: string;
  completed_at: string;
}

interface ContainerOption {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  zone_name: string;
  bay: number; row: number; tier: number;
  zone_id: number;
}

interface ZoneOption {
  zone_id: number;
  zone_name: string;
  max_bay: number;
  max_row: number;
  max_tier: number;
}

interface ShiftResult {
  shifting_needed: boolean;
  target: ContainerOption;
  containers_above: ContainerOption[];
  temp_positions: { bay: number; row: number; tier: number }[];
  total_moves: number;
  message: string;
}

export default function OperationsPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'queue' | 'create' | 'shifting'>('queue');

  // Job Queue
  const [orders, setOrders] = useState<WorkOrderRow[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [timelineCN, setTimelineCN] = useState<string | null>(null);

  // Create Work Order
  const [containers, setContainers] = useState<ContainerOption[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [createForm, setCreateForm] = useState({
    order_type: 'move', container_id: 0, from_zone_id: 0,
    from_bay: 0, from_row: 0, from_tier: 0,
    to_zone_id: 0, to_bay: 0, to_row: 0, to_tier: 0,
    priority: 3, notes: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [searchContainer, setSearchContainer] = useState('');

  // Smart Shifting
  const [shiftSearch, setShiftSearch] = useState('');
  const [shiftContainers, setShiftContainers] = useState<ContainerOption[]>([]);
  const [shiftResult, setShiftResult] = useState<ShiftResult | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Position edit for complete action
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editPos, setEditPos] = useState({ zone_id: 0, bay: 0, row: 0, tier: 0 });

  const yardId = session?.activeYardId || 1;
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchOrders = useCallback(async () => {
    setQueueLoading(true);
    try {
      let url = `/api/operations?yard_id=${yardId}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) { console.error(err); }
    finally { setQueueLoading(false); }
  }, [yardId, statusFilter]);

  // SSE real-time connection
  useEffect(() => {
    if (activeTab !== 'queue') {
      // Close SSE when not on queue tab
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setSseConnected(false);
      }
      return;
    }

    // Initial fetch
    fetchOrders();

    // Connect SSE
    const connectSSE = () => {
      const es = new EventSource(`/api/operations/stream?yard_id=${yardId}`);
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setSseConnected(true);
      });

      es.addEventListener('orders', (e) => {
        try {
          const data = JSON.parse(e.data);
          let filtered = data.orders || [];
          if (statusFilter) {
            filtered = filtered.filter((o: WorkOrderRow) => o.status === statusFilter);
          }
          setOrders(filtered);
          setQueueLoading(false);
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (activeTab === 'queue') connectSSE();
        }, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setSseConnected(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, yardId, statusFilter]);

  // Fetch containers for create form
  const searchContainersForCreate = async () => {
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&status=in_yard&search=${searchContainer}`);
      const data = await res.json();
      setContainers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  // Fetch zones (needed for create, shifting, and queue position edit)
  useEffect(() => {
    fetch(`/api/settings/zones?yard_id=${yardId}`)
      .then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : d.zones || [])).catch(() => {});
  }, [yardId]);

  // Update work order status
  const updateOrder = async (orderId: number, action: string, posOverride?: { to_zone_id: number; to_bay: number; to_row: number; to_tier: number }) => {
    try {
      await fetch('/api/operations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, action, ...posOverride }),
      });
      setEditingOrderId(null);
      fetchOrders();
    } catch (err) { console.error(err); }
  };

  // Create work order
  const handleCreate = async () => {
    if (!createForm.container_id) return;
    setCreateLoading(true);
    setCreateResult(null);
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, ...createForm }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateResult({ success: true, message: '✅ สร้างงานสำเร็จ' });
        setCreateForm({ ...createForm, container_id: 0, notes: '' });
      } else {
        setCreateResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setCreateResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setCreateLoading(false); }
  };

  // Smart Shifting search
  const searchForShift = async () => {
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&status=in_yard&search=${shiftSearch}`);
      const data = await res.json();
      setShiftContainers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const analyzeShift = async (containerId: number) => {
    setShiftLoading(true);
    setShiftResult(null);
    try {
      const res = await fetch('/api/operations/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_id: containerId, yard_id: yardId }),
      });
      const data = await res.json();
      setShiftResult(data);
    } catch (err) { console.error(err); }
    finally { setShiftLoading(false); }
  };

  const priorityLabels: Record<number, { label: string; color: string }> = {
    1: { label: 'ด่วนมาก', color: 'bg-red-500 text-white' },
    2: { label: 'ด่วน', color: 'bg-orange-500 text-white' },
    3: { label: 'ปกติ', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    4: { label: 'ต่ำ', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  };

  const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: 'รอดำเนินการ', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20', icon: <Clock size={10} /> },
    assigned: { label: 'มอบหมายแล้ว', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20', icon: <User size={10} /> },
    in_progress: { label: 'กำลังทำ', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20', icon: <Play size={10} /> },
    completed: { label: 'เสร็จ', color: 'bg-slate-50 text-slate-500 dark:bg-slate-700', icon: <CheckCircle2 size={10} /> },
    cancelled: { label: 'ยกเลิก', color: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20', icon: <XCircle size={10} /> },
  };

  const orderTypeLabels: Record<string, string> = {
    move: '🚛 ย้ายตู้', gate_in: '📥 รับเข้า', gate_out: '📤 ปล่อยออก',
    shift: '🔀 หลบตู้', restack: '📚 จัดเรียง',
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">ปฏิบัติการ</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">คำสั่งงานรถยก, จัดการตู้, Smart Shifting</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'queue' as const, label: 'Job Queue', icon: <ListOrdered size={14} /> },
          { id: 'create' as const, label: 'สร้างงาน', icon: <Plus size={14} /> },
          { id: 'shifting' as const, label: 'Smart Shifting', icon: <Shuffle size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 md:py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== JOB QUEUE TAB =================== */}
      {activeTab === 'queue' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Truck size={18} /> งานทั้งหมด ({orders.length})
            </h3>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <option value="">ทุกสถานะ</option>
                <option value="pending">รอดำเนินการ</option>
                <option value="assigned">มอบหมายแล้ว</option>
                <option value="in_progress">กำลังทำ</option>
                <option value="completed">เสร็จ</option>
              </select>
              <button onClick={fetchOrders} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1">
                <RotateCcw size={12} /> รีเฟรช
              </button>
              {sseConnected && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              )}
            </div>
          </div>

          {queueLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ไม่มีงาน — กดแท็บ &quot;สร้างงาน&quot; เพื่อเพิ่ม</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {orders.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(order => (
                <div key={order.order_id} className="p-4 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  {/* Container Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {order.notes?.includes('Gate-Out') ? (
                        <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                          <ArrowUpFromLine size={20} className="text-amber-600 dark:text-amber-400 md:w-4 md:h-4" />
                        </div>
                      ) : order.notes?.includes('Gate-In') ? (
                        <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <ArrowDownToLine size={20} className="text-emerald-600 dark:text-emerald-400 md:w-4 md:h-4" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <Package size={20} className="text-blue-600 dark:text-blue-400 md:w-4 md:h-4" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-base md:text-sm text-slate-800 dark:text-white">{order.container_number}</span>
                          <button onClick={() => setTimelineCN(order.container_number)} title="Timeline"
                            className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 text-[10px]">⏱</button>
                          <span className="text-xs text-slate-400">{order.size}&apos;{order.type}</span>
                          {order.notes?.includes('Gate-Out') ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">📤 ส่งออก</span>
                          ) : order.notes?.includes('Gate-In') ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">📥 รับเข้า</span>
                          ) : null}
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${priorityLabels[order.priority]?.color}`}>
                            {priorityLabels[order.priority]?.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                          <span>{orderTypeLabels[order.order_type]}</span>
                          {order.from_zone_name && (
                            <>
                              <span className="font-mono">Z{order.from_zone_name} B{order.from_bay}-R{order.from_row}-T{order.from_tier}</span>
                              <ArrowRight size={10} />
                            </>
                          )}
                          {order.to_zone_name && (
                            <span className="font-mono">Z{order.to_zone_name} B{order.to_bay}-R{order.to_row}-T{order.to_tier}</span>
                          )}
                        </div>
                        {/* DateTime */}
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={10} className="text-slate-400" />
                          <span className="text-[10px] text-slate-400">
                            {order.created_at ? new Date(order.created_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                          {order.started_at && (
                            <span className="text-[10px] text-blue-400 ml-1">▶ {new Date(order.started_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {order.completed_at && (
                            <span className="text-[10px] text-emerald-400 ml-1">✅ {new Date(order.completed_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop: inline status + action buttons */}
                    <div className="hidden md:flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${statusLabels[order.status]?.color}`}>
                        {statusLabels[order.status]?.icon} {statusLabels[order.status]?.label}
                      </span>
                      {(order.status === 'pending' || order.status === 'assigned') && (
                        <button onClick={() => updateOrder(order.order_id, 'accept')}
                          className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 flex items-center gap-1">
                          <Play size={10} /> รับงาน
                        </button>
                      )}
                      {order.status === 'in_progress' && (
                        order.notes?.includes('Gate-Out') ? (
                          /* Gate-Out order: complete directly without position form */
                          <button onClick={() => updateOrder(order.order_id, 'complete')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1">
                            <CheckCircle2 size={10} /> เสร็จ
                          </button>
                        ) : editingOrderId === order.order_id ? (
                          <button onClick={() => setEditingOrderId(null)}
                            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300">
                            ยกเลิก
                          </button>
                        ) : (
                          <button onClick={() => { setEditingOrderId(order.order_id); setEditPos({ zone_id: order.to_zone_id || 0, bay: order.to_bay || 0, row: order.to_row || 0, tier: order.to_tier || 0 }); }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1">
                            <CheckCircle2 size={10} /> เสร็จ
                          </button>
                        )
                      )}
                      {['pending', 'assigned'].includes(order.status) && (
                        <button onClick={() => updateOrder(order.order_id, 'cancel')}
                          className="px-1.5 py-1 rounded-lg text-slate-400 hover:text-red-500 text-xs">
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>

                    {/* Mobile: status badge only */}
                    <div className="md:hidden">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${statusLabels[order.status]?.color}`}>
                        {statusLabels[order.status]?.icon} {statusLabels[order.status]?.label}
                      </span>
                    </div>
                  </div>

                  {order.notes && <p className="text-xs text-slate-400 mt-1 ml-11 md:ml-9">💬 {order.notes}</p>}

                  {/* Mobile/Tablet: Large action buttons (glove-friendly, min 48px) */}
                  <div className="md:hidden mt-3 grid grid-cols-2 gap-2">
                    {(order.status === 'pending' || order.status === 'assigned') && (
                      <>
                        <button onClick={() => updateOrder(order.order_id, 'accept')}
                          className="flex items-center justify-center gap-2 py-4 rounded-xl bg-blue-500 text-white text-sm font-bold active:scale-95 transition-transform shadow-sm">
                          <Play size={20} /> รับงาน
                        </button>
                        <button onClick={() => updateOrder(order.order_id, 'cancel')}
                          className="flex items-center justify-center gap-2 py-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 text-sm font-bold active:scale-95 transition-transform">
                          <XCircle size={20} /> ยกเลิก
                        </button>
                      </>
                    )}
                    {order.status === 'in_progress' && editingOrderId !== order.order_id && (
                      order.notes?.includes('Gate-Out') ? (
                        /* Gate-Out order: complete directly */
                        <button onClick={() => updateOrder(order.order_id, 'complete')}
                          className="flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-600 text-white text-base font-bold active:scale-95 transition-transform shadow-md col-span-2">
                          <CheckCircle2 size={24} /> ✅ เสร็จแล้ว
                        </button>
                      ) : (
                        <button onClick={() => { setEditingOrderId(order.order_id); setEditPos({ zone_id: order.to_zone_id || 0, bay: order.to_bay || 0, row: order.to_row || 0, tier: order.to_tier || 0 }); }}
                          className="flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-600 text-white text-base font-bold active:scale-95 transition-transform shadow-md col-span-2">
                          <CheckCircle2 size={24} /> ✅ เสร็จแล้ว
                        </button>
                      )
                    )}
                  </div>

                  {/* Inline position edit form */}
                  {editingOrderId === order.order_id && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 space-y-3">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <MapPin size={12} /> ตำแหน่งวางตู้จริง (แก้ไขได้)
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium">Zone</label>
                          <select value={String(editPos.zone_id)} onChange={e => setEditPos({...editPos, zone_id: parseInt(e.target.value)})}
                            className="w-full h-10 md:h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white">
                            <option value="0">-</option>
                            {zones.map(z => <option key={z.zone_id} value={String(z.zone_id)}>{z.zone_name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium">Bay</label>
                          <input type="number" min={1} value={editPos.bay || ''} onChange={e => setEditPos({...editPos, bay: parseInt(e.target.value) || 0})}
                            className="w-full h-10 md:h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white text-center" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium">Row</label>
                          <input type="number" min={1} value={editPos.row || ''} onChange={e => setEditPos({...editPos, row: parseInt(e.target.value) || 0})}
                            className="w-full h-10 md:h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white text-center" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium">Tier</label>
                          <input type="number" min={1} value={editPos.tier || ''} onChange={e => setEditPos({...editPos, tier: parseInt(e.target.value) || 0})}
                            className="w-full h-10 md:h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white text-center" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateOrder(order.order_id, 'complete', {
                            to_zone_id: editPos.zone_id, to_bay: editPos.bay, to_row: editPos.row, to_tier: editPos.tier
                          })}
                          className="flex-1 flex items-center justify-center gap-2 py-3 md:py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-transform">
                          <CheckCircle2 size={16} /> ยืนยันเสร็จสิ้น
                        </button>
                        <button onClick={() => setEditingOrderId(null)}
                          className="px-4 py-3 md:py-2 rounded-xl bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium">
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {orders.length > pageSize && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                แสดง {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, orders.length)} จาก {orders.length} รายการ
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                >← ก่อนหน้า</button>
                {Array.from({ length: Math.ceil(orders.length / pageSize) }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded text-xs font-medium ${
                      page === currentPage
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >{page}</button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(orders.length / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(orders.length / pageSize)}
                  className="px-2 py-1 rounded text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                >ถัดไป →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== CREATE TAB =================== */}
      {activeTab === 'create' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">สร้างคำสั่งงาน</h3>
                <p className="text-xs text-slate-400">เลือกตู้ + กำหนดปลายทาง → สร้าง Work Order</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Order Type */}
            <div>
              <label className={labelClass}>ประเภทงาน</label>
              <div className="flex gap-2">
                {[
                  { value: 'move', label: '🚛 ย้ายตู้' },
                  { value: 'shift', label: '🔀 หลบตู้' },
                  { value: 'restack', label: '📚 จัดเรียง' },
                ].map(t => (
                  <button key={t.value} onClick={() => setCreateForm({ ...createForm, order_type: t.value })}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      createForm.order_type === t.value
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
                        : 'border-slate-200 dark:border-slate-600 text-slate-500'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Container */}
            <div>
              <label className={labelClass}>เลือกตู้</label>
              <div className="flex gap-2">
                <input type="text" value={searchContainer} onChange={e => setSearchContainer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchContainersForCreate()}
                  className={`${inputClass} flex-1 font-mono`} placeholder="พิมพ์เลขตู้..." />
                <button onClick={searchContainersForCreate}
                  className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
                  <Search size={14} /> ค้นหา
                </button>
              </div>
            </div>

            {/* Container Options */}
            {containers.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {containers.slice(0, 10).map(c => (
                  <button key={c.container_id} onClick={() => {
                    setCreateForm({
                      ...createForm, container_id: c.container_id,
                      from_zone_id: c.zone_id, from_bay: c.bay, from_row: c.row, from_tier: c.tier,
                    });
                    setContainers([]);
                  }}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                      createForm.container_id === c.container_id
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-200'
                    }`}>
                    <span className="font-mono font-semibold text-slate-800 dark:text-white">{c.container_number}</span>
                    <span className="text-slate-400 ml-2">{c.size}&apos;{c.type} • {c.zone_name ? `Z${c.zone_name} B${c.bay}-R${c.row}-T${c.tier}` : 'ไม่มีพิกัด'}</span>
                  </button>
                ))}
              </div>
            )}

            {createForm.container_id > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 text-xs text-blue-600">
                ✅ เลือกตู้แล้ว — จาก Z{createForm.from_zone_id} B{createForm.from_bay}-R{createForm.from_row}-T{createForm.from_tier}
              </div>
            )}

            {/* Destination */}
            <div>
              <label className={labelClass}>ปลายทาง</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>โซน</label>
                  <select value={createForm.to_zone_id} onChange={e => setCreateForm({ ...createForm, to_zone_id: parseInt(e.target.value) })} className={inputClass}>
                    <option value={0}>เลือกโซน</option>
                    {zones.map(z => <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Bay</label>
                  <input type="number" min={1} value={createForm.to_bay || ''} onChange={e => setCreateForm({ ...createForm, to_bay: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Row</label>
                  <input type="number" min={1} value={createForm.to_row || ''} onChange={e => setCreateForm({ ...createForm, to_row: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tier</label>
                  <input type="number" min={1} value={createForm.to_tier || ''} onChange={e => setCreateForm({ ...createForm, to_tier: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Priority + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>ความสำคัญ</label>
                <select value={createForm.priority} onChange={e => setCreateForm({ ...createForm, priority: parseInt(e.target.value) })} className={inputClass}>
                  <option value={1}>🔴 ด่วนมาก</option>
                  <option value={2}>🟠 ด่วน</option>
                  <option value={3}>🔵 ปกติ</option>
                  <option value={4}>⚪ ต่ำ</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>หมายเหตุ</label>
                <input type="text" value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." />
              </div>
            </div>

            <button onClick={handleCreate} disabled={createLoading || !createForm.container_id}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
              {createLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              สร้างคำสั่งงาน
            </button>

            {createResult && (
              <div className={`p-3 rounded-xl text-sm ${createResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700'}`}>
                {createResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== SMART SHIFTING TAB =================== */}
      {activeTab === 'shifting' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600">
                  <Shuffle size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">Smart Shifting (LIFO)</h3>
                  <p className="text-xs text-slate-400">วิเคราะห์ตู้ที่ต้องยกหลบเพื่อดึงตู้ล่างออก</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={labelClass}>ค้นหาตู้ที่ต้องการดึงออก</label>
                <div className="flex gap-2">
                  <input type="text" value={shiftSearch} onChange={e => setShiftSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchForShift()}
                    className={`${inputClass} flex-1 font-mono`} placeholder="พิมพ์เลขตู้..." />
                  <button onClick={searchForShift}
                    className="h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 flex items-center gap-1.5">
                    <Search size={14} /> ค้นหา
                  </button>
                </div>
              </div>

              {shiftContainers.length > 0 && !shiftResult && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-400">เลือกตู้ที่ต้องการวิเคราะห์:</p>
                  {shiftContainers.slice(0, 8).map(c => (
                    <button key={c.container_id} onClick={() => analyzeShift(c.container_id)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package size={16} className="text-violet-500" />
                        <div>
                          <p className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{c.container_number}</p>
                          <p className="text-xs text-slate-400">{c.size}&apos;{c.type} • {c.shipping_line || '-'}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {c.zone_name ? `Z${c.zone_name} B${c.bay}-R${c.row}-T${c.tier}` : 'ไม่มีพิกัด'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Shifting Result */}
          {shiftLoading && (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          )}

          {shiftResult && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
              <div className={`p-4 rounded-xl ${shiftResult.shifting_needed ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {shiftResult.shifting_needed ? <AlertTriangle size={16} className="text-amber-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
                  <span className="font-semibold text-sm text-slate-800 dark:text-white">
                    {shiftResult.shifting_needed ? 'ต้องหลบตู้ก่อน' : 'ดึงได้เลย!'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{shiftResult.message}</p>
              </div>

              {/* Target container */}
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800">
                <p className="text-[10px] text-violet-500 uppercase font-semibold mb-1">ตู้เป้าหมาย</p>
                <p className="font-mono font-bold text-slate-800 dark:text-white">
                  {shiftResult.target.container_number}
                  <span className="text-xs text-slate-400 font-normal ml-2">
                    Tier {shiftResult.target.tier} • Z{shiftResult.target.zone_name} B{shiftResult.target.bay}-R{shiftResult.target.row}
                  </span>
                </p>
              </div>

              {/* Containers above */}
              {shiftResult.containers_above.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Layers size={12} /> ตู้ที่ต้องยกหลบ ({shiftResult.containers_above.length} ตู้)</p>
                  <div className="space-y-1.5">
                    {shiftResult.containers_above.map((c, i) => (
                      <div key={c.container_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{c.container_number}</p>
                          <p className="text-xs text-slate-400">Tier {c.tier} • {c.size}&apos;{c.type}</p>
                        </div>
                        {shiftResult.temp_positions[i] && (
                          <span className="text-xs text-slate-400">
                            → B{shiftResult.temp_positions[i].bay}-R{shiftResult.temp_positions[i].row}-T{shiftResult.temp_positions[i].tier}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{shiftResult.total_moves}</p>
                  <p className="text-[10px] text-slate-400 uppercase">Total Moves</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{shiftResult.containers_above.length}</p>
                  <p className="text-[10px] text-slate-400 uppercase">ตู้หลบ</p>
                </div>
              </div>

              <button onClick={() => { setShiftResult(null); setShiftContainers([]); setShiftSearch(''); }}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium">← วิเคราะห์ตู้อื่น</button>
            </div>
          )}
        </div>
      )}

      {/* Container Timeline Modal */}
      {timelineCN && <ContainerTimeline containerNumber={timelineCN} onClose={() => setTimelineCN(null)} />}
    </div>
  );
}

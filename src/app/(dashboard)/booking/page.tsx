'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import * as XLSX from 'xlsx';
import {
  Loader2, Search, Upload, Plus, Ship, Package,
  XCircle, RotateCcw, Anchor,
  FileSpreadsheet, Trash2, ClipboardCheck, BarChart3,
  Eye, Link2, ChevronLeft, ChevronRight, Download,
} from 'lucide-react';

type UtilizationStatus = 'in_progress' | 'expired' | 'fully_received' | 'fully_released' | 'over_received';

interface BookingRow {
  booking_id: number; booking_number: string; booking_type: string;
  vessel_name: string; voyage_number: string; container_count: number;
  container_size: string; container_type: string; eta: string;
  valid_from: string; valid_to: string;
  status: string; seal_number: string; notes: string; customer_name: string;
  received_count: number; released_count: number; linked_containers: number;
  pending_count?: number; receive_percent?: number; release_percent?: number;
  utilization_status?: UtilizationStatus;
  created_at: string;
}

interface BookingContainerRow {
  id: number; booking_id: number; container_id: number | null;
  container_number: string; status: string;
  gate_in_at: string | null; gate_out_at: string | null;
  size: string; type: string; container_status: string;
  shipping_line: string; zone_name: string;
}

export default function BookingPage() {
  const { session, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'create' | 'summary'>('bookings');
  const yardId = session?.activeYardId || 1;
  const canManageBookings = hasPermission('booking.manage');

  // === Bookings List ===
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bkLoading, setBkLoading] = useState(false);
  const [bkFilter, setBkFilter] = useState('');
  const [bkSearch, setBkSearch] = useState('');
  const [bkPage, setBkPage] = useState(1);
  const [bkTotalPages, setBkTotalPages] = useState(1);
  const [bkTotal, setBkTotal] = useState(0);
  const BK_LIMIT = 20;

  // === Detail / Containers ===
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [bookingContainers, setBookingContainers] = useState<BookingContainerRow[]>([]);
  const [bkContainersLoading, setBkContainersLoading] = useState(false);
  const [addContainerNumber, setAddContainerNumber] = useState('');

  // === Create Form ===
  const [createForm, setCreateForm] = useState({
    booking_number: '', booking_type: 'import', vessel_name: '', voyage_number: '',
    container_count: 1, container_size: '20', container_type: 'GP',
    eta: '', valid_from: '', valid_to: '', seal_number: '', notes: '',
  });
  const [containerNumbers, setContainerNumbers] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);

  // === File Import ===
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileBatchLoading, setFileBatchLoading] = useState(false);
  const [fileBatchResult, setFileBatchResult] = useState<{ success: number; failed: number } | null>(null);

  // === Summary stats ===
  const [summaryStats, setSummaryStats] = useState({
    total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, expired: 0,
    expected: 0, received: 0, released: 0, over_received: 0,
  });

  // Fetch bookings (paginated)
  const fetchBookings = useCallback(async (page?: number) => {
    setBkLoading(true);
    const p = page ?? bkPage;
    try {
      let url = `/api/edi/bookings?yard_id=${yardId}&page=${p}&limit=${BK_LIMIT}`;
      if (bkFilter) url += `&status=${bkFilter}`;
      if (bkSearch) url += `&search=${encodeURIComponent(bkSearch)}`;
      const res = await fetch(url);
      const data = await res.json();
      setBookings(data.bookings || []);
      setBkTotalPages(data.totalPages || 1);
      setBkTotal(data.total || 0);
      setBkPage(data.page || 1);
    } catch (err) { console.error(err); }
    finally { setBkLoading(false); }
  }, [yardId, bkFilter, bkSearch, bkPage]);

  // Fetch summary stats (no pagination — count all)
  const fetchSummaryStats = useCallback(async () => {
    try {
      const url = `/api/edi/bookings?yard_id=${yardId}&summary=1`;
      const res = await fetch(url);
      const data = await res.json();
      const summary = data.summary || {};
      setSummaryStats({
        total: Number(summary.total || 0),
        pending: Number(summary.pending || 0),
        confirmed: Number(summary.confirmed || 0),
        completed: Number(summary.completed || 0),
        cancelled: Number(summary.cancelled || 0),
        expired: Number(summary.expired || 0),
        expected: Number(summary.expected || 0),
        received: Number(summary.received || 0),
        released: Number(summary.released || 0),
        over_received: Number(summary.over_received || 0),
      });
    } catch (err) { console.error(err); }
  }, [yardId]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { fetchSummaryStats(); }, [fetchSummaryStats]);

  // Reset to page 1 when filter/search changes
  useEffect(() => { setBkPage(1); }, [bkFilter, bkSearch]);

  // Fetch booking containers
  const fetchBookingContainers = async (bookingId: number) => {
    setBkContainersLoading(true);
    try {
      const res = await fetch(`/api/bookings/containers?booking_id=${bookingId}`);
      const data = await res.json();
      setBookingContainers(data.containers || []);
    } catch (err) { console.error(err); }
    finally { setBkContainersLoading(false); }
  };

  const openDetail = (bk: BookingRow) => {
    setSelectedBooking(bk);
    fetchBookingContainers(bk.booking_id);
  };

  const addContainer = async () => {
    if (!canManageBookings) return;
    if (!selectedBooking || !addContainerNumber.trim()) return;
    await fetch('/api/bookings/containers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: selectedBooking.booking_id, container_number: addContainerNumber.trim().toUpperCase() }),
    });
    setAddContainerNumber('');
    fetchBookingContainers(selectedBooking.booking_id);
  };

  const removeContainer = async (id: number) => {
    if (!canManageBookings) return;
    await fetch(`/api/bookings/containers?id=${id}`, { method: 'DELETE' });
    if (selectedBooking) fetchBookingContainers(selectedBooking.booking_id);
  };

  const updateBooking = async (id: number, updates: Record<string, unknown>) => {
    if (!canManageBookings) return;
    await fetch('/api/edi/bookings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id, ...updates }),
    });
    fetchBookings();
    if (selectedBooking?.booking_id === id) setSelectedBooking(null);
  };

  // Create booking
  const handleCreate = async () => {
    if (!canManageBookings) return;
    if (!createForm.booking_number) return;
    setCreateLoading(true); setCreateResult(null);
    try {
      const cns = containerNumbers.split(/[,\n]/).map(s => s.trim()).filter(s => s);
      const res = await fetch('/api/edi/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, ...createForm, container_numbers: cns }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateResult({ success: true, message: `✅ สร้าง Booking ${data.booking.booking_number} สำเร็จ` });
        setCreateForm({ ...createForm, booking_number: '', vessel_name: '', voyage_number: '', seal_number: '', notes: '', eta: '', valid_from: '', valid_to: '' });
        setContainerNumbers('');
        fetchBookings();
      } else {
        setCreateResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch { setCreateResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setCreateLoading(false); }
  };

  // File parsing (CSV / Excel)
  const handleFileUpload = (file: File) => {
    setFileName(file.name); setFileBatchResult(null);
    const reader = new FileReader();
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) return;
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/["']/g, ''));
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = vals[i] || ''; });
          return row;
        });
        setFileRows(rows);
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        const rows = json.map(row => {
          const normalized: Record<string, string> = {};
          Object.entries(row).forEach(([k, v]) => { normalized[k.toLowerCase().trim()] = String(v); });
          return normalized;
        });
        setFileRows(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const mapRow = (row: Record<string, string>) => {
    const get = (...keys: string[]) => { for (const k of keys) { const val = row[k] || row[k.replace(/_/g, ' ')] || row[k.replace(/_/g, '')]; if (val) return val; } return ''; };
    return {
      booking_number: get('booking_number', 'booking', 'bk_number', 'booking_no'),
      booking_type: get('booking_type', 'type') || 'import',
      vessel_name: get('vessel_name', 'vessel', 'ship'),
      voyage_number: get('voyage_number', 'voyage', 'voyage_no'),
      container_count: parseInt(get('container_count', 'count', 'qty')) || 1,
      container_size: get('container_size', 'size') || '20',
      container_type: get('container_type', 'ctr_type') || 'GP',
      eta: get('eta', 'arrival'),
      seal_number: get('seal_number', 'seal', 'seal_no'),
      notes: get('notes', 'remark', 'remarks'),
      container_numbers: get('container_numbers', 'containers', 'container_no'),
      valid_from: get('valid_from', 'from', 'start_date'),
      valid_to: get('valid_to', 'to', 'end_date', 'expiry'),
    };
  };

  // Download Excel template
  const downloadTemplate = () => {
    const headers = ['booking_number', 'booking_type', 'vessel_name', 'voyage_number', 'container_count', 'container_size', 'container_type', 'eta', 'seal_number', 'container_numbers', 'valid_from', 'valid_to', 'notes'];
    const data = [
      headers,
      ['BK-2025-0001', 'import', 'EVER GIVEN', 'V.001N', 5, '40', 'GP', '2025-04-01', 'SL12345', 'MSCU1234567, MSCU2345678', '2025-04-01', '2025-04-30', 'ตัวอย่าง'],
      ['BK-2025-0002', 'export', 'MSC ANNA', 'V.120E', 3, '20', 'HC', '2025-04-05', '', 'TEMU9876543', '2025-04-05', '2025-05-05', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Booking Template');
    XLSX.writeFile(wb, 'booking_template.xlsx');
  };

  const handleBatchImport = async () => {
    if (!canManageBookings) return;
    setFileBatchLoading(true); setFileBatchResult(null);
    let success = 0, failed = 0;
    for (const row of fileRows) {
      const mapped = mapRow(row);
      if (!mapped.booking_number) { failed++; continue; }
      try {
        // Split container_numbers string into array
        const payload: Record<string, unknown> = { yard_id: yardId, ...mapped };
        if (mapped.container_numbers) {
          payload.container_numbers = String(mapped.container_numbers).split(/[,;\ ]+/).map((s: string) => s.trim()).filter(Boolean);
        }
        const res = await fetch('/api/edi/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) success++; else failed++;
      } catch { failed++; }
    }
    setFileBatchResult({ success, failed });
    setFileBatchLoading(false);
    if (success > 0) fetchBookings();
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20',
    confirmed: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    completed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20',
    cancelled: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20',
  };
  const statusLabels: Record<string, string> = { pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', completed: 'เสร็จ', cancelled: 'ยกเลิก' };
  const typeLabels: Record<string, string> = { import: '📥 นำเข้า', export: '📤 ส่งออก', empty_pickup: '📦 รับตู้เปล่า', empty_return: '🔄 คืนตู้เปล่า' };
  const bookingUtilization = (bk: BookingRow) => {
    const expected = Math.max(Number(bk.container_count || 0), 0);
    const received = Math.max(Number(bk.received_count || 0), 0);
    const released = Math.max(Number(bk.released_count || 0), 0);
    const linked = Math.max(Number(bk.linked_containers || 0), 0);
    const pending = Math.max(Number(bk.pending_count ?? linked - received), 0);
    const receivePct = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;
    const releasePct = expected > 0 ? Math.min(100, Math.round((released / expected) * 100)) : 0;
    const remainingReceive = Math.max(expected - received, 0);
    const remainingRelease = Math.max(expected - released, 0);
    const overReceived = Math.max(received - expected, 0);
    const isExpired = Boolean(bk.valid_to && new Date(bk.valid_to) < new Date() && bk.status !== 'completed' && bk.status !== 'cancelled');
    const status: UtilizationStatus = overReceived > 0
      ? 'over_received'
      : released >= expected && expected > 0
        ? 'fully_released'
        : received >= expected && expected > 0
          ? 'fully_received'
          : isExpired
            ? 'expired'
            : 'in_progress';

    return { expected, received, released, linked, pending, receivePct, releasePct, remainingReceive, remainingRelease, overReceived, status };
  };
  const bookingProgressText = (bk: BookingRow) => {
    const u = bookingUtilization(bk);
    return `${u.received}/${u.expected} received, ${u.released}/${u.expected} released`;
  };
  const utilizationStatusInfo = (status: UtilizationStatus) => {
    const map: Record<UtilizationStatus, { label: string; color: string }> = {
      in_progress: { label: 'กำลังใช้งาน', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' },
      expired: { label: 'หมดอายุแต่ยังไม่ครบ', color: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' },
      fully_received: { label: 'รับครบแล้ว', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' },
      fully_released: { label: 'ออกครบแล้ว', color: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20' },
      over_received: { label: 'รับเกินจำนวน', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20' },
    };
    return map[status];
  };
  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  const fmtDate = (d: string) => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`; };

  if (!canManageBookings) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Booking</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">จัดการ Booking, ติดตามตู้, นำเข้าข้อมูลล่วงหน้า</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          คุณไม่มีสิทธิ์จัดการ Booking ใน Granular RBAC
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Booking</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">จัดการ Booking, ติดตามตู้, นำเข้าข้อมูลล่วงหน้า</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'bookings' as const, label: 'รายการ Booking', icon: <ClipboardCheck size={14} /> },
          { id: 'create' as const, label: 'สร้าง / นำเข้า', icon: <Upload size={14} /> },
          { id: 'summary' as const, label: 'สรุปรายงาน', icon: <BarChart3 size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== BOOKINGS LIST TAB =================== */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Anchor size={16} /> Bookings ({bkTotal})
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="ค้นหา..." value={bkSearch}
                    onChange={e => setBkSearch(e.target.value)}
                    className="h-8 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 w-40" />
                </div>
                <select value={bkFilter} onChange={e => setBkFilter(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                  <option value="">ทุกสถานะ</option>
                  <option value="pending">รอยืนยัน</option>
                  <option value="confirmed">ยืนยันแล้ว</option>
                  <option value="completed">เสร็จ</option>
                </select>
                <button onClick={() => fetchBookings()} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
              </div>
            </div>

            {bkLoading ? (
              <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">ยังไม่มี Booking — กดแท็บ &quot;สร้าง / นำเข้า&quot; เพื่อเพิ่ม</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {bookings.map(bk => {
                  const utilization = bookingUtilization(bk);
                  const utilizationStatus = utilizationStatusInfo(utilization.status);
                  return (
                    <div key={bk.booking_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Ship size={18} className="text-blue-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{bk.booking_number}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusColors[bk.status]}`}>{statusLabels[bk.status]}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${utilizationStatus.color}`}>{utilizationStatus.label}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                              <span>{typeLabels[bk.booking_type]}</span>
                              {bk.vessel_name && <span>• {bk.vessel_name} {bk.voyage_number}</span>}
                              <span>• {bk.container_count}x{bk.container_size}&apos;{bk.container_type}</span>
                              {bk.customer_name && <span>• {bk.customer_name}</span>}
                              {bk.valid_to && <span>• ถึง {fmtDate(bk.valid_to)}</span>}
                            </div>
                            <div className="mt-2 space-y-1.5 max-w-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-12 text-[10px] text-slate-400">รับเข้า</span>
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${utilization.receivePct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${utilization.receivePct}%` }} />
                                </div>
                                <span className="w-20 text-[10px] text-slate-400 text-right">{utilization.received}/{utilization.expected}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-12 text-[10px] text-slate-400">ปล่อยออก</span>
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${utilization.releasePct >= 100 ? 'bg-teal-500' : 'bg-amber-500'}`} style={{ width: `${utilization.releasePct}%` }} />
                                </div>
                                <span className="w-20 text-[10px] text-slate-400 text-right">{utilization.released}/{utilization.expected}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                จำนวนตู้: {bookingProgressText(bk)}
                                {utilization.remainingReceive > 0 ? ` · รอรับ ${utilization.remainingReceive}` : ''}
                                {utilization.overReceived > 0 ? ` · เกิน ${utilization.overReceived}` : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => openDetail(bk)}
                            className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-500 text-xs font-medium hover:bg-slate-100 flex items-center gap-1">
                            <Eye size={12} /> ดู
                          </button>
                          {bk.status === 'pending' && (
                            <button onClick={() => updateBooking(bk.booking_id, { status: 'confirmed' })} disabled={!canManageBookings}
                              className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-medium hover:bg-blue-100">ยืนยัน</button>
                          )}
                          {bk.status === 'confirmed' && (
                            <button onClick={() => updateBooking(bk.booking_id, { status: 'completed' })} disabled={!canManageBookings}
                              className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-medium hover:bg-emerald-100">เสร็จ</button>
                          )}
                          {['pending', 'confirmed'].includes(bk.status) && (
                            <button onClick={() => updateBooking(bk.booking_id, { status: 'cancelled' })} disabled={!canManageBookings}
                              className="px-1.5 py-1 rounded-lg text-slate-400 hover:text-red-500 text-xs"><XCircle size={14} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {bkTotalPages > 1 && (
              <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  แสดง {(bkPage - 1) * BK_LIMIT + 1}–{Math.min(bkPage * BK_LIMIT, bkTotal)} จาก {bkTotal} รายการ
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchBookings(bkPage - 1)} disabled={bkPage <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(5, bkTotalPages) }, (_, i) => {
                    let p: number;
                    if (bkTotalPages <= 5) { p = i + 1; }
                    else if (bkPage <= 3) { p = i + 1; }
                    else if (bkPage >= bkTotalPages - 2) { p = bkTotalPages - 4 + i; }
                    else { p = bkPage - 2 + i; }
                    return (
                      <button key={p} onClick={() => fetchBookings(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          p === bkPage
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchBookings(bkPage + 1)} disabled={bkPage >= bkTotalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail Modal */}
          {selectedBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedBooking(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                      <Ship size={20} className="text-blue-500" /> {selectedBooking.booking_number}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{typeLabels[selectedBooking.booking_type]} • {statusLabels[selectedBooking.status]}</p>
                  </div>
                  <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                </div>

                <div className="p-5 space-y-4">
                  {(() => {
                    const utilization = bookingUtilization(selectedBooking);
                    const utilizationStatus = utilizationStatusInfo(utilization.status);
                    return (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-slate-700 dark:text-white">Booking Utilization</p>
                            <p className="text-[10px] text-slate-400">จำนวนตู้: {bookingProgressText(selectedBooking)}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${utilizationStatus.color}`}>{utilizationStatus.label}</span>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {[
                              { label: 'Expected', value: utilization.expected, color: 'text-slate-700 dark:text-white' },
                              { label: 'Linked', value: utilization.linked, color: 'text-blue-600' },
                              { label: 'Received', value: utilization.received, color: 'text-emerald-600' },
                              { label: 'Released', value: utilization.released, color: 'text-teal-600' },
                              { label: utilization.overReceived > 0 ? 'Over' : 'Remain', value: utilization.overReceived > 0 ? utilization.overReceived : utilization.remainingRelease, color: utilization.overReceived > 0 ? 'text-orange-600' : 'text-amber-600' },
                            ].map(item => (
                              <div key={item.label} className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                                <p className="text-[10px] text-slate-400">{item.label}</p>
                                <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase">รับเข้า</span>
                                <span className="text-[10px] text-slate-400">{utilization.received}/{utilization.expected} ({utilization.receivePct}%)</span>
                              </div>
                              <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${utilization.receivePct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${utilization.receivePct}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase">ปล่อยออก</span>
                                <span className="text-[10px] text-slate-400">{utilization.released}/{utilization.expected} ({utilization.releasePct}%)</span>
                              </div>
                              <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${utilization.releasePct >= 100 ? 'bg-teal-500' : 'bg-amber-500'}`} style={{ width: `${utilization.releasePct}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-[10px] text-slate-400 uppercase block">เรือ</span><span className="text-slate-700 dark:text-white">{selectedBooking.vessel_name || '—'} {selectedBooking.voyage_number || ''}</span></div>
                    <div><span className="text-[10px] text-slate-400 uppercase block">จำนวนตู้</span><span className="text-slate-700 dark:text-white">{selectedBooking.container_count}x{selectedBooking.container_size}&apos;{selectedBooking.container_type}</span></div>
                    <div><span className="text-[10px] text-slate-400 uppercase block">ลูกค้า</span><span className="text-slate-700 dark:text-white">{selectedBooking.customer_name || '—'}</span></div>
                    <div><span className="text-[10px] text-slate-400 uppercase block">ETA</span><span className="text-slate-700 dark:text-white">{fmtDate(selectedBooking.eta)}</span></div>
                    <div><span className="text-[10px] text-slate-400 uppercase block">Valid From</span><span className="text-slate-700 dark:text-white">{fmtDate(selectedBooking.valid_from)}</span></div>
                    <div><span className="text-[10px] text-slate-400 uppercase block">Valid To</span><span className="text-slate-700 dark:text-white">{fmtDate(selectedBooking.valid_to)}</span></div>
                  </div>

                  {/* Linked Containers */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-2"><Link2 size={12} /> ตู้ที่ผูกกับ Booking</h4>
                    {bkContainersLoading ? (
                      <div className="py-4 text-center"><Loader2 size={16} className="animate-spin mx-auto text-slate-400" /></div>
                    ) : bookingContainers.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">ยังไม่มีตู้ที่ผูก — เพิ่มเลขตู้ด้านล่าง หรือระบุ Booking Ref ตอน Gate-In</p>
                    ) : (
                      <div className="space-y-1">
                        {bookingContainers.map(bc => (
                          <div key={bc.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/30">
                            <div className="flex items-start gap-2 min-w-0">
                              <Package size={14} className="text-slate-400 mt-0.5" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{bc.container_number}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                    bc.status === 'received' ? 'bg-blue-50 text-blue-600' :
                                    bc.status === 'released' ? 'bg-emerald-50 text-emerald-600' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>{bc.status === 'received' ? 'รับแล้ว' : bc.status === 'released' ? 'ออกแล้ว' : 'รอ'}</span>
                                  {(bc.size || bc.type) && <span className="text-[10px] text-slate-400">{bc.size}&apos;{bc.type}</span>}
                                  {bc.zone_name && <span className="text-[10px] text-slate-400">{bc.zone_name}</span>}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {bc.gate_in_at ? `รับเข้า ${fmtDate(bc.gate_in_at)}` : 'ยังไม่ Gate-In'}
                                  {bc.gate_out_at ? ` · ออก ${fmtDate(bc.gate_out_at)}` : ''}
                                </p>
                              </div>
                            </div>
                            {bc.status === 'pending' && (
                              <button onClick={() => removeContainer(bc.id)} disabled={!canManageBookings} className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={12} /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add container */}
                    {['pending', 'confirmed'].includes(selectedBooking.status) && (
                      <div className="flex gap-2 mt-2">
                        <input type="text" placeholder="ABCU1234567" value={addContainerNumber}
                          onChange={e => setAddContainerNumber(e.target.value.toUpperCase())}
                          className={`${inputClass} font-mono flex-1`}
                          onKeyDown={e => { if (e.key === 'Enter') addContainer(); }} />
                        <button onClick={addContainer} disabled={!canManageBookings} className="px-3 h-10 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                          <Plus size={14} /> เพิ่มตู้
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== CREATE / IMPORT TAB =================== */}
      {activeTab === 'create' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600"><Upload size={20} /></div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">สร้าง / นำเข้า Booking</h3>
                  <p className="text-xs text-slate-400">กรอกข้อมูลด้วยตนเอง หรือ อัพโหลดไฟล์ CSV / Excel</p>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="px-5 pt-4">
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
              <div onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/50'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50'); }}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50'); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                <FileSpreadsheet size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์</p>
                <p className="text-[10px] text-slate-400 mt-1">รองรับ .csv, .xlsx, .xls — คอลัมน์: booking_number, vessel_name, voyage_number, container_count, container_size, container_type, seal_number</p>
              </div>
              <div className="flex items-center justify-center gap-3 mt-2">
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                  <Download size={12} /> ดาวน์โหลด Template (.xlsx)
                </button>
              </div>

              {fileRows.length > 0 && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <FileSpreadsheet size={14} className="text-emerald-500" /> {fileName} — {fileRows.length} รายการ
                    </p>
                    <button onClick={() => { setFileRows([]); setFileName(''); setFileBatchResult(null); }}
                      className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> ลบ</button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-slate-50 dark:bg-slate-700/50">
                        <th className="px-2 py-2 text-left">#</th><th className="px-2 py-2 text-left">Booking No.</th>
                        <th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Vessel</th>
                        <th className="px-2 py-2 text-left">Size</th><th className="px-2 py-2 text-left">Seal</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {fileRows.slice(0, 10).map((row, i) => { const m = mapRow(row); return (
                          <tr key={i} className={m.booking_number ? '' : 'bg-red-50/50 dark:bg-red-900/10'}>
                            <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                            <td className="px-2 py-1.5 font-mono font-semibold">{m.booking_number || <span className="text-red-400">ไม่มี</span>}</td>
                            <td className="px-2 py-1.5">{m.booking_type}</td><td className="px-2 py-1.5">{m.vessel_name}</td>
                            <td className="px-2 py-1.5">{m.container_size}&apos;{m.container_type}</td>
                            <td className="px-2 py-1.5 font-mono">{m.seal_number || '—'}</td>
                          </tr>); })}
                      </tbody>
                    </table>
                    {fileRows.length > 10 && <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-700/30">แสดง 10 จาก {fileRows.length} รายการ</div>}
                  </div>
                  <button onClick={handleBatchImport} disabled={fileBatchLoading || !canManageBookings}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
                    {fileBatchLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    นำเข้าทั้งหมด ({fileRows.length} รายการ)
                  </button>
                  {fileBatchResult && (
                    <div className={`p-3 rounded-xl text-sm ${fileBatchResult.failed === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      ✅ สำเร็จ {fileBatchResult.success} รายการ{fileBatchResult.failed > 0 && ` | ❌ ล้มเหลว ${fileBatchResult.failed} รายการ`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual form */}
            <div className="mx-5 mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-xs text-slate-400 font-medium mb-3">หรือ กรอกข้อมูลด้วยตนเอง</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2"><label className={labelClass}>เลข Booking *</label><input type="text" value={createForm.booking_number} onChange={e => setCreateForm({ ...createForm, booking_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="BK-2024-001" /></div>
                <div><label className={labelClass}>ประเภท</label>
                  <select value={createForm.booking_type} onChange={e => setCreateForm({ ...createForm, booking_type: e.target.value })} className={inputClass}>
                    <option value="import">นำเข้า</option><option value="export">ส่งออก</option>
                    <option value="empty_pickup">รับตู้เปล่า</option><option value="empty_return">คืนตู้เปล่า</option>
                  </select>
                </div>
                <div><label className={labelClass}>จำนวนตู้</label><input type="number" min={1} value={createForm.container_count} onChange={e => setCreateForm({ ...createForm, container_count: parseInt(e.target.value) || 1 })} className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className={labelClass}>ชื่อเรือ</label><input type="text" value={createForm.vessel_name} onChange={e => setCreateForm({ ...createForm, vessel_name: e.target.value })} className={inputClass} placeholder="EVER GIVEN" /></div>
                <div><label className={labelClass}>Voyage No.</label><input type="text" value={createForm.voyage_number} onChange={e => setCreateForm({ ...createForm, voyage_number: e.target.value })} className={inputClass} placeholder="V001E" /></div>
                <div><label className={labelClass}>ขนาดตู้</label>
                  <select value={createForm.container_size} onChange={e => setCreateForm({ ...createForm, container_size: e.target.value })} className={inputClass}>
                    <option value="20">20 ฟุต</option><option value="40">40 ฟุต</option><option value="45">45 ฟุต</option>
                  </select>
                </div>
                <div><label className={labelClass}>ประเภทตู้</label>
                  <select value={createForm.container_type} onChange={e => setCreateForm({ ...createForm, container_type: e.target.value })} className={inputClass}>
                    <option value="GP">GP (แห้ง)</option><option value="HC">HC (สูง)</option><option value="RF">RF (เย็น)</option><option value="OT">OT (เปิดบน)</option><option value="FR">FR (แร็ค)</option><option value="TK">TK (แท็งค์)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className={labelClass}>ETA</label><input type="datetime-local" value={createForm.eta} onChange={e => setCreateForm({ ...createForm, eta: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>Valid From</label><input type="date" value={createForm.valid_from} onChange={e => setCreateForm({ ...createForm, valid_from: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>Valid To</label><input type="date" value={createForm.valid_to} onChange={e => setCreateForm({ ...createForm, valid_to: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>เลขซีล</label><input type="text" value={createForm.seal_number} onChange={e => setCreateForm({ ...createForm, seal_number: e.target.value })} className={inputClass} placeholder="SEAL123456" /></div>
              </div>
              <div><label className={labelClass}>เลขตู้ล่วงหน้า (ถ้ามี — คั่นด้วย , หรือ Enter)</label>
                <textarea value={containerNumbers} onChange={e => setContainerNumbers(e.target.value)}
                  className="w-full h-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white font-mono outline-none focus:border-blue-500"
                  placeholder="ABCU1234567, TCLU7654321" />
              </div>
              <div><label className={labelClass}>หมายเหตุ</label><input type="text" value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." /></div>

              <button onClick={handleCreate} disabled={createLoading || !canManageBookings || !createForm.booking_number}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
                {createLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} สร้าง Booking
              </button>

              {createResult && (
                <div className={`p-3 rounded-xl text-sm ${createResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {createResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================== SUMMARY TAB =================== */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'ทั้งหมด', value: summaryStats.total, color: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700', textColor: 'text-slate-700 dark:text-white' },
              { label: 'รอยืนยัน', value: summaryStats.pending, color: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800', textColor: 'text-amber-600' },
              { label: 'ยืนยันแล้ว', value: summaryStats.confirmed, color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800', textColor: 'text-blue-600' },
              { label: 'เสร็จ', value: summaryStats.completed, color: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800', textColor: 'text-emerald-600' },
              { label: 'ยกเลิก', value: summaryStats.cancelled, color: 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800', textColor: 'text-rose-500' },
              { label: 'หมดอายุ', value: summaryStats.expired, color: 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800', textColor: 'text-orange-600' },
            ].map(card => (
              <div key={card.label} className={`${card.color} rounded-xl border p-4 text-center`}>
                <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-2">
                <BarChart3 size={14} /> Booking Utilization รวม
              </h3>
              <p className="text-xs text-slate-400 mt-1">นับจาก Booking ที่ไม่ถูกยกเลิก เพื่อดูว่าจำนวนตู้ที่รับเข้าและปล่อยออกใช้ quota ไปเท่าไหร่</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Expected', value: summaryStats.expected, color: 'text-slate-800 dark:text-white' },
                  { label: 'Received', value: summaryStats.received, color: 'text-emerald-600' },
                  { label: 'Released', value: summaryStats.released, color: 'text-teal-600' },
                  { label: 'Over Received', value: summaryStats.over_received, color: summaryStats.over_received > 0 ? 'text-orange-600' : 'text-slate-400' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4">
                    <p className="text-[10px] text-slate-400">{item.label}</p>
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { label: 'รับเข้า', value: summaryStats.received, color: 'bg-emerald-500' },
                  { label: 'ปล่อยออก', value: summaryStats.released, color: 'bg-teal-500' },
                ].map(item => {
                  const pct = summaryStats.expected > 0 ? Math.min(100, Math.round((item.value / summaryStats.expected) * 100)) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">{item.label}</span>
                        <span className="text-[10px] text-slate-400">{item.value}/{summaryStats.expected} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Bookings Summary Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-2">
                <BarChart3 size={14} /> Booking ล่าสุด (Active)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2.5">Booking #</th>
                    <th className="text-left px-3 py-2.5">ประเภท</th>
                    <th className="text-left px-3 py-2.5">เรือ</th>
                    <th className="text-center px-3 py-2.5">ตู้</th>
                    <th className="text-center px-3 py-2.5">รับ/ออก</th>
                    <th className="text-center px-3 py-2.5">สถานะ</th>
                    <th className="text-left px-3 py-2.5">Valid To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {bookings.filter(b => b.status !== 'cancelled').slice(0, 20).map(bk => {
                    const utilization = bookingUtilization(bk);
                    const utilizationStatus = utilizationStatusInfo(utilization.status);
                    return (
                      <tr key={bk.booking_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-white">{bk.booking_number}</td>
                        <td className="px-3 py-2">{typeLabels[bk.booking_type]}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{bk.vessel_name || '—'}</td>
                        <td className="px-3 py-2 text-center">{bk.container_count}x{bk.container_size}&apos;</td>
                        <td className="px-3 py-2 text-center">
                          <div className="space-y-1 min-w-[150px]">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-[9px] text-slate-400 w-8 text-right">รับ</span>
                              <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${utilization.receivePct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${utilization.receivePct}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap w-12 text-left">{utilization.received}/{utilization.expected}</span>
                            </div>
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-[9px] text-slate-400 w-8 text-right">ออก</span>
                              <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${utilization.releasePct >= 100 ? 'bg-teal-500' : 'bg-amber-500'}`} style={{ width: `${utilization.releasePct}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap w-12 text-left">{utilization.released}/{utilization.expected}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusColors[bk.status]}`}>{statusLabels[bk.status]}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${utilizationStatus.color}`}>{utilizationStatus.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{fmtDate(bk.valid_to)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {bookings.filter(b => b.status !== 'cancelled').length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">ยังไม่มี Booking</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

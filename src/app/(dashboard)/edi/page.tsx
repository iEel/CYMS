'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Loader2, Search, FileText, Upload, ShieldCheck, Plus, Ship, Package,
  CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw, Anchor,
} from 'lucide-react';

interface BookingRow {
  booking_id: number; booking_number: string; booking_type: string;
  vessel_name: string; voyage_number: string; container_count: number;
  container_size: string; container_type: string; eta: string;
  status: string; seal_number: string; notes: string; customer_name: string;
  created_at: string;
}

interface ValidationResult {
  check: string; status: 'pass' | 'warning' | 'fail'; detail: string;
}

export default function EDIPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'import' | 'validate'>('bookings');
  const yardId = session?.activeYardId || 1;

  // Bookings
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bkLoading, setBkLoading] = useState(false);
  const [bkFilter, setBkFilter] = useState('');

  // Import Form
  const [importForm, setImportForm] = useState({
    booking_number: '', booking_type: 'import', vessel_name: '', voyage_number: '',
    container_count: 1, container_size: '20', container_type: 'GP',
    eta: '', seal_number: '', notes: '',
  });
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  // Validate
  const [valForm, setValForm] = useState({ container_number: '', seal_number: '' });
  const [valLoading, setValLoading] = useState(false);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [valOverall, setValOverall] = useState('');

  const fetchBookings = useCallback(async () => {
    setBkLoading(true);
    try {
      let url = `/api/edi/bookings?yard_id=${yardId}`;
      if (bkFilter) url += `&status=${bkFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err) { console.error(err); }
    finally { setBkLoading(false); }
  }, [yardId, bkFilter]);

  useEffect(() => { if (activeTab === 'bookings') fetchBookings(); }, [activeTab, fetchBookings]);

  const handleImport = async () => {
    if (!importForm.booking_number) return;
    setImportLoading(true); setImportResult(null);
    try {
      const res = await fetch('/api/edi/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, ...importForm }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult({ success: true, message: `✅ สร้าง Booking ${data.booking.booking_number} สำเร็จ` });
        setImportForm({ ...importForm, booking_number: '', vessel_name: '', voyage_number: '', seal_number: '', notes: '' });
      } else {
        setImportResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setImportResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setImportLoading(false); }
  };

  const handleValidate = async () => {
    if (!valForm.container_number) return;
    setValLoading(true); setValidations([]); setValOverall('');
    try {
      const res = await fetch('/api/edi/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valForm, yard_id: yardId }),
      });
      const data = await res.json();
      setValidations(data.validations || []);
      setValOverall(data.overall_status || '');
    } catch (err) { console.error(err); }
    finally { setValLoading(false); }
  };

  const updateBooking = async (id: number, status: string) => {
    await fetch('/api/edi/bookings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id, status }),
    });
    fetchBookings();
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20',
    confirmed: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    completed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20',
    cancelled: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20',
  };

  const typeLabels: Record<string, string> = {
    import: '📥 นำเข้า', export: '📤 ส่งออก', empty_pickup: '📦 รับตู้เปล่า', empty_return: '🔄 คืนตู้เปล่า',
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">EDI & ข้อมูลล่วงหน้า</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">นำเข้า Booking/Manifest, ตรวจสอบเลขซีล</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'bookings' as const, label: 'Bookings', icon: <FileText size={14} /> },
          { id: 'import' as const, label: 'นำเข้าข้อมูล', icon: <Upload size={14} /> },
          { id: 'validate' as const, label: 'ตรวจเลขซีล', icon: <ShieldCheck size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== BOOKINGS TAB =================== */}
      {activeTab === 'bookings' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Anchor size={16} /> Bookings ({bookings.length})</h3>
            <div className="flex items-center gap-2">
              <select value={bkFilter} onChange={e => setBkFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <option value="">ทุกสถานะ</option>
                <option value="pending">รอยืนยัน</option>
                <option value="confirmed">ยืนยันแล้ว</option>
                <option value="completed">เสร็จ</option>
              </select>
              <button onClick={fetchBookings} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
            </div>
          </div>

          {bkLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : bookings.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ยังไม่มี Booking — กดแท็บ &quot;นำเข้าข้อมูล&quot; เพื่อเพิ่ม</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {bookings.map(bk => (
                <div key={bk.booking_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Ship size={18} className="text-blue-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{bk.booking_number}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusColors[bk.status]}`}>{bk.status}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span>{typeLabels[bk.booking_type]}</span>
                          {bk.vessel_name && <span>• {bk.vessel_name} {bk.voyage_number}</span>}
                          <span>• {bk.container_count}x{bk.container_size}&apos;{bk.container_type}</span>
                          {bk.customer_name && <span>• {bk.customer_name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {bk.status === 'pending' && (
                        <button onClick={() => updateBooking(bk.booking_id, 'confirmed')}
                          className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-medium hover:bg-blue-100">ยืนยัน</button>
                      )}
                      {bk.status === 'confirmed' && (
                        <button onClick={() => updateBooking(bk.booking_id, 'completed')}
                          className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-medium hover:bg-emerald-100">เสร็จ</button>
                      )}
                      {['pending', 'confirmed'].includes(bk.status) && (
                        <button onClick={() => updateBooking(bk.booking_id, 'cancelled')}
                          className="px-1.5 py-1 rounded-lg text-slate-400 hover:text-red-500 text-xs"><XCircle size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================== IMPORT TAB =================== */}
      {activeTab === 'import' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600"><Upload size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">นำเข้า Booking / Manifest</h3>
                <p className="text-xs text-slate-400">กรอกข้อมูล Booking จากสายเรือ</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2"><label className={labelClass}>เลข Booking *</label><input type="text" value={importForm.booking_number} onChange={e => setImportForm({ ...importForm, booking_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="BK-2024-001" /></div>
              <div><label className={labelClass}>ประเภท</label>
                <select value={importForm.booking_type} onChange={e => setImportForm({ ...importForm, booking_type: e.target.value })} className={inputClass}>
                  <option value="import">นำเข้า</option><option value="export">ส่งออก</option>
                  <option value="empty_pickup">รับตู้เปล่า</option><option value="empty_return">คืนตู้เปล่า</option>
                </select>
              </div>
              <div><label className={labelClass}>จำนวนตู้</label><input type="number" min={1} value={importForm.container_count} onChange={e => setImportForm({ ...importForm, container_count: parseInt(e.target.value) || 1 })} className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={labelClass}>ชื่อเรือ</label><input type="text" value={importForm.vessel_name} onChange={e => setImportForm({ ...importForm, vessel_name: e.target.value })} className={inputClass} placeholder="EVER GIVEN" /></div>
              <div><label className={labelClass}>Voyage No.</label><input type="text" value={importForm.voyage_number} onChange={e => setImportForm({ ...importForm, voyage_number: e.target.value })} className={inputClass} placeholder="V001E" /></div>
              <div><label className={labelClass}>ขนาดตู้</label>
                <select value={importForm.container_size} onChange={e => setImportForm({ ...importForm, container_size: e.target.value })} className={inputClass}>
                  <option value="20">20 ฟุต</option><option value="40">40 ฟุต</option><option value="45">45 ฟุต</option>
                </select>
              </div>
              <div><label className={labelClass}>ประเภทตู้</label>
                <select value={importForm.container_type} onChange={e => setImportForm({ ...importForm, container_type: e.target.value })} className={inputClass}>
                  <option value="GP">GP (แห้ง)</option><option value="HC">HC (สูง)</option><option value="RF">RF (เย็น)</option><option value="OT">OT (เปิดบน)</option><option value="FR">FR (แร็ค)</option><option value="TK">TK (แท็งค์)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>ETA</label><input type="datetime-local" value={importForm.eta} onChange={e => setImportForm({ ...importForm, eta: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>เลขซีล</label><input type="text" value={importForm.seal_number} onChange={e => setImportForm({ ...importForm, seal_number: e.target.value })} className={inputClass} placeholder="SEAL123456" /></div>
            </div>
            <div><label className={labelClass}>หมายเหตุ</label><input type="text" value={importForm.notes} onChange={e => setImportForm({ ...importForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." /></div>

            <button onClick={handleImport} disabled={importLoading || !importForm.booking_number}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
              {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} สร้าง Booking
            </button>

            {importResult && (
              <div className={`p-3 rounded-xl text-sm ${importResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {importResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== VALIDATE TAB =================== */}
      {activeTab === 'validate' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><ShieldCheck size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">Seal Cross-Validation</h3>
                <p className="text-xs text-slate-400">ตรวจเลขตู้/ซีลเทียบ Booking ในระบบ</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>เลขตู้ *</label><input type="text" value={valForm.container_number} onChange={e => setValForm({ ...valForm, container_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="ABCU1234567" /></div>
              <div><label className={labelClass}>เลขซีล</label><input type="text" value={valForm.seal_number} onChange={e => setValForm({ ...valForm, seal_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="SEAL123456" /></div>
            </div>
            <button onClick={handleValidate} disabled={valLoading || !valForm.container_number}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {valLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} ตรวจสอบ
            </button>
          </div>

          {validations.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
              <div className={`p-3 rounded-xl text-sm font-semibold ${
                valOverall === 'pass' ? 'bg-emerald-50 text-emerald-700' : valOverall === 'fail' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {valOverall === 'pass' ? '✅ ผ่านทุกรายการ' : valOverall === 'fail' ? '❌ ตรวจไม่ผ่าน' : '⚠️ มีข้อสังเกต'}
              </div>
              <div className="space-y-2">
                {validations.map((v, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                    v.status === 'pass' ? 'border-emerald-200 bg-emerald-50/50' : v.status === 'fail' ? 'border-rose-200 bg-rose-50/50' : 'border-amber-200 bg-amber-50/50'
                  }`}>
                    {v.status === 'pass' ? <CheckCircle2 size={16} className="text-emerald-500" /> :
                     v.status === 'fail' ? <XCircle size={16} className="text-rose-500" /> :
                     <AlertTriangle size={16} className="text-amber-500" />}
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-white">{v.check}</p>
                      <p className="text-xs text-slate-400">{v.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import * as XLSX from 'xlsx';
import {
  Loader2, Search, FileText, Upload, ShieldCheck, Plus, Ship, Package,
  CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw, Anchor,
  FileSpreadsheet, Trash2, Send, FileDown, Filter,
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
  const [activeTab, setActiveTab] = useState<'bookings' | 'import' | 'validate' | 'codeco'>('bookings');
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

  // File Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileBatchLoading, setFileBatchLoading] = useState(false);
  const [fileBatchResult, setFileBatchResult] = useState<{ success: number; failed: number } | null>(null);

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

  // File parsing (CSV / Excel)
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setFileBatchResult(null);
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
        // Normalize headers to lowercase
        const rows = json.map(row => {
          const normalized: Record<string, string> = {};
          Object.entries(row).forEach(([k, v]) => {
            normalized[k.toLowerCase().trim()] = String(v);
          });
          return normalized;
        });
        setFileRows(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Map file columns to booking fields
  const mapRow = (row: Record<string, string>) => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const val = row[k] || row[k.replace(/_/g, ' ')] || row[k.replace(/_/g, '')];
        if (val) return val;
      }
      return '';
    };
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
    };
  };

  const handleBatchImport = async () => {
    setFileBatchLoading(true);
    setFileBatchResult(null);
    let success = 0, failed = 0;
    for (const row of fileRows) {
      const mapped = mapRow(row);
      if (!mapped.booking_number) { failed++; continue; }
      try {
        const res = await fetch('/api/edi/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ yard_id: yardId, ...mapped }),
        });
        const data = await res.json();
        if (data.success) success++; else failed++;
      } catch { failed++; }
    }
    setFileBatchResult({ success, failed });
    setFileBatchLoading(false);
    if (success > 0) fetchBookings();
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
          { id: 'codeco' as const, label: 'CODECO', icon: <Send size={14} /> },
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
                <p className="text-xs text-slate-400">กรอกข้อมูลด้วยตนเอง หรือ อัพโหลดไฟล์ CSV / Excel</p>
              </div>
            </div>
          </div>

          {/* ===== File Upload Section ===== */}
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

            {/* File Preview */}
            {fileRows.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <FileSpreadsheet size={14} className="text-emerald-500" />
                    {fileName} — {fileRows.length} รายการ
                  </p>
                  <button onClick={() => { setFileRows([]); setFileName(''); setFileBatchResult(null); }}
                    className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> ลบ</button>
                </div>

                {/* Preview table */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50">
                        <th className="px-2 py-2 text-left">#</th>
                        <th className="px-2 py-2 text-left">Booking No.</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Vessel</th>
                        <th className="px-2 py-2 text-left">Size</th>
                        <th className="px-2 py-2 text-left">Seal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {fileRows.slice(0, 10).map((row, i) => {
                        const m = mapRow(row);
                        return (
                          <tr key={i} className={m.booking_number ? '' : 'bg-red-50/50 dark:bg-red-900/10'}>
                            <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                            <td className="px-2 py-1.5 font-mono font-semibold">{m.booking_number || <span className="text-red-400">ไม่มี</span>}</td>
                            <td className="px-2 py-1.5">{m.booking_type}</td>
                            <td className="px-2 py-1.5">{m.vessel_name}</td>
                            <td className="px-2 py-1.5">{m.container_size}&apos;{m.container_type}</td>
                            <td className="px-2 py-1.5 font-mono">{m.seal_number || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {fileRows.length > 10 && (
                    <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-700/30">แสดง 10 จาก {fileRows.length} รายการ</div>
                  )}
                </div>

                <button onClick={handleBatchImport} disabled={fileBatchLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
                  {fileBatchLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  นำเข้าทั้งหมด ({fileRows.length} รายการ)
                </button>

                {fileBatchResult && (
                  <div className={`p-3 rounded-xl text-sm ${
                    fileBatchResult.failed === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    ✅ สำเร็จ {fileBatchResult.success} รายการ
                    {fileBatchResult.failed > 0 && ` | ❌ ล้มเหลว ${fileBatchResult.failed} รายการ`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== Divider ===== */}
          <div className="mx-5 mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
            <p className="text-xs text-slate-400 font-medium mb-3">หรือ กรอกข้อมูลด้วยตนเอง</p>
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

      {/* =================== CODECO TAB =================== */}
      {activeTab === 'codeco' && <CodecoOutbound yardId={yardId} />}
    </div>
  );
}

/* ===================== CODECO OUTBOUND COMPONENT ===================== */
interface CodecoTx {
  message_type: string; transaction_type: string; eir_number: string;
  date: string; container_number: string; size: string; type: string;
  shipping_line: string; laden_empty: string; seal_number: string;
  truck_plate: string; driver_name: string; booking_ref: string; yard_code: string;
}

function CodecoOutbound({ yardId }: { yardId: number }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [txType, setTxType] = useState('all');
  const [slFilter, setSlFilter] = useState('');
  const [shippingLines, setShippingLines] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<CodecoTx[]>([]);
  const [summary, setSummary] = useState({ total: 0, gate_in: 0, gate_out: 0 });
  const [loading, setLoading] = useState(false);

  const buildUrl = useCallback((format = 'json') => {
    let url = `/api/edi/codeco?yard_id=${yardId}&format=${format}`;
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo) url += `&date_to=${dateTo}`;
    if (txType && txType !== 'all') url += `&type=${txType}`;
    if (slFilter) url += `&shipping_line=${encodeURIComponent(slFilter)}`;
    return url;
  }, [yardId, dateFrom, dateTo, txType, slFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildUrl('json'));
      const data = await res.json();
      if (!data.error) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || { total: 0, gate_in: 0, gate_out: 0 });
        setShippingLines(data.shipping_lines || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  const inputClass = "h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white";

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
            <Send size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">CODECO — Container Departure/Arrival Message</h3>
            <p className="text-xs text-slate-400">สร้างข้อมูล EDI ส่งให้สายเรือ — แจ้ง Gate-In / Gate-Out events</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">จากวันที่</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ถึงวันที่</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ประเภท</label>
            <select value={txType} onChange={e => setTxType(e.target.value)} className={inputClass}>
              <option value="all">ทั้งหมด</option>
              <option value="gate_in">Gate-In</option>
              <option value="gate_out">Gate-Out</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">สายเรือ</label>
            <select value={slFilter} onChange={e => setSlFilter(e.target.value)} className={inputClass}>
              <option value="">ทั้งหมด</option>
              {shippingLines.map(sl => <option key={sl} value={sl}>{sl}</option>)}
            </select>
          </div>
          <button onClick={fetchData} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 flex items-center gap-1">
            <Filter size={12} /> กรอง
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.total}</p>
          <p className="text-xs text-slate-400">รายการทั้งหมด</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{summary.gate_in}</p>
          <p className="text-xs text-slate-400">Gate-In</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{summary.gate_out}</p>
          <p className="text-xs text-slate-400">Gate-Out</p>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <button onClick={() => window.open(buildUrl('edifact'), '_blank')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all">
          <Send size={14} /> ส่ง EDIFACT (.edi)
        </button>
        <button onClick={() => window.open(buildUrl('csv'), '_blank')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 transition-all">
          <FileDown size={14} /> CSV
        </button>
        <button onClick={async () => {
          const res = await fetch(buildUrl('json'));
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `CODECO_${new Date().toISOString().split('T')[0]}.json`; a.click();
        }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 transition-all">
          <FileDown size={14} /> JSON
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-2">
            <FileText size={14} /> CODECO Messages ({transactions.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">ไม่พบรายการ Gate ในช่วงวันที่เลือก</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                <tr>
                  <th className="text-center px-3 py-2.5">ประเภท</th>
                  <th className="text-left px-3 py-2.5">วันที่/เวลา</th>
                  <th className="text-left px-3 py-2.5">เลขตู้</th>
                  <th className="text-left px-3 py-2.5">ขนาด</th>
                  <th className="text-left px-3 py-2.5">สายเรือ</th>
                  <th className="text-center px-3 py-2.5">สถานะ</th>
                  <th className="text-left px-3 py-2.5">ซีล</th>
                  <th className="text-left px-3 py-2.5">ทะเบียนรถ</th>
                  <th className="text-left px-3 py-2.5">EIR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {transactions.map((tx, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        tx.transaction_type === 'gate_in' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>{tx.transaction_type === 'gate_in' ? 'เข้า' : 'ออก'}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{fmtDate(tx.date)}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-white">{tx.container_number}</td>
                    <td className="px-3 py-2">{tx.size}'{tx.type}</td>
                    <td className="px-3 py-2">{tx.shipping_line || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tx.laden_empty === 'LADEN' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {tx.laden_empty === 'LADEN' ? 'มีสินค้า' : 'เปล่า'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">{tx.seal_number || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">{tx.truck_plate || '-'}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{tx.eir_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

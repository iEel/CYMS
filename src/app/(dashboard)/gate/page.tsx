'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatTime, formatDateTime } from '@/lib/utils';
import {
  DoorOpen, LogOut, History, Loader2, Search, CheckCircle2, Truck,
  FileText, Plus, ArrowDownToLine, ArrowUpFromLine, Package, User,
  CreditCard, Hash, ClipboardCheck, Printer, X, ChevronDown,
} from 'lucide-react';

interface Transaction {
  transaction_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  transaction_type: 'gate_in' | 'gate_out';
  driver_name: string;
  truck_plate: string;
  eir_number: string;
  created_at: string;
  full_name: string;
}

interface ContainerResult {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  status: string;
  zone_name?: string;
  bay?: number;
  row?: number;
  tier?: number;
}

export default function GatePage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'gate_in' | 'gate_out' | 'history'>('gate_in');

  // Gate-In form
  const [gateInForm, setGateInForm] = useState({
    container_number: '', size: '20', type: 'GP', shipping_line: '',
    is_laden: false, seal_number: '', driver_name: '', driver_license: '',
    truck_plate: '', booking_ref: '', notes: '',
  });
  const [gateInLoading, setGateInLoading] = useState(false);
  const [gateInResult, setGateInResult] = useState<{ success: boolean; message: string; eir_number?: string } | null>(null);

  // Gate-Out
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContainerResult[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerResult | null>(null);
  const [gateOutForm, setGateOutForm] = useState({
    driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '',
  });
  const [gateOutLoading, setGateOutLoading] = useState(false);
  const [gateOutResult, setGateOutResult] = useState<{ success: boolean; message: string; eir_number?: string } | null>(null);
  const [searching, setSearching] = useState(false);

  // History
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // EIR Preview
  const [showEIR, setShowEIR] = useState<string | null>(null);
  const [eirData, setEirData] = useState<Record<string, string | number | boolean | null> | null>(null);

  const yardId = session?.activeYardId || 1;

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/gate?yard_id=${yardId}&date=today`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  }, [yardId]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchHistory]);

  // Gate-In submit
  const handleGateIn = async () => {
    if (!gateInForm.container_number) return;
    setGateInLoading(true);
    setGateInResult(null);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'gate_in',
          yard_id: yardId,
          ...gateInForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGateInResult({ success: true, message: `✅ รับตู้ ${gateInForm.container_number} เข้าลานสำเร็จ`, eir_number: data.eir_number });
        setGateInForm({ container_number: '', size: '20', type: 'GP', shipping_line: '', is_laden: false, seal_number: '', driver_name: '', driver_license: '', truck_plate: '', booking_ref: '', notes: '' });
      } else {
        setGateInResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateInResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateInLoading(false); }
  };

  // Search containers for Gate-Out
  const searchContainers = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&status=in_yard&search=${searchQuery}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  // Gate-Out submit
  const handleGateOut = async () => {
    if (!selectedContainer) return;
    setGateOutLoading(true);
    setGateOutResult(null);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'gate_out',
          yard_id: yardId,
          container_id: selectedContainer.container_id,
          container_number: selectedContainer.container_number,
          ...gateOutForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGateOutResult({ success: true, message: `✅ ปล่อยตู้ ${selectedContainer.container_number} ออกจากลานสำเร็จ`, eir_number: data.eir_number });
        setSelectedContainer(null);
        setSearchResults([]);
        setSearchQuery('');
        setGateOutForm({ driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '' });
      } else {
        setGateOutResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateOutResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateOutLoading(false); }
  };

  // View EIR
  const viewEIR = async (eirNumber: string) => {
    setShowEIR(eirNumber);
    try {
      const res = await fetch(`/api/gate/eir?eir_number=${eirNumber}`);
      const data = await res.json();
      setEirData(data.eir || null);
    } catch (err) { console.error(err); }
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">ประตู Gate</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">จัดการรถเข้า-ออกลาน, ออกเอกสาร EIR</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'gate_in' as const, label: 'Gate-In (รับเข้า)', icon: <ArrowDownToLine size={14} />, color: 'emerald' },
          { id: 'gate_out' as const, label: 'Gate-Out (ปล่อยออก)', icon: <ArrowUpFromLine size={14} />, color: 'blue' },
          { id: 'history' as const, label: 'ประวัติวันนี้', icon: <History size={14} />, color: 'slate' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== GATE-IN TAB =================== */}
      {activeTab === 'gate_in' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                <ArrowDownToLine size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">รับตู้เข้าลาน (Gate-In)</h3>
                <p className="text-xs text-slate-400">กรอกข้อมูลตู้, คนขับ, และทะเบียนรถ → ระบบจะสร้าง EIR อัตโนมัติ</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Container Info */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><Package size={12} /> ข้อมูลตู้</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className={labelClass}>เลขตู้ *</label>
                  <input type="text" placeholder="ABCU1234567" value={gateInForm.container_number}
                    onChange={e => setGateInForm({ ...gateInForm, container_number: e.target.value.toUpperCase() })}
                    className={`${inputClass} font-mono`} />
                </div>
                <div>
                  <label className={labelClass}>ขนาด</label>
                  <select value={gateInForm.size} onChange={e => setGateInForm({ ...gateInForm, size: e.target.value })} className={inputClass}>
                    <option value="20">20 ฟุต</option>
                    <option value="40">40 ฟุต</option>
                    <option value="45">45 ฟุต</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ประเภท</label>
                  <select value={gateInForm.type} onChange={e => setGateInForm({ ...gateInForm, type: e.target.value })} className={inputClass}>
                    <option value="GP">GP (แห้ง)</option>
                    <option value="HC">HC (High Cube)</option>
                    <option value="RF">RF (ตู้เย็น)</option>
                    <option value="OT">OT (Open Top)</option>
                    <option value="FR">FR (Flat Rack)</option>
                    <option value="TK">TK (Tank)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>สายเรือ</label>
                  <input type="text" placeholder="เช่น Evergreen" value={gateInForm.shipping_line}
                    onChange={e => setGateInForm({ ...gateInForm, shipping_line: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>เลขซีล</label>
                  <input type="text" placeholder="SEAL123456" value={gateInForm.seal_number}
                    onChange={e => setGateInForm({ ...gateInForm, seal_number: e.target.value.toUpperCase() })} className={`${inputClass} font-mono`} />
                </div>
                <div>
                  <label className={labelClass}>สถานะตู้</label>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setGateInForm({ ...gateInForm, is_laden: false })}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-all ${!gateInForm.is_laden ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}>
                      ตู้เปล่า
                    </button>
                    <button onClick={() => setGateInForm({ ...gateInForm, is_laden: true })}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-all ${gateInForm.is_laden ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}>
                      มีสินค้า
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Booking Ref</label>
                  <input type="text" placeholder="BK-123456" value={gateInForm.booking_ref}
                    onChange={e => setGateInForm({ ...gateInForm, booking_ref: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Driver Info */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><User size={12} /> ข้อมูลคนขับ / รถ</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>ชื่อคนขับ</label>
                  <input type="text" placeholder="ชื่อ-นามสกุล" value={gateInForm.driver_name}
                    onChange={e => setGateInForm({ ...gateInForm, driver_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>เลขใบขับขี่</label>
                  <input type="text" placeholder="1234567890" value={gateInForm.driver_license}
                    onChange={e => setGateInForm({ ...gateInForm, driver_license: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ทะเบียนรถ</label>
                  <input type="text" placeholder="1กก 1234" value={gateInForm.truck_plate}
                    onChange={e => setGateInForm({ ...gateInForm, truck_plate: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>หมายเหตุ</label>
              <input type="text" placeholder="หมายเหตุเพิ่มเติม..." value={gateInForm.notes}
                onChange={e => setGateInForm({ ...gateInForm, notes: e.target.value })} className={inputClass} />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleGateIn} disabled={gateInLoading || !gateInForm.container_number}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
                {gateInLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                รับตู้เข้าลาน + ออก EIR
              </button>
            </div>

            {/* Result */}
            {gateInResult && (
              <div className={`p-4 rounded-xl text-sm ${gateInResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                <p className="font-medium">{gateInResult.message}</p>
                {gateInResult.eir_number && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs">EIR: <span className="font-mono font-bold">{gateInResult.eir_number}</span></span>
                    <button onClick={() => viewEIR(gateInResult.eir_number!)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs hover:bg-emerald-200 transition-colors">
                      <FileText size={12} /> ดู EIR
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== GATE-OUT TAB =================== */}
      {activeTab === 'gate_out' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <ArrowUpFromLine size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">ปล่อยตู้ออกจากลาน (Gate-Out)</h3>
                <p className="text-xs text-slate-400">ค้นหาตู้ที่อยู่ในลาน → กรอกคนขับ/ทะเบียน → ปล่อยออก</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Search */}
            <div>
              <label className={labelClass}>ค้นหาตู้ในลาน</label>
              <div className="flex gap-2">
                <input type="text" placeholder="พิมพ์เลขตู้ หรือสายเรือ..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchContainers()}
                  className={`${inputClass} font-mono flex-1`} />
                <button onClick={searchContainers} disabled={searching}
                  className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-all">
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} ค้นหา
                </button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && !selectedContainer && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400">พบ {searchResults.length} ตู้ — กดเลือกตู้ที่จะปล่อยออก</p>
                {searchResults.map(c => (
                  <button key={c.container_id} onClick={() => setSelectedContainer(c)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                        <Package size={16} />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-slate-800 dark:text-white text-sm">{c.container_number}</p>
                        <p className="text-xs text-slate-400">{c.size}&apos;{c.type} • {c.shipping_line || '-'}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{c.zone_name ? `Zone ${c.zone_name} B${c.bay}-R${c.row}-T${c.tier}` : 'ไม่มีพิกัด'}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Container + Gate-Out Form */}
            {selectedContainer && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-500 font-medium mb-1">ตู้ที่จะปล่อยออก</p>
                      <p className="font-mono font-bold text-lg text-slate-800 dark:text-white">{selectedContainer.container_number}</p>
                      <p className="text-sm text-slate-500">{selectedContainer.size}&apos;{selectedContainer.type} • {selectedContainer.shipping_line || '-'} • {selectedContainer.zone_name ? `Zone ${selectedContainer.zone_name}` : ''}</p>
                    </div>
                    <button onClick={() => setSelectedContainer(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><User size={12} /> ข้อมูลคนขับ / รถ</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>ชื่อคนขับ</label>
                      <input type="text" value={gateOutForm.driver_name} onChange={e => setGateOutForm({ ...gateOutForm, driver_name: e.target.value })} className={inputClass} placeholder="ชื่อ-นามสกุล" />
                    </div>
                    <div>
                      <label className={labelClass}>เลขใบขับขี่</label>
                      <input type="text" value={gateOutForm.driver_license} onChange={e => setGateOutForm({ ...gateOutForm, driver_license: e.target.value })} className={inputClass} placeholder="1234567890" />
                    </div>
                    <div>
                      <label className={labelClass}>ทะเบียนรถ</label>
                      <input type="text" value={gateOutForm.truck_plate} onChange={e => setGateOutForm({ ...gateOutForm, truck_plate: e.target.value })} className={inputClass} placeholder="1กก 1234" />
                    </div>
                    <div>
                      <label className={labelClass}>เลขซีล</label>
                      <input type="text" value={gateOutForm.seal_number} onChange={e => setGateOutForm({ ...gateOutForm, seal_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="SEAL123456" />
                    </div>
                    <div>
                      <label className={labelClass}>Booking Ref</label>
                      <input type="text" value={gateOutForm.booking_ref} onChange={e => setGateOutForm({ ...gateOutForm, booking_ref: e.target.value })} className={inputClass} placeholder="BK-123456" />
                    </div>
                    <div>
                      <label className={labelClass}>หมายเหตุ</label>
                      <input type="text" value={gateOutForm.notes} onChange={e => setGateOutForm({ ...gateOutForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." />
                    </div>
                  </div>
                </div>

                <button onClick={handleGateOut} disabled={gateOutLoading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
                  {gateOutLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpFromLine size={16} />}
                  ปล่อยตู้ออก + ออก EIR
                </button>
              </div>
            )}

            {/* Result */}
            {gateOutResult && (
              <div className={`p-4 rounded-xl text-sm ${gateOutResult.success ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                <p className="font-medium">{gateOutResult.message}</p>
                {gateOutResult.eir_number && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs">EIR: <span className="font-mono font-bold">{gateOutResult.eir_number}</span></span>
                    <button onClick={() => viewEIR(gateOutResult.eir_number!)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-200 transition-colors">
                      <FileText size={12} /> ดู EIR
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== HISTORY TAB =================== */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <History size={18} /> ประวัติ Gate วันนี้
            </h3>
            <button onClick={fetchHistory} className="text-xs text-blue-500 hover:text-blue-700 font-medium">รีเฟรช</button>
          </div>

          {historyLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีรายการวันนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs text-slate-500 uppercase">
                    <th className="px-4 py-3">เวลา</th>
                    <th className="px-4 py-3">ประเภท</th>
                    <th className="px-4 py-3">เลขตู้</th>
                    <th className="px-4 py-3">ขนาด</th>
                    <th className="px-4 py-3">คนขับ</th>
                    <th className="px-4 py-3">ทะเบียน</th>
                    <th className="px-4 py-3">EIR</th>
                    <th className="px-4 py-3">ผู้ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {transactions.map(tx => (
                    <tr key={tx.transaction_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatTime(tx.created_at).slice(0, 5)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          tx.transaction_type === 'gate_in'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {tx.transaction_type === 'gate_in' ? <ArrowDownToLine size={10} /> : <ArrowUpFromLine size={10} />}
                          {tx.transaction_type === 'gate_in' ? 'IN' : 'OUT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-white">{tx.container_number}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.size}&apos;{tx.type}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.driver_name || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{tx.truck_plate || '-'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => viewEIR(tx.eir_number)}
                          className="text-xs text-blue-500 hover:text-blue-700 font-mono font-medium hover:underline">
                          {tx.eir_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.full_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================== EIR MODAL =================== */}
      {showEIR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText size={18} /> Equipment Interchange Receipt (EIR)
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors">
                  <Printer size={12} /> พิมพ์
                </button>
                <button onClick={() => { setShowEIR(null); setEirData(null); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
            </div>

            {!eirData ? (
              <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
            ) : (
              <div className="p-5 space-y-4 text-sm" id="eir-print">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">CYMS — EIR</h2>
                  <p className="text-xs text-slate-400">{(eirData.transaction_type as string) === 'gate_in' ? '📥 Gate-In Receipt' : '📤 Gate-Out Receipt'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'EIR No.', value: eirData.eir_number, mono: true },
                    { label: 'วันที่', value: eirData.date ? formatDateTime(eirData.date as string) : '-' },
                    { label: 'เลขตู้', value: eirData.container_number, mono: true },
                    { label: 'ขนาด/ประเภท', value: `${eirData.size}'${eirData.type}` },
                    { label: 'สายเรือ', value: eirData.shipping_line || '-' },
                    { label: 'เลขซีล', value: eirData.seal_number || '-', mono: true },
                    { label: 'สถานะ', value: eirData.is_laden ? '📦 มีสินค้า' : '📭 ตู้เปล่า' },
                    { label: 'Booking Ref', value: eirData.booking_ref || '-' },
                    { label: 'คนขับ', value: eirData.driver_name || '-' },
                    { label: 'เลขใบขับขี่', value: eirData.driver_license || '-' },
                    { label: 'ทะเบียนรถ', value: eirData.truck_plate || '-', mono: true },
                    { label: 'ลาน', value: eirData.yard_name || '-' },
                    { label: 'โซน/พิกัด', value: eirData.zone_name ? `Zone ${eirData.zone_name} B${eirData.bay}-R${eirData.row}-T${eirData.tier}` : '-' },
                    { label: 'ผู้ดำเนินการ', value: eirData.processed_by || '-' },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">{item.label}</p>
                      <p className={`text-slate-800 dark:text-white font-medium ${item.mono ? 'font-mono' : ''}`}>{item.value as string}</p>
                    </div>
                  ))}
                </div>

                {eirData.notes && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                    <p className="text-[10px] text-amber-500 uppercase font-semibold mb-1">หมายเหตุ</p>
                    <p className="text-slate-600 dark:text-slate-300">{eirData.notes as string}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

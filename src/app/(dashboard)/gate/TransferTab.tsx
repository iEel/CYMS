'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Search,
  ArrowDownToLine, ArrowRightLeft, Package,
} from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { ContainerResult, inputClass, labelClass } from './types';

interface TransferTabProps {
  yardId: number;
  userId?: number;
}

interface InTransitContainer {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  from_yard_name?: string;
  transfer_number?: string;
}

interface Yard {
  yard_id: number;
  yard_name: string;
}

export default function TransferTab({ yardId, userId }: TransferTabProps) {
  const { toast } = useToast();
  const [transferForm, setTransferForm] = useState({
    container_search: '', to_yard_id: '', driver_name: '', truck_plate: '', notes: '',
  });
  const [transferResults, setTransferResults] = useState<ContainerResult[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<ContainerResult | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferResult, setTransferResult] = useState<{ success: boolean; message: string } | null>(null);
  const [allYards, setAllYards] = useState<Yard[]>([]);
  const [inTransitContainers, setInTransitContainers] = useState<InTransitContainer[]>([]);
  const [receiveLoading, setReceiveLoading] = useState<number | null>(null);

  // Fetch yards
  useEffect(() => {
    fetch('/api/settings/yards')
      .then(res => res.json())
      .then(data => setAllYards(data.yards || []))
      .catch(err => console.error('Fetch yards error:', err));
  }, []);

  // Fetch in-transit containers
  const fetchInTransit = useCallback(async () => {
    try {
      const res = await fetch(`/api/gate/transfer/receive?yard_id=${yardId}`);
      const data = await res.json();
      setInTransitContainers(data.containers || []);
    } catch (err) { console.error(err); }
  }, [yardId]);

  useEffect(() => { fetchInTransit(); }, [fetchInTransit]);

  // Search containers for transfer
  const searchTransfer = async () => {
    if (!transferForm.container_search) return;
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&search=${transferForm.container_search}`);
      const data = await res.json();
      const allResults = Array.isArray(data) ? data : [];
      setTransferResults(allResults.filter((c: ContainerResult) => c.status !== 'gated_out'));
    } catch (err) { console.error(err); }
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!selectedTransfer || !transferForm.to_yard_id) return;
    setTransferLoading(true);
    setTransferResult(null);
    try {
      const res = await fetch('/api/gate/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: selectedTransfer.container_id,
          from_yard_id: yardId,
          to_yard_id: parseInt(transferForm.to_yard_id),
          driver_name: transferForm.driver_name,
          truck_plate: transferForm.truck_plate,
          notes: transferForm.notes,
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferResult({ success: true, message: `✅ ย้ายตู้ ${selectedTransfer.container_number} สำเร็จ — ${data.transfer_number}` });
        toast('success', `ย้ายตู้ ${selectedTransfer.container_number} สำเร็จ`);
        setSelectedTransfer(null);
        setTransferResults([]);
        setTransferForm({ container_search: '', to_yard_id: '', driver_name: '', truck_plate: '', notes: '' });
      } else {
        setTransferResult({ success: false, message: `❌ ${data.error}` });
        toast('error', data.error || 'ไม่สามารถย้ายตู้ได้');
      }
    } catch (err) { console.error(err); setTransferResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setTransferLoading(false); }
  };

  // Receive in-transit container
  const handleReceiveTransfer = async (containerId: number) => {
    setReceiveLoading(containerId);
    try {
      const res = await fetch('/api/gate/transfer/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: containerId,
          yard_id: yardId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast('success', `รับตู้เข้าลานเรียบร้อย ${data.assigned_location ? `→ Zone ${data.assigned_location.zone_name} B${data.assigned_location.bay}-R${data.assigned_location.row}-T${data.assigned_location.tier}` : ''}`);
        fetchInTransit();
      } else {
        toast('error', data.error || 'ไม่สามารถรับตู้ได้');
      }
    } catch (err) { console.error(err); }
    finally { setReceiveLoading(null); }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">ย้ายตู้ข้ามสาขา (Inter-Yard Transfer)</h3>
            <p className="text-xs text-slate-400">เลือกตู้ → ระบุลานปลายทาง → สถานะเปลี่ยนเป็น In-Transit</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* ===== RECEIVE IN-TRANSIT ===== */}
        {inTransitContainers.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">🚛 ตู้ระหว่างขนส่ง ({inTransitContainers.length} ตู้)</h4>
              <button onClick={fetchInTransit} className="text-xs text-amber-600 hover:text-amber-800 font-medium">รีเฟรช</button>
            </div>
            <div className="divide-y divide-amber-100 dark:divide-amber-900/20">
              {inTransitContainers.map(c => (
                <div key={c.container_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 shrink-0">
                      <Package size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{c.container_number}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {c.size}&apos;{c.type} · {c.shipping_line || '-'} · จาก {c.from_yard_name || 'ไม่ทราบ'} · {c.transfer_number}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleReceiveTransfer(c.container_id)} disabled={receiveLoading === c.container_id}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition-all">
                    {receiveLoading === c.container_id ? <Loader2 size={12} className="animate-spin" /> : <ArrowDownToLine size={12} />}
                    รับเข้าลาน
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== SEND TRANSFER ===== */}
        <div>
          <label className={labelClass}>ค้นหาตู้ในลาน</label>
          <div className="flex gap-2">
            <input type="text" placeholder="พิมพ์เลขตู้..." value={transferForm.container_search}
              onChange={e => setTransferForm({ ...transferForm, container_search: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && searchTransfer()}
              className={`${inputClass} flex-1 font-mono`} />
            <button onClick={searchTransfer}
              className="px-4 h-10 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 flex items-center gap-1">
              <Search size={14} /> ค้นหา
            </button>
          </div>
        </div>

        {transferResults.length > 0 && (
          <div className="space-y-1.5">
            {transferResults.map(c => (
              <button key={c.container_id} onClick={() => setSelectedTransfer(c)}
                className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                  selectedTransfer?.container_id === c.container_id
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'
                }`}>
                <span className="font-mono font-semibold text-slate-800 dark:text-white">{c.container_number}</span>
                <span className="text-slate-400 ml-2">{c.size}&apos;{c.type} · {c.shipping_line}</span>
                {c.zone_name && <span className="text-slate-400 ml-2">@ {c.zone_name} B{c.bay}-R{c.row}-T{c.tier}</span>}
              </button>
            ))}
          </div>
        )}

        {selectedTransfer && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>ลานปลายทาง *</label>
                <select value={transferForm.to_yard_id} onChange={e => setTransferForm({ ...transferForm, to_yard_id: e.target.value })} className={inputClass}>
                  <option value="">เลือกลาน...</option>
                  {allYards.filter(y => y.yard_id !== yardId).map(y => (
                    <option key={y.yard_id} value={y.yard_id}>{y.yard_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>คนขับ</label>
                <input type="text" placeholder="ชื่อ-นามสกุล" value={transferForm.driver_name}
                  onChange={e => setTransferForm({ ...transferForm, driver_name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>ทะเบียนรถ</label>
                <input type="text" placeholder="1กก 1234" value={transferForm.truck_plate}
                  onChange={e => setTransferForm({ ...transferForm, truck_plate: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>หมายเหตุ</label>
              <input type="text" placeholder="เหตุผลในการย้าย..." value={transferForm.notes}
                onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} className={inputClass} />
            </div>
            <button onClick={handleTransfer} disabled={transferLoading || !transferForm.to_yard_id}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-all">
              {transferLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
              ย้ายตู้ข้ามสาขา
            </button>
          </>
        )}

        {transferResult && (
          <div className={`p-4 rounded-xl text-sm ${transferResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700'}`}>
            <p className="font-medium">{transferResult.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, RefreshCw, Save, Hash, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';

interface DocumentSequence {
  sequence_id: number;
  yard_id: number;
  document_type: string;
  sequence_year: number;
  sequence_month: number;
  prefix: string;
  next_number: number;
  padding: number;
  updated_at: string;
}

const DOCUMENT_TYPES = [
  { id: 'eir_in', label: 'EIR Gate In', defaultPrefix: 'EIR-IN' },
  { id: 'eir_out', label: 'EIR Gate Out', defaultPrefix: 'EIR-OUT' },
  { id: 'invoice', label: 'Invoice', defaultPrefix: 'INV' },
  { id: 'receipt', label: 'Receipt', defaultPrefix: 'RCPT' },
  { id: 'credit_note', label: 'Credit Note', defaultPrefix: 'CN' },
  { id: 'eor', label: 'EOR M&R', defaultPrefix: 'EOR' },
];

const inputClass = 'h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 w-full';

export default function DocumentNumberSettings() {
  const { session } = useAuth();
  const { toast } = useToast();
  const yardId = session?.activeYardId || 1;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sequences, setSequences] = useState<DocumentSequence[]>([]);
  const [form, setForm] = useState({
    document_type: 'eir_in',
    sequence_year: currentYear,
    sequence_month: currentMonth,
    prefix: 'EIR-IN',
    next_number: 1,
    padding: 6,
  });

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/numbering?yard_id=${yardId}`);
      const data = await res.json();
      if (Array.isArray(data.sequences)) setSequences(data.sequences);
    } catch {
      toast('error', 'โหลดเลขเอกสารล้มเหลว');
    } finally {
      setLoading(false);
    }
  }, [yardId, toast]);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  const sequenceMap = useMemo(() => {
    const map = new Map<string, DocumentSequence>();
    sequences.forEach(seq => map.set(`${seq.document_type}:${seq.sequence_year}:${seq.sequence_month || 0}`, seq));
    return map;
  }, [sequences]);

  const rows = DOCUMENT_TYPES.map(doc => {
    const sequence = sequenceMap.get(`${doc.id}:${currentYear}:${currentMonth}`);
    const yearMonth = `${currentYear}${String(currentMonth).padStart(2, '0')}`;
    return {
      ...doc,
      sequence,
      prefix: sequence?.prefix || doc.defaultPrefix,
      next_number: sequence?.next_number || 1,
      padding: sequence?.padding || 6,
      sample: `${sequence?.prefix || doc.defaultPrefix}-${yearMonth}-${String(sequence?.next_number || 1).padStart(sequence?.padding || 6, '0')}`,
    };
  });

  const selectForEdit = (documentType: string) => {
    const doc = DOCUMENT_TYPES.find(item => item.id === documentType) || DOCUMENT_TYPES[0];
    const sequence = sequenceMap.get(`${doc.id}:${currentYear}:${currentMonth}`);
    setForm({
      document_type: doc.id,
      sequence_year: currentYear,
      sequence_month: currentMonth,
      prefix: sequence?.prefix || doc.defaultPrefix,
      next_number: sequence?.next_number || 1,
      padding: sequence?.padding || 6,
    });
  };

  const handleDocumentTypeChange = (documentType: string) => {
    const doc = DOCUMENT_TYPES.find(item => item.id === documentType) || DOCUMENT_TYPES[0];
    const sequence = sequenceMap.get(`${doc.id}:${form.sequence_year}:${form.sequence_month}`);
    setForm(prev => ({
      ...prev,
      document_type: doc.id,
      prefix: sequence?.prefix || doc.defaultPrefix,
      next_number: sequence?.next_number || 1,
      padding: sequence?.padding || 6,
    }));
  };

  const handlePeriodChange = (year: number, month: number) => {
    const sequence = sequenceMap.get(`${form.document_type}:${year}:${month}`);
    const doc = DOCUMENT_TYPES.find(item => item.id === form.document_type) || DOCUMENT_TYPES[0];
    setForm(prev => ({
      ...prev,
      sequence_year: year,
      sequence_month: month,
      prefix: sequence?.prefix || doc.defaultPrefix,
      next_number: sequence?.next_number || 1,
      padding: sequence?.padding || prev.padding,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/documents/numbering', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, ...form }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'save failed');
      toast('success', 'บันทึกเลขเอกสารแล้ว');
      fetchSequences();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ';
      toast('error', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
              <Hash size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">Document Number Control</h3>
              <p className="text-xs text-slate-400">ตั้ง prefix และเลขถัดไปแยกตามลาน/เดือน สำหรับ EIR, Invoice, Receipt, Credit Note และ EOR</p>
            </div>
          </div>
          <button onClick={fetchSequences}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
            <RefreshCw size={14} /> รีเฟรช
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">เอกสาร</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Prefix</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">รอบเดือน</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">เลขถัดไป</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">ตัวอย่าง</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {rows.map(row => (
                  <tr key={row.id} onClick={() => selectForEdit(row.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                    <td className="px-3 py-3 font-medium text-slate-800 dark:text-white">{row.label}</td>
                    <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-300">{row.prefix}</td>
                    <td className="px-3 py-3 text-center font-mono text-slate-600 dark:text-slate-300">{currentYear}{String(currentMonth).padStart(2, '0')}</td>
                    <td className="px-3 py-3 text-center font-mono text-slate-600 dark:text-slate-300">{row.next_number}</td>
                    <td className="px-3 py-3 font-mono text-xs text-blue-600 dark:text-blue-300">{row.sample}</td>
                    <td className="px-3 py-3 text-center">
                      {row.sequence ? (
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 text-xs font-semibold">ตั้งค่าแล้ว</span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 text-xs font-semibold">ใช้ค่าเริ่มต้น</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/30">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-blue-600" />
              <h4 className="font-semibold text-sm text-slate-800 dark:text-white">แก้ไขเลขเอกสาร</h4>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">ประเภทเอกสาร</label>
                <select value={form.document_type} onChange={e => handleDocumentTypeChange(e.target.value)} className={inputClass}>
                  {DOCUMENT_TYPES.map(doc => <option key={doc.id} value={doc.id}>{doc.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">ปี</label>
                  <input type="number" value={form.sequence_year} onChange={e => handlePeriodChange(Number(e.target.value) || currentYear, form.sequence_month)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">เดือน</label>
                  <select value={form.sequence_month} onChange={e => handlePeriodChange(form.sequence_year, Number(e.target.value) || currentMonth)} className={inputClass}>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(month => (
                      <option key={month} value={month}>{String(month).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Padding</label>
                  <input type="number" min={3} max={10} value={form.padding} onChange={e => setForm({ ...form, padding: Number(e.target.value) || 6 })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Prefix</label>
                <input value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} className={`${inputClass} font-mono`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">เลขถัดไป</label>
                <input type="number" min={1} value={form.next_number} onChange={e => setForm({ ...form, next_number: Number(e.target.value) || 1 })} className={`${inputClass} font-mono`} />
              </div>
              <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-3">
                <p className="text-xs text-slate-400 mb-1">ตัวอย่างเลขถัดไป</p>
                <p className="font-mono font-semibold text-blue-600 dark:text-blue-300">
                  {form.prefix}-{form.sequence_year}{String(form.sequence_month).padStart(2, '0')}-{String(form.next_number).padStart(form.padding, '0')}
                </p>
              </div>
              <button onClick={handleSave} disabled={saving || !form.prefix}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">ควรแก้เลขถัดไปอย่างระมัดระวัง</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
            เลขเอกสารใหม่จะรันแยกตามเดือนในรูปแบบ PREFIX-YYYYMM-RUNNING ถ้าตั้งเลขย้อนหลังในเดือนเดียวกัน อาจชนกับเอกสารเดิมได้
          </p>
        </div>
      </div>
    </div>
  );
}

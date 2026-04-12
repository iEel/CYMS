'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Plus, Trash2, Search, Loader2, Link, X, AlertTriangle,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PrefixMap {
  prefix_id: number;
  prefix_code: string;
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_forwarder: boolean;
  is_trucking: boolean;
  notes: string;
  created_at: string;
}

interface Customer {
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_forwarder: boolean;
  is_trucking: boolean;
}

export default function PrefixMapping() {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<PrefixMap[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ prefix_code: '', customer_id: '', notes: '' });
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });

  const fetchData = useCallback(async () => {
    try {
      const [mapRes, custRes] = await Promise.all([
        fetch('/api/settings/prefix-mapping'),
        fetch('/api/settings/customers'),
      ]);
      const mapData = await mapRes.json();
      const custData = await custRes.json();
      if (Array.isArray(mapData)) setMappings(mapData);
      if (Array.isArray(custData)) setCustomers(custData);
    } catch (err) {
      console.error('Load prefix mapping error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!form.prefix_code || !form.customer_id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/prefix-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix_code: form.prefix_code.toUpperCase(),
          customer_id: parseInt(form.customer_id),
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAdd(false);
        setForm({ prefix_code: '', customer_id: '', notes: '' });
        fetchData();
      } else {
        toast('error', data.error || 'Error');
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, code: string) => {
    setConfirmDlg({
      open: true,
      message: `ลบ prefix ${code}?`,
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        try {
          const res = await fetch(`/api/settings/prefix-mapping?prefix_id=${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) fetchData();
        } catch (err) { console.error(err); }
      },
    });
  };

  const filtered = mappings.filter(m =>
    m.prefix_code.toLowerCase().includes(search.toLowerCase()) ||
    m.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    m.notes?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by customer
  const grouped = filtered.reduce<Record<number, { customer: Customer; prefixes: PrefixMap[] }>>((acc, m) => {
    if (!acc[m.customer_id]) {
      acc[m.customer_id] = {
        customer: { customer_id: m.customer_id, customer_name: m.customer_name, is_line: m.is_line, is_forwarder: m.is_forwarder, is_trucking: m.is_trucking },
        prefixes: [],
      };
    }
    acc[m.customer_id].prefixes.push(m);
    return acc;
  }, {});

  const inputClass = "h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors w-full";

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <>
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center text-cyan-600">
            <Link size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Prefix Mapping — จับคู่รหัสตู้กับลูกค้า</h2>
            <p className="text-xs text-slate-400">ผูกรหัส BIC Prefix (4 ตัวอักษร) กับลูกค้าในระบบ ({mappings.length} prefix)</p>
          </div>
        </div>
        <button onClick={() => { setShowAdd(true); setForm({ prefix_code: '', customer_id: '', notes: '' }); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-medium
            hover:bg-cyan-700 active:scale-[0.98] transition-all shadow-sm">
          <Plus size={16} /> เพิ่ม Prefix
        </button>
      </div>

      {/* Search */}
      <div className="px-6 pt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา prefix, ชื่อลูกค้า..."
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-cyan-500" />
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="mx-6 mt-4 p-4 border-2 border-cyan-200 dark:border-cyan-800 rounded-xl bg-cyan-50/30 dark:bg-cyan-900/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-white">เพิ่ม Prefix → ลูกค้า</h3>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Prefix Code *</label>
              <input type="text" maxLength={4} value={form.prefix_code}
                onChange={e => setForm({ ...form, prefix_code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
                placeholder="MSCU" className={`${inputClass} font-mono text-lg tracking-wider uppercase`} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">ลูกค้า *</label>
              <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className={inputClass}>
                <option value="">-- เลือกลูกค้า --</option>
                {customers.filter(c => c.is_line).map(c => (
                  <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">หมายเหตุ</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="เช่น main code" className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">ยกเลิก</button>
            <button onClick={handleAdd} disabled={saving || !form.prefix_code || !form.customer_id || form.prefix_code.length < 4}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} เพิ่ม
            </button>
          </div>
        </div>
      )}

      {/* Mapping List — grouped by customer */}
      <div className="p-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? 'ไม่พบ prefix ที่ค้นหา' : 'ยังไม่มี prefix mapping — กดปุ่ม "เพิ่ม Prefix"'}</p>
            <p className="text-xs text-slate-300 mt-1">ตู้ที่เข้าลานจะไม่สามารถจับคู่กับลูกค้าได้อัตโนมัติ</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.values(grouped).map(({ customer, prefixes }) => (
              <div key={customer.customer_id} className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                {/* Customer Header */}
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/30 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-xs font-bold">
                    {prefixes.length}
                  </div>
                  <span className="font-medium text-sm text-slate-800 dark:text-white">{customer.customer_name}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">{customer.is_line ? 'สายเรือ' : customer.is_trucking ? 'รถบรรทุก' : 'ทั่วไป'}</span>
                </div>
                {/* Prefix Tags */}
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {prefixes.map(m => (
                    <div key={m.prefix_id}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                      <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300 text-sm tracking-wider">{m.prefix_code}</span>
                      {m.notes && <span className="text-[10px] text-slate-400">({m.notes})</span>}
                      <button onClick={() => handleDelete(m.prefix_id, m.prefix_code)}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    <ConfirmDialog open={confirmDlg.open} title="ยืนยันการลบ" message={confirmDlg.message} confirmLabel="ลบ" onConfirm={confirmDlg.action} onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />
    </>
  );
}

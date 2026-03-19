'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, Users, Pencil, X, CheckCircle2, Loader2,
  Building, Truck, Ship, Search,
} from 'lucide-react';

interface Customer {
  customer_id: number;
  customer_name: string;
  customer_type: string;
  tax_id: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  credit_term: number;
  is_active: boolean;
}

const TYPE_OPTIONS = [
  { value: 'shipping_line', label: 'สายเรือ', icon: Ship, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  { value: 'trucker', label: 'รถบรรทุก', icon: Truck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  { value: 'general', label: 'ทั่วไป', icon: Building, color: 'text-slate-600 bg-slate-100 dark:bg-slate-700' },
];

const emptyForm = {
  customer_name: '', customer_type: 'general', tax_id: '', address: '',
  contact_name: '', contact_phone: '', contact_email: '', credit_term: 0,
};

export default function CustomerMaster() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/customers');
      const json = await res.json();
      if (Array.isArray(json)) setCustomers(json);
    } catch (err) {
      console.error('Load customers error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!form.customer_name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowAdd(false);
        setForm(emptyForm);
        fetchData();
      } else {
        alert(json.error || 'Error');
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/customers', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: editId, ...form }),
      });
      const json = await res.json();
      if (json.success) {
        setEditId(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันลบลูกค้านี้?')) return;
    try {
      const res = await fetch(`/api/settings/customers?customer_id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) fetchData();
      else alert(json.error || 'Error');
    } catch (err) { console.error(err); }
  };

  const startEdit = (c: Customer) => {
    setEditId(c.customer_id);
    setForm({
      customer_name: c.customer_name, customer_type: c.customer_type,
      tax_id: c.tax_id || '', address: c.address || '',
      contact_name: c.contact_name || '', contact_phone: c.contact_phone || '',
      contact_email: c.contact_email || '', credit_term: c.credit_term || 0,
    });
  };

  const filtered = customers.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.tax_id?.includes(search) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const inputClass = "h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors w-full";

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600">
            <Users size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">จัดการลูกค้า</h2>
            <p className="text-xs text-slate-400">Customer Master — สายเรือ, รถบรรทุก, ลูกค้าทั่วไป ({customers.length} ราย)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> บันทึกแล้ว</span>}
          <button onClick={() => { setShowAdd(true); setForm(emptyForm); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium
              hover:bg-violet-700 active:scale-[0.98] transition-all shadow-sm">
            <Plus size={16} /> เพิ่มลูกค้า
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 pt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, เลขประจำตัว, ผู้ติดต่อ..."
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500" />
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="mx-6 mt-4 p-4 border-2 border-violet-200 dark:border-violet-800 rounded-xl bg-violet-50/30 dark:bg-violet-900/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-white">เพิ่มลูกค้าใหม่</h3>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
              placeholder="ชื่อลูกค้า *" className={inputClass} />
            <select value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })}
              className={inputClass}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="text" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })}
              placeholder="เลขประจำตัวผู้เสียภาษี" className={`${inputClass} font-mono`} />
            <input type="text" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
              placeholder="ผู้ติดต่อ" className={inputClass} />
            <input type="text" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
              placeholder="โทรศัพท์" className={inputClass} />
            <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })}
              placeholder="อีเมล" className={inputClass} />
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="ที่อยู่" className={`${inputClass} md:col-span-2`} />
            <input type="number" value={form.credit_term} onChange={e => setForm({ ...form, credit_term: parseInt(e.target.value) || 0 })}
              placeholder="วันเครดิต" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">ยกเลิก</button>
            <button onClick={handleAdd} disabled={saving || !form.customer_name}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} เพิ่ม
            </button>
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? 'ไม่พบลูกค้าที่ค้นหา' : 'ยังไม่มีข้อมูลลูกค้า — กดปุ่ม "เพิ่มลูกค้า"'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => {
              const typeOpt = TYPE_OPTIONS.find(t => t.value === c.customer_type) || TYPE_OPTIONS[2];
              const TypeIcon = typeOpt.icon;
              const isEditing = editId === c.customer_id;

              return (
                <div key={c.customer_id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all
                    ${isEditing ? 'border-violet-300 dark:border-violet-700 bg-violet-50/30 dark:bg-violet-900/10' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>

                  {isEditing ? (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                        className={inputClass} placeholder="ชื่อ" />
                      <select value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })} className={inputClass}>
                        {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input type="text" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                        className={inputClass} placeholder="โทร" />
                      <input type="number" value={form.credit_term} onChange={e => setForm({ ...form, credit_term: parseInt(e.target.value) || 0 })}
                        className={inputClass} placeholder="วันเครดิต" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeOpt.color}`}>
                        <TypeIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800 dark:text-white truncate">{c.customer_name}</span>
                          {!c.is_active && <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">ปิดใช้งาน</span>}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {typeOpt.label}
                          {c.tax_id && <span> • {c.tax_id}</span>}
                          {c.contact_name && <span> • {c.contact_name}</span>}
                          {c.contact_phone && <span> • {c.contact_phone}</span>}
                          {c.credit_term > 0 && <span> • เครดิต {c.credit_term} วัน</span>}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    {isEditing ? (
                      <>
                        <button onClick={handleEdit} disabled={saving}
                          className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-50">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-400 flex items-center justify-center hover:bg-slate-300">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(c)}
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500 transition-colors" title="แก้ไข">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(c.customer_id)}
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors" title="ลบ">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

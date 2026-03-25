'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, Users, Pencil, X, CheckCircle2, Loader2,
  Building, Truck, Ship, Search, KeyRound,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

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
  branch_type: string;
  branch_number: string;
  shipping_line_code: string;
}

const TYPE_OPTIONS = [
  { value: 'shipping_line', label: 'สายเรือ', icon: Ship, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  { value: 'trucker', label: 'รถบรรทุก', icon: Truck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  { value: 'general', label: 'ทั่วไป', icon: Building, color: 'text-slate-600 bg-slate-100 dark:bg-slate-700' },
];

const emptyForm = {
  customer_name: '', customer_type: 'general', tax_id: '', address: '',
  contact_name: '', contact_phone: '', contact_email: '', credit_term: 0,
  branch_type: 'head_office', branch_number: '00000', shipping_line_code: '',
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
  const [portalLoading, setPortalLoading] = useState<number | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });

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
    setConfirmDlg({
      open: true,
      message: 'ยืนยันลบลูกค้านี้?',
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        try {
          const res = await fetch(`/api/settings/customers?customer_id=${id}`, { method: 'DELETE' });
          const json = await res.json();
          if (json.success) fetchData();
          else alert(json.error || 'Error');
        } catch (err) { console.error(err); }
      },
    });
  };

  const startEdit = (c: Customer) => {
    setEditId(c.customer_id);
    setForm({
      customer_name: c.customer_name, customer_type: c.customer_type,
      tax_id: c.tax_id || '', address: c.address || '',
      contact_name: c.contact_name || '', contact_phone: c.contact_phone || '',
      contact_email: c.contact_email || '', credit_term: c.credit_term || 0,
      branch_type: c.branch_type || 'head_office', branch_number: c.branch_number || '00000',
      shipping_line_code: c.shipping_line_code || '',
    });
  };

  const createPortalAccount = async (cid: number) => {
    setPortalLoading(cid);
    try {
      const res = await fetch('/api/settings/customers/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: cid }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`✅ สร้างบัญชี Portal สำเร็จ!\n\nUsername: ${json.username}\nPassword: ${json.tempPassword}\n\nกรุณาส่งข้อมูลนี้ให้ลูกค้า`);
      } else {
        alert(json.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('ไม่สามารถสร้างบัญชีได้'); }
    finally { setPortalLoading(null); }
  };

  const filtered = customers.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.tax_id?.includes(search) ||
    c.shipping_line_code?.toLowerCase().includes(search.toLowerCase()) ||
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
    <>
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
            <div>
              <label className="block text-xs text-slate-500 mb-1">ชื่อลูกค้า *</label>
              <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                placeholder="ชื่อลูกค้า" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ประเภท</label>
              <select value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })}
                className={inputClass}>
                {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">เลขประจำตัวผู้เสียภาษี</label>
              <input type="text" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })}
                placeholder="0-0000-00000-00-0" className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ผู้ติดต่อ</label>
              <input type="text" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
                placeholder="ชื่อผู้ติดต่อ" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">โทรศัพท์</label>
              <input type="text" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="0xx-xxx-xxxx" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">อีเมล</label>
              <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })}
                placeholder="email@example.com" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">ที่อยู่</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="ที่อยู่บริษัท" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">วันเครดิต (Credit Term)</label>
              <input type="number" value={form.credit_term} onChange={e => setForm({ ...form, credit_term: parseInt(e.target.value) || 0 })}
                placeholder="0" className={inputClass} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-slate-500 mb-1">ประเภทสาขา</label>
              <div className="flex items-center gap-4 h-10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="branch_type" value="head_office" checked={form.branch_type === 'head_office'}
                    onChange={() => setForm({ ...form, branch_type: 'head_office', branch_number: '00000' })}
                    className="accent-violet-600" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">สำนักงานใหญ่</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="branch_type" value="branch" checked={form.branch_type === 'branch'}
                    onChange={() => setForm({ ...form, branch_type: 'branch', branch_number: '' })}
                    className="accent-violet-600" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">สาขาที่</span>
                </label>
                {form.branch_type === 'branch' && (
                  <input type="text" value={form.branch_number} onChange={e => setForm({ ...form, branch_number: e.target.value })}
                    placeholder="00001" className="h-10 w-28 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-white outline-none focus:border-violet-500" />
                )}
              </div>
            </div>
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
                      <div className="relative">
                        <input type="number" value={form.credit_term} onChange={e => setForm({ ...form, credit_term: parseInt(e.target.value) || 0 })}
                          className={inputClass} placeholder="วันเครดิต" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">วัน</span>
                      </div>
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
                          <span> • {c.branch_type === 'head_office' ? 'สำนักงานใหญ่' : `สาขาที่ ${c.branch_number}`}</span>
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
                        <button onClick={() => createPortalAccount(c.customer_id)} disabled={portalLoading === c.customer_id}
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 transition-colors" title="สร้างบัญชี Portal">
                          {portalLoading === c.customer_id ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
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

    <ConfirmDialog open={confirmDlg.open} title="ยืนยันการลบ" message={confirmDlg.message} confirmLabel="ลบ" onConfirm={confirmDlg.action} onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />
    </>
  );
}

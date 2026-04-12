'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Plus, Trash2, Save, Users, Pencil, X, CheckCircle2, Loader2,
  Building, Truck, Ship, Search, Anchor, PackageCheck, ArrowRightLeft, GitBranch,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

/* ========= Types ========= */

interface Branch {
  branch_id?: number;
  branch_code: string;
  branch_name: string;
  billing_address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  is_default: boolean;
  is_active?: boolean;
}

interface Customer {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  is_line: boolean;
  is_forwarder: boolean;
  is_trucking: boolean;
  is_shipper: boolean;
  is_consignee: boolean;
  tax_id: string;
  address: string;
  billing_address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  default_payment_type: string;
  credit_term: number;
  edi_prefix: string;
  shipping_line_code: string;
  is_active: boolean;
  branches: Branch[];
}

/* ========= Role Config ========= */

const ROLE_OPTIONS = [
  { key: 'is_line' as const,      label: 'สายเรือ / เจ้าของตู้', icon: Ship,           color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',     border: 'border-blue-300 dark:border-blue-700' },
  { key: 'is_forwarder' as const, label: 'Forwarder',            icon: ArrowRightLeft, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-300 dark:border-violet-700' },
  { key: 'is_trucking' as const,  label: 'รถบรรทุก',             icon: Truck,          color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-300 dark:border-amber-700' },
  { key: 'is_shipper' as const,   label: 'ผู้ส่งออก (Shipper)',  icon: PackageCheck,   color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700' },
  { key: 'is_consignee' as const, label: 'ผู้นำเข้า (Consignee)',icon: Anchor,        color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20',       border: 'border-rose-300 dark:border-rose-700' },
];

type FormFields = {
  customer_name: string;
  is_line: boolean;
  is_forwarder: boolean;
  is_trucking: boolean;
  is_shipper: boolean;
  is_consignee: boolean;
  tax_id: string;
  address: string;
  billing_address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  default_payment_type: string;
  credit_term: number;
  edi_prefix: string;
  shipping_line_code: string;
  branches: Branch[];
};

const emptyForm: FormFields = {
  customer_name: '', is_line: false, is_forwarder: false, is_trucking: false,
  is_shipper: false, is_consignee: false, tax_id: '', address: '', billing_address: '',
  contact_name: '', contact_phone: '', contact_email: '', default_payment_type: 'CASH',
  credit_term: 0, edi_prefix: '', shipping_line_code: '',
  branches: [{ branch_code: '00000', branch_name: 'สำนักงานใหญ่', billing_address: '', contact_name: '', contact_phone: '', contact_email: '', is_default: true }],
};

const emptyBranch: Branch = {
  branch_code: '', branch_name: '', billing_address: '', contact_name: '', contact_phone: '', contact_email: '', is_default: false,
};

/* ========= Helper: Role Badges ========= */

export function getRoleBadges(c: { is_line?: boolean; is_forwarder?: boolean; is_trucking?: boolean; is_shipper?: boolean; is_consignee?: boolean }) {
  return ROLE_OPTIONS.filter(r => c[r.key]);
}

/* ========= Component ========= */

export default function CustomerMaster() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);
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
        setForm({ ...emptyForm });
        fetchData();
        toast('success', 'เพิ่มลูกค้าสำเร็จ');
      } else {
        toast('error', json.error || 'Error');
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
      } else {
        toast('error', json.error || 'Error');
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
          else toast('error', json.error || 'Error');
        } catch (err) { console.error(err); }
      },
    });
  };

  const startEdit = (c: Customer) => {
    setEditId(c.customer_id);
    setForm({
      customer_name: c.customer_name,
      is_line: !!c.is_line, is_forwarder: !!c.is_forwarder, is_trucking: !!c.is_trucking,
      is_shipper: !!c.is_shipper, is_consignee: !!c.is_consignee,
      tax_id: c.tax_id || '', address: c.address || '', billing_address: c.billing_address || '',
      contact_name: c.contact_name || '', contact_phone: c.contact_phone || '',
      contact_email: c.contact_email || '', default_payment_type: c.default_payment_type || 'CASH',
      credit_term: c.credit_term || 0, edi_prefix: c.edi_prefix || '',
      shipping_line_code: c.shipping_line_code || '',
      branches: c.branches?.length > 0 ? c.branches : [{ branch_code: '00000', branch_name: 'สำนักงานใหญ่', billing_address: '', contact_name: '', contact_phone: '', contact_email: '', is_default: true }],
    });
  };

  const filtered = customers.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_code?.toLowerCase().includes(search.toLowerCase()) ||
    c.tax_id?.includes(search) ||
    c.edi_prefix?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const inputClass = "h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors w-full";

  /* ========= Role Checkbox Group ========= */
  const RoleCheckboxes = () => (
    <div>
      <label className="block text-xs text-slate-500 mb-2">บทบาทในระบบ (เลือกได้หลายรายการ)</label>
      <div className="flex flex-wrap gap-2">
        {ROLE_OPTIONS.map(r => {
          const Icon = r.icon;
          const checked = form[r.key];
          return (
            <label key={r.key}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm select-none
                ${checked ? `${r.color} ${r.border} shadow-sm` : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300'}`}>
              <input type="checkbox" checked={checked}
                onChange={() => setForm(f => ({ ...f, [r.key]: !f[r.key] }))}
                className="w-4 h-4 rounded accent-current" />
              <Icon size={14} />
              <span className={checked ? 'font-medium' : ''}>{r.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  /* ========= Branch Manager ========= */
  const BranchManager = () => (
    <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-slate-500 font-semibold flex items-center gap-1.5">
          <GitBranch size={12} /> สาขา ({form.branches.length})
        </label>
        <button type="button" onClick={() => setForm(f => ({ ...f, branches: [...f.branches, { ...emptyBranch }] }))}
          className="text-[11px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
          <Plus size={12} /> เพิ่มสาขา
        </button>
      </div>
      <div className="space-y-2">
        {form.branches.map((b, i) => (
          <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <input type="text" value={b.branch_code} placeholder="00000"
                onChange={e => { const arr = [...form.branches]; arr[i] = { ...arr[i], branch_code: e.target.value }; setForm(f => ({ ...f, branches: arr })); }}
                className="w-20 h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-mono text-center" />
              <input type="text" value={b.branch_name} placeholder="ชื่อสาขา (เช่น สำนักงานใหญ่)"
                onChange={e => { const arr = [...form.branches]; arr[i] = { ...arr[i], branch_name: e.target.value }; setForm(f => ({ ...f, branches: arr })); }}
                className="flex-1 h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs" />
              <label className="flex items-center gap-1.5 text-[10px] text-slate-500 whitespace-nowrap">
                <input type="radio" name={`default_branch_${editId || 'new'}`} checked={b.is_default}
                  onChange={() => { const arr = form.branches.map((bb, j) => ({ ...bb, is_default: j === i })); setForm(f => ({ ...f, branches: arr })); }}
                  className="accent-violet-600" />
                หลัก
              </label>
              {form.branches.length > 1 && (
                <button type="button" onClick={() => setForm(f => ({ ...f, branches: f.branches.filter((_, j) => j !== i) }))}
                  className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={b.billing_address} placeholder="ที่อยู่ออกบิล"
                onChange={e => { const arr = [...form.branches]; arr[i] = { ...arr[i], billing_address: e.target.value }; setForm(f => ({ ...f, branches: arr })); }}
                className="col-span-3 h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs" />
              <input type="text" value={b.contact_name} placeholder="ผู้ติดต่อ"
                onChange={e => { const arr = [...form.branches]; arr[i] = { ...arr[i], contact_name: e.target.value }; setForm(f => ({ ...f, branches: arr })); }}
                className="h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs" />
              <input type="text" value={b.contact_phone} placeholder="โทร"
                onChange={e => { const arr = [...form.branches]; arr[i] = { ...arr[i], contact_phone: e.target.value }; setForm(f => ({ ...f, branches: arr })); }}
                className="h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs" />
              <input type="text" value={b.contact_email} placeholder="อีเมล"
                onChange={e => { const arr = [...form.branches]; arr[i] = { ...arr[i], contact_email: e.target.value }; setForm(f => ({ ...f, branches: arr })); }}
                className="h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ========= Form Fields ========= */
  const FormFields = () => (
    <div className="space-y-3">
      <RoleCheckboxes />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">ชื่อลูกค้า *</label>
          <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
            placeholder="ชื่อลูกค้า" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">เลขประจำตัวผู้เสียภาษี</label>
          <input type="text" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })}
            placeholder="0-0000-00000-00-0" className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">การชำระเงิน</label>
          <select value={form.default_payment_type} onChange={e => setForm({ ...form, default_payment_type: e.target.value })}
            className={inputClass}>
            <option value="CASH">💵 เงินสด (Cash)</option>
            <option value="CREDIT">🏢 เครดิต (Credit)</option>
          </select>
        </div>
        {form.default_payment_type === 'CREDIT' && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">วันเครดิต (Credit Term)</label>
            <input type="number" value={form.credit_term} onChange={e => setForm({ ...form, credit_term: parseInt(e.target.value) || 0 })}
              placeholder="30" className={inputClass} />
          </div>
        )}
        {form.is_line && (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-1">EDI Prefix * <span className="text-rose-400">(บังคับสำหรับสายเรือ)</span></label>
              <input type="text" value={form.edi_prefix} onChange={e => setForm({ ...form, edi_prefix: e.target.value.toUpperCase() })}
                placeholder="MSCU" maxLength={10} className={`${inputClass} font-mono uppercase`} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Shipping Line Code</label>
              <input type="text" value={form.shipping_line_code} onChange={e => setForm({ ...form, shipping_line_code: e.target.value })}
                placeholder="MSC" className={inputClass} />
            </div>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">ที่อยู่</label>
          <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="ที่อยู่บริษัท" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">ที่อยู่ออกบิล (ถ้าต่างจากที่อยู่หลัก)</label>
          <input type="text" value={form.billing_address} onChange={e => setForm({ ...form, billing_address: e.target.value })}
            placeholder="ที่อยู่สำหรับออกใบแจ้งหนี้" className={inputClass} />
        </div>
      </div>
      <BranchManager />
    </div>
  );

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
            <p className="text-xs text-slate-400">Customer Master — Multi-role ({customers.length} ราย)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> บันทึกแล้ว</span>}
          <button onClick={() => { setShowAdd(true); setForm({ ...emptyForm }); }}
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
            placeholder="ค้นหาชื่อ, รหัสลูกค้า, เลขประจำตัว, EDI prefix..."
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
          <FormFields />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">ยกเลิก</button>
            <button onClick={handleAdd} disabled={saving || !form.customer_name || (form.is_line && !form.edi_prefix)}
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
              const isEditing = editId === c.customer_id;
              const roles = getRoleBadges(c);

              return isEditing ? (
                <div key={c.customer_id} className="p-4 rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50/30 dark:bg-violet-900/10 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                      <Pencil size={14} className="text-violet-500" /> แก้ไขข้อมูลลูกค้า
                      <span className="text-xs text-slate-400 font-mono">{c.customer_code}</span>
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button onClick={handleEdit} disabled={saving || !form.customer_name || (form.is_line && !form.edi_prefix)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-all">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึก
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-sm hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                        <X size={14} /> ยกเลิก
                      </button>
                    </div>
                  </div>
                  <FormFields />
                </div>
              ) : (
                <div key={c.customer_id}
                  className="flex items-center justify-between p-4 rounded-xl border transition-all border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${roles.length > 0 ? roles[0].color : 'text-slate-400 bg-slate-100 dark:bg-slate-700'}`}>
                      {roles.length > 0 ? (() => { const Icon = roles[0].icon; return <Icon size={16} />; })() : <Building size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-800 dark:text-white truncate">{c.customer_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.customer_code}</span>
                        {!c.is_active && <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">ปิดใช้งาน</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {/* Role badges */}
                        {roles.map(r => (
                          <span key={r.key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${r.color}`}>
                            {(() => { const Icon = r.icon; return <Icon size={10} />; })()}
                            {r.label}
                          </span>
                        ))}
                        {roles.length === 0 && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">ยังไม่กำหนดบทบาท</span>}
                        {/* Meta info */}
                        <span className="text-[10px] text-slate-400">
                          {c.tax_id && ` • ${c.tax_id}`}
                          {c.credit_term > 0 && ` • เครดิต ${c.credit_term} วัน`}
                          {c.branches?.length > 0 && ` • ${c.branches.length} สาขา`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    <button onClick={() => startEdit(c)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500 transition-colors" title="แก้ไข">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(c.customer_id)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors" title="ลบ">
                      <Trash2 size={14} />
                    </button>
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

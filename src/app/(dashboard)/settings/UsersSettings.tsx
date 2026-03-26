'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import { Users, Plus, Pencil, Save, Loader2, X, Shield, MapPin, Building, Trash2, Search, ChevronLeft, ChevronRight, Lock, Unlock } from 'lucide-react';
import { getPasswordStrength } from '@/lib/passwordStrength';
import PermissionsMatrix from './PermissionsMatrix';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface UserData {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  role_code: string;
  role_name: string;
  yard_ids: string; // comma separated
  customer_id?: number;
  failed_login_count?: number;
  locked_at?: string;
}

interface CustomerOption {
  customer_id: number;
  customer_name: string;
  customer_type: string;
}

interface YardOption {
  yard_id: number;
  yard_name: string;
  yard_code: string;
}

const ROLES = [
  { code: 'yard_manager', label: 'ผู้จัดการลาน / Admin' },
  { code: 'gate_clerk', label: 'พนักงานหน้าประตู' },
  { code: 'surveyor', label: 'พนักงานสำรวจลาน' },
  { code: 'rs_driver', label: 'คนขับรถยก' },
  { code: 'billing_officer', label: 'พนักงานบัญชี' },
  { code: 'customer', label: 'ลูกค้า (สายเรือ/ขนส่ง)' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'ใช้งาน', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  suspend: { label: 'ระงับ', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  resign: { label: 'ลาออก', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

export default function UsersSettings() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });
  const [tab, setTab] = useState<'all' | 'staff' | 'customer'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Form
  const [form, setForm] = useState({
    username: '', password: '', full_name: '', email: '', phone: '',
    role_code: 'gate_clerk', status: 'active', yard_ids: [1] as number[],
    customer_id: null as number | null,
  });
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [yards, setYards] = useState<YardOption[]>([]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/customers');
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
    } catch { /* ignore */ }
  }, []);

  const fetchYards = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/yards');
      const data = await res.json();
      if (Array.isArray(data)) setYards(data);
    } catch { /* ignore */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); fetchCustomers(); fetchYards(); }, [fetchUsers, fetchCustomers, fetchYards]);

  const openAdd = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', full_name: '', email: '', phone: '', role_code: 'gate_clerk', status: 'active', yard_ids: [1], customer_id: null });
    setShowForm(true);
  };

  const openEdit = (user: UserData) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name,
      email: user.email || '',
      phone: user.phone || '',
      role_code: user.role_code,
      status: user.status,
      yard_ids: user.yard_ids ? user.yard_ids.split(',').map(Number) : [],
      customer_id: user.customer_id || null,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isEdit = !!editingUser;
      const body = isEdit
        ? { ...form, user_id: editingUser.user_id }
        : form;

      const res = await fetch('/api/settings/users', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.success || json.userId) {
        setShowForm(false);
        fetchUsers();
      } else {
        toast('error', json.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = (user: UserData) => {
    setConfirmDlg({
      open: true,
      message: `ยืนยันลบผู้ใช้ "${user.full_name}" (@${user.username})?`,
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        try {
          const res = await fetch(`/api/settings/users?user_id=${user.user_id}`, { method: 'DELETE' });
          const json = await res.json();
          if (json.success) fetchUsers();
          else toast('error', json.error || 'เกิดข้อผิดพลาด');
        } catch { toast('error', 'ไม่สามารถลบผู้ใช้ได้'); }
      },
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 w-full" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-[#8B5CF6]">
            <Users size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">ผู้ใช้งานและสิทธิ์</h2>
            <p className="text-xs text-slate-400">จัดการบัญชีผู้ใช้ กำหนดบทบาท สิทธิ์เข้าถึงลาน</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-sm font-medium
            hover:bg-[#7C3AED] active:scale-[0.98] transition-all shadow-sm">
          <Plus size={16} /> เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      {/* Add/Edit User Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          {/* Form Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                {editingUser ? <Pencil size={16} className="text-white" /> : <Plus size={16} className="text-white" />}
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">
                  {editingUser ? `แก้ไขผู้ใช้` : 'เพิ่มผู้ใช้ใหม่'}
                </h3>
                {editingUser && <p className="text-violet-200 text-xs">{editingUser.full_name} ({editingUser.username})</p>}
              </div>
            </div>
            <button onClick={() => setShowForm(false)} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-6">
            {/* Section 1: Account */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield size={12} className="text-violet-500" /> ข้อมูลบัญชี
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">ชื่อผู้ใช้ (Username) <span className="text-rose-400">*</span></label>
                  <input type="text" value={form.username} disabled={!!editingUser}
                    onChange={e => setForm({...form, username: e.target.value})} placeholder="เช่น admin, john.doe"
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:bg-slate-100 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">
                    {editingUser ? 'รหัสผ่านใหม่' : <span>รหัสผ่าน <span className="text-rose-400">*</span></span>}
                  </label>
                  <input type="password" value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})} placeholder={editingUser ? 'เว้นว่างถ้าไม่เปลี่ยน' : '••••••••'}
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                  {/* Password Strength Meter */}
                  {form.password && (() => {
                    const strength = getPasswordStrength(form.password);
                    return (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          {[0,1,2,3].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength.score ? '' : 'bg-slate-200 dark:bg-slate-600'}`}
                              style={{ backgroundColor: i < strength.score ? strength.color : undefined }} />
                          ))}
                        </div>
                        <p className="text-[10px] mt-0.5 font-medium" style={{ color: strength.color }}>{strength.label}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Section 2: Personal */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users size={12} className="text-blue-500" /> ข้อมูลส่วนตัว
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">ชื่อ-นามสกุล <span className="text-rose-400">*</span></label>
                  <input type="text" value={form.full_name}
                    onChange={e => setForm({...form, full_name: e.target.value})} placeholder="ระบุชื่อเต็ม"
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">อีเมล</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com"
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">โทรศัพท์</label>
                  <input type="text" value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})} placeholder="0xx-xxx-xxxx"
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                </div>
              </div>
            </div>

            {/* Section 3: Role & Permissions */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield size={12} className="text-emerald-500" /> บทบาทและสิทธิ์
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">บทบาท</label>
                  <select value={form.role_code} onChange={e => setForm({...form, role_code: e.target.value, customer_id: e.target.value !== 'customer' ? null : form.customer_id})}
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all">
                    {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                </div>
                {editingUser && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">สถานะ</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                      className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all">
                      <option value="active">✅ ใช้งาน</option>
                      <option value="suspend">⚠️ ระงับ</option>
                      <option value="resign">🚫 ลาออก</option>
                    </select>
                  </div>
                )}
                {form.role_code === 'customer' && (
                  <div className={editingUser ? 'md:col-span-2' : ''}>
                    <label className="block text-xs text-slate-500 mb-1.5">🏢 บริษัทลูกค้า <span className="text-rose-400">*</span></label>
                    <select value={form.customer_id || ''} onChange={e => setForm({...form, customer_id: e.target.value ? parseInt(e.target.value) : null})}
                      className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all">
                      <option value="">-- เลือกบริษัท --</option>
                      {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Yard Access */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                    <MapPin size={12} className="text-violet-500" /> สิทธิ์เข้าถึงลาน
                    <span className="text-violet-500 font-bold">({form.yard_ids.length})</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setForm({...form, yard_ids: []})}
                      className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline">เคลียร์</button>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => setForm({...form, yard_ids: yards.map(y => y.yard_id)})}
                      className="text-[10px] text-violet-500 hover:underline">เลือกทั้งหมด</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {yards.map(y => {
                    const checked = form.yard_ids.includes(y.yard_id);
                    return (
                      <label key={y.yard_id}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                          checked
                            ? 'border-violet-400 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 shadow-sm'
                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:border-violet-300'
                        }`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            setForm({...form, yard_ids: checked
                              ? form.yard_ids.filter(id => id !== y.yard_id)
                              : [...form.yard_ids, y.yard_id]
                            });
                          }}
                          className="accent-violet-600 w-3.5 h-3.5" />
                        {y.yard_name}
                      </label>
                    );
                  })}
                  {yards.length === 0 && <span className="text-xs text-slate-400">ยังไม่มีลาน — ไปสร้างที่ ตั้งค่าระบบ → ลาน</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Form Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
              ยกเลิก
            </button>
            <button onClick={handleSave}
              disabled={saving || !form.full_name || (!editingUser && (!form.username || !form.password))}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm shadow-violet-600/25">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1">
            {[
              { key: 'all' as const, label: 'ทั้งหมด', count: users.length },
              { key: 'staff' as const, label: 'พนักงาน', count: users.filter(u => u.role_code !== 'customer').length, icon: '👤' },
              { key: 'customer' as const, label: 'ลูกค้า', count: users.filter(u => u.role_code === 'customer').length, icon: '🏢' },
            ].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.key
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}>
                {t.icon && <span className="mr-1">{t.icon}</span>}
                {t.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  tab === t.key ? 'bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300' : 'bg-slate-100 dark:bg-slate-700'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="ค้นหาชื่อ, username..." className="h-9 pl-9 pr-3 w-48 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:border-violet-500 transition-all" />
          </div>
        </div>

      {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs text-slate-500 uppercase">
                <th className="px-5 py-3">ผู้ใช้</th>
                <th className="px-5 py-3">บทบาท</th>
                <th className="px-5 py-3">ลาน</th>
                <th className="px-5 py-3">สถานะ</th>
                <th className="px-5 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(() => {
                const filtered = users
                  .filter(u => tab === 'all' ? true : tab === 'customer' ? u.role_code === 'customer' : u.role_code !== 'customer')
                  .filter(u => !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()));
                const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
                const paginated = filtered.slice((page - 1) * perPage, page * perPage);
                return (<>
                  {paginated.map((user) => {
                const st = STATUS_MAP[user.status] || STATUS_MAP.active;
                const isCustomer = user.role_code === 'customer';
                const linkedCompany = isCustomer ? customers.find(c => c.customer_id === user.customer_id) : null;
                return (
                  <tr key={user.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white">{user.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{user.username}</span>
                          {linkedCompany && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
                              🏢 {linkedCompany.customer_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Shield size={14} className="text-[#8B5CF6]" />
                        {user.role_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <MapPin size={14} />
                        {user.yard_ids ? user.yard_ids.split(',').length + ' สาขา' : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                        {user.locked_at && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                            <Lock size={9} /> ถูกล็อค
                          </span>
                        )}
                        {!user.locked_at && (user.failed_login_count || 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            ⚠️ {user.failed_login_count}x
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.locked_at && (
                          <button onClick={async () => {
                            try {
                              const res = await fetch('/api/settings/users', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'unlock', user_id: user.user_id }),
                              });
                              const json = await res.json();
                              if (json.success) { toast('success', `ปลดล็อค ${user.username} เรียบร้อย`); fetchUsers(); }
                              else toast('error', json.error || 'ไม่สามารถปลดล็อคได้');
                            } catch { toast('error', 'เกิดข้อผิดพลาด'); }
                          }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                              text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                            <Unlock size={13} /> ปลดล็อค
                          </button>
                        )}
                        <button onClick={() => openEdit(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            text-slate-500 hover:text-[#8B5CF6] hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all">
                          <Pencil size={13} /> แก้ไข
                        </button>
                        <button onClick={() => handleDelete(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                          <Trash2 size={13} /> ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
                  {paginated.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">ไม่พบผู้ใช้</td></tr>
                  )}
                  {/* Pagination inside tbody context for totalPages access */}
                  <tr><td colSpan={5}>
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-xs text-slate-400">แสดง {((page-1)*perPage)+1}-{Math.min(page*perPage, filtered.length)} จาก {filtered.length} รายการ</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-all">
                          <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                          .map((p, idx, arr) => (
                            <span key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-slate-300 text-xs px-1">…</span>}
                              <button onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                                  p === page ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}>{p}</button>
                            </span>
                          ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-all">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </td></tr>
                </>);
              })()}
            </tbody>
          </table>
        </div>
      </div>
      {/* Granular RBAC — Permission Matrix */}
      <PermissionsMatrix />

      <ConfirmDialog open={confirmDlg.open} title="ยืนยันการลบ" message={confirmDlg.message} confirmLabel="ลบ"
        onConfirm={confirmDlg.action} onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />
    </div>
  );
}

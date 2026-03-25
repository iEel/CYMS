'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Save, Loader2, X, Shield, MapPin, Building } from 'lucide-react';
import PermissionsMatrix from './PermissionsMatrix';

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
}

interface CustomerOption {
  customer_id: number;
  customer_name: string;
  customer_type: string;
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
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState({
    username: '', password: '', full_name: '', email: '', phone: '',
    role_code: 'gate_clerk', status: 'active', yard_ids: [1] as number[],
    customer_id: null as number | null,
  });
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/customers');
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
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

  useEffect(() => { fetchUsers(); fetchCustomers(); }, [fetchUsers, fetchCustomers]);

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
        alert(json.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
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
        <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-[#8B5CF6]/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white">
              {editingUser ? `แก้ไข: ${editingUser.full_name}` : 'เพิ่มผู้ใช้ใหม่'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="ชื่อผู้ใช้ (Username) *" value={form.username} disabled={!!editingUser}
              onChange={e => setForm({...form, username: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white font-mono outline-none focus:border-[#8B5CF6] disabled:opacity-50" />
            <input type="password" placeholder={editingUser ? 'รหัสผ่านใหม่ (ไม่เปลี่ยนเว้นว่าง)' : 'รหัสผ่าน *'} value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#8B5CF6]" />
            <input type="text" placeholder="ชื่อ-นามสกุล *" value={form.full_name}
              onChange={e => setForm({...form, full_name: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#8B5CF6]" />
            <input type="email" placeholder="อีเมล" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#8B5CF6]" />
            <input type="text" placeholder="โทรศัพท์" value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#8B5CF6]" />
            <select value={form.role_code} onChange={e => setForm({...form, role_code: e.target.value, customer_id: e.target.value !== 'customer' ? null : form.customer_id})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#8B5CF6]">
              {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
            {form.role_code === 'customer' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">🏢 บริษัทลูกค้า *</label>
                <select value={form.customer_id || ''} onChange={e => setForm({...form, customer_id: e.target.value ? parseInt(e.target.value) : null})}
                  className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#8B5CF6]">
                  <option value="">-- เลือกบริษัท --</option>
                  {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                </select>
              </div>
            )}
            {editingUser && (
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#8B5CF6]">
                <option value="active">ใช้งาน</option>
                <option value="suspend">ระงับ</option>
                <option value="resign">ลาออก</option>
              </select>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleSave}
              disabled={saving || !form.full_name || (!editingUser && (!form.username || !form.password))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingUser ? 'อัปเดต' : 'เพิ่มผู้ใช้'}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
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
              {users.map((user) => {
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
                      <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => openEdit(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          text-slate-500 hover:text-[#8B5CF6] hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all">
                        <Pencil size={13} /> แก้ไข
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Granular RBAC — Permission Matrix */}
      <PermissionsMatrix />
    </div>
  );
}

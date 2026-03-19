'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Loader2, Search, Wrench, FileCheck2, Plus, Package, CheckCircle2,
  XCircle, Clock, AlertTriangle, RotateCcw, Send, ThumbsUp, Play,
  DollarSign, Ban, BookOpen, Camera, ImageIcon, Save,
} from 'lucide-react';

interface EORRow {
  eor_id: number; eor_number: string; container_number: string;
  size: string; type: string; customer_name: string;
  damage_details: string; estimated_cost: number; actual_cost: number;
  status: string; approved_at: string; created_name: string; created_at: string;
}

interface ContainerOption {
  container_id: number; container_number: string; size: string; type: string; shipping_line: string;
}

// Standard CEDEX-like damage codes — loaded from DB
interface CedexCode {
  cedex_id: number;
  code: string;
  component: string;
  damage: string;
  repair: string;
  labor_hours: number;
  material_cost: number;
  is_active: boolean;
}

export default function MnRPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'cedex'>('list');
  const yardId = session?.activeYardId || 1;

  // List
  const [orders, setOrders] = useState<EORRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Create
  const [searchText, setSearchText] = useState('');
  const [containers, setContainers] = useState<ContainerOption[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerOption | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [repairPhotos, setRepairPhotos] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);

  // CEDEX Management
  const [cedexCodes, setCedexCodes] = useState<CedexCode[]>([]);
  const [cedexLoading, setCedexLoading] = useState(false);
  const [showCedexForm, setShowCedexForm] = useState(false);
  const [editingCedex, setEditingCedex] = useState<CedexCode | null>(null);
  const [cedexForm, setCedexForm] = useState({
    code: '', component: '', damage: '', repair: '', labor_hours: 0, material_cost: 0,
  });
  const [cedexSaving, setCedexSaving] = useState(false);
  const [laborRate, setLaborRate] = useState(350);

  // Load labor rate from company settings
  useEffect(() => {
    fetch('/api/settings/company').then(r => r.json()).then(d => {
      if (d?.labor_rate) setLaborRate(d.labor_rate);
    }).catch(() => {});
  }, []);

  const fetchCedexCodes = useCallback(async () => {
    setCedexLoading(true);
    try {
      const res = await fetch('/api/mnr/cedex');
      const data = await res.json();
      setCedexCodes(data.codes || []);
    } catch (err) { console.error(err); }
    finally { setCedexLoading(false); }
  }, []);

  useEffect(() => { fetchCedexCodes(); }, [fetchCedexCodes]);

  const fetchOrders = useCallback(async () => {
    setListLoading(true);
    try {
      let url = `/api/mnr?yard_id=${yardId}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) { console.error(err); }
    finally { setListLoading(false); }
  }, [yardId, statusFilter]);

  useEffect(() => { if (activeTab === 'list') fetchOrders(); }, [activeTab, fetchOrders]);

  const searchContainers = async () => {
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&status=in_yard&search=${searchText}`);
      const data = await res.json();
      setContainers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const estimatedCost = selectedCodes.reduce((sum, code) => {
    const c = cedexCodes.find(cx => cx.code === code);
    return sum + (c ? c.labor_hours * laborRate + c.material_cost : 0);
  }, 0);

  const handleCreate = async () => {
    if (!selectedContainer || selectedCodes.length === 0) return;
    setCreateLoading(true); setCreateResult(null);
    try {
      const damages = selectedCodes.map(code => cedexCodes.find(cx => cx.code === code));
      const res = await fetch('/api/mnr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: selectedContainer.container_id, yard_id: yardId,
          damage_details: damages, estimated_cost: estimatedCost,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateResult({ success: true, message: `✅ สร้าง EOR ${data.eor_number} สำเร็จ — ราคาประเมิน ฿${estimatedCost.toLocaleString()} (พร้อมรูปถ่าย ${repairPhotos.length} รูป)` });
        setSelectedContainer(null); setSelectedCodes([]); setRepairPhotos([]);
      } else {
        setCreateResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); }
    finally { setCreateLoading(false); }
  };

  const handleSaveCedex = async () => {
    setCedexSaving(true);
    try {
      const url = '/api/mnr/cedex';
      const method = editingCedex ? 'PUT' : 'POST';
      const payload = editingCedex
        ? { ...cedexForm, cedex_id: editingCedex.cedex_id, is_active: editingCedex.is_active }
        : cedexForm;
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success || data.data) {
        setShowCedexForm(false);
        setEditingCedex(null);
        setCedexForm({ code: '', component: '', damage: '', repair: '', labor_hours: 0, material_cost: 0 });
        fetchCedexCodes();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) { console.error(err); }
    finally { setCedexSaving(false); }
  };

  const handleDeleteCedex = async (id: number) => {
    if (!confirm('ยืนยันลบรหัส CEDEX นี้?')) return;
    try {
      await fetch(`/api/mnr/cedex?id=${id}`, { method: 'DELETE' });
      fetchCedexCodes();
    } catch (err) { console.error(err); }
  };

  const startEditCedex = (c: CedexCode) => {
    setEditingCedex(c);
    setCedexForm({
      code: c.code, component: c.component, damage: c.damage,
      repair: c.repair, labor_hours: c.labor_hours, material_cost: c.material_cost,
    });
    setShowCedexForm(true);
  };

  const startCreateCedex = () => {
    setEditingCedex(null);
    setCedexForm({ code: '', component: '', damage: '', repair: '', labor_hours: 0, material_cost: 0 });
    setShowCedexForm(true);
  };

  const updateOrder = async (eorId: number, action: string) => {
    await fetch('/api/mnr', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eor_id: eorId, action }),
    });
    fetchOrders();
  };

  const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: 'ร่าง', color: 'bg-slate-100 text-slate-500', icon: <Clock size={10} /> },
    pending_approval: { label: 'รออนุมัติ', color: 'bg-amber-50 text-amber-600', icon: <Send size={10} /> },
    approved: { label: 'อนุมัติแล้ว', color: 'bg-blue-50 text-blue-600', icon: <ThumbsUp size={10} /> },
    in_repair: { label: 'กำลังซ่อม', color: 'bg-violet-50 text-violet-600', icon: <Wrench size={10} /> },
    completed: { label: 'เสร็จ', color: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle2 size={10} /> },
    rejected: { label: 'ปฏิเสธ', color: 'bg-rose-50 text-rose-500', icon: <Ban size={10} /> },
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">ซ่อมบำรุง M&R</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">สร้าง EOR, มาตรฐาน CEDEX, อนุมัติใบซ่อม</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'list' as const, label: 'รายการ EOR', icon: <FileCheck2 size={14} /> },
          { id: 'create' as const, label: 'สร้าง EOR', icon: <Plus size={14} /> },
          { id: 'cedex' as const, label: 'CEDEX Codes', icon: <BookOpen size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== EOR LIST TAB =================== */}
      {activeTab === 'list' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Wrench size={16} /> EOR ({orders.length})</h3>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
                <option value="">ทุกสถานะ</option>
                <option value="draft">ร่าง</option>
                <option value="pending_approval">รออนุมัติ</option>
                <option value="approved">อนุมัติ</option>
                <option value="in_repair">กำลังซ่อม</option>
                <option value="completed">เสร็จ</option>
              </select>
              <button onClick={fetchOrders} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
            </div>
          </div>

          {listLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ยังไม่มี EOR — กดแท็บ &quot;สร้าง EOR&quot; เพื่อเพิ่ม</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {orders.map(o => (
                <div key={o.eor_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wrench size={16} className="text-violet-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{o.eor_number}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${statusLabels[o.status]?.color}`}>
                            {statusLabels[o.status]?.icon} {statusLabels[o.status]?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span>🏷️ {o.container_number} {o.size}&apos;{o.type}</span>
                          <span>• ฿{(o.estimated_cost || 0).toLocaleString()}</span>
                          {o.actual_cost > 0 && <span>• จริง: ฿{o.actual_cost.toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {o.status === 'draft' && (
                        <button onClick={() => updateOrder(o.eor_id, 'submit')}
                          className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 flex items-center gap-1"><Send size={10} /> ส่งอนุมัติ</button>
                      )}
                      {o.status === 'pending_approval' && (
                        <>
                          <button onClick={() => updateOrder(o.eor_id, 'approve')}
                            className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 flex items-center gap-1"><ThumbsUp size={10} /> อนุมัติ</button>
                          <button onClick={() => updateOrder(o.eor_id, 'reject')}
                            className="px-1.5 py-1 rounded-lg text-slate-400 hover:text-red-500 text-xs"><XCircle size={14} /></button>
                        </>
                      )}
                      {o.status === 'approved' && (
                        <button onClick={() => updateOrder(o.eor_id, 'start_repair')}
                          className="px-2 py-1 rounded-lg bg-violet-50 text-violet-600 text-xs font-medium hover:bg-violet-100 flex items-center gap-1"><Play size={10} /> เริ่มซ่อม</button>
                      )}
                      {o.status === 'in_repair' && (
                        <button onClick={() => updateOrder(o.eor_id, 'complete')}
                          className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"><CheckCircle2 size={10} /> เสร็จ</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================== CREATE EOR TAB =================== */}
      {activeTab === 'create' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600"><Plus size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">สร้างใบ EOR ใหม่</h3>
                <p className="text-xs text-slate-400">เลือกตู้ + เลือกประเภทความเสียหาย → คำนวณราคา</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Select Container */}
            <div>
              <label className={labelClass}>เลือกตู้</label>
              <div className="flex gap-2">
                <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchContainers()}
                  className={`${inputClass} flex-1 font-mono`} placeholder="พิมพ์เลขตู้..." />
                <button onClick={searchContainers} className="h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 flex items-center gap-1.5">
                  <Search size={14} /> ค้นหา</button>
              </div>
            </div>

            {containers.length > 0 && !selectedContainer && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {containers.slice(0, 5).map(c => (
                  <button key={c.container_id} onClick={() => { setSelectedContainer(c); setContainers([]); }}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-300 text-xs">
                    <span className="font-mono font-semibold text-slate-800 dark:text-white">{c.container_number}</span>
                    <span className="text-slate-400 ml-2">{c.size}&apos;{c.type} • {c.shipping_line || '-'}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedContainer && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 text-xs text-violet-600">
                ✅ ตู้: <span className="font-mono font-bold">{selectedContainer.container_number}</span> ({selectedContainer.size}&apos;{selectedContainer.type})
              </div>
            )}

            {/* CEDEX Codes Selection */}
            <div>
              <label className={labelClass}>เลือกประเภทความเสียหาย (CEDEX)</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {cedexCodes.map((c: CedexCode) => (
                  <label key={c.code} className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedCodes.includes(c.code) ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}>
                    <input type="checkbox" checked={selectedCodes.includes(c.code)}
                      onChange={e => setSelectedCodes(e.target.checked ? [...selectedCodes, c.code] : selectedCodes.filter(x => x !== c.code))}
                      className="rounded border-slate-300" />
                    <span className="font-mono text-violet-600 font-semibold w-10">{c.code}</span>
                    <span className="flex-1 text-slate-700 dark:text-slate-300">{c.component} — {c.damage} → {c.repair}</span>
                    <span className="text-slate-400">฿{(c.labor_hours * laborRate + c.material_cost).toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedCodes.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 flex items-center justify-between">
                <span className="text-xs text-amber-600"><DollarSign size={12} className="inline" /> ราคาประเมินรวม</span>
                <span className="text-lg font-bold text-amber-700">฿{estimatedCost.toLocaleString()}</span>
              </div>
            )}

            {/* Repair Photos */}
            <div className="space-y-2">
              <label className={labelClass}>รูปถ่ายความเสียหาย / ประกอบ EOR</label>
              <div className="flex gap-2 flex-wrap">
                {repairPhotos.map((photo, i) => (
                  <div key={i} className="relative">
                    <img src={photo} alt={`repair ${i + 1}`} className="w-20 h-16 rounded-lg object-cover border border-slate-200" />
                    <button onClick={() => setRepairPhotos(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px]">✕</button>
                  </div>
                ))}
                <label className="w-20 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-violet-400 hover:text-violet-500 cursor-pointer transition-colors">
                  <Camera size={16} /> <span className="text-[8px] mt-0.5">เพิ่มรูป</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setRepairPhotos(prev => [...prev, reader.result as string]);
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                </label>
              </div>
              {repairPhotos.length > 0 && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1"><ImageIcon size={10} /> {repairPhotos.length} รูปแนบ</p>
              )}
            </div>

            <button onClick={handleCreate} disabled={createLoading || !selectedContainer || selectedCodes.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-all">
              {createLoading ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} สร้าง EOR
            </button>

            {createResult && (
              <div className={`p-3 rounded-xl text-sm ${createResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {createResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== CEDEX TAB =================== */}
      {activeTab === 'cedex' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><BookOpen size={16} /> CEDEX Damage Codes</h3>
            <button onClick={startCreateCedex}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition-colors">
              <Plus size={14} /> เพิ่มรหัส
            </button>
          </div>

          {/* Form Modal */}
          {showCedexForm && (
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-violet-50/50 dark:bg-violet-900/10">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">
                {editingCedex ? `แก้ไข ${editingCedex.code}` : 'เพิ่มรหัส CEDEX ใหม่'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">รหัส</label>
                  <input type="text" value={cedexForm.code}
                    onChange={e => setCedexForm({ ...cedexForm, code: e.target.value.toUpperCase() })}
                    placeholder="DT01" disabled={!!editingCedex}
                    className={`${inputClass} font-mono ${editingCedex ? 'opacity-50' : ''}`} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ชิ้นส่วน</label>
                  <input type="text" value={cedexForm.component}
                    onChange={e => setCedexForm({ ...cedexForm, component: e.target.value })}
                    placeholder="Panel" className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ความเสียหาย</label>
                  <input type="text" value={cedexForm.damage}
                    onChange={e => setCedexForm({ ...cedexForm, damage: e.target.value })}
                    placeholder="Dent" className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">วิธีซ่อม</label>
                  <input type="text" value={cedexForm.repair}
                    onChange={e => setCedexForm({ ...cedexForm, repair: e.target.value })}
                    placeholder="Straighten" className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ชม.แรงงาน</label>
                  <input type="number" step="0.5" value={cedexForm.labor_hours}
                    onChange={e => setCedexForm({ ...cedexForm, labor_hours: parseFloat(e.target.value) || 0 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ค่าวัสดุ (฿)</label>
                  <input type="number" step="50" value={cedexForm.material_cost}
                    onChange={e => setCedexForm({ ...cedexForm, material_cost: parseFloat(e.target.value) || 0 })}
                    className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={handleSaveCedex} disabled={cedexSaving || !cedexForm.code || !cedexForm.component}
                  className="px-4 py-2 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
                  {cedexSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingCedex ? 'บันทึก' : 'เพิ่ม'}
                </button>
                <button onClick={() => { setShowCedexForm(false); setEditingCedex(null); }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-300">
                  ยกเลิก
                </button>
                <span className="text-xs text-slate-400 ml-2">
                  รวม: ฿{(cedexForm.labor_hours * laborRate + cedexForm.material_cost).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {cedexLoading ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" size={24} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">รหัส</th>
                    <th className="text-left px-4 py-2.5 font-semibold">ชิ้นส่วน</th>
                    <th className="text-left px-4 py-2.5 font-semibold">ความเสียหาย</th>
                    <th className="text-left px-4 py-2.5 font-semibold">วิธีซ่อม</th>
                    <th className="text-right px-4 py-2.5 font-semibold">ชม.แรงงาน</th>
                    <th className="text-right px-4 py-2.5 font-semibold">ค่าวัสดุ</th>
                    <th className="text-right px-4 py-2.5 font-semibold">รวม (฿)</th>
                    <th className="text-center px-4 py-2.5 font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {cedexCodes.map((c: CedexCode) => (
                    <tr key={c.cedex_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-violet-600">{c.code}</td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{c.component}</td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{c.damage}</td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{c.repair}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{c.labor_hours}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">฿{c.material_cost.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-white">฿{(c.labor_hours * laborRate + c.material_cost).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEditCedex(c)}
                            className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                            <Wrench size={12} />
                          </button>
                          <button onClick={() => handleDeleteCedex(c.cedex_id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded">
                            <Ban size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {cedexCodes.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">ยังไม่มีรหัส CEDEX — กดปุ่ม "เพิ่มรหัส" หรือรัน migration</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400">
            ทั้งหมด {cedexCodes.length} รายการ | อัตราแรงงาน {laborRate.toLocaleString()} ฿/ชม. (ตั้งค่าได้ที่หน้าตั้งค่าระบบ)
          </div>
        </div>
      )}
    </div>
  );
}

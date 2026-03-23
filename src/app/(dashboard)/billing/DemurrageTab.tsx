'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, Clock, Search, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import dynamic from 'next/dynamic';

const ContainerTimeline = dynamic(() => import('@/components/containers/ContainerTimeline'), { ssr: false });

interface DemurrageContainer {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  gate_in_date: string;
  dwell_days: number;
  free_days: number;
  over_days: number;
  days_until_demurrage: number;
  daily_rate: number;
  demurrage_amount: number;
  risk_level: 'exceeded' | 'warning' | 'safe';
}

interface DemurrageRate {
  demurrage_id: number;
  charge_type: string;
  free_days: number;
  rate_20: number;
  rate_40: number;
  rate_45: number;
  description: string;
  customer_name?: string;
  is_active: boolean;
}

interface DemurrageSummary {
  total: number;
  exceeded: number;
  warning: number;
  safe: number;
  total_demurrage: number;
}

interface DemurrageTabProps {
  yardId: number;
}

export default function DemurrageTab({ yardId }: DemurrageTabProps) {
  const [containers, setContainers] = useState<DemurrageContainer[]>([]);
  const [summary, setSummary] = useState<DemurrageSummary>({ total: 0, exceeded: 0, warning: 0, safe: 0, total_demurrage: 0 });
  const [rates, setRates] = useState<DemurrageRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'exceeded' | 'warning' | 'safe'>('all');
  const [search, setSearch] = useState('');
  const [showRates, setShowRates] = useState(false);
  const [timelineId, setTimelineId] = useState<number | null>(null);

  // Calculator
  const [calcId, setCalcId] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Rate editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ free_days: 0, rate_20: 0, rate_40: 0, rate_45: 0, description: '' });
  const [addForm, setAddForm] = useState({ charge_type: 'demurrage', free_days: 7, rate_20: 0, rate_40: 0, rate_45: 0, description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 25;

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/demurrage?yard_id=${yardId}&mode=overview`);
      const data = await res.json();
      setContainers(data.containers || []);
      setSummary(data.summary || { total: 0, exceeded: 0, warning: 0, safe: 0, total_demurrage: 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [yardId]);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/demurrage?yard_id=${yardId}`);
      const data = await res.json();
      setRates(data.rates || []);
    } catch (e) { console.error(e); }
  }, [yardId]);

  useEffect(() => { fetchOverview(); fetchRates(); }, [fetchOverview, fetchRates]);

  const calculateSingle = async (containerId: number) => {
    setCalcId(containerId);
    setCalcLoading(true);
    try {
      const res = await fetch(`/api/billing/demurrage?yard_id=${yardId}&container_id=${containerId}`);
      const data = await res.json();
      setCalcResult(data);
    } catch (e) { console.error(e); }
    finally { setCalcLoading(false); }
  };

  const startEdit = (rate: DemurrageRate) => {
    setEditingId(rate.demurrage_id);
    setEditForm({ free_days: rate.free_days, rate_20: rate.rate_20, rate_40: rate.rate_40, rate_45: rate.rate_45, description: rate.description });
  };

  const saveRate = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await fetch('/api/billing/demurrage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demurrage_id: editingId, ...editForm }),
      });
      setEditingId(null);
      fetchRates();
      fetchOverview();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const addRate = async () => {
    setSaving(true);
    try {
      await fetch('/api/billing/demurrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, ...addForm }),
      });
      setShowAddForm(false);
      setAddForm({ charge_type: 'demurrage', free_days: 7, rate_20: 0, rate_40: 0, rate_45: 0, description: '' });
      fetchRates();
      fetchOverview();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const deleteRate = async (id: number) => {
    if (!confirm('ต้องการลบ rate นี้?')) return;
    try {
      await fetch('/api/billing/demurrage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demurrage_id: id, action: 'delete' }),
      });
      fetchRates();
      fetchOverview();
    } catch (e) { console.error(e); }
  };

  const filteredContainers = containers.filter(c => {
    if (filter !== 'all' && c.risk_level !== filter) return false;
    if (search && !c.container_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Reset page on filter/search change
  useEffect(() => { setCurrentPage(1); }, [filter, search]);

  const totalPages = Math.ceil(filteredContainers.length / perPage);
  const paginated = filteredContainers.slice((currentPage - 1) * perPage, currentPage * perPage);

  const RISK_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    exceeded: { bg: 'bg-rose-100 dark:bg-rose-900/20', text: 'text-rose-700', label: '🔴 เกินกำหนด' },
    warning: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700', label: '🟡 ใกล้ครบ' },
    safe: { bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-700', label: '🟢 ปลอดภัย' },
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-';

  const inputSm = "h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-right w-20 font-mono";

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'ตู้ทั้งหมด', value: summary.total, color: 'text-slate-800 dark:text-white', icon: '📦' },
          { label: 'เกินกำหนด', value: summary.exceeded, color: 'text-rose-600', icon: '🔴', click: () => setFilter('exceeded') },
          { label: 'ใกล้ครบ', value: summary.warning, color: 'text-amber-600', icon: '🟡', click: () => setFilter('warning') },
          { label: 'ปลอดภัย', value: summary.safe, color: 'text-emerald-600', icon: '🟢', click: () => setFilter('safe') },
          { label: 'ค่า Demurrage รวม', value: `฿${summary.total_demurrage.toLocaleString()}`, color: 'text-blue-600', icon: '💰' },
        ].map((kpi, i) => (
          <button key={i} onClick={kpi.click || (() => setFilter('all'))}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:border-blue-300 transition-colors">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-1">{kpi.icon} {kpi.label}</div>
            <p className={`text-lg font-bold ${kpi.color}`}>{typeof kpi.value === 'number' ? kpi.value : kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาเลขตู้..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {(['all', 'exceeded', 'warning', 'safe'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'
              }`}>
              {f === 'all' ? 'ทั้งหมด' : f === 'exceeded' ? '🔴 เกิน' : f === 'warning' ? '🟡 ใกล้' : '🟢 ปลอดภัย'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowRates(!showRates)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-medium hover:bg-indigo-100">
          <Calculator size={14} /> ตั้งค่า Rates {showRates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Rates Config — Editable */}
      {showRates && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">⚙️ Demurrage / Detention Rates</h3>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-medium hover:bg-emerald-100">
              + เพิ่ม Rate
            </button>
          </div>

          {/* Add New Rate Form */}
          {showAddForm && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">➕ เพิ่ม Rate ใหม่</p>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">ประเภท</label>
                  <select value={addForm.charge_type} onChange={e => setAddForm({...addForm, charge_type: e.target.value})}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-full">
                    <option value="demurrage">Demurrage</option>
                    <option value="detention">Detention</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-0.5">คำอธิบาย</label>
                  <input type="text" value={addForm.description} onChange={e => setAddForm({...addForm, description: e.target.value})}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs w-full" placeholder="เช่น Demurrage สายเรือ A" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Free Days</label>
                  <input type="number" value={addForm.free_days} onChange={e => setAddForm({...addForm, free_days: +e.target.value})} className={inputSm} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">20&apos; ฿/วัน</label>
                  <input type="number" value={addForm.rate_20} onChange={e => setAddForm({...addForm, rate_20: +e.target.value})} className={inputSm} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">40&apos; ฿/วัน</label>
                  <input type="number" value={addForm.rate_40} onChange={e => setAddForm({...addForm, rate_40: +e.target.value})} className={inputSm} />
                </div>
                <div className="flex gap-1">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-0.5">45&apos;</label>
                    <input type="number" value={addForm.rate_45} onChange={e => setAddForm({...addForm, rate_45: +e.target.value})} className={inputSm} />
                  </div>
                  <button onClick={addRate} disabled={saving}
                    className="self-end h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                    {saving ? '...' : '✓ บันทึก'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {rates.length === 0 ? (
            <p className="text-xs text-slate-400">ยังไม่มี rate — กดปุ่ม &quot;+ เพิ่ม Rate&quot; เพื่อเริ่มต้น</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-600 text-slate-500">
                    <th className="text-left py-2 px-2">ประเภท</th>
                    <th className="text-left py-2 px-2">คำอธิบาย</th>
                    <th className="text-right py-2 px-2">Free Days</th>
                    <th className="text-right py-2 px-2">20&apos;</th>
                    <th className="text-right py-2 px-2">40&apos;</th>
                    <th className="text-right py-2 px-2">45&apos;</th>
                    <th className="text-left py-2 px-2">ลูกค้า</th>
                    <th className="text-center py-2 px-2">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.filter(r => r.is_active).map(rate => (
                    <tr key={rate.demurrage_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          rate.charge_type === 'demurrage' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>{rate.charge_type === 'demurrage' ? 'Demurrage' : 'Detention'}</span>
                      </td>
                      {editingId === rate.demurrage_id ? (
                        <>
                          <td className="py-1 px-1"><input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="h-7 px-2 rounded border border-blue-300 text-xs w-full bg-white dark:bg-slate-700" /></td>
                          <td className="py-1 px-1"><input type="number" value={editForm.free_days} onChange={e => setEditForm({...editForm, free_days: +e.target.value})} className="h-7 px-1 rounded border border-blue-300 text-xs w-14 text-right bg-white dark:bg-slate-700 font-mono" /></td>
                          <td className="py-1 px-1"><input type="number" value={editForm.rate_20} onChange={e => setEditForm({...editForm, rate_20: +e.target.value})} className="h-7 px-1 rounded border border-blue-300 text-xs w-16 text-right bg-white dark:bg-slate-700 font-mono" /></td>
                          <td className="py-1 px-1"><input type="number" value={editForm.rate_40} onChange={e => setEditForm({...editForm, rate_40: +e.target.value})} className="h-7 px-1 rounded border border-blue-300 text-xs w-16 text-right bg-white dark:bg-slate-700 font-mono" /></td>
                          <td className="py-1 px-1"><input type="number" value={editForm.rate_45} onChange={e => setEditForm({...editForm, rate_45: +e.target.value})} className="h-7 px-1 rounded border border-blue-300 text-xs w-16 text-right bg-white dark:bg-slate-700 font-mono" /></td>
                          <td className="py-2 px-2 text-slate-400">{rate.customer_name || 'ทุกลูกค้า'}</td>
                          <td className="py-1 px-1 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={saveRate} disabled={saving} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-medium hover:bg-emerald-700">{saving ? '...' : '✓'}</button>
                              <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px]">✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-2 text-slate-700 dark:text-slate-300">{rate.description}</td>
                          <td className="py-2 px-2 text-right font-mono">{rate.free_days}</td>
                          <td className="py-2 px-2 text-right font-mono">฿{rate.rate_20?.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right font-mono">฿{rate.rate_40?.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right font-mono">฿{rate.rate_45?.toLocaleString()}</td>
                          <td className="py-2 px-2 text-slate-400">{rate.customer_name || 'ทุกลูกค้า'}</td>
                          <td className="py-1 px-1 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => startEdit(rate)} className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-medium hover:bg-blue-100">✏️</button>
                              <button onClick={() => deleteRate(rate.demurrage_id)} className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-[10px] font-medium hover:bg-rose-100">🗑</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Container List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : filteredContainers.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">ไม่พบตู้</div>
      ) : (
        <div className="space-y-2">
          {paginated.map(c => {
            const badge = RISK_BADGE[c.risk_level] || RISK_BADGE.safe;
            const isCalcOpen = calcId === c.container_id;
            return (
              <div key={c.container_id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-800 dark:text-white">{c.container_number}</span>
                      <span className="text-[10px] text-slate-400">{c.size}&apos;{c.type}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                      <span>🚢 {c.shipping_line || '-'}</span>
                      <span>📥 {formatDate(c.gate_in_date)}</span>
                      <span>🕐 {c.dwell_days} วัน</span>
                      <span>Free: {c.free_days} วัน</span>
                      {c.over_days > 0 && <span className="text-rose-600 font-semibold">เกิน {c.over_days} วัน</span>}
                      {c.days_until_demurrage > 0 && c.days_until_demurrage <= 3 && (
                        <span className="text-amber-600 font-semibold flex items-center gap-0.5"><AlertTriangle size={10} /> เหลือ {c.days_until_demurrage} วัน</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {c.demurrage_amount > 0 && (
                      <p className="text-sm font-bold text-rose-600">฿{c.demurrage_amount.toLocaleString()}</p>
                    )}
                    <p className="text-[10px] text-slate-400">฿{c.daily_rate}/วัน</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => calculateSingle(c.container_id)}
                      className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 text-xs" title="คำนวณ">
                      <Calculator size={14} />
                    </button>
                    <button onClick={() => setTimelineId(c.container_id)}
                      className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 text-xs" title="Timeline">
                      <Clock size={14} />
                    </button>
                  </div>
                </div>

                {/* Calculator Result */}
                {isCalcOpen && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-3">
                    {calcLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> กำลังคำนวณ...</div>
                    ) : calcResult ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">📊 รายละเอียดค่าใช้จ่าย</h4>
                        {calcResult.charges?.map((ch: { charge_type: string; description: string; free_days: number; over_days: number; daily_rate: number; amount: number; is_applicable: boolean }, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                ch.charge_type === 'demurrage' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              }`}>{ch.charge_type}</span>
                              <span className="ml-2 text-slate-600 dark:text-slate-300">{ch.description}</span>
                            </div>
                            <div className="text-right">
                              {ch.is_applicable ? (
                                <span className="font-bold text-rose-600">฿{ch.amount.toLocaleString()} ({ch.over_days}d × ฿{ch.daily_rate})</span>
                              ) : (
                                <span className="text-emerald-600 text-[10px]">✅ ยังไม่เกิน free {ch.free_days} วัน</span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-600 flex justify-between text-xs font-bold">
                          <span>รวม Demurrage + Detention</span>
                          <span className="text-rose-600">฿{((calcResult.total_demurrage || 0) + (calcResult.total_detention || 0)).toLocaleString()}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <span className="text-xs text-slate-400">
            แสดง {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filteredContainers.length)} จาก {filteredContainers.length} ตู้
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
              className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">«</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    page === currentPage ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}>{page}</button>
              );
            })}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">›</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
              className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">»</button>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {timelineId && <ContainerTimeline containerId={timelineId} onClose={() => setTimelineId(null)} />}
    </div>
  );
}

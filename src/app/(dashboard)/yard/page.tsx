'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatShortDate } from '@/lib/utils';
import ContainerSearch from '@/components/yard/ContainerSearch';
import YardAudit from '@/components/yard/YardAudit';
import ContainerCardPWA from '@/components/yard/ContainerCardPWA';
import BayCrossSection from '@/components/yard/BayCrossSection';
import ContainerDetailModal from '@/components/yard/ContainerDetailModal';

const ContainerTimeline = dynamic(() => import('@/components/containers/ContainerTimeline'), { ssr: false });
import {
  MapPin, Search, Filter, ChevronDown, Cuboid, ClipboardCheck, SearchIcon,
  Box, Snowflake, AlertTriangle, Wrench, Trash2, Layers, LayoutGrid, Wand2, Loader2, CheckCircle2, Star, Clock, TrendingUp,
} from 'lucide-react';

const YardViewer3D = dynamic(() => import('@/components/yard/YardViewer3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] rounded-xl bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

interface ZoneData {
  zone_id: number;
  zone_name: string;
  zone_type: string;
  max_bay: number;
  max_row: number;
  max_tier: number;
  container_count: number;
  capacity: number;
  occupancy_pct: number;
}

interface ContainerData {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  status: string;
  yard_name: string;
  zone_name: string;
  zone_type: string;
  bay: number;
  row: number;
  tier: number;
  shipping_line: string;
  is_laden: boolean;
  gate_in_date: string;
}

const ZONE_ICONS: Record<string, React.ReactNode> = {
  dry: <Box size={16} />,
  reefer: <Snowflake size={16} />,
  hazmat: <AlertTriangle size={16} />,
  empty: <Trash2 size={16} />,
  repair: <Wrench size={16} />,
  wash: <Layers size={16} />,
};

const ZONE_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  dry:    { bg: 'bg-blue-50 dark:bg-blue-900/20', bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  reefer: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', bar: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
  hazmat: { bg: 'bg-red-50 dark:bg-red-900/20', bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  empty:  { bg: 'bg-slate-50 dark:bg-slate-700/30', bar: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
  repair: { bg: 'bg-amber-50 dark:bg-amber-900/20', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  wash:   { bg: 'bg-emerald-50 dark:bg-emerald-900/20', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  in_yard:    { label: 'ในลาน', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  hold:       { label: 'ค้างจ่าย', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  repair:     { label: 'ซ่อม', color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  gated_out:  { label: 'ปล่อยแล้ว', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  available:  { label: 'ว่าง', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
};

export default function YardPage() {
  const { session } = useAuth();
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [containers, setContainers] = useState<ContainerData[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'bay'>('2d');
  const [selectedContainer, setSelectedContainer] = useState<ContainerData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'dwell' | 'search' | 'allocate' | 'audit'>('overview');
  const [dwellThreshold, setDwellThreshold] = useState(7);
  const [dwellPage, setDwellPage] = useState(1);
  const dwellPerPage = 20;
  const [highlightNumber, setHighlightNumber] = useState<string>('');
  const [detailContainerId, setDetailContainerId] = useState<number | null>(null);
  const [timelineId, setTimelineId] = useState<number | null>(null);

  // Allocate state
  const [allocForm, setAllocForm] = useState({ size: '20', type: 'GP', shipping_line: '', container_number: '' });
  const [allocSuggestions, setAllocSuggestions] = useState<Array<{ zone_name: string; zone_id: number; bay: number; row: number; tier: number; reason: string; score: number }>>([]);
  const [allocSelected, setAllocSelected] = useState<number | null>(null);
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocSaving, setAllocSaving] = useState(false);
  const [allocResult, setAllocResult] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 25;

  const yardId = session?.activeYardId || 1;

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, containersRes] = await Promise.all([
        fetch(`/api/yard/stats?yard_id=${yardId}`),
        fetch(`/api/containers?yard_id=${yardId}`),
      ]);
      const stats = await statsRes.json();
      const ctrs = await containersRes.json();
      setZones(stats.zones || []);
      setSummary(stats.summary || {});
      setContainers(ctrs || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [yardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter containers
  const filtered = containers.filter(c => {
    if (search && !c.container_number.toLowerCase().includes(search.toLowerCase())
        && !c.shipping_line?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterZone && String(c.zone_name) !== filterZone) return false;
    if (filterStatus) {
      if (c.status !== filterStatus) return false;
    } else {
      // By default, hide gated_out containers
      if (c.status === 'gated_out') return false;
    }
    return true;
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterZone, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="skeleton h-64" />
      </div>
    );
  }

  const totalCapacity = zones.reduce((s, z) => s + z.capacity, 0);
  const totalUsed = zones.reduce((s, z) => s + z.container_count, 0);
  const overallPct = totalCapacity > 0 ? (totalUsed / totalCapacity * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">🏗️ จัดการลาน</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            ภาพรวมโซนและตู้ทั้งหมด — อัตราเต็ม {overallPct.toFixed(1)}%
          </p>
        </div>
        {/* 2D / 3D Toggle */}
        <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
          <button onClick={() => setViewMode('2d')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === '2d' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <LayoutGrid size={16} /> 2D
          </button>
          <button onClick={() => setViewMode('bay')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'bay' ? 'bg-[#10B981] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Layers size={16} /> Bay
          </button>
          <button onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === '3d' ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Cuboid size={16} /> 3D
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
        {[
          { id: 'overview' as const, label: 'ภาพรวม', icon: <LayoutGrid size={14} /> },
          { id: 'dwell' as const, label: 'Dwell Time', icon: <TrendingUp size={14} /> },
          { id: 'search' as const, label: 'ค้นหาตู้', icon: <Search size={14} /> },
          { id: 'allocate' as const, label: 'จัดวางตู้', icon: <Wand2 size={14} /> },
          { id: 'audit' as const, label: 'ตรวจนับ', icon: <ClipboardCheck size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'ตู้ทั้งหมด', value: summary.total || 0, color: 'text-slate-800 dark:text-white' },
          { label: 'ในลาน', value: summary.in_yard || 0, color: 'text-emerald-600' },
          { label: 'ค้างจ่าย', value: summary.on_hold || 0, color: 'text-amber-600' },
          { label: 'ซ่อม', value: summary.in_repair || 0, color: 'text-rose-600' },
          { label: 'อัตราเต็ม', value: `${overallPct.toFixed(1)}%`, color: overallPct > 80 ? 'text-rose-600' : 'text-blue-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* View Mode */}
          {viewMode === '3d' ? (
            <div className="space-y-4">
              {/* 3D Viewer */}
              <YardViewer3D
                yardId={yardId}
                selectedZone={filterZone || undefined}
                onSelectContainer={(c) => setSelectedContainer(c as ContainerData | null)}
              />

              {/* Selected Container Detail */}
              {selectedContainer && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#3B82F6]">
                        <Box size={20} />
                      </div>
                      <div>
                        <p className="font-mono font-bold text-lg text-slate-800 dark:text-white">{selectedContainer.container_number}</p>
                        <p className="text-xs text-slate-400">
                          {selectedContainer.size}&apos;{selectedContainer.type} • {selectedContainer.shipping_line} • Zone {selectedContainer.zone_name} B{selectedContainer.bay}-R{selectedContainer.row}-T{selectedContainer.tier}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedContainer(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
                  </div>
                </div>
              )}

              {/* Zone filter cards (compact) */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setFilterZone('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    !filterZone ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700'
                  }`}>ทั้งหมด</button>
                {zones.map(z => (
                  <button key={z.zone_id} onClick={() => setFilterZone(filterZone === z.zone_name ? '' : z.zone_name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      filterZone === z.zone_name ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700'
                    }`}>
                    Zone {z.zone_name} ({z.container_count})
                  </button>
                ))}
              </div>
            </div>
          ) : viewMode === 'bay' ? (
            /* Bay Cross-Section View */
            <BayCrossSection
              yardId={yardId}
              onSelectContainer={(c) => setSelectedContainer(c as ContainerData | null)}
            />
          ) : (
            /* 2D Zone Map — Visual Cards */
            <div>
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                <MapPin size={16} /> แผนผังโซน
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {zones.map((zone) => {
                  const zc = ZONE_COLORS[zone.zone_type] || ZONE_COLORS.dry;
                  const pct = zone.occupancy_pct || 0;
                  return (
                    <button
                      key={zone.zone_id}
                      onClick={() => setFilterZone(filterZone === zone.zone_name ? '' : zone.zone_name)}
                      className={`relative rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-md
                        ${filterZone === zone.zone_name
                          ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-800'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`${zc.text}`}>{ZONE_ICONS[zone.zone_type]}</span>
                          <span className="font-bold text-slate-800 dark:text-white text-lg">{zone.zone_name}</span>
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${zc.bg} ${zc.text}`}>
                          {zone.zone_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">
                        {zone.container_count}/{zone.capacity} ตู้ • {zone.max_bay}×{zone.max_row}×{zone.max_tier}
                      </p>
                      {/* Occupancy Bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct > 85 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : zc.bar
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className={`text-right text-[10px] mt-1 font-semibold ${
                        pct > 85 ? 'text-rose-500' : pct > 60 ? 'text-amber-500' : 'text-slate-400'
                      }`}>
                        {pct.toFixed(0)}%
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Container Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            {/* Search & Filters */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขตู้, สายเรือ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                    text-sm text-slate-800 dark:text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div className="relative">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-10 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                    text-sm text-slate-800 dark:text-white outline-none appearance-none">
                  <option value="">ทุกสถานะ</option>
                  <option value="in_yard">ในลาน</option>
                  <option value="hold">ค้างจ่าย</option>
                  <option value="repair">ซ่อม</option>
                  <option value="gated_out">ปล่อยแล้ว</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-xs text-slate-400">
                แสดง {filtered.length} / {containers.length} ตู้
                {filterZone && <span className="ml-1 text-blue-500 font-medium">• Zone {filterZone}</span>}
              </span>
            </div>

            {/* Desktop: Table view (hidden on mobile) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs text-slate-500 uppercase">
                    <th className="px-4 py-3">เลขตู้</th>
                    <th className="px-4 py-3">ขนาด/ประเภท</th>
                    <th className="px-4 py-3">โซน</th>
                    <th className="px-4 py-3">พิกัด</th>
                    <th className="px-4 py-3">สายเรือ</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">สินค้า</th>
                    <th className="px-4 py-3">เข้าลานเมื่อ</th>
                    <th className="px-4 py-3">อยู่ในลาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginated.map((c) => {
                    const st = STATUS_LABELS[c.status] || STATUS_LABELS.available;
                    return (
                      <tr key={c.container_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setDetailContainerId(c.container_id)}>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-slate-800 dark:text-white">
                            {c.container_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">
                            {c.size}&apos;{c.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${ZONE_COLORS[c.zone_type]?.text || 'text-slate-500'}`}>
                            {c.zone_name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {c.bay && c.row && c.tier ? `B${c.bay}-R${c.row}-T${c.tier}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{c.shipping_line || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.is_laden ? (
                            <span className="inline-flex w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center text-emerald-600 text-[10px] font-bold">F</span>
                          ) : (
                            <span className="inline-flex w-5 h-5 rounded bg-slate-100 dark:bg-slate-700 items-center justify-center text-slate-400 text-[10px] font-bold">E</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {c.gate_in_date ? (
                            <div>
                              <span>{formatShortDate(c.gate_in_date)}</span>
                              <span className="ml-1 text-slate-500 dark:text-slate-400">
                                {new Date(c.gate_in_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              </span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {c.gate_in_date ? (() => {
                              const days = Math.floor((Date.now() - new Date(c.gate_in_date).getTime()) / 86400000);
                              const color = days <= 7
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : days <= 14
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                              return <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${color}`}>{days} วัน</span>;
                            })() : '—'}
                            <button onClick={(e) => { e.stopPropagation(); setTimelineId(c.container_id); }}
                              className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:bg-indigo-100 transition-colors" title="Timeline">
                              <Clock size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile: Card view (shown only on mobile) */}
            <div className="md:hidden">
              <ContainerCardPWA yardId={yardId} containers={paginated} />
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  แสดง {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filtered.length)} จาก {filtered.length} ตู้
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                    className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-default">«</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-default">‹</button>
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
                          page === currentPage
                            ? 'bg-blue-500 text-white'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}>{page}</button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-default">›</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                    className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-default">»</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'dwell' && (() => {
        // Compute dwell days for all in-yard containers
        const now = Date.now();
        const dwellContainers = containers
          .filter(c => c.status !== 'gated_out' && c.gate_in_date)
          .map(c => ({
            ...c,
            days: Math.floor((now - new Date(c.gate_in_date).getTime()) / 86400000),
          }))
          .sort((a, b) => b.days - a.days);

        const overdue = dwellContainers.filter(c => c.days > 30).length;
        const chargeable = dwellContainers.filter(c => c.days > dwellThreshold && c.days <= 30).length;
        const inFree = dwellContainers.filter(c => c.days <= dwellThreshold).length;
        const avgDays = dwellContainers.length > 0
          ? (dwellContainers.reduce((s, c) => s + c.days, 0) / dwellContainers.length).toFixed(1)
          : '0';
        const filtered30 = dwellContainers.filter(c => c.days >= dwellThreshold);
        const dwellTotalPages = Math.max(1, Math.ceil(filtered30.length / dwellPerPage));
        const dwellPaginated = filtered30.slice((dwellPage - 1) * dwellPerPage, dwellPage * dwellPerPage);

        return (
          <div className="space-y-4">
            {/* Summary Cards — improved */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Overdue */}
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl border-2 border-rose-200 dark:border-rose-800/50 p-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 dark:bg-rose-500/5 rounded-bl-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 text-base">🚨</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Overdue</p>
                    <p className="text-[9px] text-rose-400">&gt;30 วัน</p>
                  </div>
                </div>
                <p className="text-4xl font-black text-rose-600">{overdue}</p>
                <p className="text-[10px] text-rose-400 mt-1">{dwellContainers.length > 0 ? ((overdue / dwellContainers.length) * 100).toFixed(0) : 0}% ของทั้งหมด</p>
              </div>
              {/* Chargeable */}
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl border-2 border-amber-200 dark:border-amber-800/50 p-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 dark:bg-amber-500/5 rounded-bl-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-base">💰</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Chargeable</p>
                    <p className="text-[9px] text-amber-400">&gt;{dwellThreshold} วัน</p>
                  </div>
                </div>
                <p className="text-4xl font-black text-amber-600">{chargeable}</p>
                <p className="text-[10px] text-amber-400 mt-1">คิดค่าฝากแล้ว</p>
              </div>
              {/* Free */}
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/50 p-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-bl-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-base">✅</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Free Period</p>
                    <p className="text-[9px] text-emerald-400">≤{dwellThreshold} วัน</p>
                  </div>
                </div>
                <p className="text-4xl font-black text-emerald-600">{inFree}</p>
                <p className="text-[10px] text-emerald-400 mt-1">ยังไม่คิดค่าฝาก</p>
              </div>
              {/* Avg */}
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-200 dark:border-blue-800/50 p-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 dark:bg-blue-500/5 rounded-bl-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-base">⏱️</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Avg Dwell</p>
                    <p className="text-[9px] text-blue-400">ค่าเฉลี่ย</p>
                  </div>
                </div>
                <p className="text-4xl font-black text-blue-600">{avgDays}</p>
                <p className="text-[10px] text-blue-400 mt-1">วัน / ตู้</p>
              </div>
            </div>

            {/* Filter Bar — improved */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500">📋 แสดงตู้ที่อยู่เกิน:</span>
              <div className="flex gap-1.5">
                {[{ d: 3, label: '3 วัน' }, { d: 7, label: '7 วัน' }, { d: 14, label: '14 วัน' }, { d: 30, label: '30 วัน' }].map(({ d, label }) => (
                  <button key={d} onClick={() => { setDwellThreshold(d); setDwellPage(1); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      dwellThreshold === d
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Overdue
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-2"></span> Chargeable
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block ml-2"></span> &lt;{dwellThreshold} วัน
                <span className="text-slate-300 mx-1">|</span>
                <span className="font-medium text-slate-500">{filtered30.length} รายการ</span>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-left text-[10px] text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3 font-semibold">เลขตู้</th>
                      <th className="px-4 py-3 font-semibold">สายเรือ</th>
                      <th className="px-4 py-3 font-semibold">ขนาด/ประเภท</th>
                      <th className="px-4 py-3 font-semibold">โซน/พิกัด</th>
                      <th className="px-4 py-3 font-semibold">เข้าลานเมื่อ</th>
                      <th className="px-4 py-3 font-semibold text-center">วันในลาน</th>
                      <th className="px-4 py-3 font-semibold text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filtered30.length === 0 ? (
                      <tr><td colSpan={7} className="p-12 text-center">
                        <div className="text-3xl mb-2">🎉</div>
                        <p className="text-slate-500 font-medium">ไม่มีตู้ที่อยู่นานเกิน {dwellThreshold} วัน</p>
                        <p className="text-slate-400 text-xs mt-1">ทุกตู้อยู่ในช่วง Free Period</p>
                      </td></tr>
                    ) : dwellPaginated.map(c => {
                      const isOverdue = c.days > 30;
                      const isWarn = c.days > 14 && !isOverdue;
                      const barPct = Math.min(100, (c.days / 45) * 100);
                      const barColor = isOverdue ? 'bg-rose-500' : isWarn ? 'bg-amber-400' : 'bg-blue-400';
                      const badgeCls = isOverdue
                        ? 'bg-rose-600 text-white'
                        : isWarn
                        ? 'bg-amber-500 text-white'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                      return (
                        <tr key={c.container_id}
                          className={`cursor-pointer transition-all group ${
                            isOverdue
                              ? 'bg-rose-50/60 dark:bg-rose-900/10 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                          }`}
                          onClick={() => setDetailContainerId(c.container_id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isOverdue && <span className="w-1.5 h-8 rounded-full bg-rose-500 shrink-0" />}
                              <div>
                                <span className="font-mono font-bold text-slate-800 dark:text-white text-sm">{c.container_number}</span>
                                {isOverdue && (
                                  <span className="ml-2 text-[9px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded-full tracking-wider">OVERDUE</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 font-medium">{c.shipping_line || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg font-mono font-semibold text-slate-700 dark:text-slate-200">{c.size}&apos;{c.type}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {c.zone_name ? (
                              <span className="font-medium text-slate-700 dark:text-slate-300">Zone {c.zone_name}</span>
                            ) : '—'}
                            {c.bay && c.row && c.tier && (
                              <span className="ml-1 text-[10px] text-slate-400 font-mono">B{c.bay}-R{c.row}-T{c.tier}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{formatShortDate(c.gate_in_date)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center justify-center w-12 h-7 rounded-lg text-sm font-black ${badgeCls}`}>{c.days}</span>
                              {/* Progress bar */}
                              <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${barPct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                              STATUS_LABELS[c.status]?.color || ''
                            }`}>{STATUS_LABELS[c.status]?.label || c.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {dwellTotalPages > 1 && (
                <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    แสดง {(dwellPage - 1) * dwellPerPage + 1}–{Math.min(dwellPage * dwellPerPage, filtered30.length)} จาก {filtered30.length} รายการ
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDwellPage(1)} disabled={dwellPage === 1}
                      className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">«</button>
                    <button onClick={() => setDwellPage(p => Math.max(1, p - 1))} disabled={dwellPage === 1}
                      className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">‹</button>
                    {Array.from({ length: Math.min(5, dwellTotalPages) }, (_, i) => {
                      let page: number;
                      if (dwellTotalPages <= 5) page = i + 1;
                      else if (dwellPage <= 3) page = i + 1;
                      else if (dwellPage >= dwellTotalPages - 2) page = dwellTotalPages - 4 + i;
                      else page = dwellPage - 2 + i;
                      return (
                        <button key={page} onClick={() => setDwellPage(page)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                            page === dwellPage ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}>{page}</button>
                      );
                    })}
                    <button onClick={() => setDwellPage(p => Math.min(dwellTotalPages, p + 1))} disabled={dwellPage === dwellTotalPages}
                      className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">›</button>
                    <button onClick={() => setDwellPage(dwellTotalPages)} disabled={dwellPage === dwellTotalPages}
                      className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">»</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Search Panel */}
          <ContainerSearch yardId={yardId} onLocate={(c) => {
            setFilterZone(c.zone_name);
            setSelectedContainer(c as ContainerData);
            setHighlightNumber(c.container_number);
          }} />
          {/* Right: 3D Viewer */}
          <div>
            <YardViewer3D
              yardId={yardId}
              selectedZone={filterZone || undefined}
              onSelectContainer={(c) => setSelectedContainer(c as ContainerData | null)}
              highlightContainerNumber={highlightNumber}
            />
          </div>
        </div>
      )}

      {activeTab === 'allocate' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600">
                <Wand2 size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">แนะนำพิกัดวางตู้ (Smart Auto-Allocation)</h3>
                <p className="text-xs text-slate-400">ระบุขนาดและประเภทตู้ → ระบบจะแนะนำตำแหน่งที่ดีที่สุดตามกฎของลาน</p>
              </div>
            </div>

            {/* Form */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">เลขตู้ *</label>
                <input type="text" placeholder="ABCU1234567" value={allocForm.container_number}
                  onChange={e => setAllocForm({ ...allocForm, container_number: e.target.value.toUpperCase() })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-white outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ขนาด</label>
                <select value={allocForm.size} onChange={e => setAllocForm({ ...allocForm, size: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none">
                  <option value="20">20 ฟุต</option>
                  <option value="40">40 ฟุต</option>
                  <option value="45">45 ฟุต (HC)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ประเภท</label>
                <select value={allocForm.type} onChange={e => setAllocForm({ ...allocForm, type: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none">
                  <option value="GP">GP (แห้ง)</option>
                  <option value="HC">HC (High Cube)</option>
                  <option value="RF">RF (ตู้เย็น)</option>
                  <option value="OT">OT (Open Top)</option>
                  <option value="FR">FR (Flat Rack)</option>
                  <option value="TK">TK (Tank)</option>
                  <option value="DG">DG (สารอันตราย)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">สายเรือ</label>
                <input type="text" placeholder="เช่น Evergreen" value={allocForm.shipping_line}
                  onChange={e => setAllocForm({ ...allocForm, shipping_line: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500" />
              </div>
              <div className="flex items-end">
                <button
                  onClick={async () => {
                    setAllocLoading(true);
                    setAllocResult(null);
                    setAllocSelected(null);
                    try {
                      const res = await fetch('/api/yard/allocate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ yard_id: yardId, size: allocForm.size, type: allocForm.type, shipping_line: allocForm.shipping_line }),
                      });
                      const data = await res.json();
                      setAllocSuggestions(data.suggestions || []);
                    } catch (err) { console.error(err); }
                    finally { setAllocLoading(false); }
                  }}
                  disabled={allocLoading}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-all"
                >
                  {allocLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  ขอแนะนำพิกัด
                </button>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {allocSuggestions.length > 0 && (
            <div className="p-5">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Star size={14} className="text-amber-500" /> ตำแหน่งแนะนำ ({allocSuggestions.length} รายการ)
              </h4>
              <div className="space-y-2">
                {allocSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setAllocSelected(i)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      allocSelected === i
                        ? 'border-violet-400 dark:border-violet-500 ring-2 ring-violet-500/20 bg-violet-50/50 dark:bg-violet-900/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        }`}>
                          #{i + 1}
                        </div>
                        <div>
                          <p className="font-mono font-semibold text-slate-800 dark:text-white">
                            Zone {s.zone_name} • B{s.bay}-R{s.row}-T{s.tier}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{s.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          s.score >= 130 ? 'text-emerald-600' : s.score >= 100 ? 'text-blue-600' : 'text-slate-500'
                        }`}>
                          {s.score}
                        </div>
                        <p className="text-[10px] text-slate-400">คะแนน</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Confirm button */}
              {allocSelected !== null && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (allocSelected === null || !allocForm.container_number) return;
                      const s = allocSuggestions[allocSelected];
                      setAllocSaving(true);
                      try {
                        const res = await fetch('/api/containers', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            container_number: allocForm.container_number,
                            size: allocForm.size,
                            type: allocForm.type,
                            shipping_line: allocForm.shipping_line,
                            yard_id: yardId,
                            zone_id: s.zone_id,
                            bay: s.bay,
                            row: s.row,
                            tier: s.tier,
                            status: 'in_yard',
                            is_laden: false,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setAllocResult(`✅ วางตู้ ${allocForm.container_number} ที่ Zone ${s.zone_name} B${s.bay}-R${s.row}-T${s.tier} สำเร็จ`);
                          setAllocForm({ size: '20', type: 'GP', shipping_line: '', container_number: '' });
                          setAllocSuggestions([]);
                          setAllocSelected(null);
                          fetchData();
                        } else {
                          setAllocResult(`❌ ${data.error || 'ไม่สามารถวางตู้ได้'}`);
                        }
                      } catch (err) {
                        console.error(err);
                        setAllocResult('❌ เกิดข้อผิดพลาด');
                      }
                      finally { setAllocSaving(false); }
                    }}
                    disabled={allocSaving || !allocForm.container_number}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all"
                  >
                    {allocSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    ยืนยันวางตู้
                  </button>
                  {!allocForm.container_number && (
                    <p className="text-xs text-amber-500">⚠️ กรุณาระบุเลขตู้ก่อน</p>
                  )}
                </div>
              )}

              {/* Result message */}
              {allocResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  allocResult.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                }`}>
                  {allocResult}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {allocSuggestions.length === 0 && !allocLoading && (
            <div className="p-12 text-center">
              <Wand2 size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">ระบุข้อมูลตู้แล้วกด "ขอแนะนำพิกัด" เพื่อดูตำแหน่งที่ดีที่สุด</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <YardAudit yardId={yardId} zones={zones.map(z => ({
          zone_id: z.zone_id,
          zone_name: z.zone_name,
          zone_type: z.zone_type,
          container_count: z.container_count,
        }))} />
      )}

      {/* Container Detail Modal */}
      {detailContainerId && (
        <ContainerDetailModal
          containerId={detailContainerId}
          onClose={() => setDetailContainerId(null)}
          onRefresh={fetchData}
        />
      )}

      {/* Container Timeline Modal */}
      {timelineId && <ContainerTimeline containerId={timelineId} onClose={() => setTimelineId(null)} />}
    </div>
  );
}


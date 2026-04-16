'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatShortDate, calcDwellDays } from '@/lib/utils';
import ContainerSearch from '@/components/yard/ContainerSearch';
import YardAudit from '@/components/yard/YardAudit';
import ContainerCardPWA from '@/components/yard/ContainerCardPWA';
import BayCrossSection from '@/components/yard/BayCrossSection';
import ContainerDetailModal from '@/components/yard/ContainerDetailModal';
import EIRDocument from '@/components/gate/EIRDocument';
import type { EIRData } from '@/components/gate/EIRDocument';

const ContainerTimeline = dynamic(() => import('@/components/containers/ContainerTimeline'), { ssr: false });
import {
  MapPin, Search, Filter, ChevronDown, Cuboid, ClipboardCheck,
  Box, Snowflake, AlertTriangle, Wrench, Trash2, Layers, LayoutGrid, Wand2, Loader2, CheckCircle2, Star, Clock,
  Gauge, PackageCheck,
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

type YardQuickFilter = '' | 'ready_release' | 'damaged_hold';

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
  container_grade?: string;
  hold_status?: string | null;
  booking_ref?: string | null;
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
  released:   { label: 'ปล่อยแล้ว', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  available:  { label: 'ว่าง', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
};

const GRADE_INFO: Record<string, { desc: string; color: string; bg: string }> = {
  A: { desc: 'สภาพดี', color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
  B: { desc: 'พอใช้', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
  C: { desc: 'ต้องซ่อม', color: 'text-orange-700', bg: 'bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400' },
  D: { desc: 'Hold', color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
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
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterSize, setFilterSize] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<YardQuickFilter>('');
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'bay'>('2d');
  const [selectedContainer, setSelectedContainer] = useState<ContainerData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'allocate' | 'audit'>('overview');
  const [highlightNumber, setHighlightNumber] = useState<string>('');
  const [detailContainerId, setDetailContainerId] = useState<number | null>(null);
  const [timelineId, setTimelineId] = useState<number | null>(null);
  const [showEIR, setShowEIR] = useState<string | null>(null);
  const [eirData, setEirData] = useState<EIRData | null>(null);

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
      // By default, hide released containers
      if (c.status === 'gated_out' || c.status === 'released') return false;
    }
    if (filterGrade && (c.container_grade || 'A').toUpperCase() !== filterGrade) return false;
    if (filterSize && c.size !== filterSize) return false;
    if (filterType && c.type !== filterType) return false;
    if (quickFilter === 'ready_release') {
      const grade = (c.container_grade || 'A').toUpperCase();
      if (c.status !== 'in_yard' || !['A', 'B'].includes(grade) || c.hold_status || c.is_laden) return false;
    }
    if (quickFilter === 'damaged_hold') {
      const grade = (c.container_grade || 'A').toUpperCase();
      if (!['hold', 'repair'].includes(c.status) && !['C', 'D'].includes(grade) && !c.hold_status) return false;
    }
    return true;
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterZone, filterStatus, filterGrade, filterSize, filterType, quickFilter]);

  const viewEIR = useCallback(async (eirNumber: string) => {
    setShowEIR(eirNumber);
    setEirData(null);
    try {
      const res = await fetch(`/api/gate/eir?eir_number=${eirNumber}`);
      const data = await res.json();
      setEirData(data.eir || null);
    } catch {
      setEirData(null);
    }
  }, []);

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
  const activeContainers = containers.filter(c => c.status !== 'gated_out' && c.status !== 'released');
  const gradeStats = ['A', 'B', 'C', 'D'].map(grade => ({
    grade,
    count: activeContainers.filter(c => (c.container_grade || 'A').toUpperCase() === grade).length,
  }));
  const sizeTypeStats = Array.from(
    activeContainers.reduce((map, c) => {
      const key = `${c.size || '-'}'${c.type || '-'}`;
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const readyReleaseCount = activeContainers.filter(c => {
    const grade = (c.container_grade || 'A').toUpperCase();
    return c.status === 'in_yard' && ['A', 'B'].includes(grade) && !c.hold_status && !c.is_laden;
  }).length;
  const damagedHoldCount = activeContainers.filter(c => {
    const grade = (c.container_grade || 'A').toUpperCase();
    return ['hold', 'repair'].includes(c.status) || ['C', 'D'].includes(grade) || Boolean(c.hold_status);
  }).length;
  const uniqueSizes = Array.from(new Set(containers.map(c => c.size).filter(Boolean))).sort();
  const uniqueTypes = Array.from(new Set(containers.map(c => c.type).filter(Boolean))).sort();

  const nextEmptySlots = zones.flatMap(zone => {
    const occupied = new Set(
      containers
        .filter(c => c.status !== 'gated_out' && c.status !== 'released' && c.zone_name === zone.zone_name && c.bay && c.row && c.tier)
        .map(c => `${c.bay}-${c.row}-${c.tier}`)
    );
    const slots: Array<{ zone_name: string; zone_type: string; bay: number; row: number; tier: number }> = [];
    for (let bay = 1; bay <= zone.max_bay && slots.length < 3; bay++) {
      for (let row = 1; row <= zone.max_row && slots.length < 3; row++) {
        for (let tier = 1; tier <= zone.max_tier && slots.length < 3; tier++) {
          if (!occupied.has(`${bay}-${row}-${tier}`)) slots.push({ zone_name: zone.zone_name, zone_type: zone.zone_type, bay, row, tier });
        }
      }
    }
    return slots;
  }).slice(0, 12);

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
      {(() => {
        const inYardCtrs = containers.filter(c => c.status !== 'gated_out' && c.gate_in_date);
        const overdueCount = inYardCtrs.filter(c => calcDwellDays(c.gate_in_date) > 30).length;
        const avgDwell = inYardCtrs.length > 0
          ? (inYardCtrs.reduce((s, c) => s + calcDwellDays(c.gate_in_date), 0) / inYardCtrs.length).toFixed(1)
          : '0';
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'ตู้ทั้งหมด', value: summary.total || 0, color: 'text-slate-800 dark:text-white' },
              { label: 'ในลาน', value: summary.in_yard || 0, color: 'text-emerald-600' },
              { label: 'ค้างจ่าย', value: summary.on_hold || 0, color: 'text-amber-600' },
              { label: 'ซ่อม', value: summary.in_repair || 0, color: 'text-rose-600' },
              { label: 'Overdue (>30วัน)', value: overdueCount, color: overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600' },
              { label: 'Avg Dwell', value: `${avgDwell} วัน`, color: 'text-blue-600' },
              { label: 'อัตราเต็ม', value: `${overallPct.toFixed(1)}%`, color: overallPct > 80 ? 'text-rose-600' : 'text-blue-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        );
      })()}

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
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <MapPin size={16} /> แผนผังโซน
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {zones.map((zone) => {
                    const zc = ZONE_COLORS[zone.zone_type] || ZONE_COLORS.dry;
                    const pct = zone.occupancy_pct || 0;
                    const freeSlots = Math.max((zone.capacity || 0) - (zone.container_count || 0), 0);
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
                        <p className="text-xs text-slate-400 mb-1">
                          ใช้แล้ว {zone.container_count}/{zone.capacity} • ว่าง {freeSlots}
                        </p>
                        <p className="text-[10px] text-slate-400 mb-2">
                          {zone.max_bay} Bay × {zone.max_row} Row × {zone.max_tier} Tier
                        </p>
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

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <Gauge size={16} /> Yard Optimization
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">ช่วย planner เห็น slot, grade, size/type และตู้ที่ควรหยิบออกหรือแยกจัดการ</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setQuickFilter(quickFilter === 'ready_release' ? '' : 'ready_release')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${quickFilter === 'ready_release' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
                      <PackageCheck size={12} /> พร้อมปล่อย {readyReleaseCount}
                    </button>
                    <button onClick={() => setQuickFilter(quickFilter === 'damaged_hold' ? '' : 'damaged_hold')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${quickFilter === 'damaged_hold' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                      <AlertTriangle size={12} /> Damaged/Hold {damagedHoldCount}
                    </button>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Slot ว่าง/ไม่ว่าง</p>
                      <span className="text-[10px] text-slate-400">{totalUsed}/{totalCapacity}</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full ${overallPct > 85 ? 'bg-rose-500' : overallPct > 60 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(overallPct, 100)}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                        <p className="text-[10px] text-slate-400">ใช้แล้ว</p>
                        <p className="text-lg font-bold text-slate-800 dark:text-white">{totalUsed.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                        <p className="text-[10px] text-slate-400">ว่าง</p>
                        <p className="text-lg font-bold text-emerald-600">{Math.max(totalCapacity - totalUsed, 0).toLocaleString()}</p>
                      </div>
                    </div>
                    {nextEmptySlots.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">ตัวอย่าง slot ว่าง</p>
                        <div className="flex flex-wrap gap-1">
                          {nextEmptySlots.slice(0, 6).map(slot => (
                            <span key={`${slot.zone_name}-${slot.bay}-${slot.row}-${slot.tier}`} className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-500">
                              {slot.zone_name} B{slot.bay}-R{slot.row}-T{slot.tier}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">ตู้ตาม Grade</p>
                    <div className="space-y-2">
                      {gradeStats.map(item => {
                        const gradeInfo = GRADE_INFO[item.grade] || GRADE_INFO.A;
                        const pct = activeContainers.length > 0 ? (item.count / activeContainers.length) * 100 : 0;
                        return (
                          <button key={item.grade} onClick={() => setFilterGrade(filterGrade === item.grade ? '' : item.grade)}
                            className={`w-full text-left rounded-lg border p-2 transition-all ${filterGrade === item.grade ? 'border-blue-400 bg-white dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${gradeInfo.bg} ${gradeInfo.color}`}>Grade {item.grade}</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.count}</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">ตู้ตาม Size / Type</p>
                    <div className="space-y-2">
                      {sizeTypeStats.length === 0 ? (
                        <p className="text-xs text-slate-400">ยังไม่มีข้อมูลในลาน</p>
                      ) : sizeTypeStats.map(([key, count]) => {
                        const [size, type] = key.replace("'", '').split(/(?=[A-Z-])/);
                        const pct = activeContainers.length > 0 ? (count / activeContainers.length) * 100 : 0;
                        return (
                          <button key={key} onClick={() => {
                            const normalizedSize = key.split("'")[0];
                            const normalizedType = key.split("'")[1];
                            setFilterSize(filterSize === normalizedSize && filterType === normalizedType ? '' : normalizedSize);
                            setFilterType(filterSize === normalizedSize && filterType === normalizedType ? '' : normalizedType);
                          }} className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{size}&apos;{type}</span>
                              <span className="text-xs text-slate-500">{count}</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
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
                  <option value="released">ปล่อยแล้ว</option>
                  <option value="gated_out">ปล่อยแล้ว (เดิม)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <Star size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}
                  className="h-10 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                    text-sm text-slate-800 dark:text-white outline-none appearance-none">
                  <option value="">ทุกเกรด</option>
                  <option value="A">Grade A - สภาพดี</option>
                  <option value="B">Grade B - พอใช้</option>
                  <option value="C">Grade C - ต้องซ่อม</option>
                  <option value="D">Grade D - Hold</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <Box size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)}
                  className="h-10 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                    text-sm text-slate-800 dark:text-white outline-none appearance-none">
                  <option value="">ทุกขนาด</option>
                  {uniqueSizes.map(size => <option key={size} value={size}>{size} ฟุต</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <Cuboid size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="h-10 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                    text-sm text-slate-800 dark:text-white outline-none appearance-none">
                  <option value="">ทุกประเภท</option>
                  {uniqueTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              {(quickFilter || filterZone || filterGrade || filterSize || filterType || filterStatus || search) && (
                <button onClick={() => { setSearch(''); setFilterZone(''); setFilterStatus(''); setFilterGrade(''); setFilterSize(''); setFilterType(''); setQuickFilter(''); }}
                  className="h-10 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-500 hover:text-slate-700">
                  ล้าง Filter
                </button>
              )}
              <span className="text-xs text-slate-400">
                แสดง {filtered.length} / {containers.length} ตู้
                {filterZone && <span className="ml-1 text-blue-500 font-medium">• Zone {filterZone}</span>}
                {filterGrade && <span className="ml-1 text-amber-500 font-medium">• Grade {filterGrade}</span>}
                {filterSize && <span className="ml-1 text-cyan-500 font-medium">• {filterSize} ft</span>}
                {filterType && <span className="ml-1 text-cyan-500 font-medium">• {filterType}</span>}
                {quickFilter === 'ready_release' && <span className="ml-1 text-emerald-500 font-medium">• พร้อมปล่อย</span>}
                {quickFilter === 'damaged_hold' && <span className="ml-1 text-rose-500 font-medium">• Damaged/Hold</span>}
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
                    <th className="px-4 py-3">เกรด</th>
                    <th className="px-4 py-3">สินค้า</th>
                    <th className="px-4 py-3">เข้าลานเมื่อ</th>
                    <th className="px-4 py-3">อยู่ในลาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginated.map((c) => {
                    const st = STATUS_LABELS[c.status] || STATUS_LABELS.available;
                    const grade = (c.container_grade || 'A').toUpperCase();
                    const gradeInfo = GRADE_INFO[grade] || GRADE_INFO.A;
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
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${gradeInfo.bg} ${gradeInfo.color}`}>
                            {grade}
                            <span className="font-medium">{gradeInfo.desc}</span>
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
                              const days = calcDwellDays(c.gate_in_date);
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
              <p className="text-slate-400 text-sm">ระบุข้อมูลตู้แล้วกด &quot;ขอแนะนำพิกัด&quot; เพื่อดูตำแหน่งที่ดีที่สุด</p>
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
          onViewEIR={viewEIR}
        />
      )}

      {showEIR && eirData && (
        <EIRDocument
          data={eirData}
          onClose={() => { setShowEIR(null); setEirData(null); }}
        />
      )}

      {showEIR && !eirData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center shadow-xl">
            <Loader2 size={24} className="animate-spin mx-auto text-blue-500" />
            <p className="text-sm text-slate-500 mt-3">กำลังโหลด EIR...</p>
          </div>
        </div>
      )}

      {/* Container Timeline Modal */}
      {timelineId && <ContainerTimeline containerId={timelineId} onClose={() => setTimelineId(null)} />}
    </div>
  );
}

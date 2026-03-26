'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layers, ChevronDown, Box, Snowflake, AlertTriangle, Wrench, Trash2 } from 'lucide-react';
import { calcDwellDays } from '@/lib/utils';

interface ContainerData {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  status: string;
  shipping_line: string;
  is_laden: boolean;
  bay: number;
  row: number;
  tier: number;
  zone_name: string;
  zone_type: string;
  gate_in_date: string;
}

interface ZoneData {
  zone_id: number;
  zone_name: string;
  zone_type: string;
  max_bay: number;
  max_row: number;
  max_tier: number;
  container_count: number;
}

interface Props {
  yardId: number;
  onSelectContainer?: (c: ContainerData | null) => void;
}

// Shipping line → color
const SHIPPING_COLORS: Record<string, string> = {
  'Evergreen':  '#006847',
  'MSC':        '#1E3A5F',
  'Maersk':     '#0074BC',
  'COSCO':      '#CC2229',
  'CMA CGM':    '#003DA5',
  'ONE':        '#E6007E',
  'Yang Ming':  '#D4A017',
  'HMM':        '#003D6B',
  'ZIM':        '#D4A017',
  'PIL':        '#E31937',
};

const STATUS_COLORS: Record<string, string> = {
  in_yard: '#10B981',
  hold: '#F59E0B',
  repair: '#EF4444',
  gated_out: '#64748B',
};

const ZONE_ICONS: Record<string, React.ReactNode> = {
  dry: <Box size={14} />,
  reefer: <Snowflake size={14} />,
  hazmat: <AlertTriangle size={14} />,
  empty: <Trash2 size={14} />,
  repair: <Wrench size={14} />,
};

const STATUS_LABELS: Record<string, string> = {
  in_yard: 'ในลาน',
  hold: 'ค้างจ่าย',
  repair: 'ซ่อม',
  gated_out: 'ปล่อยแล้ว',
};

function getContainerColor(c: ContainerData): string {
  if (c.status === 'hold') return STATUS_COLORS.hold;
  if (c.status === 'repair') return STATUS_COLORS.repair;
  return SHIPPING_COLORS[c.shipping_line] || STATUS_COLORS[c.status] || '#10B981';
}

function getContainerBorderColor(c: ContainerData): string {
  if (c.status === 'hold') return '#D97706';
  if (c.status === 'repair') return '#DC2626';
  return SHIPPING_COLORS[c.shipping_line]
    ? SHIPPING_COLORS[c.shipping_line]
    : '#059669';
}

export default function BayCrossSection({ yardId, onSelectContainer }: Props) {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [containers, setContainers] = useState<ContainerData[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hoveredContainer, setHoveredContainer] = useState<ContainerData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, ctrRes] = await Promise.all([
        fetch(`/api/yard/stats?yard_id=${yardId}`),
        fetch(`/api/containers?yard_id=${yardId}`),
      ]);
      const stats = await statsRes.json();
      const ctrs = await ctrRes.json();
      setZones(stats.zones || []);
      const allCtrs = (ctrs || []).filter((c: ContainerData) => c.status !== 'gated_out' && c.bay && c.row && c.tier);
      setContainers(allCtrs);
      // Auto-select first zone
      if (stats.zones?.length > 0 && !selectedZone) {
        setSelectedZone(stats.zones[0].zone_name);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [yardId, selectedZone]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const zone = zones.find(z => z.zone_name === selectedZone);
  const zoneContainers = containers.filter(c => c.zone_name === selectedZone);

  // Build grid: bay → row → tier = container
  const gridMap = new Map<string, ContainerData>();
  for (const c of zoneContainers) {
    gridMap.set(`${c.bay}-${c.row}-${c.tier}`, c);
  }

  // Container abbreviation
  const abbr = (num: string) => num.substring(0, 4);

  const handleMouseEnter = (c: ContainerData, e: React.MouseEvent) => {
    setHoveredContainer(c);
    const rect = (e.currentTarget as HTMLElement).closest('.bay-section-wrapper')?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 10,
      });
    }
  };

  const handleMouseMove = (c: ContainerData, e: React.MouseEvent) => {
    setHoveredContainer(c);
    const rect = (e.currentTarget as HTMLElement).closest('.bay-section-wrapper')?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 10,
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[400px] rounded-xl bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">กำลังโหลดแผนผังลานตู้...</p>
        </div>
      </div>
    );
  }

  const maxBay = zone?.max_bay || 10;
  const maxRow = zone?.max_row || 6;
  const maxTier = zone?.max_tier || 5;

  return (
    <div className="w-full rounded-xl bg-[#0F172A] border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-slate-800/80 to-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">แผนผังลานตู้ — Bay View</h3>
            <p className="text-[10px] text-slate-400">มุมมองตัดขวาง Row × Tier แยกตาม Bay</p>
          </div>
        </div>

        {/* Zone Selector */}
        <div className="relative">
          <button
            onClick={() => setShowZoneDropdown(!showZoneDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-sm text-white font-medium transition-all"
          >
            {ZONE_ICONS[zone?.zone_type || 'dry']}
            Zone {selectedZone || '—'}
            <ChevronDown size={14} className={`transition-transform ${showZoneDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showZoneDropdown && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
              {zones.map(z => (
                <button
                  key={z.zone_id}
                  onClick={() => { setSelectedZone(z.zone_name); setShowZoneDropdown(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all hover:bg-slate-700 ${
                    selectedZone === z.zone_name ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300'
                  }`}
                >
                  {ZONE_ICONS[z.zone_type] || <Box size={14} />}
                  Zone {z.zone_name}
                  <span className="ml-auto text-[10px] text-slate-500">{z.container_count} ตู้</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bay Cross-Section Grid */}
      <div className="bay-section-wrapper relative p-4 overflow-x-auto">
        {/* Zone stats bar */}
        <div className="flex items-center gap-4 mb-4 text-xs text-slate-400">
          <span>📦 ตู้ในโซน: <strong className="text-white">{zoneContainers.length}</strong></span>
          <span>📐 Bay: <strong className="text-white">{maxBay}</strong></span>
          <span>↔️ Row: <strong className="text-white">{maxRow}</strong></span>
          <span>↕️ Tier: <strong className="text-white">{maxTier}</strong></span>
        </div>

        {/* Bays grid */}
        <div className="flex gap-4 pb-2" style={{ minWidth: maxBay > 8 ? `${maxBay * 110}px` : undefined }}>
          {Array.from({ length: maxBay }, (_, bayIdx) => {
            const bayNum = bayIdx + 1;
            const bayContainers = zoneContainers.filter(c => c.bay === bayNum);

            return (
              <div key={bayNum} className="flex-shrink-0">
                {/* Bay label */}
                <div className="text-center mb-2">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-slate-700/60 text-[10px] font-bold text-slate-300 tracking-wider">
                    BAY {String(bayNum).padStart(2, '0')}
                  </span>
                </div>

                {/* Tier × Row grid (bottom-up) */}
                <div className="rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/30">
                  {/* Column headers: Row */}
                  <div className="flex">
                    <div className="w-8 flex-shrink-0" /> {/* tier label space */}
                    {Array.from({ length: maxRow }, (_, rIdx) => (
                      <div key={rIdx} className="w-[72px] text-center py-1 text-[9px] font-bold text-slate-500 border-b border-slate-700/30">
                        R{rIdx + 1}
                      </div>
                    ))}
                  </div>

                  {/* Rows: tier from top (maxTier) to bottom (1) */}
                  {Array.from({ length: maxTier }, (_, tIdxRev) => {
                    const tierNum = maxTier - tIdxRev;
                    return (
                      <div key={tierNum} className="flex">
                        {/* Tier label */}
                        <div className="w-8 flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-slate-500 border-r border-slate-700/30">
                          T{tierNum}
                        </div>

                        {/* Cells */}
                        {Array.from({ length: maxRow }, (_, rIdx) => {
                          const rowNum = rIdx + 1;
                          const ctr = gridMap.get(`${bayNum}-${rowNum}-${tierNum}`);

                          if (!ctr) {
                            return (
                              <div
                                key={rowNum}
                                className="w-[72px] h-[32px] border border-slate-700/20 bg-slate-800/10"
                              />
                            );
                          }

                          const bgColor = getContainerColor(ctr);
                          const borderColor = getContainerBorderColor(ctr);

                          return (
                            <div
                              key={rowNum}
                              className="w-[72px] h-[32px] flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 hover:z-10 hover:shadow-lg hover:shadow-black/30 relative"
                              style={{
                                backgroundColor: bgColor,
                                borderWidth: 1,
                                borderColor: borderColor,
                                borderStyle: 'solid',
                              }}
                              onMouseEnter={(e) => handleMouseEnter(ctr, e)}
                              onMouseMove={(e) => handleMouseMove(ctr, e)}
                              onMouseLeave={() => setHoveredContainer(null)}
                              onClick={() => onSelectContainer?.(ctr)}
                            >
                              <span className="text-[10px] font-bold text-white/90 drop-shadow-sm tracking-wide">
                                {abbr(ctr.container_number)}
                              </span>
                              {/* Size indicator */}
                              {(ctr.size === '40' || ctr.size === '45') && (
                                <span className="absolute top-0 right-0.5 text-[7px] font-bold text-white/60">
                                  {ctr.size}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Bay container count */}
                <div className="text-center mt-1.5">
                  <span className="text-[9px] text-slate-500">{bayContainers.length} ตู้</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {hoveredContainer && (
          <div
            className="absolute pointer-events-none z-50 rounded-xl shadow-2xl shadow-black/40 border border-slate-600/50 overflow-hidden"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)',
              minWidth: '220px',
            }}
          >
            <div className="bg-slate-800/95 backdrop-blur-xl px-4 py-3">
              {/* Container number */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getContainerColor(hoveredContainer) }}
                />
                <span className="font-mono font-bold text-white text-sm">{hoveredContainer.container_number}</span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div>
                  <span className="text-slate-400">ขนาด:</span>{' '}
                  <span className="text-white font-medium">{hoveredContainer.size}&apos;{hoveredContainer.type}</span>
                </div>
                <div>
                  <span className="text-slate-400">สายเรือ:</span>{' '}
                  <span className="text-white font-medium">{hoveredContainer.shipping_line || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400">สถานะ:</span>{' '}
                  <span className="text-white font-medium">{STATUS_LABELS[hoveredContainer.status] || hoveredContainer.status}</span>
                </div>
                <div>
                  <span className="text-slate-400">สินค้า:</span>{' '}
                  <span className="text-white font-medium">{hoveredContainer.is_laden ? 'มีสินค้า' : 'ตู้เปล่า'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">ตำแหน่ง:</span>{' '}
                  <span className="text-indigo-300 font-mono font-bold">
                    Zone {hoveredContainer.zone_name} • B{hoveredContainer.bay}-R{hoveredContainer.row}-T{hoveredContainer.tier}
                  </span>
                </div>
                {hoveredContainer.gate_in_date && (() => {
                  const days = calcDwellDays(hoveredContainer.gate_in_date);
                  const color = days <= 7 ? 'text-emerald-400' : days <= 14 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <div className="col-span-2">
                      <span className="text-slate-400">อยู่ในลาน:</span>{' '}
                      <span className={`font-bold ${color}`}>{days} วัน</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-700/30">
          <span className="text-[10px] text-slate-500 font-semibold tracking-wider mr-1">สายเรือ:</span>
          {Object.entries(SHIPPING_COLORS).slice(0, 6).map(([name, color]) => (
            <span key={name} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              {name}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-slate-500 font-semibold tracking-wider mr-1">สถานะ:</span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> ค้างจ่าย
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> ซ่อม
          </span>
        </div>
      </div>
    </div>
  );
}

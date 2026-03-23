'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Package, Ship, Sparkles, ExternalLink, Calendar, Truck, User, Image as ImageIcon, Clock } from 'lucide-react';

interface SearchResult {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  status: string;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  shipping_line: string;
  is_laden: boolean;
  gate_in_date: string;
}

interface ContainerDetail {
  container: {
    container_id: number;
    container_number: string;
    size: string;
    type: string;
    status: string;
    shipping_line: string;
    is_laden: boolean;
    yard_name: string;
    zone_name: string;
    bay: number;
    row: number;
    tier: number;
    dwell_days: number;
    seal_number: string;
    booking_ref: string;
  };
  gate_in: {
    eir_number: string;
    date: string;
    driver_name: string;
    truck_plate: string;
    processed_by: string;
    damage_report: {
      points?: Array<{ id: string; side: string; type: string; severity: string; photo?: string }>;
      condition_grade?: string;
      photos?: string[];
    } | null;
  } | null;
  gate_out: {
    damage_report: { exit_photos?: string[] } | null;
  } | null;
}

interface Props {
  yardId: number;
  onLocate?: (container: SearchResult) => void;
}

const STATUS_TH: Record<string, string> = {
  in_yard: 'ในลาน', hold: 'ค้างจ่าย', repair: 'ซ่อม', released: 'ปล่อยแล้ว',
};

const GRADE_INFO: Record<string, { desc: string; color: string }> = {
  A: { desc: 'สภาพดี', color: '#10B981' },
  B: { desc: 'พอใช้', color: '#F59E0B' },
  C: { desc: 'ทั่วไป', color: '#F97316' },
  D: { desc: 'ชำรุด', color: '#EF4444' },
};

export default function ContainerSearch({ yardId, onLocate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.slice(0, 20));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [yardId]);

  const handleSelect = (c: SearchResult) => {
    setSelected(c);
    if (onLocate) onLocate(c);
  };

  // Fetch detail when selected
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/containers/detail?container_id=${selected.container_id}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setDetail(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  // Collect all photos
  const allPhotos: string[] = [];
  if (detail?.gate_in?.damage_report?.photos) allPhotos.push(...detail.gate_in.damage_report.photos);
  if (detail?.gate_in?.damage_report?.points) {
    detail.gate_in.damage_report.points.forEach(p => { if (p.photo) allPhotos.push(p.photo); });
  }
  if (detail?.gate_out?.damage_report?.exit_photos) allPhotos.push(...detail.gate_out.damage_report.exit_photos);

  const grade = detail?.gate_in?.damage_report?.condition_grade || 'A';
  const gradeInfo = GRADE_INFO[grade] || GRADE_INFO.A;
  const damageCount = detail?.gate_in?.damage_report?.points?.length || 0;

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขตู้ / สายเรือ..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-600
                bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none
                focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[200px] overflow-y-auto">
          {results.length === 0 && query.length >= 2 && !loading && (
            <div className="p-6 text-center text-slate-400 text-sm">ไม่พบตู้ที่ค้นหา</div>
          )}
          {results.map((c) => (
            <button
              key={c.container_id}
              onClick={() => handleSelect(c)}
              className={`w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors
                ${selected?.container_id === c.container_id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-slate-800 dark:text-white">{c.container_number}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="inline-flex items-center gap-1"><Ship size={10} /> {c.shipping_line || '—'}</span>
                    <span className="mx-2">•</span>
                    <span>{c.size}&apos;{c.type}</span>
                    <span className="mx-2">•</span>
                    <span className={c.status === 'in_yard' ? 'text-emerald-500' : c.status === 'hold' ? 'text-amber-500' : 'text-rose-500'}>
                      {STATUS_TH[c.status] || c.status}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-slate-500">
                    <MapPin size={10} className="inline mr-1" />
                    Zone {c.zone_name} • B{c.bay}-R{c.row}-T{c.tier}
                  </p>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    {c.gate_in_date && (() => {
                      const days = Math.floor((Date.now() - new Date(c.gate_in_date).getTime()) / 86400000);
                      const color = days <= 7 ? 'text-emerald-600 bg-emerald-50' : days <= 14 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
                      return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}><Clock size={8} className="inline mr-0.5" />{days} วัน</span>;
                    })()}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); handleSelect(c); }}
                      className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Sparkles size={10} /> 3D
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Detail Panel */}
        {selected && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            {detailLoading ? (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 mt-2">กำลังโหลด...</p>
              </div>
            ) : detail ? (
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Package size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-slate-800 dark:text-white">{detail.container.container_number}</p>
                    <p className="text-xs text-slate-400">
                      {detail.container.size}&apos;{detail.container.type} • {detail.container.shipping_line || '—'} • {detail.container.is_laden ? 'มีสินค้า' : 'ตู้เปล่า'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-black"
                      style={{ backgroundColor: gradeInfo.color }}>{grade}</span>
                    {detail.container.dwell_days > 0 && (
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{detail.container.dwell_days}วัน</span>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{detail.container.zone_name} • B{detail.container.bay}-R{detail.container.row}-T{detail.container.tier}</span>
                  </div>
                  {detail.gate_in && (
                    <>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={12} className="text-slate-400" />
                        <span>{detail.gate_in.date ? new Date(detail.gate_in.date).toLocaleDateString('th-TH') : '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User size={12} className="text-slate-400" />
                        <span>{detail.gate_in.driver_name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Truck size={12} className="text-slate-400" />
                        <span className="font-mono">{detail.gate_in.truck_plate || '—'}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Damage Summary */}
                {damageCount > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-xs">
                    <span className="text-amber-600">⚠️ {damageCount} จุดเสียหาย</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400">{gradeInfo.desc}</span>
                  </div>
                )}

                {/* Photos Gallery */}
                {allPhotos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <ImageIcon size={10} /> รูปถ่าย ({allPhotos.length})
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {allPhotos.slice(0, 8).map((photo, i) => (
                        <button key={i} onClick={() => setFullPhoto(photo)} className="group">
                          <img src={photo} alt={`Photo ${i + 1}`}
                            className="w-full h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600 group-hover:border-blue-400 transition-colors" />
                        </button>
                      ))}
                      {allPhotos.length > 8 && (
                        <div className="w-full h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-400">
                          +{allPhotos.length - 8}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* EIR Link */}
                {detail.gate_in?.eir_number && (
                  <button onClick={() => window.open(`/eir/${detail.gate_in!.eir_number}`, '_blank')}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors">
                    <ExternalLink size={12} /> ดู EIR {detail.gate_in.eir_number}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-slate-400">ไม่พบข้อมูลเพิ่มเติม</div>
            )}
          </div>
        )}
      </div>

      {/* Full-size photo overlay */}
      {fullPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setFullPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-lg flex items-center justify-center hover:bg-white/30">✕</button>
          <img src={fullPhoto} alt="Full-size" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

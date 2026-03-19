'use client';

import { useState, useCallback } from 'react';
import { Search, MapPin, Package, Ship, ArrowRight, Sparkles } from 'lucide-react';

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

interface Props {
  yardId: number;
  onLocate?: (container: SearchResult) => void;
}

const STATUS_TH: Record<string, string> = {
  in_yard: 'ในลาน', hold: 'ค้างจ่าย', repair: 'ซ่อม', released: 'ปล่อยแล้ว',
};

export default function ContainerSearch({ yardId, onLocate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);

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

  return (
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
      <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[350px] overflow-y-auto">
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
                <button
                  onClick={(e) => { e.stopPropagation(); handleSelect(c); }}
                  className="mt-1 text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 ml-auto"
                >
                  <Sparkles size={10} /> ค้นหาตำแหน่ง 3D
                </button>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Detail */}
      {selected && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <Package size={20} />
            </div>
            <div className="flex-1">
              <p className="font-mono font-bold text-slate-800 dark:text-white">{selected.container_number}</p>
              <p className="text-xs text-slate-400">
                Zone {selected.zone_name} • Bay {selected.bay} • Row {selected.row} • Tier {selected.tier}
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-slate-500">{selected.shipping_line}</p>
              <p className="text-slate-400">{selected.size}&apos;{selected.type} • {selected.is_laden ? 'Full' : 'Empty'}</p>
              {selected.gate_in_date && (
                <p className="text-slate-400">เข้า: {new Date(selected.gate_in_date).toLocaleDateString('th-TH')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

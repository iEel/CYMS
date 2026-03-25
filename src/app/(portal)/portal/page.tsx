'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, FileText, ClipboardList, ArrowUpRight, ArrowDownLeft, Loader2, RefreshCw, Download } from 'lucide-react';

interface Overview {
  customer: { customer_name: string; contact_email: string; customer_type: string };
  containers: { total: number; in_yard: number; released: number };
  outstanding: { count: number; total: number };
  activeBookings: number;
  recentGate: Array<{
    transaction_type: string; eir_number: string; created_at: string;
    container_number: string; size: string; type: string;
  }>;
}

export default function PortalOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(() => {
    fetch('/api/portal/overview').then(r => r.json()).then(d => {
      setData(d); setLoading(false); setLastUpdated(new Date());
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
  if (!data) return <p className="text-red-500">ไม่สามารถโหลดข้อมูลได้</p>;

  // Safe defaults in case API returns partial data
  const customer = data.customer || { customer_name: 'ลูกค้า', contact_email: '', customer_type: '' };
  const containers = data.containers || { total: 0, in_yard: 0, released: 0 };
  const outstanding = data.outstanding || { count: 0, total: 0 };
  const activeBookings = data.activeBookings || 0;
  const recentGate = data.recentGate || [];

  const kpis = [
    { label: 'ตู้ในลาน', value: containers.in_yard, icon: <Package size={20} />, color: 'blue', sub: `ทั้งหมด ${containers.total} ตู้` },
    { label: 'ค้างชำระ', value: `฿${outstanding.total.toLocaleString()}`, icon: <FileText size={20} />, color: 'amber', sub: `${outstanding.count} รายการ` },
    { label: 'Booking Active', value: activeBookings, icon: <ClipboardList size={20} />, color: 'emerald', sub: 'pending + confirmed' },
    { label: 'ตู้ปล่อยออก', value: containers.released, icon: <ArrowUpRight size={20} />, color: 'purple', sub: 'ทั้งหมด' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-700',
    amber: 'from-amber-500 to-amber-600',
    emerald: 'from-emerald-500 to-emerald-700',
    purple: 'from-purple-500 to-purple-700',
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            สวัสดี, {customer.customer_name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Customer Portal — ดูสถานะตู้ และ Invoice</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-blue-500 transition-colors mt-2"
          title="รีเฟรช">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {lastUpdated && `${lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/60 dark:border-slate-700/50">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[k.color]} flex items-center justify-center text-white mb-3`}>
              {k.icon}
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{k.value}</p>
            <p className="text-xs text-slate-500 font-medium">{k.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Gate Activity */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">กิจกรรม Gate ล่าสุด</h2>
        </div>
        {recentGate.length === 0 ? (
          <p className="p-6 text-center text-slate-400 text-sm">ยังไม่มีกิจกรรม</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {recentGate.map((g, i) => (
              <div key={i} className="flex items-center gap-3 p-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  g.transaction_type === 'gate_in'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                }`}>
                  {g.transaction_type === 'gate_in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white font-mono">{g.container_number}</p>
                  <p className="text-[10px] text-slate-400">{g.size}&apos; {g.type} — {g.eir_number}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-0.5">
                  <p className={`text-xs font-medium ${g.transaction_type === 'gate_in' ? 'text-blue-600' : 'text-red-500'}`}>
                    {g.transaction_type === 'gate_in' ? 'เข้า' : 'ออก'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(g.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <a href={`/api/portal/eir-pdf?eir_number=${g.eir_number}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 hover:text-blue-700">
                    <Download size={9} /> EIR PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

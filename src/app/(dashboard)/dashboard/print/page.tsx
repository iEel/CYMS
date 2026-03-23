'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export default function DashboardPrintPage() {
  const params = useSearchParams();
  const yardId = params.get('yard_id') || '1';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<{ company_name: string; address: string; phone: string; tax_id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, companyRes] = await Promise.all([
        fetch(`/api/dashboard?yard_id=${yardId}`),
        fetch('/api/settings/company'),
      ]);
      const dashboard = await dashRes.json();
      const comp = await companyRes.json();
      if (!dashboard.error) setData(dashboard);
      if (comp && !comp.error) setCompany(comp);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [yardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto print after load
  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">กำลังโหลดข้อมูล...</div>;
  if (!data?.kpi) return <div className="flex items-center justify-center min-h-screen text-slate-400">ไม่พบข้อมูล</div>;

  const kpi = data.kpi;
  const summary = data.statusSummary;
  const charts = data.charts;
  const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-white p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed text-slate-800">
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{company?.company_name || 'CYMS'}</h1>
          {company?.address && <p className="text-[10px] text-slate-500 mt-0.5">{company.address}</p>}
          {company?.phone && <p className="text-[10px] text-slate-500">โทร. {company.phone}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-base font-bold text-slate-900">รายงาน Dashboard ประจำวัน</h2>
          <p className="text-sm font-semibold text-blue-700 mt-0.5">{today}</p>
          <p className="text-[10px] text-slate-400 mt-1">พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</p>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'ตู้ในลาน', value: kpi.containers.value, change: kpi.containers.change, color: '#2563EB' },
          { label: 'อัตราลานเต็ม', value: `${kpi.occupancy.value}%`, change: null, color: '#059669' },
          { label: 'Gate-In วันนี้', value: kpi.gateInToday.value, change: kpi.gateInToday.change, color: '#D97706' },
          { label: 'Gate-Out วันนี้', value: kpi.gateOutToday.value, change: kpi.gateOutToday.change, color: '#EF4444' },
          { label: 'รายได้วันนี้', value: `฿${kpi.revenue.value.toLocaleString()}`, change: kpi.revenue.change ? `${kpi.revenue.change}%` : null, color: '#7C3AED' },
        ].map((item, i) => (
          <div key={i} className="border border-slate-200 rounded-lg p-2.5 text-center">
            <p className="text-[9px] text-slate-400 uppercase font-semibold">{item.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: item.color }}>
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </p>
            {item.change !== null && (
              <p className={`text-[9px] font-medium ${Number(item.change) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {Number(item.change) >= 0 ? '↑' : '↓'} {item.change} จากเมื่อวาน
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Container Status Summary */}
      {summary && (
        <div className="border border-slate-200 rounded-lg p-3 mb-5">
          <h3 className="font-bold text-xs mb-2">สรุปสถานะตู้</h3>
          <div className="grid grid-cols-6 gap-2 text-center text-[10px]">
            {[
              { label: 'พร้อมใช้งาน', value: summary.available, color: '#10B981' },
              { label: 'อยู่ในลาน', value: summary.in_yard, color: '#3B82F6' },
              { label: 'งานค้าง', value: kpi.pendingOrders, color: '#F59E0B' },
              { label: 'ระงับ (Hold)', value: summary.on_hold, color: '#DC2626' },
              { label: 'ตู้เย็น', value: summary.reefer, color: '#06B6D4' },
              { label: 'ออกวันนี้', value: summary.gated_out_today, color: '#64748B' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 rounded p-2">
                <span className="font-bold text-sm" style={{ color: item.color }}>{item.value}</span>
                <br />{item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gate Activity (7 days) */}
      {charts?.gateActivity && (
        <div className="border border-slate-200 rounded-lg p-3 mb-5">
          <h3 className="font-bold text-xs mb-2">Gate Activity (7 วัน)</h3>
          <table className="w-full text-[10px] border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-2 py-1.5 border-b border-slate-200">วัน</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">Gate-In</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">Gate-Out</th>
              </tr>
            </thead>
            <tbody>
              {charts.gateActivity.map((d: { date: string; gate_in: number; gate_out: number }, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1">{d.date}</td>
                  <td className="px-2 py-1 text-right font-semibold text-blue-600">{d.gate_in}</td>
                  <td className="px-2 py-1 text-right font-semibold text-red-600">{d.gate_out}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revenue Trend (7 days) */}
      {charts?.revenueTrend && (
        <div className="border border-slate-200 rounded-lg p-3 mb-5">
          <h3 className="font-bold text-xs mb-2">Revenue Trend (7 วัน)</h3>
          <table className="w-full text-[10px] border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-2 py-1.5 border-b border-slate-200">วัน</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">รายได้</th>
              </tr>
            </thead>
            <tbody>
              {charts.revenueTrend.map((d: { date: string; revenue: number }, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1">{d.date}</td>
                  <td className="px-2 py-1 text-right font-semibold">฿{d.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dwell Distribution + Shipping Line — side by side */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {charts?.dwellDistribution && (
          <div className="border border-slate-200 rounded-lg p-3">
            <h3 className="font-bold text-xs mb-2">Dwell Time Distribution</h3>
            <table className="w-full text-[10px]">
              <tbody>
                {charts.dwellDistribution.map((d: { name: string; value: number; color: string }, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: d.color }}></span>
                      {d.name}
                    </td>
                    <td className="py-1.5 text-right font-bold">{d.value} ตู้</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {charts?.byShippingLine && (
          <div className="border border-slate-200 rounded-lg p-3">
            <h3 className="font-bold text-xs mb-2">ตู้ตามสายเรือ</h3>
            <table className="w-full text-[10px]">
              <tbody>
                {charts.byShippingLine.map((d: { name: string; value: number }, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5">{d.name}</td>
                    <td className="py-1.5 text-right font-bold">{d.value} ตู้</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-3 mt-8 flex justify-between text-[9px] text-slate-400">
        <span>CYMS — Container Yard Management System</span>
        <span>ผู้พิมพ์: ระบบ • {new Date().toLocaleString('th-TH')}</span>
      </div>

      {/* Print / Close Buttons */}
      <div className="no-print flex justify-center gap-3 mt-8">
        <button onClick={() => window.print()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          🖨️ พิมพ์ / Save PDF
        </button>
        <button onClick={() => window.close()}
          className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200">
          ปิดหน้านี้
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

const CHARGE_LABELS: Record<string, string> = {
  storage: 'ค่าฝากตู้', lolo: 'ค่ายก LOLO', mnr: 'ค่าซ่อม M&R',
  washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น', other: 'อื่นๆ',
};

interface InvoiceRow {
  invoice_id: number; invoice_number: string; customer_name: string;
  charge_type: string; container_number: string; grand_total: number;
  total_amount: number; vat_amount: number; status: string;
  description: string; quantity: number; unit_price: number;
  created_at: string; paid_at: string;
}

interface ChargeBreakdown {
  charge_type: string; count: number; total: number;
}

interface TopCustomer {
  customer_name: string; invoice_count: number; total: number;
}

interface DailyData {
  date: string; total: number; collected: number; count: number;
}

export default function ReportPrintPage() {
  const params = useSearchParams();
  const type = params.get('type') || 'daily';
  const date = params.get('date') || new Date().toISOString().slice(0, 10);
  const yardId = params.get('yard_id') || '1';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<{ company_name: string; address: string; phone: string; tax_id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Get auth token
      const authHeaders: HeadersInit = {};
      try {
        const s = localStorage.getItem('cyms_session');
        if (s) {
          const session = JSON.parse(s);
          if (session?.token) authHeaders['Authorization'] = `Bearer ${session.token}`;
        }
      } catch { /* */ }

      const [reportRes, companyRes] = await Promise.all([
        fetch(`/api/billing/reports?yard_id=${yardId}&type=${type}&date=${date}`, { headers: authHeaders }),
        fetch('/api/settings/company', { headers: authHeaders }),
      ]);
      const report = await reportRes.json();
      const comp = await companyRes.json();
      if (!report.error) setData(report);
      if (comp && !comp.error) setCompany(comp);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [yardId, type, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto print after load
  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">กำลังโหลดรายงาน...</div>;
  if (!data?.summary) return <div className="flex items-center justify-center min-h-screen text-slate-400">ไม่พบข้อมูล</div>;

  const s = data.summary;
  const thaiDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const thaiMonth = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  };

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
          {company?.tax_id && <p className="text-[10px] text-slate-500">เลขประจำตัวผู้เสียภาษี: {company.tax_id}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-base font-bold text-slate-900">
            {type === 'daily' ? 'รายงานประจำวัน' : 'รายงานประจำเดือน'}
          </h2>
          <p className="text-sm font-semibold text-blue-700 mt-0.5">
            {type === 'daily' ? thaiDate(date) : thaiMonth(date)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
          </p>
        </div>
      </div>

      {/* Summary Box */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'ยอดเรียกเก็บ', value: s.total_billed, color: '#2563EB' },
          { label: 'เก็บเงินได้', value: s.total_collected, color: '#059669' },
          { label: 'ค้างชำระ', value: s.total_outstanding, color: '#D97706' },
          { label: type === 'monthly' ? 'VAT รวม' : 'จำนวนบิลทั้งหมด', value: type === 'monthly' ? s.total_vat : s.total_invoices, isCurrency: type === 'monthly' },
        ].map((kpi, i) => (
          <div key={i} className="border border-slate-200 rounded-lg p-2.5 text-center">
            <p className="text-[9px] text-slate-400 uppercase font-semibold">{kpi.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: kpi.color || '#334155' }}>
              {kpi.isCurrency !== false && typeof kpi.value === 'number' && kpi.label !== 'จำนวนบิลทั้งหมด'
                ? `฿${kpi.value.toLocaleString()}` : kpi.value?.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Status Summary Row */}
      <div className="grid grid-cols-4 gap-2 mb-5 text-center text-[10px]">
        <div className="bg-slate-50 rounded p-2"><span className="font-bold text-sm">{s.total_invoices}</span><br />ทั้งหมด</div>
        <div className="bg-emerald-50 rounded p-2"><span className="font-bold text-sm text-emerald-600">{s.paid_count}</span><br />ชำระแล้ว</div>
        <div className="bg-blue-50 rounded p-2"><span className="font-bold text-sm text-blue-600">{s.issued_count}</span><br />ค้างชำระ</div>
        <div className="bg-slate-50 rounded p-2"><span className="font-bold text-sm text-slate-400">{s.cancelled_count}</span><br />ยกเลิก</div>
      </div>

      {/* Gate Activity */}
      {data.gateActivity && (
        <div className="border border-slate-200 rounded-lg p-3 mb-5">
          <h3 className="font-bold text-xs mb-2">กิจกรรม Gate</h3>
          <div className="flex gap-8">
            <span>Gate-In: <strong className="text-emerald-600">{data.gateActivity.gate_in}</strong> ครั้ง</span>
            <span>Gate-Out: <strong className="text-amber-600">{data.gateActivity.gate_out}</strong> ครั้ง</span>
          </div>
        </div>
      )}

      {/* Charge Type Breakdown */}
      {data.byChargeType && data.byChargeType.length > 0 && (
        <div className="mb-5">
          <h3 className="font-bold text-xs mb-2">แยกตามประเภทค่าบริการ</h3>
          <table className="w-full text-[10px] border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-2 py-1.5 border-b border-slate-200">ประเภท</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">จำนวน</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {data.byChargeType.map((ct: ChargeBreakdown, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">{CHARGE_LABELS[ct.charge_type] || ct.charge_type}</td>
                  <td className="px-2 py-1.5 text-right">{ct.count}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">฿{ct.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily report: Invoice list */}
      {type === 'daily' && data.invoices && data.invoices.length > 0 && (
        <div className="mb-5">
          <h3 className="font-bold text-xs mb-2">รายการใบแจ้งหนี้ ({data.invoices.length} รายการ)</h3>
          <table className="w-full text-[10px] border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-2 py-1.5 border-b border-slate-200">#</th>
                <th className="text-left px-2 py-1.5 border-b border-slate-200">เลขบิล</th>
                <th className="text-left px-2 py-1.5 border-b border-slate-200">ลูกค้า</th>
                <th className="text-left px-2 py-1.5 border-b border-slate-200">ประเภท</th>
                <th className="text-left px-2 py-1.5 border-b border-slate-200">ตู้</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">ก่อน VAT</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">VAT</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">รวม</th>
                <th className="text-center px-2 py-1.5 border-b border-slate-200">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv: InvoiceRow, i: number) => (
                <tr key={inv.invoice_id} className="border-b border-slate-100">
                  <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1 font-mono font-semibold">{inv.invoice_number}</td>
                  <td className="px-2 py-1">{inv.customer_name || '-'}</td>
                  <td className="px-2 py-1">{CHARGE_LABELS[inv.charge_type] || inv.charge_type}</td>
                  <td className="px-2 py-1 font-mono">{inv.container_number || '-'}</td>
                  <td className="px-2 py-1 text-right">฿{inv.total_amount?.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right">฿{inv.vat_amount?.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right font-semibold">฿{inv.grand_total?.toLocaleString()}</td>
                  <td className="px-2 py-1 text-center">
                    {inv.status === 'paid' ? 'ชำระ' : inv.status === 'issued' ? 'แจ้งหนี้' : inv.status === 'cancelled' ? 'ยกเลิก' : inv.status}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-slate-50 font-bold">
                <td colSpan={5} className="px-2 py-1.5 text-right">รวมทั้งหมด</td>
                <td className="px-2 py-1.5 text-right">
                  ฿{data.invoices.filter((i: InvoiceRow) => i.status !== 'cancelled').reduce((sum: number, i: InvoiceRow) => sum + (i.total_amount || 0), 0).toLocaleString()}
                </td>
                <td className="px-2 py-1.5 text-right">
                  ฿{data.invoices.filter((i: InvoiceRow) => i.status !== 'cancelled').reduce((sum: number, i: InvoiceRow) => sum + (i.vat_amount || 0), 0).toLocaleString()}
                </td>
                <td className="px-2 py-1.5 text-right">
                  ฿{data.invoices.filter((i: InvoiceRow) => i.status !== 'cancelled').reduce((sum: number, i: InvoiceRow) => sum + (i.grand_total || 0), 0).toLocaleString()}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly: Top Customers */}
      {type === 'monthly' && data.topCustomers && data.topCustomers.length > 0 && (
        <div className="mb-5">
          <h3 className="font-bold text-xs mb-2">ลูกค้า Top 10</h3>
          <table className="w-full text-[10px] border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-center px-2 py-1.5 border-b border-slate-200 w-8">#</th>
                <th className="text-left px-2 py-1.5 border-b border-slate-200">ลูกค้า</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">จำนวนบิล</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {data.topCustomers.map((c: TopCustomer, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-center font-bold">{i + 1}</td>
                  <td className="px-2 py-1.5">{c.customer_name || 'ไม่ระบุ'}</td>
                  <td className="px-2 py-1.5 text-right">{c.invoice_count}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">฿{c.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly: Daily Breakdown Table */}
      {type === 'monthly' && data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
        <div className="mb-5">
          <h3 className="font-bold text-xs mb-2">ยอดรายวัน</h3>
          <table className="w-full text-[10px] border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-2 py-1.5 border-b border-slate-200">วันที่</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">จำนวนบิล</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">ยอดรวม</th>
                <th className="text-right px-2 py-1.5 border-b border-slate-200">เก็บได้</th>
              </tr>
            </thead>
            <tbody>
              {data.dailyBreakdown.map((d: DailyData, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1">{new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-2 py-1 text-right">{d.count}</td>
                  <td className="px-2 py-1 text-right font-semibold">฿{d.total.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right text-emerald-600">฿{d.collected.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-2 py-1.5">รวม</td>
                <td className="px-2 py-1.5 text-right">{data.dailyBreakdown.reduce((sum: number, d: DailyData) => sum + d.count, 0)}</td>
                <td className="px-2 py-1.5 text-right">฿{data.dailyBreakdown.reduce((sum: number, d: DailyData) => sum + d.total, 0).toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right text-emerald-600">฿{data.dailyBreakdown.reduce((sum: number, d: DailyData) => sum + d.collected, 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-3 mt-8 flex justify-between text-[9px] text-slate-400">
        <span>CYMS — Container Yard Management System</span>
        <span>ผู้พิมพ์: ระบบ • {new Date().toLocaleString('th-TH')}</span>
      </div>

      {/* Print / Close Buttons */}
      <div className="no-print flex justify-center gap-3 mt-8">
        <button onClick={() => window.print()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          🖨️ พิมพ์
        </button>
        <button onClick={() => window.close()}
          className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200">
          ปิดหน้านี้
        </button>
      </div>
    </div>
  );
}

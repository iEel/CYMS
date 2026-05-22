'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface StatementRow {
  statement_id: number;
  statement_number: string;
  customer_name?: string;
  billing_address?: string;
  customer_address?: string;
  customer_tax_id?: string;
  yard_id: number;
  period_from?: string | null;
  period_to?: string | null;
  due_date?: string | null;
  total_amount: number;
  vat_amount: number;
  grand_total: number;
  status: string;
}

interface StatementLine {
  line_id: number;
  invoice_id: number;
  invoice_number: string;
  description?: string;
  charge_type?: string;
  container_number?: string;
  due_date?: string | null;
  created_at?: string | null;
  line_total: number;
}

interface CompanyData {
  company_name: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PrintBillingStatementPage() {
  const params = useSearchParams();
  const statementId = params.get('id');
  const yardId = params.get('yard_id') || '1';
  const [statement, setStatement] = useState<StatementRow | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!statementId) return;
    const authHeaders: HeadersInit = {};
    try {
      const raw = localStorage.getItem('cyms_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.token) authHeaders.Authorization = `Bearer ${session.token}`;
      }
    } catch { /* ignore */ }

    Promise.all([
      fetch(`/api/billing/statements?yard_id=${yardId}&statement_id=${statementId}`, { headers: authHeaders }).then(r => r.json()),
      fetch('/api/settings/company', { headers: authHeaders }).then(r => r.json()).catch(() => null),
    ]).then(([statementData, companyData]) => {
      setStatement(statementData.statement || null);
      setLines(statementData.lines || []);
      setCompany(companyData?.company_name ? companyData : null);
    }).finally(() => setLoading(false));
  }, [statementId, yardId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!statement) return <div className="p-8 text-center text-red-500">ไม่พบใบวางบิล</div>;

  return (
    <>
      <style jsx global>{`
        body { margin: 0; background: #f1f5f9; }
        .doc { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 18mm; box-sizing: border-box; font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; color: #0f172a; }
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .doc { padding: 0; width: auto; min-height: auto; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>
      <div className="no-print fixed right-4 top-4 z-50">
        <button onClick={() => window.print()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700">พิมพ์</button>
      </div>
      <main className="doc">
        <header className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-bold">{company?.company_name || 'CYMS'}</h1>
            {company?.tax_id && <p className="mt-1 text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี: {company.tax_id}</p>}
            {company?.address && <p className="mt-1 max-w-md text-xs text-slate-500">{company.address}</p>}
            {(company?.phone || company?.email) && <p className="mt-1 text-xs text-slate-500">{company.phone || ''} {company.email || ''}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">ใบวางบิล</p>
            <p className="text-sm text-slate-500">Billing Statement</p>
            <p className="mt-2 font-mono text-sm font-semibold">{statement.statement_number}</p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">ลูกค้า</p>
            <p className="mt-1 font-semibold">{statement.customer_name || '-'}</p>
            {statement.customer_tax_id && <p className="text-xs text-slate-500">Tax ID: {statement.customer_tax_id}</p>}
            <p className="mt-1 text-xs text-slate-500">{statement.billing_address || statement.customer_address || '-'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="text-slate-400">รอบบิล</span><span className="text-right">{formatDate(statement.period_from)} - {formatDate(statement.period_to)}</span>
            <span className="text-slate-400">ครบกำหนด</span><span className="text-right">{formatDate(statement.due_date)}</span>
            <span className="text-slate-400">สถานะ</span><span className="text-right">{statement.status}</span>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="py-2 text-left">#</th>
              <th className="py-2 text-left">Invoice</th>
              <th className="py-2 text-left">รายละเอียด</th>
              <th className="py-2 text-left">ตู้</th>
              <th className="py-2 text-right">ยอด</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.line_id || line.invoice_id} className="border-b border-slate-100">
                <td className="py-2">{index + 1}</td>
                <td className="py-2 font-mono">{line.invoice_number}</td>
                <td className="py-2">{line.description || line.charge_type || '-'}</td>
                <td className="py-2 font-mono">{line.container_number || '-'}</td>
                <td className="py-2 text-right font-semibold">฿{money(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 ml-auto w-72 space-y-2 text-sm">
          <div className="flex justify-between"><span>ยอดก่อน VAT</span><span>฿{money(statement.total_amount)}</span></div>
          <div className="flex justify-between"><span>VAT 7%</span><span>฿{money(statement.vat_amount)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-lg font-bold"><span>ยอดรวม</span><span>฿{money(statement.grand_total)}</span></div>
        </section>
      </main>
    </>
  );
}

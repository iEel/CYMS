'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface InvoiceData {
  invoice_id: number; invoice_number: string; customer_name: string;
  container_number: string; charge_type: string; description: string;
  quantity: number; unit_price: number; total_amount: number;
  vat_amount: number; grand_total: number; status: string;
  due_date: string; paid_at: string; created_at: string;
  customer_tax_id?: string; customer_address?: string;
  customer_branch_type?: string; customer_branch_number?: string;
}

interface CompanyData {
  company_name: string; tax_id: string; address: string;
  phone: string; email: string; logo_url: string;
  branch_type: string; branch_number: string;
}

function numberToThaiText(num: number): string {
  const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  if (num === 0) return 'ศูนย์บาทถ้วน';

  const intPart = Math.floor(num);
  const decimalPart = Math.round((num - intPart) * 100);
  
  function intToThai(n: number): string {
    if (n === 0) return '';
    const s = String(n);
    let result = '';
    for (let i = 0; i < s.length; i++) {
      const d = parseInt(s[i]);
      const pos = s.length - 1 - i;
      if (d === 0) continue;
      if (pos === 1 && d === 1) { result += 'สิบ'; continue; }
      if (pos === 1 && d === 2) { result += 'ยี่สิบ'; continue; }
      if (pos === 0 && d === 1 && s.length > 1) { result += 'เอ็ด'; continue; }
      result += digits[d] + units[pos];
    }
    return result;
  }

  let text = intToThai(intPart) + 'บาท';
  if (decimalPart > 0) {
    text += intToThai(decimalPart) + 'สตางค์';
  } else {
    text += 'ถ้วน';
  }
  return text;
}

export default function PrintInvoicePage() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('id');
  const docType = searchParams.get('type') || 'invoice'; // 'invoice' or 'receipt'

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    const load = async () => {
      try {
        // Fetch invoice detail
        const invRes = await fetch(`/api/billing/invoices?invoice_id=${invoiceId}`);
        const invData = await invRes.json();
        if (invData.invoices?.length > 0) {
          setInvoice(invData.invoices[0]);
        }
        // Fetch company profile
        const compRes = await fetch('/api/settings/company');
        const compData = await compRes.json();
        if (compData && compData.company_name) {
          setCompany(compData);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [invoiceId]);

  // Auto-print after loaded
  useEffect(() => {
    if (!loading && invoice) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, invoice]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!invoice) {
    return <div className="p-8 text-center text-red-500">ไม่พบใบแจ้งหนี้</div>;
  }

  const isReceipt = docType === 'receipt';
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
        }
        @page { size: A4; margin: 15mm; }
        .doc-body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium shadow-lg hover:bg-blue-700">
          🖨️ พิมพ์
        </button>
        <button onClick={() => window.close()} className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-medium shadow-lg hover:bg-slate-300">
          ✕ ปิด
        </button>
      </div>

      <div className="doc-body max-w-[210mm] mx-auto bg-white p-8 print-page" style={{ minHeight: '297mm' }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex-1">
            {company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="h-16 mb-2" style={{ maxWidth: '200px', objectFit: 'contain' }} />
            )}
            <h2 className="text-lg font-bold text-slate-800">{company?.company_name || 'บริษัท ลานตู้คอนเทนเนอร์ จำกัด'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{company?.address || ''}</p>
            <p className="text-xs text-slate-500">
              โทร: {company?.phone || '-'} | อีเมล: {company?.email || '-'}
            </p>
            <p className="text-xs text-slate-500">
              เลขประจำตัวผู้เสียภาษี: {company?.tax_id || '-'}
              {company?.branch_type === 'head_office' ? ' (สำนักงานใหญ่)' : company?.branch_number ? ` (สาขา ${company.branch_number})` : ''}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold" style={{ color: isReceipt ? '#059669' : '#2563eb' }}>
              {isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{isReceipt ? 'Receipt / Tax Invoice' : 'Invoice / Tax Invoice'}</p>
            <div className="mt-3 text-sm">
              <p><span className="text-slate-500">เลขที่:</span> <strong className="font-mono">{invoice.invoice_number}</strong></p>
              <p><span className="text-slate-500">วันที่:</span> {formatDate(invoice.created_at)}</p>
              {isReceipt && invoice.paid_at && (
                <p><span className="text-slate-500">วันที่ชำระ:</span> {formatDate(invoice.paid_at)}</p>
              )}
              {!isReceipt && invoice.due_date && (
                <p><span className="text-slate-500">ครบกำหนด:</span> {formatDate(invoice.due_date)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-1">ข้อมูลลูกค้า</p>
          <p className="text-sm font-semibold text-slate-800">{invoice.customer_name || 'ลูกค้าทั่วไป'}</p>
          {invoice.customer_tax_id && (
            <p className="text-xs text-slate-500">เลขผู้เสียภาษี: {invoice.customer_tax_id}
              {invoice.customer_branch_type === 'head_office' ? ' (สำนักงานใหญ่)' : invoice.customer_branch_number ? ` (สาขา ${invoice.customer_branch_number})` : ''}
            </p>
          )}
          {invoice.customer_address && <p className="text-xs text-slate-500">{invoice.customer_address}</p>}
          {invoice.container_number && <p className="text-xs text-slate-500 mt-1">เลขตู้: <strong className="font-mono">{invoice.container_number}</strong></p>}
        </div>

        {/* Items Table */}
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-y-2 border-slate-800">
              <th className="text-left py-2 w-8">ลำดับ</th>
              <th className="text-left py-2">รายการ</th>
              <th className="text-right py-2 w-20">จำนวน</th>
              <th className="text-right py-2 w-28">ราคาต่อหน่วย</th>
              <th className="text-right py-2 w-28">รวม</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-2">1</td>
              <td className="py-2">{invoice.description || invoice.charge_type}</td>
              <td className="py-2 text-right">{invoice.quantity}</td>
              <td className="py-2 text-right font-mono">฿{invoice.unit_price?.toLocaleString()}</td>
              <td className="py-2 text-right font-mono">฿{invoice.total_amount?.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {/* Summary */}
        <div className="flex justify-end mb-6">
          <div className="w-64">
            <div className="flex justify-between py-1 text-sm">
              <span className="text-slate-500">รวมเป็นเงิน</span>
              <span className="font-mono">฿{invoice.total_amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-slate-500">ภาษีมูลค่าเพิ่ม 7%</span>
              <span className="font-mono">฿{invoice.vat_amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 text-base font-bold border-t-2 border-slate-800 mt-1">
              <span>ยอดรวมทั้งสิ้น</span>
              <span className="font-mono" style={{ color: isReceipt ? '#059669' : '#2563eb' }}>฿{invoice.grand_total?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Thai Amount Text */}
        <div className="p-3 bg-slate-50 rounded-lg mb-6 text-sm">
          <span className="text-slate-500">จำนวนเงิน (ตัวอักษร): </span>
          <strong>{numberToThaiText(invoice.grand_total || 0)}</strong>
        </div>

        {/* Payment Status (for receipt) */}
        {isReceipt && (
          <div className="p-4 border-2 border-emerald-500 rounded-lg text-center mb-6">
            <p className="text-lg font-bold text-emerald-600">✅ ชำระเงินแล้ว</p>
            <p className="text-xs text-slate-500 mt-1">วันที่ชำระ: {formatDate(invoice.paid_at)}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-8" style={{ marginTop: '80px' }}>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-b border-slate-300 mb-1 h-12"></div>
              <p className="text-xs text-slate-500">ผู้รับเงิน / Received by</p>
              <p className="text-xs text-slate-400 mt-0.5">วันที่ ____/____/____</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-300 mb-1 h-12"></div>
              <p className="text-xs text-slate-500">ผู้อนุมัติ / Authorized by</p>
              <p className="text-xs text-slate-400 mt-0.5">วันที่ ____/____/____</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            <p>เอกสารนี้ออกโดยระบบ CYMS — Container Yard Management System</p>
            <p>พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      </div>
    </>
  );
}

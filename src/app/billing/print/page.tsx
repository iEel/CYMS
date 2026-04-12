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
  notes?: string;
  container_id?: number; yard_id?: number;
}

interface InvoiceNotes {
  charges?: { description: string; quantity: number; unit_price: number; subtotal: number }[];
  payment_method?: 'cash' | 'transfer' | 'credit';
  payment_status?: 'paid' | 'credit';
  document_type?: 'invoice' | 'receipt';
  transaction_type?: string;
  container_number?: string;
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

  const [chargeLines, setChargeLines] = useState<{ description: string; quantity: number; unit_price: number; subtotal: number }[]>([]);
  const [invoiceNotes, setInvoiceNotes] = useState<InvoiceNotes | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    const load = async () => {
      try {
        // Get auth token from localStorage
        const authHeaders: HeadersInit = {};
        try {
          const s = localStorage.getItem('cyms_session');
          if (s) {
            const session = JSON.parse(s);
            if (session?.token) authHeaders['Authorization'] = `Bearer ${session.token}`;
          }
        } catch { /* */ }

        // Fetch invoice detail
        const invRes = await fetch(`/api/billing/invoices?invoice_id=${invoiceId}`, { headers: authHeaders });
        const invData = await invRes.json();
        const inv = invData.invoices?.[0];
        if (inv) {
          setInvoice(inv);

          // Try to parse charges from notes
          let parsed = false;
          try {
            if (inv.notes) {
              const notesData = JSON.parse(inv.notes) as InvoiceNotes;
              setInvoiceNotes(notesData);
              const noteCharges = notesData.charges || [];
              if (noteCharges.length > 0) {
                setChargeLines(noteCharges.filter((c: { subtotal: number }) => c.subtotal > 0));
                parsed = true;
              }
            }
          } catch { /* ignore */ }

          // Fallback: call gate-check to get live breakdown
          if (!parsed && inv.container_id && inv.yard_id) {
            try {
              const gcRes = await fetch('/api/billing/gate-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ yard_id: inv.yard_id, container_id: inv.container_id }),
              });
              const gcData = await gcRes.json();
              if (gcData.charges?.length > 0) {
                setChargeLines(gcData.charges.filter((c: { subtotal: number }) => c.subtotal > 0));
                parsed = true;
              }
            } catch { /* ignore */ }
          }

          // Final fallback: single line
          if (!parsed) {
            setChargeLines([{ description: inv.description || inv.charge_type, quantity: inv.quantity, unit_price: inv.unit_price, subtotal: inv.total_amount }]);
          }
        }

        // Fetch company profile
        const compRes = await fetch('/api/settings/company', { headers: authHeaders });
        const compData = await compRes.json();
        if (compData && compData.company_name) setCompany(compData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [invoiceId]);

  // Removed auto-print — user clicks the print button instead

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

  const isCreditNote = invoice.status === 'credit_note' || invoice.invoice_number?.startsWith('CN-');
  const isReceipt = !isCreditNote && invoice.status === 'paid';
  const documentTitle = isCreditNote ? 'ใบลดหนี้' : isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้';
  const documentSubtitle = isCreditNote ? 'Credit Note' : isReceipt ? 'Receipt' : 'Invoice';
  const statusLabel = (() => {
    if (isCreditNote) return { text: 'ใบลดหนี้', color: '#7c3aed', bg: '#f3e8ff', border: '#c4b5fd' };
    if (invoice.status === 'paid') return { text: 'ชำระเงินแล้ว', color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' };
    if (invoice.status === 'cancelled') return { text: 'ยกเลิกแล้ว', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    if (invoice.status === 'overdue') return { text: 'เกินกำหนดชำระ', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' };
    return { text: 'รอชำระ / วางบิล', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' };
  })();
  const paymentMethodText = invoiceNotes?.payment_method === 'cash'
    ? 'เงินสด'
    : invoiceNotes?.payment_method === 'transfer'
      ? 'โอน'
      : invoiceNotes?.payment_method === 'credit'
        ? 'เครดิต'
        : '';
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

  return (
    <>
      <style jsx global>{`
        body { margin: 0; padding: 0; background: #f1f5f9; }
        .doc-body { 
          font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
          font-size: 11px;
          max-width: 210mm;
          margin: 0 auto;
          background: white;
          padding: 2rem;
          box-sizing: border-box;
        }
        @media print {
          body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .doc-body { padding: 0; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      {/* Print button */}
      <div className="no-print" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 50, display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => window.print()} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', background: '#2563eb', color: 'white', fontWeight: 500, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          🖨️ พิมพ์
        </button>
        <button onClick={() => window.close()} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', background: '#e2e8f0', color: '#475569', fontWeight: 500, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          ✕ ปิด
        </button>
      </div>

      <div className="doc-body">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-1">
              {company?.logo_url && (
                <img src={company.logo_url} alt="Logo" className="h-12 w-12 object-contain flex-shrink-0" />
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {company?.company_name || 'บริษัท ลานตู้คอนเทนเนอร์ จำกัด'}
                  {company?.branch_type === 'head_office' ? ' (สำนักงานใหญ่)' : company?.branch_number ? ` (สาขา ${company.branch_number})` : ''}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{company?.address || ''}</p>
                <p className="text-xs text-slate-500">
                  เลขประจำตัวผู้เสียภาษี: {company?.tax_id || '-'}
                </p>
                <p className="text-xs text-slate-500">
                  โทร: {company?.phone || '-'} | อีเมล: {company?.email || '-'}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold" style={{ color: isReceipt ? '#059669' : '#2563eb' }}>
              {documentTitle}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{documentSubtitle}</p>
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
            <div className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold" style={{ color: statusLabel.color, background: statusLabel.bg, border: `1px solid ${statusLabel.border}` }}>
              {statusLabel.text}{paymentMethodText ? ` • ${paymentMethodText}` : ''}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-1">ข้อมูลลูกค้า</p>
          <p className="text-sm font-semibold text-slate-800">
            {invoice.customer_name || 'ลูกค้าทั่วไป'}
            {invoice.customer_branch_type === 'head_office' ? ' (สำนักงานใหญ่)' : invoice.customer_branch_number ? ` (สาขา ${invoice.customer_branch_number})` : ''}
          </p>
          {invoice.customer_address && <p className="text-xs text-slate-500">{invoice.customer_address}</p>}
          {invoice.customer_tax_id && (
            <p className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี: {invoice.customer_tax_id}</p>
          )}
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
            {chargeLines.map((line, idx) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="py-2">{idx + 1}</td>
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right">{line.quantity}</td>
                <td className="py-2 text-right font-mono">฿{line.unit_price?.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">฿{line.subtotal?.toLocaleString()}</td>
              </tr>
            ))}
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

        {/* Document Status */}
        <div className="p-4 rounded-lg text-center mb-6" style={{ border: `2px solid ${statusLabel.border}`, background: statusLabel.bg }}>
          <p className="text-lg font-bold" style={{ color: statusLabel.color }}>{statusLabel.text}</p>
          {isReceipt ? (
            <p className="text-xs text-slate-500 mt-1">วันที่ชำระ: {formatDate(invoice.paid_at)}</p>
          ) : invoice.due_date ? (
            <p className="text-xs text-slate-500 mt-1">ครบกำหนดชำระ: {formatDate(invoice.due_date)}</p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">เอกสารนี้ยังไม่ใช่ใบเสร็จรับเงิน</p>
          )}
        </div>

        {docType === 'receipt' && !isReceipt && !isCreditNote && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 text-xs text-amber-700">
            ระบบแสดงเป็นใบแจ้งหนี้ เพราะรายการนี้ยังไม่มีสถานะชำระเงิน
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-8" style={{ marginTop: '30px' }}>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-b border-slate-300 mb-1 h-12"></div>
              <p className="text-xs text-slate-500">{isReceipt ? 'ผู้จ่าย / Paid by' : 'ผู้รับวางบิล / Acknowledged by'}</p>
              <p className="text-xs text-slate-400 mt-0.5">วันที่ ____/____/____</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-300 mb-1 h-12"></div>
              <p className="text-xs text-slate-500">{isReceipt ? 'ผู้รับเงิน / Received by' : 'ผู้ออกเอกสาร / Issued by'}</p>
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

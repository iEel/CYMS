/**
 * PDF Report Generator — CYMS
 * ใช้ jspdf + jspdf-autotable สำหรับสร้าง PDF รายงาน
 * รองรับภาษาไทยผ่าน Google Sarabun font (embedded base64)
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sarabunBase64 } from './sarabunFont';

// ─── Thai Font (Sarabun — Google Fonts, embedded base64) ───
const FONT_NAME = 'Sarabun';

function setupDoc(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  // Register Sarabun Thai font
  doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64);
  doc.addFont('Sarabun-Regular.ttf', FONT_NAME, 'normal');
  doc.setFont(FONT_NAME);
  return doc;
}

function getFontName() { return FONT_NAME; }

function formatCurrency(n: number): string {
  return `${n?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CHARGE_LABELS: Record<string, string> = {
  storage: 'ค่าฝากตู้', lolo: 'ค่ายก LOLO', mnr: 'ค่าซ่อม M&R',
  washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น',
  gate: 'ค่า Gate', other: 'อื่นๆ',
};

const STATUS_LABELS: Record<string, string> = {
  paid: 'ชำระแล้ว', issued: 'แจ้งหนี้', pending: 'รอ', cancelled: 'ยกเลิก',
  draft: 'ร่าง', credit_note: 'ใบลดหนี้',
};

// ─────────────────── BILLING REPORT PDF ───────────────────

interface BillingReportData {
  summary: {
    total_billed: number;
    total_collected: number;
    total_outstanding: number;
    total_invoices: number;
    total_vat?: number;
  };
  gateActivity?: { gate_in: number; gate_out: number };
  byChargeType?: Array<{ charge_type: string; count: number; total: number }>;
  invoices?: Array<{
    invoice_number: string;
    customer_name: string;
    charge_type: string;
    container_number: string;
    grand_total: number;
    status: string;
  }>;
  topCustomers?: Array<{ customer_name: string; invoice_count: number; total: number }>;
  dailyBreakdown?: Array<{ date: string; total: number; collected: number; count: number }>;
}

export async function generateBillingReportPDF(
  data: BillingReportData,
  reportType: 'daily' | 'monthly',
  dateLabel: string,
  companyName?: string,
) {
  const doc = setupDoc();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ─── Header ───
  doc.setFontSize(18);
  doc.text(companyName || 'CYMS - Container Yard Management System', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(14);
  const title = reportType === 'daily'
    ? `รายงานประจำวัน — ${dateLabel}`
    : `รายงานประจำเดือน — ${dateLabel}`;
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0);
  y += 8;

  // ─── Summary KPIs ───
  const s = data.summary;
  doc.setFontSize(11);

  const kpiData = [
    ['ยอดเรียกเก็บ', `฿${formatCurrency(s.total_billed)}`],
    ['เก็บเงินได้', `฿${formatCurrency(s.total_collected)}`],
    ['ค้างชำระ', `฿${formatCurrency(s.total_outstanding)}`],
    [reportType === 'monthly' ? 'VAT รวม' : 'จำนวนบิล', reportType === 'monthly' ? `฿${formatCurrency(s.total_vat || 0)}` : `${s.total_invoices} รายการ`],
  ];

  autoTable(doc, {
    startY: y,
    head: [['รายการ', 'ยอด']],
    body: kpiData,
    theme: 'grid',
    styles: { font: getFontName(), fontSize: 11, cellPadding: 3 },
    headStyles: { fontStyle: 'normal', fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── Gate Activity ───
  if (data.gateActivity) {
    doc.setFontSize(12);
    doc.text('กิจกรรม Gate', 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['ประเภท', 'จำนวน']],
      body: [
        ['Gate-In (รับเข้า)', `${data.gateActivity.gate_in} ตู้`],
        ['Gate-Out (ปล่อยออก)', `${data.gateActivity.gate_out} ตู้`],
      ],
      theme: 'striped',
      styles: { font: getFontName(), fontSize: 10, cellPadding: 2.5 },
      headStyles: { fontStyle: 'normal', fillColor: [16, 185, 129] },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── Breakdown by Charge Type ───
  if (data.byChargeType && data.byChargeType.length > 0) {
    doc.setFontSize(12);
    doc.text('แยกตามประเภทค่าบริการ', 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['ประเภท', 'จำนวนบิล', 'ยอดรวม (฿)']],
      body: data.byChargeType.map(ct => [
        CHARGE_LABELS[ct.charge_type] || ct.charge_type,
        `${ct.count}`,
        formatCurrency(ct.total),
      ]),
      theme: 'striped',
      styles: { font: getFontName(), fontSize: 10, cellPadding: 2.5 },
      headStyles: { fontStyle: 'normal', fillColor: [59, 130, 246] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── Top Customers (monthly) ───
  if (reportType === 'monthly' && data.topCustomers && data.topCustomers.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.text('ลูกค้า Top 10', 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['อันดับ', 'ลูกค้า', 'จำนวนบิล', 'ยอดรวม (฿)']],
      body: data.topCustomers.map((c, i) => [
        `${i + 1}`,
        c.customer_name || 'ไม่ระบุ',
        `${c.invoice_count}`,
        formatCurrency(c.total),
      ]),
      theme: 'striped',
      styles: { font: getFontName(), fontSize: 10, cellPadding: 2.5 },
      headStyles: { fontStyle: 'normal', fillColor: [245, 158, 11] },
      columnStyles: { 0: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── Daily Invoices (daily report) ───
  if (reportType === 'daily' && data.invoices && data.invoices.length > 0) {
    if (y > 200) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.text(`รายการบิลวันนี้ (${data.invoices.length} รายการ)`, 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['เลขบิล', 'ลูกค้า', 'ประเภท', 'ตู้', 'ยอดรวม (฿)', 'สถานะ']],
      body: data.invoices.map(inv => [
        inv.invoice_number,
        inv.customer_name || '-',
        CHARGE_LABELS[inv.charge_type] || inv.charge_type,
        inv.container_number || '-',
        formatCurrency(inv.grand_total),
        STATUS_LABELS[inv.status] || inv.status,
      ]),
      theme: 'striped',
      styles: { font: getFontName(), fontSize: 9, cellPadding: 2 },
      headStyles: { fontStyle: 'normal', fillColor: [30, 41, 59] },
      columnStyles: { 0: { cellWidth: 30 }, 4: { halign: 'right' }, 5: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── Monthly Daily Breakdown ───
  if (reportType === 'monthly' && data.dailyBreakdown && data.dailyBreakdown.length > 0) {
    if (y > 200) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.text('ยอดรายวันในเดือน', 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['วันที่', 'จำนวนบิล', 'ยอดรวม (฿)', 'เก็บได้ (฿)']],
      body: data.dailyBreakdown.map(d => [
        new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        `${d.count}`,
        formatCurrency(d.total),
        formatCurrency(d.collected),
      ]),
      theme: 'striped',
      styles: { font: getFontName(), fontSize: 9, cellPadding: 2 },
      headStyles: { fontStyle: 'normal', fillColor: [59, 130, 246] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
  }

  // ─── Footer ───
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`CYMS Report — หน้า ${i}/${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  // ─── Save ───
  const fileName = reportType === 'daily'
    ? `CYMS_Report_Daily_${dateLabel}.pdf`
    : `CYMS_Report_Monthly_${dateLabel}.pdf`;
  doc.save(fileName);
}

// ─────────────────── INVOICE PDF ───────────────────

interface InvoicePDFData {
  invoice_number: string;
  customer_name: string;
  customer_tax_id?: string;
  customer_address?: string;
  container_number?: string;
  charge_type: string;
  charges?: Array<{ description: string; quantity: number; unit_price: number; subtotal: number }>;
  total_before_vat: number;
  vat_amount: number;
  grand_total: number;
  status: string;
  created_at: string;
  paid_at?: string;
}

export async function generateInvoicePDF(
  inv: InvoicePDFData,
  company: { name: string; address?: string; tax_id?: string; phone?: string },
  isReceipt?: boolean,
) {
  const doc = setupDoc();
  
  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  // ─── Header ───
  doc.setFontSize(16);
  doc.text(company.name, pw / 2, y, { align: 'center' });
  y += 6;

  if (company.address) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(company.address, pw / 2, y, { align: 'center' });
    y += 4;
  }
  if (company.tax_id) {
    doc.text(`เลขประจำตัวผู้เสียภาษี: ${company.tax_id}`, pw / 2, y, { align: 'center' });
    y += 4;
  }
  if (company.phone) {
    doc.text(`โทร: ${company.phone}`, pw / 2, y, { align: 'center' });
    y += 4;
  }
  doc.setTextColor(0);
  y += 4;

  // ─── Document Title ───
  doc.setFontSize(14);
  const docTitle = isReceipt ? 'ใบเสร็จรับเงิน / Receipt' : 'ใบแจ้งหนี้ / Invoice';
  doc.text(docTitle, pw / 2, y, { align: 'center' });
  y += 8;

  // ─── Info Rows ───
  doc.setFontSize(10);
  const infoRows = [
    ['เลขที่เอกสาร:', inv.invoice_number],
    ['ลูกค้า:', inv.customer_name || '-'],
    ['เลขตู้:', inv.container_number || '-'],
    ['วันที่:', new Date(inv.created_at).toLocaleDateString('th-TH')],
  ];
  if (inv.customer_tax_id) infoRows.push(['เลขภาษี:', inv.customer_tax_id]);
  if (isReceipt && inv.paid_at) infoRows.push(['ชำระเมื่อ:', new Date(inv.paid_at).toLocaleDateString('th-TH')]);

  infoRows.forEach(([label, val]) => {
    doc.text(label, 20, y);
    doc.text(val, 60, y);
    y += 5;
  });
  y += 4;

  // ─── Charges Table ───
  const charges = inv.charges || [
    { description: CHARGE_LABELS[inv.charge_type] || inv.charge_type, quantity: 1, unit_price: inv.total_before_vat, subtotal: inv.total_before_vat },
  ];

  autoTable(doc, {
    startY: y,
    head: [['#', 'รายการ', 'จำนวน', 'ราคา/หน่วย (฿)', 'รวม (฿)']],
    body: charges.map((c, i) => [
      `${i + 1}`,
      c.description,
      `${c.quantity}`,
      formatCurrency(c.unit_price),
      formatCurrency(c.subtotal),
    ]),
    foot: [
      ['', '', '', 'ยอดรวมก่อน VAT', `฿${formatCurrency(inv.total_before_vat)}`],
      ['', '', '', 'VAT 7%', `฿${formatCurrency(inv.vat_amount)}`],
      ['', '', '', 'ยอดสุทธิ', `฿${formatCurrency(inv.grand_total)}`],
    ],
    theme: 'grid',
    styles: { font: getFontName(), fontSize: 10, cellPadding: 3 },
    headStyles: { fontStyle: 'normal', fillColor: [30, 41, 59], textColor: 255 },
    footStyles: { fontStyle: 'normal', fillColor: [248, 250, 252], textColor: [30, 41, 59] },
    columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 15;

  // ─── Stamp (for receipts) ───
  if (isReceipt) {
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text('✅ ชำระเงินแล้ว', pw / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 10;
  }

  // ─── Signature Lines ───
  y = Math.max(y, 230);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const sigWidth = 55;
  const sigLeft = 35;
  const sigRight = pw - 35;
  doc.line(sigLeft - sigWidth / 2, y, sigLeft + sigWidth / 2, y);
  doc.text('ผู้จ่าย / Paid by', sigLeft, y + 5, { align: 'center' });
  doc.line(sigRight - sigWidth / 2, y, sigRight + sigWidth / 2, y);
  doc.text('ผู้รับเงิน / Received by', sigRight, y + 5, { align: 'center' });
  doc.setTextColor(0);

  // ─── Footer ───
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`CYMS — ${docTitle}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

  // ─── Save ───
  const prefix = isReceipt ? 'Receipt' : 'Invoice';
  doc.save(`CYMS_${prefix}_${inv.invoice_number}.pdf`);
}

// ─────────────────── GATE HISTORY PDF ───────────────────

interface GateTransaction {
  transaction_id: number;
  container_number: string;
  transaction_type: string;
  driver_name?: string;
  truck_plate?: string;
  eir_number?: string;
  created_at: string;
  processed_name?: string;
}

export async function generateGateHistoryPDF(
  transactions: GateTransaction[],
  dateLabel: string,
  yardName?: string,
) {
  const doc = setupDoc('landscape');
  
  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(16);
  doc.text('CYMS — ประวัติ Gate', pw / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(11);
  doc.text(`${yardName || 'ลาน'} — ${dateLabel}`, pw / 2, y, { align: 'center' });
  y += 8;

  const gateIn = transactions.filter(t => t.transaction_type === 'gate_in').length;
  const gateOut = transactions.filter(t => t.transaction_type === 'gate_out').length;
  doc.setFontSize(10);
  doc.text(`ทั้งหมด ${transactions.length} รายการ — Gate-In: ${gateIn} | Gate-Out: ${gateOut}`, 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['#', 'เลขตู้', 'ประเภท', 'คนขับ', 'ทะเบียนรถ', 'เลข EIR', 'ผู้ดำเนินการ', 'วันที่/เวลา']],
    body: transactions.map((t, i) => [
      `${i + 1}`,
      t.container_number,
      t.transaction_type === 'gate_in' ? 'รับเข้า' : 'ปล่อยออก',
      t.driver_name || '-',
      t.truck_plate || '-',
      t.eir_number || '-',
      t.processed_name || '-',
      new Date(t.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    ]),
    theme: 'striped',
    styles: { font: getFontName(), fontSize: 9, cellPadding: 2 },
    headStyles: { fontStyle: 'normal', fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center' } },
    margin: { left: 10, right: 10 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`CYMS Gate History — หน้า ${i}/${pageCount}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  doc.save(`CYMS_Gate_History_${dateLabel}.pdf`);
}

// ─────────────────── GATE DAILY REPORT PDF ───────────────────

interface GateDailyReportData {
  type: string;
  date: string;
  summary: {
    total: number;
    laden: number;
    empty: number;
    size_20: number;
    size_40: number;
    size_45: number;
  };
  transactions: Array<{
    eir_number?: string;
    created_at: string;
    driver_name?: string;
    truck_plate?: string;
    container_number?: string;
    size?: string;
    container_type?: string;
    shipping_line?: string;
    is_laden?: boolean;
    operator_name?: string;
  }>;
  byShippingLine: Array<{ shipping_line: string; count: number }>;
}

export function generateGateReportPDF(
  data: GateDailyReportData,
  type: 'daily_in' | 'daily_out',
  date: string,
) {
  const doc = setupDoc('landscape');
  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  const title = type === 'daily_in' ? 'Daily Gate In Report — รายงานตู้เข้ารายวัน' : 'Daily Gate Out Report — รายงานตู้ออกรายวัน';

  doc.setFontSize(16);
  doc.text('CYMS — Container Yard Management System', pw / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(12);
  doc.text(title, pw / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`วันที่: ${new Date(date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, y, { align: 'center' });
  doc.text(`พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`, pw - 14, y, { align: 'right' });
  doc.setTextColor(0);
  y += 8;

  // ── Summary KPIs ──
  const s = data.summary;
  autoTable(doc, {
    startY: y,
    head: [['รวมทั้งหมด', 'โหลด', 'เปล่า', '20 ฟุต', '40 ฟุต', '45 ฟุต']],
    body: [[`${s.total} ตู้`, `${s.laden} ตู้`, `${s.empty} ตู้`, `${s.size_20} ตู้`, `${s.size_40} ตู้`, `${s.size_45} ตู้`]],
    theme: 'grid',
    styles: { font: getFontName(), fontSize: 11, cellPadding: 3, halign: 'center' },
    headStyles: { fontStyle: 'normal', fillColor: type === 'daily_in' ? [5, 150, 105] : [37, 99, 235], textColor: 255 },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Transaction Table ──
  doc.setFontSize(11);
  doc.text(`รายการทั้งหมด (${data.transactions.length} รายการ)`, 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['#', 'เวลา', 'เลขตู้', 'ขนาด/ประเภท', 'สายเรือ', 'สภาพ', 'คนขับ', 'ทะเบียน', 'เลข EIR', 'ผู้ดำเนินการ']],
    body: data.transactions.map((t, i) => [
      `${i + 1}`,
      new Date(t.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
      t.container_number || '-',
      t.size ? `${t.size}'${t.container_type || ''}` : '-',
      t.shipping_line || '-',
      t.is_laden ? 'โหลด' : 'เปล่า',
      t.driver_name || '-',
      t.truck_plate || '-',
      t.eir_number || '-',
      t.operator_name || '-',
    ]),
    theme: 'striped',
    styles: { font: getFontName(), fontSize: 8.5, cellPadding: 2 },
    headStyles: { fontStyle: 'normal', fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 5: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`CYMS Gate Report — หน้า ${i}/${pageCount}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  doc.save(`CYMS_${type === 'daily_in' ? 'GateIn' : 'GateOut'}_Daily_${date}.pdf`);
}

// ─────────────────── GATE SUMMARY REPORT PDF ───────────────────

interface GateSummaryReportData {
  type: string;
  date_from: string;
  date_to: string;
  kpi: {
    total: number;
    laden: number;
    empty: number;
    avg_per_day: number;
    peak_count?: number;
    peak_date?: string;
  };
  byShippingLine: Array<{ shipping_line: string; count: number; laden: number; empty: number }>;
  bySize: Array<{ size: string; count: number }>;
  byType: Array<{ container_type: string; count: number }>;
  byOperator: Array<{ operator_name: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
}

export function generateGateSummaryPDF(
  data: GateSummaryReportData,
  type: 'summary_in' | 'summary_out',
  dateFrom: string,
  dateTo: string,
) {
  const doc = setupDoc('landscape');
  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  const title = type === 'summary_in' ? 'Summary Gate In Report — สรุปตู้เข้า' : 'Summary Gate Out Report — สรุปตู้ออก';
  const dateLabel = `${new Date(dateFrom).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} — ${new Date(dateTo).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  doc.setFontSize(16);
  doc.text('CYMS — Container Yard Management System', pw / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(12);
  doc.text(title, pw / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`ช่วงเวลา: ${dateLabel}`, pw / 2, y, { align: 'center' });
  doc.text(`พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`, pw - 14, y, { align: 'right' });
  doc.setTextColor(0);
  y += 8;

  // ── KPI Summary ──
  const k = data.kpi;
  autoTable(doc, {
    startY: y,
    head: [['ตู้ทั้งหมด', 'โหลด', 'เปล่า', 'เฉลี่ยต่อวัน', 'วัน Peak']],
    body: [[
      `${k.total.toLocaleString()} ตู้`,
      `${k.laden} ตู้ (${k.total > 0 ? Math.round(k.laden / k.total * 100) : 0}%)`,
      `${k.empty} ตู้ (${k.total > 0 ? Math.round(k.empty / k.total * 100) : 0}%)`,
      `${k.avg_per_day} ตู้/วัน`,
      `${k.peak_count || 0} ตู้ (${k.peak_date ? new Date(k.peak_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-'})`,
    ]],
    theme: 'grid',
    styles: { font: getFontName(), fontSize: 10, cellPadding: 3, halign: 'center' },
    headStyles: { fontStyle: 'normal', fillColor: type === 'summary_in' ? [5, 150, 105] : [124, 58, 237], textColor: 255 },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── By Shipping Line ──
  doc.setFontSize(11);
  doc.text('Top 10 สายเรือ', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['อันดับ', 'สายเรือ', 'จำนวน (ตู้)', 'โหลด', 'เปล่า', '% ของทั้งหมด']],
    body: data.byShippingLine.map((r, i) => [
      `${i + 1}`,
      r.shipping_line,
      `${r.count}`,
      `${r.laden}`,
      `${r.empty}`,
      `${k.total > 0 ? Math.round(r.count / k.total * 100) : 0}%`,
    ]),
    theme: 'striped',
    styles: { font: getFontName(), fontSize: 9.5, cellPadding: 2.5 },
    headStyles: { fontStyle: 'normal', fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { halign: 'center', cellWidth: 16 }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  if (y > 150) { doc.addPage(); y = 15; }

  // ── By Size & By Type (side by side) ──
  const sizeBody = data.bySize.map(r => [`${r.size ? r.size + ' ฟุต' : 'ไม่ระบุ'}`, `${r.count}`, `${k.total > 0 ? Math.round(r.count / k.total * 100) : 0}%`]);
  const typeBody = data.byType.map(r => [r.container_type, `${r.count}`, `${k.total > 0 ? Math.round(r.count / k.total * 100) : 0}%`]);

  doc.setFontSize(11);
  doc.text('แยกตามขนาด', 14, y);
  doc.text('แยกตามประเภท', pw / 2 + 5, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['ขนาด', 'จำนวน', '%']],
    body: sizeBody,
    theme: 'striped',
    styles: { font: getFontName(), fontSize: 9.5, cellPadding: 2.5 },
    headStyles: { fontStyle: 'normal', fillColor: [59, 130, 246], textColor: 255 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    margin: { left: 14, right: pw / 2 + 2 },
  });

  const sizeEndY = (doc as any).lastAutoTable.finalY; // eslint-disable-line @typescript-eslint/no-explicit-any

  autoTable(doc, {
    startY: y,
    head: [['ประเภท', 'จำนวน', '%']],
    body: typeBody,
    theme: 'striped',
    styles: { font: getFontName(), fontSize: 9.5, cellPadding: 2.5 },
    headStyles: { fontStyle: 'normal', fillColor: [16, 185, 129], textColor: 255 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    margin: { left: pw / 2 + 5, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = Math.max(sizeEndY, (doc as any).lastAutoTable.finalY) + 6;

  if (y > 150) { doc.addPage(); y = 15; }

  // ── Daily Trend ──
  doc.setFontSize(11);
  doc.text('แนวโน้มรายวัน', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['วันที่', 'จำนวน (ตู้)']],
    body: data.dailyTrend.map(d => [
      new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
      `${d.count}`,
    ]),
    theme: 'striped',
    styles: { font: getFontName(), fontSize: 9.5, cellPadding: 2.5 },
    headStyles: { fontStyle: 'normal', fillColor: [139, 92, 246], textColor: 255 },
    columnStyles: { 1: { halign: 'center' } },
    margin: { left: 14, right: pw / 2 + 2 },
  });

  // ── By Operator (same page, right side) ──
  doc.setFontSize(11);
  doc.text('ผู้ดำเนินการ', pw / 2 + 5, y - 4);
  autoTable(doc, {
    startY: y,
    head: [['ผู้ดำเนินการ', 'จำนวน']],
    body: data.byOperator.map(r => [r.operator_name, `${r.count}`]),
    theme: 'striped',
    styles: { font: getFontName(), fontSize: 9.5, cellPadding: 2.5 },
    headStyles: { fontStyle: 'normal', fillColor: [100, 116, 139], textColor: 255 },
    columnStyles: { 1: { halign: 'center' } },
    margin: { left: pw / 2 + 5, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`CYMS Gate Summary Report — หน้า ${i}/${pageCount}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  doc.save(`CYMS_${type === 'summary_in' ? 'GateIn' : 'GateOut'}_Summary_${dateFrom}_${dateTo}.pdf`);
}


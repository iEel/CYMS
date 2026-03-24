/**
 * PDF Report Generator — CYMS
 * ใช้ jspdf + jspdf-autotable สำหรับสร้าง PDF รายงาน
 * รองรับภาษาไทยผ่าน THSarabunNew font (embedded)
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Thai Font (THSarabunNew) Base64 ───
// We'll load the font lazily to avoid bundling issues
let thaiFont: string | null = null;

async function loadThaiFont(): Promise<string> {
  if (thaiFont) return thaiFont;
  try {
    const res = await fetch('/fonts/THSarabunNew.ttf');
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    thaiFont = btoa(binary);
    return thaiFont;
  } catch {
    console.warn('⚠️ Thai font not found, falling back to Helvetica');
    return '';
  }
}

function setupDoc(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' });
}

async function addThaiFont(doc: jsPDF) {
  const fontData = await loadThaiFont();
  if (fontData) {
    doc.addFileToVFS('THSarabunNew.ttf', fontData);
    doc.addFont('THSarabunNew.ttf', 'THSarabunNew', 'normal');
    doc.setFont('THSarabunNew');
  }
}

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
  await addThaiFont(doc);
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
  doc.setFont('THSarabunNew', 'normal');

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
    styles: { font: 'THSarabunNew', fontSize: 11, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
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
      styles: { font: 'THSarabunNew', fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [16, 185, 129] },
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
      styles: { font: 'THSarabunNew', fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [59, 130, 246] },
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
      styles: { font: 'THSarabunNew', fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [245, 158, 11] },
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
      styles: { font: 'THSarabunNew', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59] },
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
      styles: { font: 'THSarabunNew', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
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
  await addThaiFont(doc);
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
    styles: { font: 'THSarabunNew', fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' },
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
  await addThaiFont(doc);
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
    styles: { font: 'THSarabunNew', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
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

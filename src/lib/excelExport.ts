/**
 * Excel Report Generator — CYMS
 * ใช้ SheetJS (xlsx) สำหรับสร้างไฟล์ Excel รายงาน
 * Client-side download — ไม่ต้องส่งผ่าน server
 */

// ─── Types ───────────────────────────────────────────────

interface ExcelStyle {
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number };
  fill?: { fgColor: { rgb: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: {
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
    left?: { style: string; color: { rgb: string } };
    right?: { style: string; color: { rgb: string } };
  };
}

// ─── Helper ───────────────────────────────────────────────

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '0.00';
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

function makeHeader(ws: Record<string, unknown>, headers: string[], col: number) {
  headers.forEach((h, i) => {
    const cell = String.fromCharCode(65 + col + i) + '1';
    ws[cell] = { v: h, t: 's' };
  });
}

/** Create a worksheet from array of row-objects with given column keys */
async function buildWorksheet(
  data: Record<string, unknown>[],
  columns: { header: string; key: string; width?: number }[],
  title: string,
) {
  const XLSX = await import('xlsx');

  // Header row
  const wsData: unknown[][] = [
    [title],
    [],
    columns.map(c => c.header),
    ...data.map(row =>
      columns.map(c => {
        const val = row[c.key];
        return val !== undefined && val !== null ? val : '';
      })
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width || 18 }));

  // Merged title cell
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];

  return ws;
}

// ─────────────────── DWELL REPORT EXCEL ───────────────────

interface DwellByShippingLine {
  shipping_line: string;
  container_count: number;
  avg_dwell_days: number;
  max_dwell_days: number;
  min_dwell_days: number;
  total_dwell_days: number;
  overdue_count: number;
}

interface DwellOverdueItem {
  container_number: string;
  shipping_line: string;
  size: string;
  type: string;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  dwell_days: number;
  gate_in_date: string;
  pending_invoice_count: number;
}

interface DwellSummary {
  total_in_yard: number;
  avg_dwell_days: number;
  max_dwell_days: number;
  overdue_count: number;
  within_7_days: number;
  within_8_14_days: number;
  within_15_30_days: number;
  over_30_days: number;
}

export async function exportDwellReportExcel(
  data: {
    summary: DwellSummary;
    byShippingLine: DwellByShippingLine[];
    overdueList: DwellOverdueItem[];
    overdueDays: number;
  },
  yardName = 'CYMS',
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });

  // ── Sheet 1: Summary + By Shipping Line ──
  const s = data.summary;
  const summaryRows: unknown[][] = [
    [`Container Dwell Report — ${yardName}`],
    [`สร้างเมื่อ: ${now}`],
    [],
    ['📊 สรุปภาพรวม'],
    ['ตู้ทั้งหมดในลาน', s.total_in_yard],
    ['เฉลี่ย Dwell Days', s.avg_dwell_days],
    ['สูงสุด Dwell Days', s.max_dwell_days],
    [`Overdue (>${data.overdueDays} วัน)`, s.overdue_count],
    [],
    ['กลุ่มวัน', 'จำนวนตู้'],
    ['≤ 7 วัน', s.within_7_days],
    ['8–14 วัน', s.within_8_14_days],
    ['15–30 วัน', s.within_15_30_days],
    [`> 30 วัน (Overdue)`, s.over_30_days],
    [],
    ['📋 แยกตามสายเรือ'],
    ['สายเรือ', 'จำนวนตู้', 'Avg Dwell', 'Max Dwell', 'Min Dwell', 'Total Dwell Days', `Overdue (>${data.overdueDays}d)`],
    ...data.byShippingLine.map(r => [
      r.shipping_line, r.container_count, r.avg_dwell_days,
      r.max_dwell_days, r.min_dwell_days, r.total_dwell_days, r.overdue_count,
    ]),
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุปตามสายเรือ');

  // ── Sheet 2: Overdue List ──
  const overdueRows: unknown[][] = [
    [`ตู้ Overdue (>${data.overdueDays} วัน) — ${yardName}`],
    [],
    ['เลขตู้', 'สายเรือ', 'ขนาด', 'ประเภท', 'Zone', 'พิกัด (B-R-T)', 'Dwell Days', 'Gate-In Date', 'Invoice ค้าง'],
    ...data.overdueList.map(r => [
      r.container_number, r.shipping_line, r.size, r.type,
      r.zone_name || '-',
      `B${r.bay}-R${r.row}-T${r.tier}`,
      r.dwell_days,
      formatDate(r.gate_in_date),
      r.pending_invoice_count > 0 ? `มี (${r.pending_invoice_count})` : 'ไม่มี',
    ]),
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(overdueRows);
  ws2['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
  XLSX.utils.book_append_sheet(wb, ws2, `Overdue >${data.overdueDays}d`);

  XLSX.writeFile(wb, `CYMS_Dwell_Report_${now.replace(/\//g, '-')}.xlsx`);
}

// ─────────────────── M&R REPORT EXCEL ───────────────────

interface MnRSummary {
  total_eor: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  completed_count: number;
  total_estimated: number;
  total_actual: number;
  avg_estimated: number;
  avg_actual: number;
}

interface MnRByStatus {
  status: string;
  count: number;
  total_estimated: number;
  total_actual: number;
  avg_cost: number;
}

interface MnRTrend {
  month: string;
  total: number;
  approved: number;
  rejected: number;
  total_actual_cost: number;
}

interface MnREOR {
  eor_number: string;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  estimated_cost: number;
  actual_cost: number;
  status: string;
  created_at: string;
  approved_at: string;
  created_name: string;
}

const STATUS_TH: Record<string, string> = {
  draft: 'ร่าง', submitted: 'รอพิจารณา', approved: 'อนุมัติ',
  rejected: 'ปฏิเสธ', in_progress: 'กำลังซ่อม', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
};

export async function exportMnRReportExcel(
  data: {
    summary: MnRSummary;
    byStatus: MnRByStatus[];
    eorList: MnREOR[];
    trend: MnRTrend[];
    dateFrom: string;
    dateTo: string;
  },
  yardName = 'CYMS',
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  const period = `${formatDate(data.dateFrom)} – ${formatDate(data.dateTo)}`;

  // ── Sheet 1: Summary KPIs ──
  const s = data.summary;
  const summaryRows: unknown[][] = [
    [`M&R Report — ${yardName}`],
    [`ช่วงเวลา: ${period}`],
    [`สร้างเมื่อ: ${now}`],
    [],
    ['📊 สรุป KPIs'],
    ['รายการ', 'จำนวน / ยอด'],
    ['ใบ EOR ทั้งหมด', s.total_eor],
    ['อนุมัติ', s.approved_count],
    ['ปฏิเสธ', s.rejected_count],
    ['รอพิจารณา', s.pending_count],
    ['เสร็จสิ้น', s.completed_count],
    ['ราคาประเมินรวม (฿)', formatCurrency(s.total_estimated)],
    ['ราคาจริงรวม (฿)', formatCurrency(s.total_actual)],
    ['ราคาประเมินเฉลี่ย (฿)', formatCurrency(s.avg_estimated)],
    ['ราคาจริงเฉลี่ย (฿)', formatCurrency(s.avg_actual)],
    [],
    ['📋 แยกตามสถานะ'],
    ['สถานะ', 'จำนวน', 'ราคาประเมินรวม (฿)', 'ราคาจริงรวม (฿)', 'ราคาเฉลี่ย (฿)'],
    ...data.byStatus.map(r => [
      STATUS_TH[r.status] || r.status,
      r.count,
      formatCurrency(r.total_estimated),
      formatCurrency(r.total_actual),
      formatCurrency(r.avg_cost),
    ]),
    [],
    ['📈 Trend 6 เดือน'],
    ['เดือน', 'ใบ EOR ทั้งหมด', 'อนุมัติ', 'ปฏิเสธ', 'ค่าซ่อมจริงรวม (฿)'],
    ...data.trend.map(r => [
      r.month, r.total, r.approved, r.rejected, formatCurrency(r.total_actual_cost),
    ]),
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป KPIs');

  const eorRows: unknown[][] = [
    [`รายการ EOR — ${yardName} — ${period}`],
    [],
    ['เลข EOR', 'เลขตู้', 'ขนาด', 'ประเภท', 'สายเรือ', 'สถานะ', 'ราคาประเมิน (฿)', 'ราคาจริง (฿)', 'ผู้สร้าง', 'วันสร้าง', 'วันอนุมัติ'],
    ...data.eorList.map(r => [
      r.eor_number,
      r.container_number,
      r.size, r.type,
      r.shipping_line,
      STATUS_TH[r.status] || r.status,
      formatCurrency(r.estimated_cost),
      formatCurrency(r.actual_cost),
      r.created_name || '-',
      formatDate(r.created_at),
      formatDate(r.approved_at),
    ]),
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(eorRows);
  ws2['!cols'] = [
    { wch: 20 }, { wch: 18 }, { wch: 7 }, { wch: 7 }, { wch: 16 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
  ];
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
  XLSX.utils.book_append_sheet(wb, ws2, 'รายการ EOR');

  XLSX.writeFile(wb, `CYMS_MnR_Report_${now.replace(/\//g, '-')}.xlsx`);
}

// ─────────────────── BILLING REPORT EXCEL ───────────────────

interface BillingReportData {
  summary: {
    total_billed: number;
    total_collected: number;
    total_outstanding: number;
    total_invoices: number;
    total_vat?: number;
  };
  byChargeType?: Array<{ charge_type: string; count: number; total: number }>;
  invoices?: Array<{
    invoice_number: string;
    customer_name: string;
    charge_type: string;
    container_number: string;
    grand_total: number;
    status: string;
    created_at: string;
  }>;
  topCustomers?: Array<{ customer_name: string; invoice_count: number; total: number }>;
  dailyBreakdown?: Array<{ date: string; total: number; collected: number; count: number }>;
  gateActivity?: { gate_in: number; gate_out: number };
}

const CHARGE_LABELS: Record<string, string> = {
  storage: 'ค่าฝากตู้', lolo: 'ค่ายก LOLO', mnr: 'ค่าซ่อม M&R',
  washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น',
  gate: 'ค่า Gate', other: 'อื่นๆ',
};

const INV_STATUS_LABELS: Record<string, string> = {
  paid: 'ชำระแล้ว', issued: 'แจ้งหนี้', pending: 'รอ', cancelled: 'ยกเลิก',
  draft: 'ร่าง', credit_note: 'ใบลดหนี้',
};

export async function exportBillingReportExcel(
  data: BillingReportData,
  reportType: 'daily' | 'monthly',
  dateLabel: string,
  yardName = 'CYMS',
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const s = data.summary;
  const now = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  const titleType = reportType === 'daily' ? 'รายงานประจำวัน' : 'รายงานประจำเดือน';

  // ── Sheet 1: KPI Summary ──
  const summaryRows: unknown[][] = [
    [`${titleType} — ${yardName}`],
    [`ช่วงเวลา: ${dateLabel}`],
    [`สร้างเมื่อ: ${now}`],
    [],
    ['รายการ', 'ยอด'],
    ['ยอดเรียกเก็บ (฿)', formatCurrency(s.total_billed)],
    ['เก็บเงินได้ (฿)', formatCurrency(s.total_collected)],
    ['ค้างชำระ (฿)', formatCurrency(s.total_outstanding)],
    ['จำนวนบิล', s.total_invoices],
    ...(s.total_vat ? [['VAT รวม (฿)', formatCurrency(s.total_vat)]] : []),
    ...(data.gateActivity ? [
      [],
      ['Gate Activity', ''],
      ['Gate-In (ตู้)', data.gateActivity.gate_in],
      ['Gate-Out (ตู้)', data.gateActivity.gate_out],
    ] : []),
    [],
    ['แยกตามประเภทค่าบริการ'],
    ['ประเภท', 'จำนวนบิล', 'ยอดรวม (฿)'],
    ...(data.byChargeType || []).map(ct => [
      CHARGE_LABELS[ct.charge_type] || ct.charge_type,
      ct.count,
      formatCurrency(ct.total),
    ]),
    ...(data.topCustomers && data.topCustomers.length > 0 ? [
      [],
      ['ลูกค้า Top 10'],
      ['อันดับ', 'ลูกค้า', 'จำนวนบิล', 'ยอดรวม (฿)'],
      ...data.topCustomers.map((c, i) => [i + 1, c.customer_name || 'ไม่ระบุ', c.invoice_count, formatCurrency(c.total)]),
    ] : []),
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป KPIs');

  // ── Sheet 2: Invoice List ──
  if (data.invoices && data.invoices.length > 0) {
    const invRows: unknown[][] = [
      [`รายการบิล — ${dateLabel}`],
      [],
      ['เลขบิล', 'ลูกค้า', 'ประเภท', 'เลขตู้', 'ยอดรวม (฿)', 'สถานะ', 'วันที่'],
      ...data.invoices.map(inv => [
        inv.invoice_number,
        inv.customer_name || '-',
        CHARGE_LABELS[inv.charge_type] || inv.charge_type,
        inv.container_number || '-',
        formatCurrency(inv.grand_total),
        INV_STATUS_LABELS[inv.status] || inv.status,
        formatDate(inv.created_at),
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(invRows);
    ws2['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    XLSX.utils.book_append_sheet(wb, ws2, 'รายการบิล');
  }

  // ── Sheet 3: Daily Breakdown (monthly only) ──
  if (reportType === 'monthly' && data.dailyBreakdown && data.dailyBreakdown.length > 0) {
    const breakRows: unknown[][] = [
      [`ยอดรายวัน — ${dateLabel}`],
      [],
      ['วันที่', 'จำนวนบิล', 'ยอดรวม (฿)', 'เก็บได้ (฿)'],
      ...data.dailyBreakdown.map(d => [
        formatDate(d.date), d.count, formatCurrency(d.total), formatCurrency(d.collected),
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(breakRows);
    ws3['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(wb, ws3, 'รายวัน');
  }

  const fileName = reportType === 'daily'
    ? `CYMS_Billing_Daily_${dateLabel}.xlsx`
    : `CYMS_Billing_Monthly_${dateLabel}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ─────────────────── GATE HISTORY EXCEL ───────────────────

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

export async function exportGateHistoryExcel(
  transactions: GateTransaction[],
  dateLabel: string,
  yardName = 'CYMS',
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  const gateIn = transactions.filter(t => t.transaction_type === 'gate_in').length;
  const gateOut = transactions.filter(t => t.transaction_type === 'gate_out').length;

  const rows: unknown[][] = [
    [`ประวัติ Gate — ${yardName} — ${dateLabel}`],
    [`Gate-In: ${gateIn} | Gate-Out: ${gateOut} | รวม: ${transactions.length} รายการ`],
    [`สร้างเมื่อ: ${now}`],
    [],
    ['#', 'เลขตู้', 'ประเภท', 'คนขับ', 'ทะเบียนรถ', 'เลข EIR', 'ผู้ดำเนินการ', 'วันที่/เวลา'],
    ...transactions.map((t, i) => [
      i + 1,
      t.container_number,
      t.transaction_type === 'gate_in' ? 'รับเข้า' : 'ปล่อยออก',
      t.driver_name || '-',
      t.truck_plate || '-',
      t.eir_number || '-',
      t.processed_name || '-',
      new Date(t.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
    { wch: 22 }, { wch: 18 }, { wch: 22 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Gate History');
  XLSX.writeFile(wb, `CYMS_Gate_History_${dateLabel}.xlsx`);
}

// ─────────────────── shared unused import fix ───────────────────
void (makeHeader);
void (buildWorksheet);

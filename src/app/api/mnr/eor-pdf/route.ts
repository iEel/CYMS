import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sarabunBase64 } from '@/lib/sarabunFont';

const FONT = 'Sarabun';
const PHOTO_CATEGORY_LABELS: Record<string, string> = {
  before_repair: 'Before repair',
  during_repair: 'During repair',
  after_repair: 'After repair',
  damage_closeup: 'Damage close-up',
  full_container: 'Full container view',
  repair_material: 'Repair material/part',
};

function parseJson(value: unknown) {
  if (!value || typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function toDamageRows(details: unknown) {
  const parsed = parseJson(details);
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { cedex_items?: unknown[] })?.cedex_items)
      ? (parsed as { cedex_items: unknown[] }).cedex_items
      : [];
  return items.map((item) => {
    const row = item as Record<string, unknown>;
    return [
      String(row.code || '-'),
      String(row.component || row.side || '-'),
      String(row.damage || row.type || '-'),
      String(row.repair || row.note || '-'),
      `฿${Number(row.amount || row.cost || 0).toLocaleString()}`,
    ];
  });
}

async function ensureMnrColumns(db: sql.ConnectionPool) {
  await db.request().query(`
    IF COL_LENGTH('RepairOrders', 'source_eir_number') IS NULL
      ALTER TABLE RepairOrders ADD source_eir_number NVARCHAR(80) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_photos') IS NULL
      ALTER TABLE RepairOrders ADD repair_photos NVARCHAR(MAX) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_photo_evidence') IS NULL
      ALTER TABLE RepairOrders ADD repair_photo_evidence NVARCHAR(MAX) NULL;
    IF COL_LENGTH('RepairOrders', 'invoice_id') IS NULL
      ALTER TABLE RepairOrders ADD invoice_id INT NULL;
    IF COL_LENGTH('RepairOrders', 'billing_customer_id') IS NULL
      ALTER TABLE RepairOrders ADD billing_customer_id INT NULL;
    IF COL_LENGTH('RepairOrders', 'completed_at') IS NULL
      ALTER TABLE RepairOrders ADD completed_at DATETIME2 NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approved_by') IS NULL
      ALTER TABLE RepairOrders ADD customer_approved_by NVARCHAR(200) NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approved_at') IS NULL
      ALTER TABLE RepairOrders ADD customer_approved_at DATETIME2 NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approval_channel') IS NULL
      ALTER TABLE RepairOrders ADD customer_approval_channel NVARCHAR(50) NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approval_reference') IS NULL
      ALTER TABLE RepairOrders ADD customer_approval_reference NVARCHAR(200) NULL;
    IF COL_LENGTH('RepairOrders', 'completion_grade') IS NULL
      ALTER TABLE RepairOrders ADD completion_grade NVARCHAR(1) NULL;
    IF COL_LENGTH('RepairOrders', 'completion_status') IS NULL
      ALTER TABLE RepairOrders ADD completion_status NVARCHAR(30) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_inspected_by') IS NULL
      ALTER TABLE RepairOrders ADD repair_inspected_by NVARCHAR(200) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_inspected_at') IS NULL
      ALTER TABLE RepairOrders ADD repair_inspected_at DATETIME2 NULL;
  `);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eorId = searchParams.get('eor_id');
    if (!eorId) {
      return NextResponse.json({ error: 'กรุณาระบุ eor_id' }, { status: 400 });
    }

    const db = await getDb();
    await ensureMnrColumns(db);
    const result = await db.request()
      .input('eorId', sql.Int, parseInt(eorId))
      .query(`
        SELECT r.*, c.container_number, c.size, c.type, c.shipping_line,
          cu.customer_name, bill.customer_name as billing_customer_name,
          u.full_name as created_name, inv.invoice_number
        FROM RepairOrders r
        LEFT JOIN Containers c ON r.container_id = c.container_id
        LEFT JOIN Customers cu ON ISNULL(r.customer_id, c.customer_id) = cu.customer_id
        LEFT JOIN Customers bill ON ISNULL(r.billing_customer_id, ISNULL(r.customer_id, c.customer_id)) = bill.customer_id
        LEFT JOIN Users u ON r.created_by = u.user_id
        LEFT JOIN Invoices inv ON r.invoice_id = inv.invoice_id
        WHERE r.eor_id = @eorId
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ EOR' }, { status: 404 });
    }

    const eor = result.recordset[0];
    const damageRows = toDamageRows(eor.damage_details);

    let company: Record<string, string> = {};
    try {
      const cr = await db.request().query('SELECT TOP 1 company_name, address, phone, email, tax_id FROM CompanyProfile');
      if (cr.recordset.length > 0) company = cr.recordset[0];
    } catch { /* ignore */ }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64);
    doc.addFont('Sarabun-Regular.ttf', FONT, 'normal');
    doc.setFont(FONT, 'normal');

    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(16);
    doc.text(company.company_name || 'CYMS - Container Yard', pw / 2, y, { align: 'center' });
    y += 6;
    if (company.address) { doc.setFontSize(9); doc.setTextColor(100); doc.text(company.address, pw / 2, y, { align: 'center' }); y += 4; }
    if (company.tax_id) { doc.text(`Tax ID: ${company.tax_id}`, pw / 2, y, { align: 'center' }); y += 4; }
    doc.setTextColor(0);
    y += 6;

    doc.setFontSize(14);
    doc.text('ใบประเมินซ่อม / Equipment Repair Order', pw / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.text(`EOR No: ${eor.eor_number}`, 14, y);
    doc.text(`Date: ${new Date(eor.created_at).toLocaleDateString('th-TH')}`, pw - 14, y, { align: 'right' });
    y += 6;
    doc.text(`Status: ${eor.status}`, 14, y);
    if (eor.source_eir_number) doc.text(`Source EIR: ${eor.source_eir_number}`, pw - 14, y, { align: 'right' });
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['ข้อมูลตู้', '']],
      body: [
        ['เลขตู้', eor.container_number || '-'],
        ['ขนาด/ประเภท', `${eor.size || '-'}'${eor.type || ''}`],
        ['สายเรือ', eor.shipping_line || '-'],
        ['ลูกค้า/เจ้าของงาน', eor.customer_name || '-'],
        ['ผู้รับผิดชอบค่าซ่อม', eor.billing_customer_name || eor.customer_name || '-'],
        ['ลูกค้าอนุมัติ', eor.customer_approved_by ? `${eor.customer_approved_by} / ${eor.customer_approval_channel || '-'} / ${eor.customer_approved_at ? new Date(eor.customer_approved_at).toLocaleString('th-TH') : '-'}` : '-'],
        ['อ้างอิงอนุมัติ', eor.customer_approval_reference || '-'],
        ['ตรวจรับหลังซ่อม', eor.repair_inspected_by ? `${eor.repair_inspected_by} / ${eor.repair_inspected_at ? new Date(eor.repair_inspected_at).toLocaleString('th-TH') : '-'}` : '-'],
        ['Grade/Status หลังซ่อม', `${eor.completion_grade || '-'} / ${eor.completion_status || '-'}`],
        ['Invoice M&R', eor.invoice_number || '-'],
      ],
      theme: 'grid',
      styles: { font: FONT, fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255 },
      columnStyles: { 0: { cellWidth: 38 } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;

    autoTable(doc, {
      startY: y,
      head: [['Code', 'Component/Side', 'Damage', 'Repair', 'Amount']],
      body: damageRows.length > 0 ? damageRows : [['-', '-', eor.notes || 'ไม่ระบุรายละเอียด', '-', '-']],
      theme: 'grid',
      styles: { font: FONT, fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;

    doc.setFontSize(12);
    doc.text(`Estimated Cost: ฿${Number(eor.estimated_cost || 0).toLocaleString()}`, pw - 14, y, { align: 'right' });
    y += 6;
    if (eor.actual_cost != null) {
      doc.text(`Actual Cost: ฿${Number(eor.actual_cost || 0).toLocaleString()}`, pw - 14, y, { align: 'right' });
      y += 6;
    }

    if (eor.notes) {
      doc.setFontSize(9);
      doc.text(`หมายเหตุ: ${eor.notes}`, 14, y);
      y += 6;
    }

    const evidence = parseJson(eor.repair_photo_evidence) as Record<string, string[]> | null;
    const evidenceRows = evidence && typeof evidence === 'object'
      ? Object.entries(evidence).map(([key, value]) => [PHOTO_CATEGORY_LABELS[key] || key, `${Array.isArray(value) ? value.length : 0} รูป`])
      : [];
    if (evidenceRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Repair Photo Evidence', 'จำนวน']],
        body: evidenceRows,
        theme: 'grid',
        styles: { font: FONT, fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
        margin: { left: 14, right: 14 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    const evidencePhotos = evidence && typeof evidence === 'object'
      ? Object.values(evidence).flat().filter(Boolean)
      : [];
    const photos = evidencePhotos.length > 0
      ? evidencePhotos
      : Array.isArray(parseJson(eor.repair_photos)) ? parseJson(eor.repair_photos) as string[] : [];
    if (photos.length > 0) {
      y += 4;
      if (y > 230) {
        doc.addPage();
        y = 15;
      }
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text('รูปประกอบ EOR', 14, y);
      y += 6;
      photos.slice(0, 6).forEach((photo, idx) => {
        try {
          const x = 14 + (idx % 3) * 62;
          const yy = y + Math.floor(idx / 3) * 42;
          const format = photo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(photo, format, x, yy, 55, 35, undefined, 'FAST');
          doc.setFontSize(7);
          doc.text(`Photo ${idx + 1}`, x, yy + 39);
        } catch { /* skip unsupported image */ }
      });
    }

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`CYMS — EOR ${eor.eor_number}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

    const buffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="EOR-${eor.eor_number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('❌ EOR PDF error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง EOR PDF ได้' }, { status: 500 });
  }
}

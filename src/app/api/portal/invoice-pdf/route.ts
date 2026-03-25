import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sarabunBase64 } from '@/lib/sarabunFont';

const FONT = 'Sarabun';

// GET — Customer Portal: Download Invoice PDF
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');
    if (!customerId) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoice_id');
    if (!invoiceId) {
      return NextResponse.json({ error: 'กรุณาระบุ invoice_id' }, { status: 400 });
    }

    const db = await getDb();
    const cid = parseInt(customerId);

    // Fetch invoice — only if belongs to this customer
    const result = await db.request()
      .input('invoiceId', sql.Int, parseInt(invoiceId))
      .input('cid', sql.Int, cid)
      .query(`
        SELECT i.*, c.container_number, c.size, c.type, c.shipping_line,
          cust.customer_name, cust.contact_email, cust.contact_phone, cust.address
        FROM Invoices i
        LEFT JOIN Containers c ON i.container_id = c.container_id
        JOIN Customers cust ON i.customer_id = cust.customer_id
        WHERE i.invoice_id = @invoiceId AND i.customer_id = @cid
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Invoice หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const inv = result.recordset[0];

    // Company info
    let company: Record<string, string> = {};
    try {
      const cr = await db.request().query('SELECT TOP 1 company_name, address, phone, email, tax_id FROM CompanyProfile');
      if (cr.recordset.length > 0) company = cr.recordset[0];
    } catch { /* ignore */ }

    // Generate PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64);
    doc.addFont('Sarabun-Regular.ttf', FONT, 'normal');
    doc.setFont(FONT, 'normal');

    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFontSize(16);
    doc.text(company.company_name || 'CYMS - Container Yard', pw / 2, y, { align: 'center' });
    y += 6;
    if (company.address) { doc.setFontSize(9); doc.setTextColor(100); doc.text(company.address, pw / 2, y, { align: 'center' }); y += 4; }
    if (company.phone) { doc.setFontSize(9); doc.text(`โทร: ${company.phone}`, pw / 2, y, { align: 'center' }); y += 4; }
    if (company.tax_id) { doc.text(`Tax ID: ${company.tax_id}`, pw / 2, y, { align: 'center' }); y += 4; }
    doc.setTextColor(0);
    y += 6;

    // Title
    doc.setFontSize(14);
    doc.text('ใบแจ้งหนี้ / Invoice', pw / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.text(`Invoice No: ${inv.invoice_number}`, 14, y);
    doc.text(`Date: ${new Date(inv.created_at).toLocaleDateString('th-TH')}`, pw - 14, y, { align: 'right' });
    y += 6;
    doc.text(`Status: ${inv.status === 'paid' ? 'ชำระแล้ว' : inv.status === 'issued' ? 'แจ้งหนี้' : inv.status}`, 14, y);
    if (inv.paid_at) doc.text(`Paid: ${new Date(inv.paid_at).toLocaleDateString('th-TH')}`, pw - 14, y, { align: 'right' });
    y += 8;

    // Customer info
    autoTable(doc, {
      startY: y,
      head: [['ข้อมูลลูกค้า', '']],
      body: [
        ['ชื่อบริษัท', inv.customer_name || '-'],
        ['อีเมล', inv.contact_email || '-'],
        ['โทรศัพท์', inv.contact_phone || '-'],
        ['ที่อยู่', inv.address || '-'],
      ],
      theme: 'grid',
      styles: { font: FONT, fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: { 0: { cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;

    // Charge details
    const chargeLabels: Record<string, string> = {
      storage: 'ค่าฝากตู้', lolo: 'ค่ายก LOLO', mnr: 'ค่าซ่อม M&R',
      washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น',
      gate: 'ค่า Gate', other: 'อื่นๆ',
    };

    autoTable(doc, {
      startY: y,
      head: [['รายการ', 'ตู้', 'ยอดก่อน VAT', 'VAT', 'ยอดรวม']],
      body: [[
        chargeLabels[inv.charge_type] || inv.charge_type || '-',
        inv.container_number || '-',
        `฿${(inv.total_before_vat || 0).toLocaleString()}`,
        `฿${(inv.vat_amount || 0).toLocaleString()}`,
        `฿${(inv.grand_total || 0).toLocaleString()}`,
      ]],
      theme: 'grid',
      styles: { font: FONT, fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;

    // Grand total
    doc.setFontSize(14);
    doc.text(`ยอดรวมสุทธิ: ฿${(inv.grand_total || 0).toLocaleString()}`, pw - 14, y, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`CYMS — Invoice ${inv.invoice_number}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

    const arrayBuffer = doc.output('arraybuffer');
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${inv.invoice_number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('❌ Portal Invoice PDF error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง Invoice PDF ได้' }, { status: 500 });
  }
}

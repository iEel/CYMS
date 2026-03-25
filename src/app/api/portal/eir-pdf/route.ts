import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { generateEIRPDF } from '@/lib/eirPdfGenerator';

// GET — Customer Portal: Download EIR PDF
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');
    if (!customerId) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const eirNumber = searchParams.get('eir_number');
    if (!eirNumber) {
      return NextResponse.json({ error: 'กรุณาระบุ eir_number' }, { status: 400 });
    }

    const db = await getDb();
    const cid = parseInt(customerId);

    // Fetch EIR data — only if container belongs to this customer
    const result = await db.request()
      .input('eirNumber', sql.NVarChar, eirNumber)
      .input('cid', sql.Int, cid)
      .query(`
        SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
          c.bay, c.[row], c.tier,
          u.full_name as processed_by_name,
          y.yard_name, y.yard_code,
          z.zone_name
        FROM GateTransactions g
        JOIN Containers c ON g.container_id = c.container_id
        LEFT JOIN Users u ON g.processed_by = u.user_id
        LEFT JOIN Yards y ON g.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE g.eir_number = @eirNumber AND c.customer_id = @cid
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ EIR หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const row = result.recordset[0];

    // Fetch company info
    let company = null;
    try {
      const companyResult = await db.request().query(
        'SELECT TOP 1 company_name, address, phone, email, logo_url, tax_id FROM CompanyProfile'
      );
      if (companyResult.recordset.length > 0) company = companyResult.recordset[0];
    } catch { /* ignore */ }

    const pdfBuffer = generateEIRPDF({
      eir_number: row.eir_number,
      transaction_type: row.transaction_type,
      container_number: row.container_number,
      size: row.size, type: row.type,
      shipping_line: row.shipping_line,
      is_laden: row.is_laden,
      seal_number: row.seal_number,
      driver_name: row.driver_name,
      driver_license: row.driver_license,
      truck_plate: row.truck_plate,
      booking_ref: row.booking_ref,
      yard_name: row.yard_name, yard_code: row.yard_code,
      zone_name: row.zone_name,
      bay: row.bay, row: row.row, tier: row.tier,
      processed_by: row.processed_by_name || 'ระบบ',
      notes: row.notes,
      date: new Date(row.created_at).toLocaleString('th-TH'),
      company,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="EIR-${eirNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('❌ Portal EIR PDF error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง EIR PDF ได้' }, { status: 500 });
  }
}

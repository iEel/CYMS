import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// CODECO — Container Departure/Arrival Message (Outbound EDI)
// Generate CODECO messages from gate transactions for shipping lines

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const transactionType = searchParams.get('type'); // gate_in | gate_out | all
    const shippingLine = searchParams.get('shipping_line');
    const format = searchParams.get('format') || 'json'; // json | edifact | csv
    const status = searchParams.get('status'); // sent | pending | all

    const db = await getDb();
    const req = db.request().input('yardId', sql.Int, yardId);

    let query = `
      SELECT g.transaction_id, g.transaction_type, g.eir_number,
             g.driver_name, g.truck_plate, g.seal_number, g.booking_ref,
             g.created_at as transaction_date,
             c.container_number, c.size, c.type as container_type,
             c.shipping_line, c.is_laden,
             y.yard_name, y.yard_code
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      LEFT JOIN Yards y ON g.yard_id = y.yard_id
      WHERE g.yard_id = @yardId
    `;

    if (transactionType && transactionType !== 'all') {
      query += ` AND g.transaction_type = @txType`;
      req.input('txType', sql.NVarChar, transactionType);
    }
    if (shippingLine) {
      query += ` AND c.shipping_line = @shippingLine`;
      req.input('shippingLine', sql.NVarChar, shippingLine);
    }
    if (dateFrom) {
      query += ` AND CAST(g.created_at AS DATE) >= @dateFrom`;
      req.input('dateFrom', sql.NVarChar, dateFrom);
    }
    if (dateTo) {
      query += ` AND CAST(g.created_at AS DATE) <= @dateTo`;
      req.input('dateTo', sql.NVarChar, dateTo);
    }
    query += ` ORDER BY g.created_at DESC`;

    const result = await req.query(query);
    const transactions = result.recordset;

    // Get company info for message header
    let company = { company_name: 'CYMS', address: '' };
    try {
      const cr = await db.request().query('SELECT TOP 1 company_name, address FROM CompanyProfile');
      if (cr.recordset[0]) company = cr.recordset[0];
    } catch { /* ignore */ }

    // Get unique shipping lines for filter dropdown
    const slResult = await db.request()
      .input('yardId2', sql.Int, yardId)
      .query(`
        SELECT DISTINCT c.shipping_line
        FROM GateTransactions g
        JOIN Containers c ON g.container_id = c.container_id
        WHERE g.yard_id = @yardId2 AND c.shipping_line IS NOT NULL AND c.shipping_line != ''
        ORDER BY c.shipping_line
      `);

    if (format === 'edifact') {
      // Generate UN/EDIFACT CODECO format
      const now = new Date();
      const fmtDT = (d: Date) => {
        const y = d.getFullYear().toString().slice(-2);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${y}${m}${dd}:${hh}${mi}`;
      };
      const msgRef = `CODECO${now.getTime()}`;

      const lines: string[] = [];
      // Interchange header
      lines.push(`UNB+UNOC:3+${(company.company_name || 'CYMS').substring(0, 35)}+${shippingLine || 'SHIPPING_LINE'}+${fmtDT(now)}+${msgRef}'`);
      // Message header
      lines.push(`UNH+1+CODECO:D:95B:UN'`);
      // Beginning of message
      lines.push(`BGM+36+${msgRef}+9'`);

      transactions.forEach((tx: Record<string, unknown>, idx: number) => {
        const txDate = new Date(tx.transaction_date as string);
        const giFn = (tx.transaction_type as string) === 'gate_in' ? '34' : '36'; // 34=discharge, 36=loading
        // Transport movement details
        lines.push(`TDT+${giFn}'`);
        // Location
        lines.push(`LOC+89+${tx.yard_code || 'YARD'}:139:6'`);
        // Date/Time
        lines.push(`DTM+137:${fmtDT(txDate)}:203'`);
        // Equipment details
        const sizeCode = (tx.size as string) === '40' ? '42' : (tx.size as string) === '45' ? '45' : '22';
        const typeCode = (tx.container_type as string) || 'GP';
        lines.push(`EQD+CN+${tx.container_number}+${sizeCode}${typeCode === 'GP' ? 'G1' : typeCode === 'HC' ? 'G1' : typeCode === 'RF' ? 'R1' : 'G1'}:102:5'`);
        // Full/Empty
        lines.push(`MEA+AAE+VGM+KGM'`);
        // Seal
        if (tx.seal_number) {
          lines.push(`SEL+${tx.seal_number}+CA'`);
        }
        // Transport (truck)
        if (tx.truck_plate) {
          lines.push(`TDT+1++3+++++${tx.truck_plate}'`);
        }
        // Name (driver)
        if (tx.driver_name) {
          lines.push(`NAD+CA+${tx.driver_name}'`);
        }
        // Reference (booking)
        if (tx.booking_ref) {
          lines.push(`RFF+BN:${tx.booking_ref}'`);
        }
        // Laden/Empty indicator
        lines.push(`FTX+AAA+++${tx.is_laden ? 'LADEN' : 'EMPTY'}'`);
      });

      // Message trailer
      lines.push(`UNT+${lines.length - 1}+1'`);
      // Interchange trailer
      lines.push(`UNZ+1+${msgRef}'`);

      const edifact = lines.join('\n');

      return new NextResponse(edifact, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="CODECO_${shippingLine || 'ALL'}_${now.toISOString().split('T')[0]}.edi"`,
        },
      });
    }

    if (format === 'csv') {
      const headers = 'message_type,transaction_type,eir_number,date,container_number,size,type,shipping_line,laden_empty,seal_number,truck_plate,driver_name,booking_ref,yard_code';
      const fmtDate = (d: unknown) => {
        if (!d) return '';
        const dt = new Date(d as string);
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      };
      const rows = transactions.map((tx: Record<string, unknown>) =>
        `CODECO,${tx.transaction_type},${tx.eir_number || ''},${fmtDate(tx.transaction_date)},${tx.container_number},${tx.size},${tx.container_type},${tx.shipping_line || ''},${tx.is_laden ? 'F' : 'E'},${tx.seal_number || ''},${tx.truck_plate || ''},"${tx.driver_name || ''}",${tx.booking_ref || ''},${tx.yard_code || ''}`
      );
      const csv = [headers, ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="CODECO_${shippingLine || 'ALL'}_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON response (default)
    const summary = {
      total: transactions.length,
      gate_in: transactions.filter((t: Record<string, string>) => t.transaction_type === 'gate_in').length,
      gate_out: transactions.filter((t: Record<string, string>) => t.transaction_type === 'gate_out').length,
    };

    return NextResponse.json({
      company: company.company_name,
      generated_at: new Date().toISOString(),
      filters: { yard_id: yardId, date_from: dateFrom, date_to: dateTo, transaction_type: transactionType, shipping_line: shippingLine },
      summary,
      shipping_lines: slResult.recordset.map((r: Record<string, string>) => r.shipping_line),
      transactions: transactions.map((tx: Record<string, unknown>) => ({
        message_type: 'CODECO',
        transaction_type: tx.transaction_type,
        eir_number: tx.eir_number,
        date: tx.transaction_date,
        container_number: tx.container_number,
        size: tx.size,
        type: tx.container_type,
        shipping_line: tx.shipping_line,
        laden_empty: tx.is_laden ? 'LADEN' : 'EMPTY',
        seal_number: tx.seal_number,
        truck_plate: tx.truck_plate,
        driver_name: tx.driver_name,
        booking_ref: tx.booking_ref,
        yard_code: tx.yard_code,
      })),
    });
  } catch (error) {
    console.error('❌ GET CODECO error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง CODECO ได้' }, { status: 500 });
  }
}

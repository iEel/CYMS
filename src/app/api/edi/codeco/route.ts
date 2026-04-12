import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import {
  formatCODECO,
  legacyFormatToTemplate,
  validateCODECOTransactions,
  type CODECOTransaction,
  type EDITemplate,
} from '@/lib/ediFormatter';

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
    const templateId = searchParams.get('template_id'); // NEW: optional template_id

    const db = await getDb();
    await db.request().query(`
      IF COL_LENGTH('GateTransactions', 'truck_company') IS NULL
        ALTER TABLE GateTransactions ADD truck_company NVARCHAR(100) NULL;
      IF COL_LENGTH('Containers', 'container_grade') IS NULL
        ALTER TABLE Containers ADD container_grade NVARCHAR(1) NULL;
      IF COL_LENGTH('EDITemplates', 'required_fields') IS NULL
        ALTER TABLE EDITemplates ADD required_fields NVARCHAR(MAX) NULL;
      IF COL_LENGTH('EDITemplates', 'edifact_config') IS NULL
        ALTER TABLE EDITemplates ADD edifact_config NVARCHAR(MAX) NULL;
    `);
    const req = db.request().input('yardId', sql.Int, yardId);

    let query = `
      SELECT g.transaction_id, g.transaction_type, g.eir_number,
             g.driver_name, g.truck_plate, g.truck_company, g.seal_number, g.booking_ref,
             g.created_at as transaction_date,
             c.container_number, c.size, c.type as container_type,
             c.container_grade, c.shipping_line, c.is_laden,
             CASE
               WHEN c.container_grade = 'A' THEN 'GOOD'
               WHEN c.container_grade = 'B' THEN 'MINOR_DAMAGE'
               WHEN c.container_grade = 'C' THEN 'MAJOR_DAMAGE'
               WHEN c.container_grade = 'D' THEN 'UNSERVICEABLE'
               ELSE NULL
             END AS condition,
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
    const transactions = result.recordset as CODECOTransaction[];

    // Load template before validation/formatting.
    let template: EDITemplate | null = null;
    if (templateId) {
      try {
        const tplResult = await db.request()
          .input('tplId', sql.Int, parseInt(templateId))
          .query('SELECT * FROM EDITemplates WHERE template_id = @tplId');
        if (tplResult.recordset[0]) {
          template = tplResult.recordset[0] as EDITemplate;
        }
      } catch { /* fallback to legacy */ }
    }
    if (!template) {
      template = legacyFormatToTemplate(format);
    }
    const validation = validateCODECOTransactions(transactions, template);

    // Get company info for message header
    let companyName = 'CYMS';
    try {
      const cr = await db.request().query('SELECT TOP 1 company_name FROM CompanyProfile');
      if (cr.recordset[0]) companyName = cr.recordset[0].company_name;
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

    // === Format output ===
    // If format is 'json' without template → return structured JSON with metadata (original behavior)
    if (format === 'json' && !templateId) {
      const summary = {
        total: transactions.length,
        gate_in: transactions.filter(t => t.transaction_type === 'gate_in').length,
        gate_out: transactions.filter(t => t.transaction_type === 'gate_out').length,
      };

      return NextResponse.json({
        company: companyName,
        generated_at: new Date().toISOString(),
        filters: { yard_id: yardId, date_from: dateFrom, date_to: dateTo, transaction_type: transactionType, shipping_line: shippingLine },
        summary,
        shipping_lines: slResult.recordset.map((r: Record<string, string>) => r.shipping_line),
        transactions: transactions.map(tx => ({
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
          truck_company: tx.truck_company,
          container_grade: tx.container_grade,
          condition: tx.condition,
          yard_code: tx.yard_code,
        })),
        validation,
      });
    }

    // Use shared formatter
    const output = formatCODECO(transactions, template, companyName, shippingLine || undefined);

    return new NextResponse(output.content, {
      headers: {
        'Content-Type': output.contentType,
        'Content-Disposition': `attachment; filename="${output.filename}"`,
      },
    });
  } catch (error) {
    console.error('❌ GET CODECO error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง CODECO ได้' }, { status: 500 });
  }
}

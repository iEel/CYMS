import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// FR6.5 — ERP Integration: Export invoices as debit/credit entries
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yardId = searchParams.get('yard_id') || '1';
  const format = searchParams.get('format') || 'json'; // json, csv
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const status = searchParams.get('status') || 'paid';

  try {
    const pool = await getDb();
    let query = `
      SELECT i.invoice_id, i.invoice_number, i.charge_type, i.description,
             i.quantity, i.unit_price, i.total_amount, i.vat_amount, i.grand_total,
             i.status, i.paid_at, i.created_at, i.due_date,
             c.customer_name, c.tax_id, c.credit_term, c.address, c.branch_type, c.branch_number,
             ct.container_number
      FROM Invoices i
      LEFT JOIN Customers c ON i.customer_id = c.customer_id
      LEFT JOIN Containers ct ON i.container_id = ct.container_id
      WHERE i.yard_id = @yard_id
    `;

    const request = pool.request().input('yard_id', parseInt(yardId));
    
    if (status) {
      query += ` AND i.status = @status`;
      request.input('status', status);
    }
    if (dateFrom) {
      query += ` AND i.created_at >= @date_from`;
      request.input('date_from', dateFrom);
    }
    if (dateTo) {
      query += ` AND i.created_at <= @date_to`;
      request.input('date_to', dateTo);
    }
    query += ` ORDER BY i.created_at DESC`;

    const result = await request.query(query);
    const invoices = result.recordset;

    // Transform to accounting entries
    const fmtDate = (d: unknown) => {
      if (!d) return '';
      const dt = new Date(d as string);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yy = dt.getFullYear();
      const hh = String(dt.getHours()).padStart(2, '0');
      const mi = String(dt.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yy} ${hh}:${mi}`;
    };

    const entries = invoices.map((inv: Record<string, unknown>) => ({
      entry_type: inv.status === 'credit_note' ? 'credit' : 'debit',
      invoice_number: inv.invoice_number,
      date: fmtDate(inv.paid_at || inv.created_at),
      due_date: fmtDate(inv.due_date),
      customer_name: inv.customer_name,
      tax_id: inv.tax_id || '',
      branch: inv.branch_type === 'head_office' ? 'สำนักงานใหญ่' : inv.branch_number ? `สาขา ${inv.branch_number}` : '',
      credit_term: inv.credit_term ? `${inv.credit_term} วัน` : '',
      address: inv.address || '',
      container_number: inv.container_number || '',
      charge_type: inv.charge_type,
      description: inv.description,
      quantity: inv.quantity,
      unit_price: inv.unit_price,
      amount_before_vat: inv.total_amount,
      vat_amount: inv.vat_amount,
      grand_total: inv.grand_total,
      status: inv.status,
    }));

    if (format === 'csv') {
      const headers = 'entry_type,invoice_number,date,due_date,customer_name,tax_id,branch,credit_term,address,container_number,charge_type,description,quantity,unit_price,amount_before_vat,vat_amount,grand_total,status';
      const rows = entries.map((e: Record<string, unknown>) =>
        `${e.entry_type},${e.invoice_number},${e.date},${e.due_date},${String(e.customer_name || '').replace(/,/g, ' ')},${e.tax_id},${String(e.branch || '').replace(/,/g, ' ')},${e.credit_term},"${String(e.address || '').replace(/"/g, '""')}",${e.container_number},${e.charge_type},"${e.description}",${e.quantity},${e.unit_price},${e.amount_before_vat},${e.vat_amount},${e.grand_total},${e.status}`
      );
      const csv = [headers, ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="erp_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      export_date: new Date().toISOString(),
      yard_id: parseInt(yardId),
      total_entries: entries.length,
      total_debit: entries.filter((e: Record<string, string>) => e.entry_type === 'debit').reduce((s: number, e: Record<string, number>) => s + (e.grand_total || 0), 0),
      total_credit: entries.filter((e: Record<string, string>) => e.entry_type === 'credit').reduce((s: number, e: Record<string, number>) => s + (e.grand_total || 0), 0),
      entries,
    });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import {
  getPortalCustomerId,
  portalContainerVisibilitySql,
  portalInvoiceVisibilitySql,
  portalVisibilityReasonSql,
} from '@/lib/portalAccess';

const PORTAL_CONTAINER_CONTEXT_SQL = `
  OUTER APPLY (
    SELECT TOP 1
      b.booking_id,
      b.booking_number,
      b.booking_type,
      b.status AS booking_status
    FROM BookingContainers bc
    JOIN Bookings b ON b.booking_id = bc.booking_id
    WHERE bc.container_id = c.container_id
      OR bc.container_number = c.container_number
    ORDER BY ISNULL(b.eta, b.created_at) DESC, b.booking_id DESC
  ) latestBooking
  OUTER APPLY (
    SELECT TOP 1
      g.transaction_id,
      g.eir_number,
      g.transaction_type,
      g.created_at
    FROM GateTransactions g
    WHERE g.container_id = c.container_id
      OR g.container_number = c.container_number
    ORDER BY g.created_at DESC, g.transaction_id DESC
  ) latestGate
  OUTER APPLY (
    SELECT
      COUNT(*) AS open_invoice_count,
      ISNULL(SUM(ISNULL(i.balance_amount, i.grand_total)), 0) AS open_invoice_amount
    FROM Invoices i
    WHERE i.container_id = c.container_id
      AND i.status IN ('issued', 'overdue')
      AND ${portalInvoiceVisibilitySql('i')}
  ) invoiceContext
`;

function parseBoundedPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

// GET — Customer's containers
export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim();
    const search = searchParams.get('search')?.trim();
    const page = parseBoundedPositiveInt(searchParams.get('page'), 1, 10_000);
    const limit = parseBoundedPositiveInt(searchParams.get('limit'), 20, 100);
    const offset = (page - 1) * limit;

    const filterClauses = [portalContainerVisibilitySql('c')];
    if (status === 'released') {
      filterClauses.push("c.status IN ('released', 'gated_out')");
    } else if (status === 'repair') {
      filterClauses.push("c.status IN ('repair', 'under_repair', 'mnr')");
    } else if (status === 'hold') {
      filterClauses.push("ISNULL(c.hold_status, '') <> ''");
    } else if (status) {
      filterClauses.push('c.status = @status');
    }
    if (search) {
      filterClauses.push(`(
        c.container_number LIKE @search
        OR ISNULL(c.shipping_line, '') LIKE @search
        OR ISNULL(latestBooking.booking_number, '') LIKE @search
        OR ISNULL(latestGate.eir_number, '') LIKE @search
      )`);
    }
    const whereClause = `WHERE ${filterClauses.join(' AND ')}`;

    const summaryResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN c.status = 'in_yard' THEN 1 ELSE 0 END) AS in_yard,
          SUM(CASE WHEN c.status IN ('released', 'gated_out') THEN 1 ELSE 0 END) AS released,
          SUM(CASE WHEN ISNULL(c.hold_status, '') <> '' THEN 1 ELSE 0 END) AS on_hold,
          SUM(CASE WHEN c.status IN ('repair', 'under_repair', 'mnr') THEN 1 ELSE 0 END) AS repair
        FROM Containers c
        WHERE ${portalContainerVisibilitySql('c')}
      `);
    const summary = summaryResult.recordset[0] || {};

    const req = db.request().input('cid', sql.Int, cid);
    if (status && !['released', 'repair', 'hold'].includes(status)) req.input('status', sql.NVarChar, status);
    if (search) req.input('search', sql.NVarChar, `%${search}%`);

    // Count
    const countResult = await req.query(`
      SELECT COUNT(*) as total
      FROM Containers c
      ${PORTAL_CONTAINER_CONTEXT_SQL}
      ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    // Data
    const req2 = db.request().input('cid', sql.Int, cid)
      .input('offset', sql.Int, offset).input('limit', sql.Int, limit);
    if (status && !['released', 'repair', 'hold'].includes(status)) req2.input('status', sql.NVarChar, status);
    if (search) req2.input('search', sql.NVarChar, `%${search}%`);

    const result = await req2.query(`
      SELECT c.container_id, c.container_number, c.size, c.type, c.shipping_line,
        c.status, c.hold_status, c.is_laden,
        c.gate_in_date, c.gate_out_date,
        DATEDIFF(DAY, ISNULL(c.gate_in_date, c.created_at), GETDATE()) + 1 AS dwell_days,
        latestBooking.booking_id AS latest_booking_id,
        latestBooking.booking_number AS latest_booking_number,
        latestBooking.booking_type AS latest_booking_type,
        latestBooking.booking_status AS latest_booking_status,
        latestGate.eir_number AS latest_eir_number,
        latestGate.transaction_type AS latest_gate_type,
        latestGate.created_at AS latest_gate_at,
        invoiceContext.open_invoice_count,
        invoiceContext.open_invoice_amount,
        ${portalVisibilityReasonSql('container', 'c.container_id', 'c.container_number')} AS visibility_role,
        z.zone_name, y.yard_name
      FROM Containers c
      LEFT JOIN YardZones z ON c.zone_id = z.zone_id
      LEFT JOIN Yards y ON c.yard_id = y.yard_id
      ${PORTAL_CONTAINER_CONTEXT_SQL}
      ${whereClause}
      ORDER BY c.gate_in_date DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return NextResponse.json({
      containers: result.recordset,
      summary: {
        total: Number(summary.total || 0),
        in_yard: Number(summary.in_yard || 0),
        released: Number(summary.released || 0),
        on_hold: Number(summary.on_hold || 0),
        repair: Number(summary.repair || 0),
      },
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ Portal containers error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}

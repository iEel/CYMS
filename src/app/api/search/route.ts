import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

type SearchKind = 'container' | 'gate' | 'invoice' | 'booking';

const SEARCH_READ_PERMISSIONS = [
  'gate.in',
  'gate.out',
  'booking.manage',
  'billing.invoice.create',
  'yard.location.assign',
  'yard.slot.move',
  'reports.view',
];

interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  meta?: string;
  status?: string;
  href: string;
}

function positiveInt(value: string | null): number | null {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function compact(parts: Array<string | number | null | undefined>) {
  return parts
    .map(part => (part === null || part === undefined ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' • ');
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return amount.toLocaleString('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  });
}

function applyCommonInputs(req: sql.Request, search: string, limit: number, yardId: number | null) {
  req.input('search', sql.NVarChar, `%${search}%`);
  req.input('exact', sql.NVarChar, search);
  req.input('startsWith', sql.NVarChar, `${search}%`);
  req.input('limit', sql.Int, limit);
  if (yardId) req.input('yardId', sql.Int, yardId);
  return req;
}

// GET /api/search?q=...&yard_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || searchParams.get('search') || '').trim();
    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const yardId = positiveInt(searchParams.get('yard_id'));
    const limit = Math.min(20, Math.max(4, positiveInt(searchParams.get('limit')) || 12));
    const perEntityLimit = Math.max(2, Math.ceil(limit / 4));
    const yardFilter = yardId ? 'AND {alias}.yard_id = @yardId' : '';

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requireAnyPermission(request, db, SEARCH_READ_PERMISSIONS, 'คุณไม่มีสิทธิ์ค้นหาข้อมูล');
    if (actor instanceof NextResponse) return actor;

    const containerReq = applyCommonInputs(db.request(), query, perEntityLimit, yardId);
    const containerResult = await containerReq.query(`
      SELECT TOP (@limit)
        c.container_id, c.container_number, c.size, c.type, c.shipping_line,
        c.status, y.yard_name, z.zone_name, c.bay, c.[row], c.tier
      FROM Containers c
      LEFT JOIN Yards y ON c.yard_id = y.yard_id
      LEFT JOIN YardZones z ON c.zone_id = z.zone_id
      WHERE (
        c.container_number LIKE @search
        OR c.shipping_line LIKE @search
        OR c.seal_number LIKE @search
      )
      ${yardFilter.replace('{alias}', 'c')}
      ORDER BY
        CASE
          WHEN c.container_number = @exact THEN 0
          WHEN c.container_number LIKE @startsWith THEN 1
          ELSE 2
        END,
        c.updated_at DESC
    `);

    const gateReq = applyCommonInputs(db.request(), query, perEntityLimit, yardId);
    const gateResult = await gateReq.query(`
      SELECT TOP (@limit)
        g.transaction_id, g.eir_number, g.transaction_type,
        c.container_number, g.truck_plate, g.driver_name, g.created_at
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      WHERE (
        g.eir_number LIKE @search
        OR c.container_number LIKE @search
        OR g.truck_plate LIKE @search
        OR g.driver_name LIKE @search
        OR g.booking_ref LIKE @search
      )
      ${yardFilter.replace('{alias}', 'g')}
      ORDER BY
        CASE
          WHEN g.eir_number = @exact OR c.container_number = @exact THEN 0
          WHEN g.eir_number LIKE @startsWith OR c.container_number LIKE @startsWith THEN 1
          ELSE 2
        END,
        g.created_at DESC
    `);

    const invoiceReq = applyCommonInputs(db.request(), query, perEntityLimit, yardId);
    const invoiceResult = await invoiceReq.query(`
      SELECT TOP (@limit)
        i.invoice_id, i.invoice_number, i.status, i.grand_total,
        cus.customer_name, c.container_number
      FROM Invoices i
      LEFT JOIN Customers cus ON i.customer_id = cus.customer_id
      LEFT JOIN Containers c ON i.container_id = c.container_id
      WHERE (
        i.invoice_number LIKE @search
        OR cus.customer_name LIKE @search
        OR c.container_number LIKE @search
      )
      ${yardFilter.replace('{alias}', 'i')}
      ORDER BY
        CASE
          WHEN i.invoice_number = @exact THEN 0
          WHEN i.invoice_number LIKE @startsWith THEN 1
          ELSE 2
        END,
        i.created_at DESC
    `);

    const bookingReq = applyCommonInputs(db.request(), query, perEntityLimit, yardId);
    const bookingResult = await bookingReq.query(`
      SELECT TOP (@limit)
        b.booking_id, b.booking_number, b.status, b.vessel_name, b.voyage_number,
        b.container_count, cus.customer_name,
        (SELECT COUNT(*) FROM BookingContainers bc WHERE bc.booking_id = b.booking_id AND bc.status IN ('received', 'released')) AS received_count
      FROM Bookings b
      LEFT JOIN Customers cus ON b.customer_id = cus.customer_id
      WHERE (
        b.booking_number LIKE @search
        OR b.vessel_name LIKE @search
        OR b.voyage_number LIKE @search
        OR cus.customer_name LIKE @search
      )
      ${yardFilter.replace('{alias}', 'b')}
      ORDER BY
        CASE
          WHEN b.booking_number = @exact THEN 0
          WHEN b.booking_number LIKE @startsWith THEN 1
          ELSE 2
        END,
        b.created_at DESC
    `);

    const results: SearchResult[] = [
      ...containerResult.recordset.map((container): SearchResult => ({
        id: `container-${container.container_id}`,
        kind: 'container',
        title: container.container_number,
        subtitle: compact([
          `${container.size || '-'}'${container.type || '-'}`,
          container.shipping_line,
          container.yard_name,
        ]),
        meta: container.zone_name
          ? `Zone ${container.zone_name} B${container.bay ?? '-'}-R${container.row ?? '-'}-T${container.tier ?? '-'}`
          : undefined,
        status: container.status,
        href: `/yard?search=${encodeURIComponent(container.container_number)}`,
      })),
      ...gateResult.recordset.map((gate): SearchResult => {
        const jumpSearch = gate.container_number || gate.eir_number;
        return {
          id: `gate-${gate.transaction_id}`,
          kind: 'gate',
          title: gate.eir_number,
          subtitle: compact([gate.container_number, gate.truck_plate, gate.driver_name]),
          meta: gate.transaction_type === 'gate_in' ? 'Gate-In' : 'Gate-Out',
          status: gate.transaction_type,
          href: `/gate?tab=history&search=${encodeURIComponent(jumpSearch)}`,
        };
      }),
      ...invoiceResult.recordset.map((invoice): SearchResult => ({
        id: `invoice-${invoice.invoice_id}`,
        kind: 'invoice',
        title: invoice.invoice_number,
        subtitle: compact([invoice.customer_name, invoice.container_number, formatMoney(invoice.grand_total)]),
        status: invoice.status,
        href: `/billing?tab=invoices&invoice_id=${invoice.invoice_id}`,
      })),
      ...bookingResult.recordset.map((booking): SearchResult => ({
        id: `booking-${booking.booking_id}`,
        kind: 'booking',
        title: booking.booking_number,
        subtitle: compact([
          booking.customer_name,
          compact([booking.vessel_name, booking.voyage_number]),
          `${booking.received_count || 0}/${booking.container_count || 0}`,
        ]),
        status: booking.status,
        href: `/booking?search=${encodeURIComponent(booking.booking_number)}`,
      })),
    ];

    return NextResponse.json({ results: results.slice(0, limit) });
  } catch (error) {
    console.error('❌ GET search error:', error);
    return NextResponse.json({ error: 'ไม่สามารถค้นหาข้อมูลได้' }, { status: 500 });
  }
}

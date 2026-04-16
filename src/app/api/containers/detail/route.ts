import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { calcDwellDays } from '@/lib/utils';

async function ensureContainerGradeColumn(db: sql.ConnectionPool) {
  await db.request().query(`
    IF COL_LENGTH('Containers', 'container_grade') IS NULL
      ALTER TABLE Containers ADD container_grade NVARCHAR(1) NOT NULL CONSTRAINT DF_Containers_Grade DEFAULT 'A'
  `);
}

type ExceptionSeverity = 'info' | 'warning' | 'danger';

interface LifecycleException {
  code: string;
  severity: ExceptionSeverity;
  title: string;
  message: string;
}

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function buildExceptions({
  container,
  gateIn,
  gateOut,
  damageReport,
  invoices,
  clearances,
  booking,
  ediEndpoints,
}: {
  container: Record<string, unknown>;
  gateIn: Record<string, unknown> | null;
  gateOut: Record<string, unknown> | null;
  damageReport: { points?: unknown[] } | null;
  invoices: Array<Record<string, unknown>>;
  clearances: Array<Record<string, unknown>>;
  booking: Record<string, unknown> | null;
  ediEndpoints: Array<Record<string, unknown>>;
}) {
  const exceptions: LifecycleException[] = [];
  const pendingInvoices = invoices.filter(inv => ['draft', 'issued', 'overdue'].includes(String(inv.status || '')));
  const gateInClearance = clearances.find(c => c.transaction_type === 'gate_in');
  const gateOutClearance = clearances.find(c => c.transaction_type === 'gate_out');
  const damagePoints = damageReport?.points || [];

  if (!gateIn) {
    exceptions.push({
      code: 'missing_gate_in',
      severity: 'danger',
      title: 'ยังไม่มี Gate-In',
      message: 'ตู้ยังไม่มีรายการรับเข้า จึงยังไม่ควรดำเนินงานต่อ',
    });
  }
  if (gateIn && !gateIn.eir_number) {
    exceptions.push({
      code: 'missing_gate_in_eir',
      severity: 'warning',
      title: 'Gate-In ยังไม่มี EIR',
      message: 'ควรตรวจสอบเลขเอกสาร EIR ขาเข้า',
    });
  }
  if (container.status !== 'gated_out' && (!container.zone_name || !container.bay || !container.row || !container.tier)) {
    exceptions.push({
      code: 'missing_location',
      severity: 'warning',
      title: 'ยังไม่ระบุพิกัดวางตู้',
      message: 'ควร assign location เพื่อให้ค้นหาและวางแผนลานได้ถูกต้อง',
    });
  }
  if (damagePoints.length > 0 && !invoices.some(inv => inv.charge_type === 'mnr')) {
    exceptions.push({
      code: 'damage_without_mnr',
      severity: 'warning',
      title: 'พบความเสียหายแต่ยังไม่มี M&R',
      message: 'ควรตรวจสอบว่าต้องประเมินค่าซ่อมหรือไม่',
    });
  }
  if (pendingInvoices.length > 0) {
    exceptions.push({
      code: 'pending_invoice',
      severity: 'danger',
      title: 'มีใบแจ้งหนี้ค้าง',
      message: `พบเอกสารค้างชำระ ${pendingInvoices.length} รายการ ก่อนปล่อยตู้ควรเคลียร์ Billing`,
    });
  }
  if (gateIn && !gateInClearance) {
    exceptions.push({
      code: 'missing_gate_in_clearance',
      severity: 'info',
      title: 'ยังไม่พบ Billing Clearance ขาเข้า',
      message: 'ถ้าขาเข้ามีค่าบริการ ควรมี paid/credit/no charge/waived กำกับ',
    });
  }
  if (gateOut && !gateOutClearance) {
    exceptions.push({
      code: 'missing_gate_out_clearance',
      severity: 'info',
      title: 'ยังไม่พบ Billing Clearance ขาออก',
      message: 'ถ้าขาออกมีค่าบริการ ควรมี paid/credit/no charge/waived กำกับ',
    });
  }
  if (container.booking_ref && !booking) {
    exceptions.push({
      code: 'booking_not_found',
      severity: 'warning',
      title: 'Booking Ref ไม่พบในเมนู Booking',
      message: `เลข ${container.booking_ref} อยู่บนตู้ แต่ยังไม่พบ booking ที่ตรงกัน`,
    });
  }
  if (booking && toNumber(booking.released_count) > toNumber(booking.container_count)) {
    exceptions.push({
      code: 'booking_over_released',
      severity: 'danger',
      title: 'Booking ออกเกินจำนวน',
      message: 'จำนวน released มากกว่า container count ของ booking',
    });
  }
  if (container.shipping_line && ediEndpoints.length > 0 && ediEndpoints.every(ep => (ep.last_log_status || ep.last_status) === 'failed')) {
    exceptions.push({
      code: 'edi_failed',
      severity: 'warning',
      title: 'EDI ล่าสุดส่งไม่สำเร็จ',
      message: 'ควรตรวจสอบ endpoint ของสายเรือนี้ก่อนส่งรอบถัดไป',
    });
  }

  return exceptions;
}

// GET — ดึงรายละเอียดตู้ + Gate Transactions + damage_report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get('container_id');

    if (!containerId) {
      return NextResponse.json({ error: 'ต้องระบุ container_id' }, { status: 400 });
    }

    const db = await getDb();
    await ensureContainerGradeColumn(db);

    // 1. Container info
    const containerResult = await db.request()
      .input('cid', sql.Int, parseInt(containerId))
      .query(`
        SELECT c.*, y.yard_name, y.yard_code, z.zone_name, z.zone_type
        FROM Containers c
        LEFT JOIN Yards y ON c.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE c.container_id = @cid
      `);

    if (containerResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลตู้' }, { status: 404 });
    }

    const container = containerResult.recordset[0];

    // 2. Gate-In transaction (ล่าสุด)
    const gateInResult = await db.request()
      .input('cid', sql.Int, parseInt(containerId))
      .query(`
        SELECT TOP 1 g.*, u.full_name as processed_by_name
        FROM GateTransactions g
        LEFT JOIN Users u ON g.processed_by = u.user_id
        WHERE g.container_id = @cid AND g.transaction_type = 'gate_in'
        ORDER BY g.created_at DESC
      `);

    // 3. Gate-Out transaction (ล่าสุด — ถ้ามี)
    const gateOutResult = await db.request()
      .input('cid', sql.Int, parseInt(containerId))
      .query(`
        SELECT TOP 1 g.*, u.full_name as processed_by_name
        FROM GateTransactions g
        LEFT JOIN Users u ON g.processed_by = u.user_id
        WHERE g.container_id = @cid AND g.transaction_type = 'gate_out'
        ORDER BY g.created_at DESC
      `);

    // Parse damage reports
    const parseDamageReport = (raw: string | null) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };

    const gateIn = gateInResult.recordset[0] || null;
    const gateOut = gateOutResult.recordset[0] || null;
    const gateInDamageReport = parseDamageReport(gateIn?.damage_report);

    // Calculate dwell days — use gate_in_date from container, or gate transaction date, or created_at
    const dwellStart = container.gate_in_date || gateIn?.created_at || container.created_at;
    const dwellDays = dwellStart ? calcDwellDays(dwellStart) : 0;

    const invoicesResult = await db.request()
      .input('cid5', sql.Int, parseInt(containerId))
      .query(`
        SELECT TOP 50 invoice_id, invoice_number, charge_type, description,
               grand_total, status, paid_at, created_at, due_date
        FROM Invoices
        WHERE container_id = @cid5
        ORDER BY created_at DESC
      `);

    const clearancesResult = await db.request()
      .input('cid6', sql.Int, parseInt(containerId))
      .input('cnum', sql.NVarChar, container.container_number)
      .query(`
        IF OBJECT_ID('BillingClearances', 'U') IS NOT NULL
        BEGIN
          SELECT TOP 20 bc.clearance_id, bc.transaction_type, bc.clearance_type,
                 bc.original_amount, bc.final_amount, bc.reason, bc.invoice_id,
                 bc.created_at, i.invoice_number, i.status AS invoice_status,
                 u.full_name AS approved_by_name
          FROM BillingClearances bc
          LEFT JOIN Invoices i ON bc.invoice_id = i.invoice_id
          LEFT JOIN Users u ON bc.approved_by = u.user_id
          WHERE bc.container_id = @cid6 OR bc.container_number = @cnum
          ORDER BY bc.created_at DESC
        END
        ELSE
        BEGIN
          SELECT TOP 0
            CAST(NULL AS INT) AS clearance_id,
            CAST(NULL AS NVARCHAR(20)) AS transaction_type,
            CAST(NULL AS NVARCHAR(20)) AS clearance_type,
            CAST(0 AS DECIMAL(12,2)) AS original_amount,
            CAST(0 AS DECIMAL(12,2)) AS final_amount,
            CAST(NULL AS NVARCHAR(500)) AS reason,
            CAST(NULL AS INT) AS invoice_id,
            CAST(NULL AS DATETIME2) AS created_at,
            CAST(NULL AS NVARCHAR(50)) AS invoice_number,
            CAST(NULL AS NVARCHAR(20)) AS invoice_status,
            CAST(NULL AS NVARCHAR(200)) AS approved_by_name
        END
      `);

    const bookingResult = await db.request()
      .input('cid7', sql.Int, parseInt(containerId))
      .input('cnum2', sql.NVarChar, container.container_number)
      .input('bookingRef', sql.NVarChar, container.booking_ref || gateIn?.booking_ref || gateOut?.booking_ref || null)
      .query(`
        IF OBJECT_ID('Bookings', 'U') IS NOT NULL AND OBJECT_ID('BookingContainers', 'U') IS NOT NULL
        BEGIN
          SELECT TOP 1 b.booking_id, b.booking_number, b.booking_type, b.status,
                 b.vessel_name, b.voyage_number, b.container_count, b.container_size,
                 b.container_type, b.received_count, b.released_count, b.valid_from,
                 b.valid_to, b.eta, c.customer_name,
                 bc.status AS container_booking_status, bc.gate_in_at, bc.gate_out_at
          FROM Bookings b
          LEFT JOIN Customers c ON b.customer_id = c.customer_id
          LEFT JOIN BookingContainers bc
            ON bc.booking_id = b.booking_id
           AND (bc.container_id = @cid7 OR bc.container_number = @cnum2)
          WHERE b.booking_number = @bookingRef
             OR bc.container_id = @cid7
             OR bc.container_number = @cnum2
          ORDER BY
            CASE WHEN b.booking_number = @bookingRef THEN 0 ELSE 1 END,
            b.created_at DESC
        END
        ELSE
        BEGIN
          SELECT TOP 0
            CAST(NULL AS INT) AS booking_id,
            CAST(NULL AS NVARCHAR(50)) AS booking_number,
            CAST(NULL AS NVARCHAR(20)) AS booking_type,
            CAST(NULL AS NVARCHAR(20)) AS status,
            CAST(NULL AS NVARCHAR(100)) AS vessel_name,
            CAST(NULL AS NVARCHAR(50)) AS voyage_number,
            CAST(0 AS INT) AS container_count,
            CAST(NULL AS NVARCHAR(10)) AS container_size,
            CAST(NULL AS NVARCHAR(10)) AS container_type,
            CAST(0 AS INT) AS received_count,
            CAST(0 AS INT) AS released_count,
            CAST(NULL AS DATETIME2) AS valid_from,
            CAST(NULL AS DATETIME2) AS valid_to,
            CAST(NULL AS DATETIME2) AS eta,
            CAST(NULL AS NVARCHAR(200)) AS customer_name,
            CAST(NULL AS NVARCHAR(20)) AS container_booking_status,
            CAST(NULL AS DATETIME2) AS gate_in_at,
            CAST(NULL AS DATETIME2) AS gate_out_at
        END
      `);

    const ediResult = await db.request()
      .input('line', sql.NVarChar, container.shipping_line || '')
      .query(`
        IF OBJECT_ID('EDIEndpoints', 'U') IS NOT NULL AND OBJECT_ID('EDISendLog', 'U') IS NOT NULL
        BEGIN
          SELECT TOP 10 e.endpoint_id, e.name, e.shipping_line, e.type, e.format,
                 e.last_sent_at, e.last_status,
                 (SELECT TOP 1 l.status FROM EDISendLog l WHERE l.endpoint_id = e.endpoint_id ORDER BY l.sent_at DESC) AS last_log_status,
                 (SELECT TOP 1 l.error_message FROM EDISendLog l WHERE l.endpoint_id = e.endpoint_id ORDER BY l.sent_at DESC) AS last_error_message
          FROM EDIEndpoints e
          WHERE e.is_active = 1
            AND (@line = '' OR e.shipping_line IS NULL OR e.shipping_line = '' OR e.shipping_line = @line)
          ORDER BY e.last_sent_at DESC, e.updated_at DESC
        END
        ELSE
        BEGIN
          SELECT TOP 0
            CAST(NULL AS INT) AS endpoint_id,
            CAST(NULL AS NVARCHAR(100)) AS name,
            CAST(NULL AS NVARCHAR(100)) AS shipping_line,
            CAST(NULL AS NVARCHAR(20)) AS type,
            CAST(NULL AS NVARCHAR(10)) AS format,
            CAST(NULL AS DATETIME2) AS last_sent_at,
            CAST(NULL AS NVARCHAR(20)) AS last_status,
            CAST(NULL AS NVARCHAR(20)) AS last_log_status,
            CAST(NULL AS NVARCHAR(500)) AS last_error_message
        END
      `);

    const invoices = invoicesResult.recordset;
    const clearances = clearancesResult.recordset;
    const booking = bookingResult.recordset[0] || null;
    const ediEndpoints = ediResult.recordset;
    const invoiceTotals = invoices.reduce((acc, inv) => {
      const amount = toNumber(inv.grand_total);
      if (inv.status === 'paid') acc.paid += amount;
      else if (inv.status === 'credit_note') acc.credit_notes += Math.abs(amount);
      else if (!['cancelled'].includes(inv.status)) acc.outstanding += amount;
      return acc;
    }, { paid: 0, outstanding: 0, credit_notes: 0 });

    const lifecycle = {
      gate_in: Boolean(gateIn),
      inspection: Boolean(gateInDamageReport),
      location: Boolean(container.zone_name && container.bay && container.row && container.tier),
      booking: Boolean(booking),
      billing: invoices.length > 0 || clearances.length > 0,
      edi: ediEndpoints.length > 0,
      gate_out: Boolean(gateOut),
    };
    const exceptions = buildExceptions({
      container,
      gateIn,
      gateOut,
      damageReport: gateInDamageReport,
      invoices,
      clearances,
      booking,
      ediEndpoints,
    });

    return NextResponse.json({
      container: {
        container_id: container.container_id,
        container_number: container.container_number,
        size: container.size,
        type: container.type,
        status: container.status,
        shipping_line: container.shipping_line,
        is_laden: container.is_laden,
        yard_name: container.yard_name,
        zone_name: container.zone_name,
        zone_type: container.zone_type,
        bay: container.bay,
        row: container.row,
        tier: container.tier,
        booking_ref: container.booking_ref,
        seal_number: container.seal_number,
        container_grade: container.container_grade || 'A',
        dwell_days: dwellDays,
      },
      gate_in: gateIn ? {
        eir_number: gateIn.eir_number,
        date: gateIn.created_at,
        driver_name: gateIn.driver_name,
        driver_license: gateIn.driver_license,
        truck_plate: gateIn.truck_plate,
        seal_number: gateIn.seal_number,
        booking_ref: gateIn.booking_ref,
        notes: gateIn.notes,
        processed_by: gateIn.processed_by_name || 'ระบบ',
        damage_report: gateInDamageReport,
      } : null,
      gate_out: gateOut ? {
        eir_number: gateOut.eir_number,
        date: gateOut.created_at,
        driver_name: gateOut.driver_name,
        truck_plate: gateOut.truck_plate,
        processed_by: gateOut.processed_by_name || 'ระบบ',
        damage_report: parseDamageReport(gateOut.damage_report),
      } : null,
      lifecycle,
      exceptions,
      documents: {
        eir_gate_in: gateIn?.eir_number || null,
        eir_gate_out: gateOut?.eir_number || null,
        invoices,
      },
      billing: {
        clearances,
        totals: invoiceTotals,
      },
      booking,
      edi: {
        endpoints: ediEndpoints,
      },
    });
  } catch (error) {
    console.error('❌ GET container detail error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

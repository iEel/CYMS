import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

async function ensureContainerGradeColumn(db: sql.ConnectionPool) {
  await db.request().query(`
    IF COL_LENGTH('Containers', 'container_grade') IS NULL
      ALTER TABLE Containers ADD container_grade NVARCHAR(1) NOT NULL CONSTRAINT DF_Containers_Grade DEFAULT 'A'
  `);
}

async function validateGateOutBooking(
  db: sql.ConnectionPool,
  yardId: number,
  bookingRef: string,
  containerId: number,
  containerNumber?: string
) {
  const bookingResult = await db.request()
    .input('bkRef', sql.NVarChar, bookingRef)
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT TOP 1 b.booking_id, b.booking_number, b.status, b.container_count,
        (SELECT COUNT(*) FROM BookingContainers bc WHERE bc.booking_id = b.booking_id) AS linked_count
      FROM Bookings b
      WHERE b.booking_number = @bkRef AND b.yard_id = @yardId
    `);

  if (bookingResult.recordset.length === 0) {
    return { ok: false, error: `ไม่พบ Booking ${bookingRef}` };
  }

  const booking = bookingResult.recordset[0];
  if (booking.status === 'cancelled') {
    return { ok: false, error: `Booking ${bookingRef} ถูกยกเลิกแล้ว` };
  }
  if (booking.status === 'completed') {
    return { ok: false, error: `Booking ${bookingRef} ปิดงานแล้ว` };
  }

  let finalContainerNumber = containerNumber;
  if (!finalContainerNumber) {
    const cResult = await db.request()
      .input('containerId', sql.Int, containerId)
      .query('SELECT container_number FROM Containers WHERE container_id = @containerId');
    finalContainerNumber = cResult.recordset[0]?.container_number;
  }

  const linkResult = await db.request()
    .input('bkId', sql.Int, booking.booking_id)
    .input('containerId', sql.Int, containerId)
    .input('containerNumber', sql.NVarChar, finalContainerNumber || '')
    .query(`
      SELECT TOP 1 id, status
      FROM BookingContainers
      WHERE booking_id = @bkId
        AND (container_id = @containerId OR container_number = @containerNumber)
    `);

  if (linkResult.recordset[0]?.status === 'released') {
    return { ok: false, error: `ตู้ ${finalContainerNumber || containerId} ถูกปล่อยออกใน Booking ${bookingRef} แล้ว` };
  }

  if (linkResult.recordset.length === 0 && booking.linked_count >= booking.container_count) {
    return { ok: false, error: `Booking ${bookingRef} ครบจำนวนตู้แล้ว` };
  }

  return { ok: true, bookingId: booking.booking_id, containerNumber: finalContainerNumber };
}

const gateBodySchema = z.object({
  transaction_type: z.enum(['gate_in', 'gate_out']),
  container_number: z.string().min(4).max(15).optional(),
  size: z.enum(['20', '40', '45']).optional(),
  type: z.string().max(20).optional(),
  shipping_line: z.string().max(50).optional(),
  is_laden: z.boolean().optional(),
  is_soc: z.boolean().optional(),
  yard_id: z.coerce.number().int().positive(),
  zone_id: z.coerce.number().int().positive().optional().nullable(),
  bay: z.coerce.number().int().min(0).optional().nullable(),
  row: z.coerce.number().int().min(0).optional().nullable(),
  tier: z.coerce.number().int().min(0).optional().nullable(),
  driver_name: z.string().max(100).optional(),
  driver_license: z.string().max(50).optional(),
  truck_plate: z.string().max(20).optional(),
  truck_company: z.string().max(100).optional(),
  seal_number: z.string().max(50).optional(),
  booking_ref: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  damage_report: z.any().optional(),
  container_id: z.number().int().positive().optional(),
  user_id: z.number().int().positive().optional(),
  container_owner_id: z.number().int().positive().optional().nullable(),
  billing_customer_id: z.number().int().positive().optional().nullable(),
}).passthrough();

// GET — ดึง gate transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const type = searchParams.get('type');
    const date = searchParams.get('date'); // 'today' or 'YYYY-MM-DD'
    const search = searchParams.get('search');

    const db = await getDb();
    await ensureContainerGradeColumn(db);
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) {
      conditions.push('g.yard_id = @yardId');
      req.input('yardId', sql.Int, parseInt(yardId));
    }
    if (type) {
      conditions.push('g.transaction_type = @type');
      req.input('type', sql.NVarChar, type);
    }
    if (date === 'today') {
      conditions.push('CAST(g.created_at AS DATE) = CAST(GETDATE() AS DATE)');
    } else if (date) {
      conditions.push('CAST(g.created_at AS DATE) = @date');
      req.input('date', sql.Date, date);
    }
    if (search) {
      conditions.push('(c.container_number LIKE @search OR g.driver_name LIKE @search OR g.truck_plate LIKE @search OR g.eir_number LIKE @search)');
      req.input('search', sql.NVarChar, `%${search}%`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
        u.full_name, y.yard_name
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      LEFT JOIN Users u ON g.processed_by = u.user_id
      LEFT JOIN Yards y ON g.yard_id = y.yard_id
      ${where}
      ORDER BY g.created_at DESC
    `);

    return NextResponse.json({ transactions: result.recordset });
  } catch (error) {
    console.error('❌ GET gate error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล gate ได้' }, { status: 500 });
  }
}

// === Auto-Allocation Logic (shared module) ===
import { autoAllocate } from '@/lib/autoAllocate';

// POST — บันทึก Gate-In หรือ Gate-Out
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = gateBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', details: errors }, { status: 400 });
    }
    const body = parsed.data;
    const {
      transaction_type,
      container_number, size, type: containerType, shipping_line, is_laden, is_soc,
      yard_id, zone_id, bay, row, tier,
      driver_name, driver_license, truck_plate, truck_company, seal_number, booking_ref, notes,
      damage_report,
      container_id,
      user_id,
      container_owner_id, billing_customer_id,
    } = body;

    const db = await getDb();
    await ensureContainerGradeColumn(db);
    const containerGrade = typeof damage_report?.condition_grade === 'string'
      && ['A', 'B', 'C', 'D'].includes(damage_report.condition_grade.toUpperCase())
      ? damage_report.condition_grade.toUpperCase()
      : 'A';

    // Generate EIR number with random suffix (prevents URL guessing on public QR pages)
    const eirPrefix = transaction_type === 'gate_in' ? 'EIR-IN' : 'EIR-OUT';
    const countResult = await db.request()
      .input('yardId', sql.Int, yard_id)
      .query(`SELECT COUNT(*) as cnt FROM GateTransactions WHERE yard_id = @yardId`);
    const randomHex = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
    const eirNumber = `${eirPrefix}-${new Date().getFullYear()}-${String(countResult.recordset[0].cnt + 1).padStart(6, '0')}-${randomHex}`;

    let finalContainerId = container_id;
    let assignedLocation: { zone_name: string; zone_id: number; bay: number; row: number; tier: number; reason: string } | null = null;

    if (transaction_type === 'gate_in') {
      // === GATE-IN ===

      // Auto-allocate if no zone specified
      let finalZoneId = zone_id || null;
      let finalBay = bay || null;
      let finalRow = row || null;
      let finalTier = tier || null;

      if (!zone_id) {
        const allocation = await autoAllocate(db, yard_id, size || '20', containerType || 'GP', shipping_line || undefined, is_laden || false);
        if (allocation) {
          finalZoneId = allocation.zone_id;
          finalBay = allocation.bay;
          finalRow = allocation.row;
          finalTier = allocation.tier;
          assignedLocation = {
            zone_name: allocation.zone_name,
            zone_id: allocation.zone_id,
            bay: allocation.bay,
            row: allocation.row,
            tier: allocation.tier,
            reason: allocation.reason,
          };
        }
      }

      // Check if container already exists
      const existingCheck = await db.request()
        .input('containerNumber', sql.NVarChar, container_number)
        .query('SELECT container_id, status FROM Containers WHERE container_number = @containerNumber');

      if (existingCheck.recordset.length > 0) {
        const existing = existingCheck.recordset[0];
        if (existing.status === 'in_yard') {
          return NextResponse.json({ error: `ตู้ ${container_number} อยู่ในลานแล้ว` }, { status: 400 });
        }
        // Re-enter: update existing container
        finalContainerId = existing.container_id;
        await db.request()
          .input('containerId', sql.Int, finalContainerId)
          .input('status', sql.NVarChar, 'in_yard')
          .input('yardId', sql.Int, yard_id)
          .input('zoneId', sql.Int, finalZoneId)
          .input('bay', sql.Int, finalBay)
          .input('row', sql.Int, finalRow)
          .input('tier', sql.Int, finalTier)
          .input('shippingLine', sql.NVarChar, shipping_line || null)
          .input('isLaden', sql.Bit, is_laden || false)
          .input('isSoc', sql.Bit, is_soc || false)
          .input('ownerId', sql.Int, container_owner_id || null)
          .input('containerGrade', sql.NVarChar, containerGrade)
          .input('sealNumber', sql.NVarChar, seal_number || null)
          .input('gateInDate', sql.DateTime2, new Date())
          .query(`
            UPDATE Containers SET
              status = @status, yard_id = @yardId, zone_id = @zoneId,
              bay = @bay, [row] = @row, tier = @tier,
              shipping_line = @shippingLine, is_laden = @isLaden,
              is_soc = @isSoc, container_owner_id = @ownerId,
              container_grade = @containerGrade,
              seal_number = @sealNumber, gate_in_date = @gateInDate,
              gate_out_date = NULL, updated_at = GETDATE()
            WHERE container_id = @containerId
          `);
      } else {
        // New container
        const insertResult = await db.request()
          .input('containerNumber', sql.NVarChar, container_number)
          .input('size', sql.NVarChar, size)
          .input('type', sql.NVarChar, containerType)
          .input('status', sql.NVarChar, 'in_yard')
          .input('yardId', sql.Int, yard_id)
          .input('zoneId', sql.Int, finalZoneId)
          .input('bay', sql.Int, finalBay)
          .input('row', sql.Int, finalRow)
          .input('tier', sql.Int, finalTier)
          .input('shippingLine', sql.NVarChar, shipping_line || null)
          .input('isLaden', sql.Bit, is_laden || false)
          .input('isSoc', sql.Bit, is_soc || false)
          .input('ownerId', sql.Int, container_owner_id || null)
          .input('containerGrade', sql.NVarChar, containerGrade)
          .input('sealNumber', sql.NVarChar, seal_number || null)
          .input('gateInDate', sql.DateTime2, new Date())
          .query(`
            INSERT INTO Containers (container_number, size, type, status, yard_id, zone_id,
              bay, [row], tier, shipping_line, is_laden, is_soc, container_owner_id, container_grade, seal_number, gate_in_date)
            OUTPUT INSERTED.container_id
            VALUES (@containerNumber, @size, @type, @status, @yardId, @zoneId,
              @bay, @row, @tier, @shippingLine, @isLaden, @isSoc, @ownerId, @containerGrade, @sealNumber, @gateInDate)
          `);
        finalContainerId = insertResult.recordset[0].container_id;
      }

    } else {
      // === GATE-OUT ===
      if (!finalContainerId) {
        return NextResponse.json({ error: 'ต้องระบุ container_id สำหรับ Gate-Out' }, { status: 400 });
      }
      if (booking_ref) {
        const bookingValidation = await validateGateOutBooking(
          db,
          yard_id,
          booking_ref,
          finalContainerId,
          container_number
        );
        if (!bookingValidation.ok) {
          return NextResponse.json({ error: bookingValidation.error }, { status: 400 });
        }
      }
      await db.request()
        .input('containerId', sql.Int, finalContainerId)
        .input('sealNumber', sql.NVarChar, seal_number || null)
        .query(`
          UPDATE Containers SET
            status = 'gated_out', gate_out_date = GETDATE(),
            seal_number = @sealNumber, bay = NULL, [row] = NULL, tier = NULL,
            updated_at = GETDATE()
          WHERE container_id = @containerId
        `);
    }

    // Create GateTransaction record (with owner/billing separation)
    const txResult = await db.request()
      .input('containerId', sql.Int, finalContainerId)
      .input('yardId', sql.Int, yard_id)
      .input('transactionType', sql.NVarChar, transaction_type)
      .input('driverName', sql.NVarChar, driver_name || null)
      .input('driverLicense', sql.NVarChar, driver_license || null)
      .input('truckPlate', sql.NVarChar, truck_plate || null)
      .input('truckCompany', sql.NVarChar, truck_company || null)
      .input('sealNumber', sql.NVarChar, seal_number || null)
      .input('bookingRef', sql.NVarChar, booking_ref || null)
      .input('eirNumber', sql.NVarChar, eirNumber)
      .input('notes', sql.NVarChar, notes || null)
      .input('damageReport', sql.NVarChar, damage_report ? JSON.stringify(damage_report) : null)
      .input('processedBy', sql.Int, user_id || null)
      .input('ownerId', sql.Int, container_owner_id || null)
      .input('billingId', sql.Int, billing_customer_id || null)
      .query(`
        INSERT INTO GateTransactions (container_id, yard_id, transaction_type,
          driver_name, driver_license, truck_plate, truck_company, seal_number, booking_ref,
          eir_number, notes, damage_report, processed_by,
          container_owner_id, billing_customer_id)
        OUTPUT INSERTED.*
        VALUES (@containerId, @yardId, @transactionType,
          @driverName, @driverLicense, @truckPlate, @truckCompany, @sealNumber, @bookingRef,
          @eirNumber, @notes, @damageReport, @processedBy,
          @ownerId, @billingId)
      `);

    // === Booking Auto-Link ===
    if (booking_ref) {
      try {
        if (transaction_type === 'gate_in') {
          // Find matching Booking
          const bkResult = await db.request()
            .input('bkRef', sql.NVarChar, booking_ref)
            .input('bkYardId', sql.Int, yard_id)
            .query(`SELECT booking_id, status FROM Bookings WHERE booking_number = @bkRef AND yard_id = @bkYardId`);

          if (bkResult.recordset.length > 0) {
            const bk = bkResult.recordset[0];
            if (bk.status === 'confirmed' || bk.status === 'pending') {
              // Check if already linked
              const existLink = await db.request()
                .input('bkId', sql.Int, bk.booking_id)
                .input('cNum', sql.NVarChar, container_number)
                .query(`SELECT id FROM BookingContainers WHERE booking_id = @bkId AND container_number = @cNum`);

              if (existLink.recordset.length > 0) {
                // Update existing link
                await db.request()
                  .input('linkId', sql.Int, existLink.recordset[0].id)
                  .input('cId', sql.Int, finalContainerId)
                  .query(`UPDATE BookingContainers SET container_id = @cId, status = 'received', gate_in_at = GETDATE() WHERE id = @linkId`);
              } else {
                // Create new link
                await db.request()
                  .input('bkId2', sql.Int, bk.booking_id)
                  .input('cId2', sql.Int, finalContainerId)
                  .input('cNum2', sql.NVarChar, container_number)
                  .query(`INSERT INTO BookingContainers (booking_id, container_id, container_number, status, gate_in_at) VALUES (@bkId2, @cId2, @cNum2, 'received', GETDATE())`);
              }

              // Update received_count
              await db.request()
                .input('bkId3', sql.Int, bk.booking_id)
                .query(`UPDATE Bookings SET received_count = (SELECT COUNT(*) FROM BookingContainers WHERE booking_id = @bkId3 AND status IN ('received', 'released')) WHERE booking_id = @bkId3`);

              // Send email: container received
              try {
                const { getEmailConfig, sendEmail, bookingStatusEmail } = await import('@/lib/emailService');
                const emailCfg = await getEmailConfig();
                if (emailCfg.enabled) {
                  const nResult = await db.request().query(`SELECT setting_value FROM SystemSettings WHERE setting_key = 'email_notify_booking'`);
                  if (nResult.recordset[0]?.setting_value === 'true') {
                    const bkDetail = await db.request().input('bkId5', sql.Int, bk.booking_id).query(`
                      SELECT b.*, c.customer_name, c.contact_email FROM Bookings b
                      LEFT JOIN Customers c ON b.customer_id = c.customer_id WHERE b.booking_id = @bkId5`);
                    const bd = bkDetail.recordset[0];
                    if (bd?.contact_email) {
                      const ed = bookingStatusEmail({ bookingNumber: bd.booking_number, status: bd.status,
                        customerName: bd.customer_name || '', vesselName: bd.vessel_name, voyageNumber: bd.voyage_number,
                        containerCount: bd.container_count || 0, receivedCount: bd.received_count || 0,
                        releasedCount: bd.released_count || 0, containerNumber: container_number, eventType: 'container_received' });
                      await sendEmail({ to: bd.contact_email, ...ed });
                    }
                  }
                }
              } catch (emailErr) { console.error('⚠️ Gate-In booking email error:', emailErr); }
            }
          }
        } else if (transaction_type === 'gate_out') {
          // Find Booking by ref and update BookingContainers
          const bkResult = await db.request()
            .input('bkRef', sql.NVarChar, booking_ref)
            .input('bkYardId', sql.Int, yard_id)
            .query(`SELECT booking_id, container_count FROM Bookings WHERE booking_number = @bkRef AND yard_id = @bkYardId AND status != 'cancelled'`);

          if (bkResult.recordset.length > 0) {
            const bk = bkResult.recordset[0];
            const cResult = await db.request()
              .input('cId0', sql.Int, finalContainerId)
              .query('SELECT container_number FROM Containers WHERE container_id = @cId0');
            const finalContainerNumber = container_number || cResult.recordset[0]?.container_number || '';

            const linkResult = await db.request()
              .input('bkId0', sql.Int, bk.booking_id)
              .input('cId0', sql.Int, finalContainerId)
              .input('cNum0', sql.NVarChar, finalContainerNumber)
              .query(`
                SELECT TOP 1 id
                FROM BookingContainers
                WHERE booking_id = @bkId0
                  AND (container_id = @cId0 OR container_number = @cNum0)
              `);

            if (linkResult.recordset.length > 0) {
              await db.request()
                .input('linkId', sql.Int, linkResult.recordset[0].id)
                .input('cId', sql.Int, finalContainerId)
                .input('cNum', sql.NVarChar, finalContainerNumber)
                .query(`
                  UPDATE BookingContainers
                  SET container_id = @cId, container_number = @cNum,
                      status = 'released', gate_out_at = GETDATE()
                  WHERE id = @linkId
                `);
            } else {
              await db.request()
                .input('bkId', sql.Int, bk.booking_id)
                .input('cId', sql.Int, finalContainerId)
                .input('cNum', sql.NVarChar, finalContainerNumber)
                .query(`
                  INSERT INTO BookingContainers (booking_id, container_id, container_number, status, gate_out_at)
                  VALUES (@bkId, @cId, @cNum, 'released', GETDATE())
                `);
            }

            // Update released_count
            await db.request()
              .input('bkId2', sql.Int, bk.booking_id)
              .query(`
                UPDATE Bookings SET
                  released_count = (SELECT COUNT(*) FROM BookingContainers WHERE booking_id = @bkId2 AND status = 'released'),
                  received_count = (SELECT COUNT(*) FROM BookingContainers WHERE booking_id = @bkId2 AND status IN ('received', 'released'))
                WHERE booking_id = @bkId2
              `);

            // Auto-complete if all containers released
            const updBk = await db.request()
              .input('bkId3', sql.Int, bk.booking_id)
              .query(`SELECT released_count, container_count FROM Bookings WHERE booking_id = @bkId3`);
            const autoCompleted = updBk.recordset.length > 0 && updBk.recordset[0].released_count >= updBk.recordset[0].container_count;
            if (autoCompleted) {
              await db.request()
                .input('bkId4', sql.Int, bk.booking_id)
                .query(`UPDATE Bookings SET status = 'completed' WHERE booking_id = @bkId4 AND status != 'completed'`);
            }

            // Send email: container released / completed
            try {
              const { getEmailConfig, sendEmail, bookingStatusEmail } = await import('@/lib/emailService');
              const emailCfg = await getEmailConfig();
              if (emailCfg.enabled) {
                const nResult = await db.request().query(`SELECT setting_value FROM SystemSettings WHERE setting_key = 'email_notify_booking'`);
                if (nResult.recordset[0]?.setting_value === 'true') {
                  const bkDetail = await db.request().input('bkId5', sql.Int, bk.booking_id).query(`
                    SELECT b.*, c.customer_name, c.contact_email FROM Bookings b
                    LEFT JOIN Customers c ON b.customer_id = c.customer_id WHERE b.booking_id = @bkId5`);
                  const bd = bkDetail.recordset[0];
                  if (bd?.contact_email) {
                    const ed = bookingStatusEmail({ bookingNumber: bd.booking_number, status: bd.status,
                      customerName: bd.customer_name || '', vesselName: bd.vessel_name, voyageNumber: bd.voyage_number,
                      containerCount: bd.container_count || 0, receivedCount: bd.received_count || 0,
                      releasedCount: bd.released_count || 0, containerNumber: container_number,
                      eventType: autoCompleted ? 'completed' : 'container_released' });
                    await sendEmail({ to: bd.contact_email, ...ed });
                  }
                }
              }
            } catch (emailErr) { console.error('⚠️ Gate-Out booking email error:', emailErr); }
          }
        }
      } catch (bkErr) {
        console.error('⚠️ Booking auto-link failed:', bkErr);
        // Don't fail the gate transaction if booking linking fails
      }
    }

    // Audit log
    await logAudit({
      userId: user_id || null,
      yardId: yard_id,
      action: transaction_type,
      entityType: 'container',
      entityId: finalContainerId,
      details: {
        eir_number: eirNumber, container_number, transaction_type,
        driver_name, truck_plate,
        ...(assignedLocation ? { assigned_location: assignedLocation } : {}),
      },
    });

    // === Gate Email Notification with EIR PDF ===
    try {
      const { getEmailConfig, sendEmail, gateNotificationEmail } = await import('@/lib/emailService');
      const emailCfg = await getEmailConfig();
      if (emailCfg.enabled) {
        const nResult = await db.request().query(`
          SELECT setting_key, setting_value FROM SystemSettings
          WHERE setting_key IN ('email_notify_gate', 'email_notify_to')
        `);
        const ns: Record<string, string> = {};
        for (const nr of nResult.recordset) ns[nr.setting_key] = nr.setting_value;

        if (ns.email_notify_gate === 'true' && ns.email_notify_to) {
          // Get yard name
          const yardResult = await db.request()
            .input('yId', sql.Int, yard_id)
            .query(`SELECT yard_name, yard_code FROM Yards WHERE yard_id = @yId`);
          const yard = yardResult.recordset[0];

          // Get company info
          let company = null;
          try {
            const compResult = await db.request().query('SELECT TOP 1 company_name, address, phone, tax_id FROM CompanyProfile');
            company = compResult.recordset[0] || null;
          } catch { /* ignore */ }

          const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

          // Generate EIR PDF
          const { generateEIRPDF } = await import('@/lib/eirPdfGenerator');
          const pdfBuffer = generateEIRPDF({
            eir_number: eirNumber,
            transaction_type,
            container_number: container_number || '',
            size,
            type: containerType,
            shipping_line,
            is_laden,
            seal_number,
            driver_name,
            truck_plate,
            truck_company,
            booking_ref,
            yard_name: yard?.yard_name,
            yard_code: yard?.yard_code,
            zone_name: assignedLocation?.zone_name,
            bay: assignedLocation?.bay,
            row: assignedLocation?.row,
            tier: assignedLocation?.tier,
            processed_by: undefined,
            notes,
            date: now,
            company,
          });

          const emailData = gateNotificationEmail({
            type: transaction_type as 'gate_in' | 'gate_out',
            containerNumber: container_number || '',
            customerName: shipping_line || '-',
            yardName: yard?.yard_name || 'CYMS',
            dateTime: now,
            driverName: driver_name,
            truckPlate: truck_plate,
          });

          const toList = ns.email_notify_to.split(',').map(e => e.trim()).filter(Boolean);
          await sendEmail({
            to: toList,
            ...emailData,
            attachments: [{
              filename: `EIR_${eirNumber}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            }],
          });
        }
      }
    } catch (emailErr) {
      console.error('⚠️ Gate email notification error (non-blocking):', emailErr);
    }

    // === Auto-create Work Order for forklift driver ===
    if (transaction_type === 'gate_in') {
      try {
        if (assignedLocation) {
          // Auto-allocate succeeded → work order with destination
          await db.request()
            .input('woYardId', sql.Int, yard_id)
            .input('woOrderType', sql.NVarChar, 'move')
            .input('woContainerId', sql.Int, finalContainerId)
            .input('woToZoneId', sql.Int, assignedLocation.zone_id)
            .input('woToBay', sql.Int, assignedLocation.bay)
            .input('woToRow', sql.Int, assignedLocation.row)
            .input('woToTier', sql.Int, assignedLocation.tier)
            .input('woNotes', sql.NVarChar, `Gate-In → ย้ายตู้ ${container_number} ไปวางที่ Zone ${assignedLocation.zone_name} B${assignedLocation.bay}-R${assignedLocation.row}-T${assignedLocation.tier} (${assignedLocation.reason})${truck_plate ? ` | 🚛 ${truck_plate}` : ''}${driver_name ? ` | 👤 ${driver_name}` : ''}`)
            .input('woPriority', sql.Int, 3)
            .query(`
              INSERT INTO WorkOrders (yard_id, order_type, container_id,
                to_zone_id, to_bay, to_row, to_tier,
                priority, notes, status)
              VALUES (@woYardId, @woOrderType, @woContainerId,
                @woToZoneId, @woToBay, @woToRow, @woToTier,
                @woPriority, @woNotes, 'pending')
            `);
        } else {
          // Auto-allocate failed → work order without destination (driver picks position)
          await db.request()
            .input('woYardId', sql.Int, yard_id)
            .input('woOrderType', sql.NVarChar, 'move')
            .input('woContainerId', sql.Int, finalContainerId)
            .input('woNotes', sql.NVarChar, `Gate-In → รับตู้ ${container_number} (${size || '20'}'${containerType || 'GP'}) เข้าลาน — ⚠️ ไม่มีตำแหน่งอัตโนมัติ กรุณาเลือกตำแหน่งวางตู้${truck_plate ? ` | 🚛 ${truck_plate}` : ''}${driver_name ? ` | 👤 ${driver_name}` : ''}`)
            .input('woPriority', sql.Int, 2) // ด่วนกว่าปกติ เพราะต้องกำหนดตำแหน่งเอง
            .query(`
              INSERT INTO WorkOrders (yard_id, order_type, container_id,
                priority, notes, status)
              VALUES (@woYardId, @woOrderType, @woContainerId,
                @woPriority, @woNotes, 'pending')
            `);
        }
      } catch (woErr) {
        console.error('⚠️ Auto work order creation failed:', woErr);
        // Don't fail the gate-in if work order creation fails
      }
    }
    // Note: gate_out work order is created by the frontend (Phase 1 of 2-phase gate-out)

    return NextResponse.json({
      success: true,
      transaction: txResult.recordset[0],
      eir_number: eirNumber,
      container_id: finalContainerId,
      ...(assignedLocation ? { assigned_location: assignedLocation } : {}),
    });

  } catch (error: unknown) {
    console.error('❌ POST gate error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'หมายเลขตู้นี้มีอยู่ในระบบแล้ว' : 'ไม่สามารถบันทึก gate transaction ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

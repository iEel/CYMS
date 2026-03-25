import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail, bookingDailySummaryEmail, getEmailConfig } from '@/lib/emailService';

// GET — Trigger daily booking summary email (called by scheduler or manually)
export async function GET() {
  try {
    const emailConfig = await getEmailConfig();
    if (!emailConfig.enabled) {
      return NextResponse.json({ skipped: true, reason: 'Email disabled' });
    }

    const db = await getDb();

    // Check if booking summary is enabled
    const settingsResult = await db.request().query(`
      SELECT setting_key, setting_value FROM SystemSettings
      WHERE setting_key IN ('email_notify_booking_summary', 'email_booking_summary_to', 'email_notify_to')
    `);
    const s: Record<string, string> = {};
    for (const row of settingsResult.recordset) s[row.setting_key] = row.setting_value;

    if (s.email_notify_booking_summary !== 'true') {
      return NextResponse.json({ skipped: true, reason: 'Booking summary disabled' });
    }

    const recipients = s.email_booking_summary_to || s.email_notify_to || '';
    if (!recipients.trim()) {
      return NextResponse.json({ skipped: true, reason: 'No recipients configured' });
    }

    // Get yard name
    const yardResult = await db.request().query(`SELECT TOP 1 yard_name FROM Yards WHERE is_active = 1 ORDER BY yard_id`);
    const yardName = yardResult.recordset[0]?.yard_name || 'CYMS';

    // Today's date range (server timezone)
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    // Stats: total active bookings
    const activeResult = await db.request().query(`
      SELECT COUNT(*) AS cnt FROM Bookings WHERE status IN ('pending','confirmed')
    `);

    // Stats: new today
    const newResult = await db.request().query(`
      SELECT COUNT(*) AS cnt FROM Bookings WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // Stats: confirmed today
    const confirmedResult = await db.request().query(`
      SELECT COUNT(*) AS cnt FROM Bookings
      WHERE status = 'confirmed' AND CAST(updated_at AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // Stats: completed today
    const completedResult = await db.request().query(`
      SELECT COUNT(*) AS cnt FROM Bookings
      WHERE status = 'completed' AND CAST(updated_at AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // Stats: containers received today
    const receivedResult = await db.request().query(`
      SELECT COUNT(*) AS cnt FROM BookingContainers
      WHERE status = 'received' AND CAST(gate_in_at AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // Stats: containers released today
    const releasedResult = await db.request().query(`
      SELECT COUNT(*) AS cnt FROM BookingContainers
      WHERE status = 'released' AND CAST(gate_out_at AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // Recent bookings with changes today
    const recentResult = await db.request().query(`
      SELECT TOP 10 b.booking_number, b.status, c.customer_name,
        b.container_count, b.received_count
      FROM Bookings b
      LEFT JOIN Customers c ON b.customer_id = c.customer_id
      WHERE CAST(b.updated_at AS DATE) = CAST(GETDATE() AS DATE)
         OR CAST(b.created_at AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY b.updated_at DESC
    `);

    const emailData = bookingDailySummaryEmail({
      date: dateStr,
      yardName,
      stats: {
        totalActive: activeResult.recordset[0].cnt,
        newToday: newResult.recordset[0].cnt,
        confirmedToday: confirmedResult.recordset[0].cnt,
        completedToday: completedResult.recordset[0].cnt,
        containersReceived: receivedResult.recordset[0].cnt,
        containersReleased: releasedResult.recordset[0].cnt,
      },
      recentBookings: recentResult.recordset,
    });

    const toList = recipients.split(',').map((e: string) => e.trim()).filter(Boolean);
    const result = await sendEmail({ to: toList, ...emailData });

    // Update last sent timestamp
    await db.request().query(`
      IF EXISTS (SELECT 1 FROM SystemSettings WHERE setting_key = 'email_booking_summary_last_sent')
        UPDATE SystemSettings SET setting_value = CONVERT(NVARCHAR, GETDATE(), 120), updated_at = GETDATE() WHERE setting_key = 'email_booking_summary_last_sent'
      ELSE
        INSERT INTO SystemSettings (setting_key, setting_value) VALUES ('email_booking_summary_last_sent', CONVERT(NVARCHAR, GETDATE(), 120))
    `);

    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      recipients: toList.length,
      stats: {
        totalActive: activeResult.recordset[0].cnt,
        newToday: newResult.recordset[0].cnt,
        completedToday: completedResult.recordset[0].cnt,
      },
    });
  } catch (error) {
    console.error('❌ Booking summary email error:', error);
    return NextResponse.json({ error: 'Failed to send booking summary' }, { status: 500 });
  }
}

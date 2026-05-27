import { getDb } from '@/lib/db';
import { sendEmail, bookingDailySummaryEmail, getEmailConfig } from '@/lib/emailService';

interface DbRequest {
  query(statement: string): Promise<{ recordset: any[] }>;
}

interface DbPool {
  request(): DbRequest;
}

export interface BookingSummaryJobResult {
  skipped?: boolean;
  reason?: string;
  success?: boolean;
  error?: string;
  provider?: string;
  recipients?: number;
  stats?: {
    totalActive: number;
    newToday: number;
    completedToday: number;
  };
}

export async function runBookingSummaryJob(dbPool?: DbPool): Promise<BookingSummaryJobResult> {
  const emailConfig = await getEmailConfig();
  if (!emailConfig.enabled) {
    return { skipped: true, reason: 'Email disabled' };
  }

  const db = dbPool || await getDb();

  const settingsResult = await db.request().query(`
    SELECT setting_key, setting_value FROM SystemSettings
    WHERE setting_key IN ('email_notify_booking_summary', 'email_booking_summary_to', 'email_notify_to')
  `);
  const s: Record<string, string> = {};
  for (const row of settingsResult.recordset) s[row.setting_key] = row.setting_value;

  if (s.email_notify_booking_summary !== 'true') {
    return { skipped: true, reason: 'Booking summary disabled' };
  }

  const recipients = s.email_booking_summary_to || s.email_notify_to || '';
  if (!recipients.trim()) {
    return { skipped: true, reason: 'No recipients configured' };
  }

  const yardResult = await db.request().query(`SELECT TOP 1 yard_name FROM Yards WHERE is_active = 1 ORDER BY yard_id`);
  const yardName = yardResult.recordset[0]?.yard_name || 'CYMS';

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const activeResult = await db.request().query(`
    SELECT COUNT(*) AS cnt FROM Bookings WHERE status IN ('pending','confirmed')
  `);

  const newResult = await db.request().query(`
    SELECT COUNT(*) AS cnt FROM Bookings WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
  `);

  const confirmedResult = await db.request().query(`
    SELECT COUNT(*) AS cnt FROM Bookings
    WHERE status = 'confirmed' AND CAST(updated_at AS DATE) = CAST(GETDATE() AS DATE)
  `);

  const completedResult = await db.request().query(`
    SELECT COUNT(*) AS cnt FROM Bookings
    WHERE status = 'completed' AND CAST(updated_at AS DATE) = CAST(GETDATE() AS DATE)
  `);

  const receivedResult = await db.request().query(`
    SELECT COUNT(*) AS cnt FROM BookingContainers
    WHERE status = 'received' AND CAST(gate_in_at AS DATE) = CAST(GETDATE() AS DATE)
  `);

  const releasedResult = await db.request().query(`
    SELECT COUNT(*) AS cnt FROM BookingContainers
    WHERE status = 'released' AND CAST(gate_out_at AS DATE) = CAST(GETDATE() AS DATE)
  `);

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

  await db.request().query(`
    IF EXISTS (SELECT 1 FROM SystemSettings WHERE setting_key = 'email_booking_summary_last_sent')
      UPDATE SystemSettings SET setting_value = CONVERT(NVARCHAR, GETDATE(), 120), updated_at = GETDATE() WHERE setting_key = 'email_booking_summary_last_sent'
    ELSE
      INSERT INTO SystemSettings (setting_key, setting_value) VALUES ('email_booking_summary_last_sent', CONVERT(NVARCHAR, GETDATE(), 120))
  `);

  return {
    success: result.success,
    provider: result.provider,
    recipients: toList.length,
    stats: {
      totalActive: activeResult.recordset[0].cnt,
      newToday: newResult.recordset[0].cnt,
      completedToday: completedResult.recordset[0].cnt,
    },
  };
}
